import { useEffect, useState } from "react";
import { useDb } from "../db/db";
import { calcularPlano, itensDoPlano } from "../services/planoRevisao";

const vazio = { id: "", nome: "", meses: "", km: "", dataBase: "", kmBase: "" };
const numero = valor => valor === "" || valor == null ? null : Number(valor);
const formatarKm = km => Number(km).toLocaleString("pt-BR") + " km";
const formatarData = data => data.split("-").reverse().join("/");

export default function PlanoRevisao({ carro }) {
  const db = useDb();
  const [form, setForm] = useState(vazio);
  const [historico, setHistorico] = useState([]);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    let ativo = true;
    db.services.where("carId").equals(carro.id).toArray()
      .then(lista => { if (ativo) setHistorico(lista); })
      .catch(() => { if (ativo) setErro("Não foi possível carregar o histórico."); });
    return () => { ativo = false; };
  }, [db, carro.id]);

  function campo(nome) {
    return { value: form[nome] ?? "", onChange: e => setForm(atual => ({ ...atual, [nome]: e.target.value })) };
  }

  async function alterarPlano(atualizar) {
    setSalvando(true);
    setErro("");
    try {
      const atual = await db.cars.get(carro.id);
      if (!atual || !await db.cars.update(carro.id, { planoRevisao: atualizar(itensDoPlano(atual)) })) {
        throw new Error("Não foi possível salvar o plano. Tente novamente.");
      }
      setForm(vazio);
    } catch (falha) {
      setErro(falha.message || "Não foi possível salvar o plano.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar(evento) {
    evento.preventDefault();
    if (salvando) return;
    const item = {
      id: form.id || crypto.randomUUID(),
      nome: form.nome.trim(),
      meses: numero(form.meses),
      km: numero(form.km),
      dataBase: form.dataBase || null,
      kmBase: numero(form.kmBase),
    };
    if (!item.nome || (item.meses == null && item.km == null) ||
      [item.meses, item.km].some(n => n != null && (!Number.isSafeInteger(n) || n < 1)) ||
      (item.kmBase != null && (!Number.isSafeInteger(item.kmBase) || item.kmBase < 0))) {
      setErro("Informe o nome do serviço e pelo menos um intervalo válido.");
      return;
    }
    alterarPlano(itens => {
      if (itens.some(outro => outro.id !== item.id && outro.nome.localeCompare(item.nome, "pt-BR", { sensitivity: "accent" }) === 0)) {
        throw new Error("Já há um item com esse nome no plano.");
      }
      if (!form.id) return [...itens, item];
      if (!itens.some(outro => outro.id === item.id)) throw new Error("O item já foi retirado do plano.");
      return itens.map(outro => outro.id === item.id ? {
        ...item,
        nomesAnteriores: [...new Set([...(outro.nomesAnteriores || []), outro.nome])].filter(nome => nome !== item.nome),
      } : outro);
    });
  }

  const plano = calcularPlano(carro, historico);
  return (
    <section className="revisoes-tela">
      <h2>Plano de revisão</h2>
      <p>Quando houver dois intervalos, vale o que chegar primeiro.</p>
      <form className="revisoes-formulario" onSubmit={salvar}>
        <label>Serviço<input required maxLength={80} list="revisoes-do-veiculo" placeholder="Ex.: Troca de óleo" {...campo("nome")} /></label>
        <datalist id="revisoes-do-veiculo">
          {[...new Set(historico.map(revisao => revisao.type).filter(Boolean))].map(tipo => <option value={tipo} key={tipo} />)}
        </datalist>
        <div className="revisoes-par">
          <label>Intervalo (meses)<input type="number" min="1" max="1200" step="1" {...campo("meses")} /></label>
          <label>Intervalo (km)<input type="number" min="1" step="1" {...campo("km")} /></label>
        </div>
        <p>Se o serviço já estiver no histórico, o CarRev usa esse registro. Você também pode informar quando ele foi feito.</p>
        <div className="revisoes-par">
          <label>Última data (opcional)<input type="date" {...campo("dataBase")} /></label>
          <label>Última quilometragem (opcional)<input type="number" min="0" step="1" {...campo("kmBase")} /></label>
        </div>
        <button className="gr-add" type="submit" disabled={salvando}>{form.id ? "Salvar alterações" : "Adicionar ao plano"}</button>
        {form.id && <button type="button" disabled={salvando} onClick={() => setForm(vazio)}>Cancelar</button>}
        {erro && <p role="alert">{erro}</p>}
      </form>
      <h3 className="revisoes-historico-titulo">Serviços programados</h3>
      {!plano.length && <p>Nenhum serviço cadastrado no plano.</p>}
      <ul className="revisoes-historico">
        {plano.map((item, indice) => {
          const original = itensDoPlano(carro)[indice];
          return <li className="revisoes-registro" key={item.id}>
            <div className="revisoes-registro-topo">
              <div>
                <strong>{item.nome}</strong>
                <p>A cada {[item.meses && `${item.meses} ${item.meses === 1 ? "mês" : "meses"}`, item.km && formatarKm(item.km)].filter(Boolean).join(" ou ")}</p>
              </div>
              <div className="revisoes-acoes">
                <button type="button" disabled={salvando} onClick={() => { setErro(""); setForm(original); }}>Editar</button>
                <button type="button" disabled={salvando} onClick={() => {
                  if (window.confirm(`Retirar “${item.nome}” do plano?`)) alterarPlano(itens => itens.filter(outro => outro.id !== original.id));
                }}>Retirar</button>
              </div>
            </div>
            <p>{[item.nextDate && formatarData(item.nextDate), item.nextMileage != null && formatarKm(item.nextMileage)].filter(Boolean).join(" ou ") || "Aguardando registro ou referência inicial."}</p>
            {item.meses && !item.nextDate && item.nextMileage != null && <p>Informe a última data para calcular o prazo em meses.</p>}
            {item.km && item.nextMileage == null && item.nextDate && <p>Informe a última quilometragem para calcular o prazo em km.</p>}
          </li>;
        })}
      </ul>
    </section>
  );
}
