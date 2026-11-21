import { useEffect, useRef, useState } from "react";
import { useDb } from "../db/db";
import Anexo from "./Anexo";
import SeletorAnexos from "./SeletorAnexos";
import "./Revisoes.css";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function novoItem() {
  return { part: "", price: "", date: new Date().toISOString().slice(0, 10), vendor: "", notes: "" };
}

function listarAnexos(db, id) {
  return db.attachments.where("[entityType+entityId]").equals(["purchase", Number(id)]).toArray();
}

function adicionarAnexos(db, id, arquivos) {
  const createdAt = new Date().toISOString();
  return db.attachments.bulkAdd(arquivos.map(blob => ({
    entityType: "purchase",
    entityId: Number(id),
    category: blob.type.startsWith("image/") ? "foto" : "arquivo",
    nomeArquivo: blob.name,
    blob,
    createdAt,
  })));
}

export default function Acabamentos({ carId, titulo = "Itens estéticos" }) {
  const db = useDb();
  const [lista, setLista] = useState([]);
  const [item, setItem] = useState(novoItem);
  const [editId, setEditId] = useState(null);
  const [arquivos, setArquivos] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [alvo, setAlvo] = useState(null);
  const [recarregar, setRecarregar] = useState(0);
  const dialogo = useRef(null);
  const campoPeca = useRef(null);

  useEffect(() => {
    let ativo = true;
    db.purchases.where("carId").equals(Number(carId)).toArray().then(itens => {
      if (ativo) setLista(itens.sort((a, b) => (b.date || "").localeCompare(a.date || "")));
    }).catch(() => {
      if (ativo) setErro("Não foi possível carregar os itens estéticos.");
    });
    return () => { ativo = false; };
  }, [db, carId, recarregar]);

  const total = lista.reduce((soma, registro) => soma + (registro.price ?? 0), 0);

  function atualizarCampo(evento) {
    const { name, value } = evento.target;
    setItem(atual => ({ ...atual, [name]: value }));
  }

  function limparFormulario() {
    setItem(novoItem());
    setEditId(null);
    setArquivos([]);
  }

  function editar(registro) {
    setErro("");
    setEditId(registro.id);
    setItem({
      part: registro.part,
      price: registro.price ?? "",
      date: registro.date ?? "",
      vendor: registro.vendor ?? "",
      notes: registro.notes ?? "",
    });
    setArquivos([]);
    campoPeca.current.focus();
  }

  async function salvar(evento) {
    evento.preventDefault();
    if (ocupado || !item.part.trim()) return;
    const price = item.price === "" ? null : Number(item.price);
    if (price != null && (!Number.isFinite(price) || price < 0)) return;
    const dados = {
      part: item.part.trim(),
      price,
      date: item.date || null,
      vendor: item.vendor.trim(),
      notes: item.notes.trim(),
    };

    setErro("");
    setOcupado(true);
    let idSalvo;
    try {
      if (editId == null) {
        idSalvo = await db.purchases.add({
          ...dados,
          carId: Number(carId),
          createdAt: new Date().toISOString(),
        });
      } else {
        if (!await db.purchases.update(editId, dados)) throw new Error("Item indisponível.");
        idSalvo = editId;
      }

      if (arquivos.length) await adicionarAnexos(db, idSalvo, arquivos);
      limparFormulario();
    } catch {
      setErro(idSalvo == null
        ? "Não foi possível salvar o item."
        : "Item salvo. Os anexos falharam. Toque em Salvar alterações para tentar novamente.");
      if (idSalvo != null) setEditId(idSalvo);
    } finally {
      if (idSalvo != null) setRecarregar(atual => atual + 1);
      setOcupado(false);
    }
  }

  function pedirConfirmacao(registro) {
    setAlvo(registro);
    dialogo.current.showModal();
  }

  async function excluir() {
    if (!alvo || ocupado) return;
    setErro("");
    setOcupado(true);
    try {
      const anexos = await listarAnexos(db, alvo.id);
      await db.purchases.delete(alvo.id);
      if (editId === alvo.id) limparFormulario();
      if (anexos.length) await db.attachments.bulkDelete(anexos.map(anexo => anexo.id));
    } catch {
      setErro("Não foi possível concluir a exclusão do item.");
    } finally {
      dialogo.current.close();
      setRecarregar(atual => atual + 1);
      setOcupado(false);
    }
  }

  return (
    <div className="revisoes-tela">
      <h2>{titulo}</h2>
      <form className="revisoes-formulario" onSubmit={salvar}>
        {editId != null && <strong>Editando item estético</strong>}
        <label>
          Peça ou item
          <input ref={campoPeca} name="part" value={item.part} onChange={atualizarCampo} required />
        </label>
        <div className="revisoes-par">
          <label>
            Valor (R$)
            <input name="price" type="number" inputMode="decimal" min="0" step="0.01"
              value={item.price} onChange={atualizarCampo} />
          </label>
          <label>
            Data
            <input name="date" type="date" value={item.date} onChange={atualizarCampo} />
          </label>
        </div>
        <label>
          Onde comprei
          <input name="vendor" value={item.vendor} onChange={atualizarCampo} />
        </label>
        <label>
          Observações
          <textarea name="notes" value={item.notes} onChange={atualizarCampo} />
        </label>
        <fieldset className="gr-attachment-picker">
          <legend>Anexos</legend>
          {editId != null && <AnexosDoItem id={editId} versao={recarregar} desabilitado={ocupado} />}
          <SeletorAnexos desabilitado={ocupado} onSelecionar={novos => setArquivos(atuais => [...atuais, ...novos])} />
          {arquivos.length > 0 && <ul className="revisoes-arquivos">
            {arquivos.map((arquivo, indice) => (
              <li key={indice}>
                {arquivo.name}{" "}
                <button type="button" disabled={ocupado}
                  onClick={() => setArquivos(atuais => atuais.filter((_, i) => i !== indice))}>
                  Remover
                </button>
              </li>
            ))}
          </ul>}
        </fieldset>
        <button type="submit" className="gr-add" disabled={ocupado}>
          {ocupado ? "Aguarde…" : editId == null ? "Adicionar item" : "Salvar alterações"}
        </button>
        {editId != null && <div className="revisoes-acoes">
          <button type="button" disabled={ocupado} onClick={() => { limparFormulario(); setErro(""); }}>Cancelar edição</button>
        </div>}
        {erro && <p role="alert">{erro}</p>}
      </form>

      <div className="revisoes-registro-topo revisoes-historico-titulo">
        <h3>Itens cadastrados</h3>
        <strong>Total gasto · {moeda.format(total)}</strong>
      </div>
      {lista.length === 0 && <p>Nenhum item estético cadastrado.</p>}
      <ul className="revisoes-historico">
        {lista.map(registro => (
          <li className="revisoes-registro" key={registro.id}>
            <div className="revisoes-registro-topo">
              <div>
                <strong>{registro.part}</strong>
                <p>{[registro.date?.split("-").reverse().join("/"), registro.vendor].filter(Boolean).join(" · ")}</p>
              </div>
              {registro.price != null && <strong>{moeda.format(registro.price)}</strong>}
            </div>
            {registro.notes && <p className="revisoes-observacao">{registro.notes}</p>}
            {editId !== registro.id && <AnexosDoItem id={registro.id} versao={recarregar} desabilitado={ocupado} />}
            <div className="revisoes-acoes">
              <button type="button" disabled={ocupado} onClick={() => editar(registro)}>Editar</button>
              <button type="button" className="revisoes-excluir" disabled={ocupado}
                onClick={() => pedirConfirmacao(registro)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>

      <dialog className="revisoes-registro revisoes-confirmacao" ref={dialogo}
        aria-labelledby="titulo-excluir-estetica" onClose={() => setAlvo(null)}
        onCancel={evento => { if (ocupado) evento.preventDefault(); }}>
        <h3 id="titulo-excluir-estetica">Excluir item estético?</h3>
        <p>Excluir <strong>{alvo?.part}</strong> e seus anexos?</p>
        <div className="revisoes-acoes">
          <button type="button" autoFocus disabled={ocupado} onClick={() => dialogo.current.close()}>Cancelar</button>
          <button type="button" className="revisoes-excluir" disabled={ocupado} onClick={excluir}>Excluir</button>
        </div>
      </dialog>
    </div>
  );
}

function AnexosDoItem({ id, versao, desabilitado }) {
  const db = useDb();
  const [anexos, setAnexos] = useState([]);
  const [erro, setErro] = useState("");
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    let ativo = true;
    listarAnexos(db, id).then(lista => {
      if (ativo) setAnexos(lista);
    }).catch(() => {
      if (ativo) setErro("Não foi possível carregar os anexos.");
    });
    return () => { ativo = false; };
  }, [db, id, versao]);

  async function remover(anexoId) {
    setRemovendo(true);
    setErro("");
    try {
      await db.attachments.delete(anexoId);
      setAnexos(atuais => atuais.filter(anexo => anexo.id !== anexoId));
    } catch {
      setErro("Não foi possível remover o anexo.");
    } finally {
      setRemovendo(false);
    }
  }

  return (
    <>
      {anexos.length > 0 && <div className="revisoes-anexos-lista">
        {anexos.map(anexo => <Anexo key={anexo.id} anexo={anexo} contexto="item estético"
          desabilitado={desabilitado || removendo} onRemover={() => remover(anexo.id)} />)}
      </div>}
      {erro && <p role="alert">{erro}</p>}
    </>
  );
}
