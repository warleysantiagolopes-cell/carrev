import { createContext, useContext } from "react";
import { resultado, rpc, supabase } from "./supabase";

export const DbContext = createContext(null);
export const useDb = () => useContext(DbContext);

const tipos = ["cars", "abastecimentos", "services", "purchases", "wishlist", "attachments"];
const camposArquivo = ["photo", "crlvPdf", "blob"];
const tamanhoPagina = 500;

export function abrirBancoGaragem(garagemId) {
  const arquivos = supabase.storage.from("carrev-privado");
  const fotos = new Map();
  const eventos = new EventTarget();
  const pertence = caminho => typeof caminho === "string" && caminho.startsWith(garagemId + "/");

  async function apagarArquivos(caminhos) {
    const validos = [...new Set(caminhos.filter(pertence))];
    for (const caminho of validos) fotos.delete(caminho);
    if (!validos.length) return;
    try {
      await resultado(arquivos.remove(validos));
    } catch (erro) {
      console.warn("Não foi possível remover um arquivo privado sem registro.", erro);
    }
  }

  async function preparar(dados, enviados) {
    const novo = { ...dados };
    delete novo.id;
    for (const campo of camposArquivo) {
      if (!(novo[campo] instanceof Blob)) continue;
      const blob = novo[campo];
      const caminho = garagemId + "/" + crypto.randomUUID();
      await resultado(arquivos.upload(caminho, blob, {
        contentType: blob.type || "application/octet-stream",
      }));
      enviados.push(caminho);
      novo[campo] = { caminho };
    }
    return novo;
  }

  async function lerRegistro({ id, dados }, lista, exigirArquivos = false) {
    const registro = { ...dados, id };
    if (lista) delete registro.crlvPdf;

    await Promise.all(camposArquivo.map(async campo => {
      const caminho = registro[campo]?.caminho;
      if (!pertence(caminho)) {
        if (exigirArquivos && caminho) throw new Error("Arquivo fora da garagem ativa.");
        return;
      }
      let leitura = fotos.get(caminho);
      if (!leitura) {
        leitura = resultado(arquivos.download(caminho));
        // O cache retém apenas fotos da listagem. Documentos e anexos são lidos sob demanda.
        if (campo === "photo") {
          fotos.set(caminho, leitura);
          leitura.catch(() => fotos.delete(caminho));
        }
      }
      registro[campo] = await (exigirArquivos ? leitura : leitura.catch(() => null));
    }));
    return registro;
  }

  function tabela(tipo) {
    const consulta = (campos = "id,dados") => supabase.from("carrev_registros").select(campos)
      .eq("garagem_id", garagemId).eq("tipo", tipo);

    async function listar(filtros = [], pais = null) {
      const registros = [];
      for (let inicio = 0; ; inicio += tamanhoPagina) {
        let query = pais ? consulta("id,dados,pai_id").in("pai_id", pais) : consulta();
        for (const [campo, valor] of filtros) query = query.eq("dados->>" + campo, String(valor));
        const pagina = await resultado(query.order("id").range(inicio, inicio + tamanhoPagina - 1));
        registros.push(...await Promise.all(pagina.map(async registro => {
          const dados = await lerRegistro(registro, true, Boolean(pais));
          return pais ? { ...dados, paiId: registro.pai_id } : dados;
        })));
        if (pagina.length < tamanhoPagina) return registros;
      }
    }

    async function inserir(registros) {
      if (!registros.length) return [];
      const enviados = [];
      try {
        const linhas = [];
        for (const dados of registros) {
          linhas.push({ garagem_id: garagemId, tipo, dados: await preparar(dados, enviados) });
        }
        const salvos = await resultado(supabase.from("carrev_registros").insert(linhas).select("id"));
        eventos.dispatchEvent(new Event(tipo));
        return salvos.map(({ id }) => id);
      } catch (erro) {
        await apagarArquivos(enviados);
        throw erro;
      }
    }

    async function excluir(ids) {
      if (!ids.length) return;
      const excluidos = await rpc("excluir_registros", { p_garagem: garagemId, p_tipo: tipo, p_ids: ids });
      eventos.dispatchEvent(new Event(tipo));
      await apagarArquivos(excluidos.flatMap(registro => camposArquivo.map(campo => registro[campo]?.caminho)));
    }

    const api = {
      toArray: () => listar(),
      where(campo) {
        const campos = campo.startsWith("[") ? campo.slice(1, -1).split("+") : [campo];
        return {
          equals(valor) {
            const valores = Array.isArray(valor) ? valor : [valor];
            return { toArray: () => listar(campos.map((chave, i) => [chave, valores[i]])) };
          },
        };
      },
      async get(id, { exigirArquivos = false } = {}) {
        const registro = await resultado(consulta().eq("id", id).maybeSingle());
        return registro ? lerRegistro(registro, false, exigirArquivos) : undefined;
      },
      async add(dados) {
        const [id] = await inserir([dados]);
        return id;
      },
      bulkAdd: inserir,
      delete: id => excluir([id]),
      bulkDelete: excluir,
      async update(id, alteracoes) {
        const enviados = [];
        let anteriores;
        let dados;
        try {
          dados = await preparar(alteracoes, enviados);
          anteriores = await rpc("atualizar_registro", {
            p_garagem: garagemId, p_tipo: tipo, p_id: id, p_dados: dados,
          });
        } catch (erro) {
          await apagarArquivos(enviados);
          throw erro;
        }
        if (anteriores === null) {
          await apagarArquivos(enviados);
          return 0;
        }
        eventos.dispatchEvent(new Event(tipo));
        await apagarArquivos(camposArquivo
          .filter(campo => campo in dados && dados[campo]?.caminho !== anteriores[campo]?.caminho)
          .map(campo => anteriores[campo]?.caminho));
        return 1;
      },
      observar(id, { next, error }) {
        let ativo = true;
        let versao = 0;
        const carregar = async () => {
          const atual = ++versao;
          try {
            const registro = await api.get(id);
            if (ativo && atual === versao) next(registro);
          } catch (erro) {
            if (ativo && atual === versao) error(erro);
          }
        };
        eventos.addEventListener(tipo, carregar);
        carregar();
        return () => {
          ativo = false;
          eventos.removeEventListener(tipo, carregar);
        };
      },
    };
    if (tipo === "attachments") {
      api.porRegistros = async ids => {
        const anexos = new Map();
        for (let i = 0; i < ids.length; i += 50) {
          const lote = await listar([], ids.slice(i, i + 50));
          for (const anexo of lote) {
            if (!anexos.has(anexo.paiId)) anexos.set(anexo.paiId, []);
            anexos.get(anexo.paiId).push(anexo);
          }
        }
        return anexos;
      };
    }
    return api;
  }

  return Object.fromEntries(tipos.map(tipo => [tipo, tabela(tipo)]));
}
