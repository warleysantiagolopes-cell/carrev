import { useCallback, useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";
import { prazosDaGaragem } from "../services/planoRevisao";
import BotaoVoltar from "./BotaoVoltar";
import "./Revisoes.css";

const STATUS = [
  { valor: "TODAS", rotulo: "Todas", classe: "todas", titulo: "Próximas revisões" },
  { valor: "EM BREVE", rotulo: "Em breve", classe: "em-breve", titulo: "Revisões em breve" },
  { valor: "VENCIDA", rotulo: "Vencidas", classe: "vencida", titulo: "Revisões vencidas" },
];
const ordem = { VENCIDA: 0, "EM BREVE": 1, OK: 2 };
const formatoKm = new Intl.NumberFormat("pt-BR");

function ordenarPrazos(a, b) {
  return ordem[a.status] - ordem[b.status]
    || (a.diasAte ?? Infinity) - (b.diasAte ?? Infinity)
    || (a.kmRestante ?? Infinity) - (b.kmRestante ?? Infinity);
}

function Prazo({ revisao }) {
  const { status, type, carroNome, nextDate, nextMileage, diasAte, kmAtual, kmRestante } = revisao;
  const classe = STATUS.find(item => item.valor === status)?.classe ?? "programada";
  const dataFormatada = nextDate?.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
  const dias = diasAte != null ? Math.abs(diasAte) : 0;
  const tempo = diasAte < 0
    ? `${dias} ${dias === 1 ? "dia de atraso" : "dias de atraso"}`
    : diasAte === 0 ? "Hoje" : `Faltam ${dias} ${dias === 1 ? "dia" : "dias"}`;

  return (
    <li className={`revisoes-registro prazos-item ${classe}`}>
      <div className="revisoes-registro-topo">
        <div>
          <strong>{type || "Revisão"}</strong>
          <p>{carroNome}</p>
        </div>
        <span className="prazos-status">{status === "OK" ? "Programada" : status}</span>
      </div>
      <dl className="revisoes-resumo">
        {nextDate && <div>
          <dt>Próxima data</dt>
          <dd>{dataFormatada}</dd>
          {diasAte != null && <dd className="prazos-detalhe">{tempo}</dd>}
        </div>}
        {nextMileage != null && <div>
          <dt>Quilometragem-alvo</dt>
          <dd>{formatoKm.format(nextMileage)} km</dd>
          {kmRestante != null && <dd className="prazos-detalhe">
            {kmRestante < 0 ? `${formatoKm.format(-kmRestante)} km de atraso` : `Faltam ${formatoKm.format(kmRestante)} km`}
          </dd>}
        </div>}
        {kmAtual != null && <div>
          <dt>Quilometragem atual</dt>
          <dd>{formatoKm.format(kmAtual)} km</dd>
        </div>}
      </dl>
    </li>
  );
}

export default function Proximas({ carId = null, filtroStatusInicial = "TODAS", onBack = null }) {
  const db = useDb();
  const [carros, setCarros] = useState([]);
  const [prazos, setPrazos] = useState([]);
  const [filtroCarro, setFiltroCarro] = useState("todos");
  const [filtroStatus, setFiltroStatus] = useState(
    STATUS.some(item => item.valor === filtroStatusInicial) ? filtroStatusInicial : "TODAS",
  );
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const [carrosDb, revisoes] = await Promise.all([db.cars.toArray(), db.services.toArray()]);
      setCarros(carrosDb);
      setPrazos(prazosDaGaragem(carrosDb, revisoes).sort(ordenarPrazos));
    } catch {
      setErro("Não foi possível carregar as próximas revisões.");
    } finally {
      setCarregando(false);
    }
  }, [db]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const idVeiculo = carId == null ? filtroCarro : String(carId);
  const prazosDoVeiculo = useMemo(
    () => idVeiculo === "todos" ? prazos : prazos.filter(item => String(item.carId) === idVeiculo),
    [idVeiculo, prazos],
  );
  const itens = filtroStatus === "TODAS"
    ? prazosDoVeiculo
    : prazosDoVeiculo.filter(item => item.status === filtroStatus);
  const titulo = STATUS.find(item => item.valor === filtroStatus)?.titulo;

  return (
    <section className={`revisoes-tela prazos-tela${onBack ? " prazos-garagem" : ""}`}>
      <BotaoVoltar onClick={onBack} />
      <h2>{titulo}</h2>
      <div className="prazos-resumo" aria-label="Filtrar revisões por situação">
        {STATUS.map(({ valor, rotulo, classe }) => (
          <button key={valor} type="button" className={`revisoes-registro ${classe}`}
            aria-pressed={filtroStatus === valor} onClick={() => setFiltroStatus(valor)}>
            <strong>{valor === "TODAS" ? prazosDoVeiculo.length : prazosDoVeiculo.filter(item => item.status === valor).length}</strong>
            <span>{rotulo}</span>
          </button>
        ))}
      </div>
      <div className="revisoes-formulario prazos-filtros">
        {carId == null && <label>
          Veículo
          <select value={filtroCarro} onChange={e => setFiltroCarro(e.target.value)}>
            <option value="todos">Todos os veículos</option>
            {carros.map(carro => <option value={carro.id} key={carro.id}>{carro.name}</option>)}
          </select>
        </label>}
        <label>
          Situação
          <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)}>
            <option value="TODAS">Todos os status</option>
            {STATUS.slice(1).map(({ valor, rotulo }) => <option key={valor} value={valor}>{rotulo}</option>)}
          </select>
        </label>
        <button className="gr-add" type="button" onClick={carregar} disabled={carregando}>
          {carregando ? "Atualizando…" : "Atualizar"}
        </button>
      </div>
      {erro && <p role="alert">{erro}</p>}
      {itens.length ? (
        <ul className="revisoes-historico">
          {itens.map(revisao => <Prazo key={`${revisao.carId}:${revisao.id}`} revisao={revisao} />)}
        </ul>
      ) : !carregando && !erro && (
        <p className="revisoes-registro">Nenhuma revisão encontrada para este filtro.</p>
      )}
    </section>
  );
}
