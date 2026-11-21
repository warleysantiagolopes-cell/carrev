import { useEffect, useState } from "react";
import { useDb } from "../db/db";
import { calcularPlano, itensDoPlano } from "../services/planoRevisao";

const vazio = { id: "", nome: "", kmAlvo: "" };
const formatarKm = km => Number(km).toLocaleString("pt-BR") + " km";

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
    const item = { id: form.id || crypto.randomUUID(), nome: form.nome.trim(), kmAlvo: Number(form.kmAlvo) };
    if (!item.nome || !Number.isSafeInteger(item.kmAlvo) || item.kmAlvo < 1) {
      setErro("Informe o serviço e uma quilometragem válida.");
      return;
    }
    alterarPlano(itens => {
      if (!form.id) return [...itens, item];
      if (!itens.some(outro => outro.id === item.id)) throw new Error("O item já foi retirado do plano.");
      return itens.map(outro => outro.id === item.id ? item : outro);
    });
  }

  const plano = calcularPlano(carro, historico);
  return (
    <section className="revisoes-tela">
      <h2>Plano de revisão</h2>
      <p>Informe a quilometragem do odômetro em que cada serviço deve ser feito.</p>
      <form className="revisoes-formulario" onSubmit={salvar}>
        <label>Serviço
          <input required maxLength={80} placeholder="Ex.: Trocar velas de ignição" value={form.nome}
            onChange={e => setForm({ ...form, nome: e.target.value })} />
        </label>
        <label>Quilometragem-alvo (km)
          <input required type="number" inputMode="numeric" min="1" step="1" placeholder="Ex.: 150000"
            value={form.kmAlvo} onChange={e => setForm({ ...form, kmAlvo: e.target.value })} />
        </label>
        <button className="gr-add" type="submit" disabled={salvando}>{form.id ? "Salvar alterações" : "Adicionar ao plano"}</button>
        {form.id && <button type="button" disabled={salvando} onClick={() => { setErro(""); setForm(vazio); }}>Cancelar</button>}
        {erro && <p role="alert">{erro}</p>}
      </form>
      <h3 className="revisoes-historico-titulo">Serviços programados</h3>
      {!plano.length && <p>Nenhum serviço cadastrado no plano.</p>}
      <ul className="revisoes-historico">
        {plano.map(item => {
          const id = item.id.slice("plano:".length);
          return <li className="revisoes-registro" key={item.id}>
            <div className="revisoes-registro-topo">
              <div>
                <strong>{item.nome}</strong>
                <p>{item.nextMileage != null ? formatarKm(item.nextMileage) : "Edite este item para definir a quilometragem-alvo."}</p>
              </div>
              <div className="revisoes-acoes">
                <button type="button" disabled={salvando} onClick={() => {
                  setErro("");
                  setForm({ id, nome: item.nome, kmAlvo: item.nextMileage ?? "" });
                }}>Editar</button>
                <button type="button" disabled={salvando} onClick={() => {
                  if (window.confirm(`Retirar “${item.nome}” do plano?`)) alterarPlano(itens => itens.filter(outro => outro.id !== id));
                }}>Retirar</button>
              </div>
            </div>
          </li>;
        })}
      </ul>
    </section>
  );
}
