import BotaoVoltar from "./BotaoVoltar";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useDb } from "../db/db";
import AbastecimentosCarro from "./AbastecimentosCarro";
import Revisoes from "./Revisoes";
import Documentos from "./Documentos";
import { atualizarFipeDoCarro } from "../services/fipe";

const Relatorio = lazy(() => import("./Relatorio"));

export function Icone({ nome, ...props }) {
  const paths = {
    carro: <><path d="m5 10 2-5h10l2 5M4 10h16v8H4zM7 18v2m10-2v2M7 14h2m6 0h2" /></>,
    casa: <><path d="m3 11 9-8 9 8M5 10v11h5v-6h4v6h5V10" /></>,
    bomba: <><path d="M4 21V3h10v18M3 21h12M6 6h6v5H6zM14 12h2a2 2 0 0 1 2 2v4a2 2 0 0 0 4 0V8l-4-4M20 6v5h2" /></>,
    chave: <><path d="M14 6a5 5 0 0 0-6 6L2 18a2.8 2.8 0 0 0 4 4l6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3Z" /></>,
    documento: <><path d="M5 2h9l5 5v15H5zM14 2v6h5M8 12h8M8 16h8M8 19h5" /></>,
    sino: <><path d="M5 10a7 7 0 0 1 14 0v6l2 3H3l2-3zM10 22h4M12 1v2" /></>,
    grafico: <><path d="M4 21V13h3v8M10 21V8h3v13M16 21V3h3v18" /></>,
    moedas: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v5c0 4 16 4 16 0V5M4 10v5c0 4 16 4 16 0v-5M4 15v4c0 4 16 4 16 0v-4" /></>,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    seta: <path d="m14 5-7 7 7 7" />,
    mais: <path d="M12 4v16M4 12h16" />,
    pontos: <><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></>,
  };
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[nome] || paths.carro}</svg>;
}

function FotoVeiculo({ carro }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!(carro.photo instanceof Blob)) { setUrl(null); return; }
    const next = URL.createObjectURL(carro.photo);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [carro.photo]);
  return url ? <img src={url} alt={carro.name} /> : <div className="gr-photo-empty"><Icone nome="carro"/><span>Adicionar foto na ficha</span></div>;
}

function Topo({ titulo, voltar }) {
  return <header className="gr-page-top"><BotaoVoltar onClick={voltar} /><h1>{titulo}</h1><span className="gr-mini-brand">CR</span></header>;
}

function Seletor({ tipo, carros, escolher, fechar }) {
  const box = useRef(null);
  useEffect(() => {
    const dialogo = box.current;
    dialogo.showModal();
    return () => dialogo.close();
  }, []);
  return <dialog ref={box} className="gr-dialog" onCancel={fechar} onClick={e => { if (e.target === e.currentTarget) fechar(); }} aria-labelledby="gr-picker-title">
    <div className="gr-dialog-head"><div><small>{tipo}</small><h2 id="gr-picker-title">Escolha o veículo</h2></div><button type="button" onClick={fechar} aria-label="Fechar">×</button></div>
    <div className="gr-picker-list">{carros.map(c => <button type="button" key={c.id} onClick={() => escolher(c)}><span className="gr-picker-photo"><FotoVeiculo carro={c}/></span><span><strong>{c.name}</strong><small>{[c.year,c.model].filter(Boolean).join(" • ") || "Ver registros"}</small></span><span className="gr-picker-arrow">→</span></button>)}</div>
  </dialog>;
}

function FipeVeiculo({ carro }) {
  const db = useDb();
  const [atual, setAtual] = useState(carro);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  async function atualizar() {
    setOcupado(true); setMensagem("");
    try {
      const r = await atualizarFipeDoCarro(atual, db);
      setAtual(await db.cars.get(carro.id));
      setMensagem(r?.atualizado ? "Valor atualizado." : "Não foi possível atualizar agora. Confira a configuração FIPE na edição do veículo.");
    } catch { setMensagem("Não foi possível consultar a FIPE. Verifique sua conexão e tente novamente."); }
    finally { setOcupado(false); }
  }
  return <section className="gr-info-panel"><h2>{atual.name}</h2><p>{atual.fipeBrand} {atual.fipeModel}</p><small>Valor de referência FIPE</small><strong className="gr-fipe-value">{atual.fipeValueFormatted || "Não configurado"}</strong><p>{atual.fipeReference || "Configure marca, modelo e ano na edição do veículo, em Meus veículos."}</p><p>Código FIPE: {atual.fipeCode || "—"}</p><button type="button" className="gr-add" onClick={atualizar} disabled={ocupado || !atual.fipeCode || !atual.fipeYearId}>{ocupado ? "Consultando…" : "Atualizar valor FIPE"}</button><p role="status">{mensagem}</p></section>;
}

export default function GaragemHome({
  carros, resumo, nomeGaragem, menuAberto, onMenu, destinoInicial, onVoltarInicio,
  onAdicionar, onAbrirCarro, onVeiculos, onAlertas,
}) {
  const db = useDb();
  const porVeiculo = ["Abastecimentos", "Manutenções", "Documentos", "Tabela FIPE"].includes(destinoInicial);
  const [selecionar, setSelecionar] = useState(porVeiculo && carros.length > 1 ? destinoInicial : null);
  const [pagina, setPagina] = useState(() => {
    if (destinoInicial === "Relatórios") return { tipo: destinoInicial };
    if (porVeiculo && carros.length <= 1) return { tipo: destinoInicial, carro: carros[0] };
    return null;
  });
  const [dados, setDados] = useState({ abastecimentos: [], services: [] });
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let ativo = true;
    Promise.all([db.abastecimentos.toArray(), db.services.toArray()])
      .then(([abastecimentos, services]) => { if (ativo) { setDados({ abastecimentos, services }); setErro(""); } })
      .catch(() => { if (ativo) setErro("Não foi possível carregar os totais. Reabra a garagem para tentar novamente."); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [db, pagina]);
  function escolher(tipo) {
    if (!carros.length) { onAdicionar(); return; }
    if (carros.length === 1) setPagina({ tipo, carro: carros[0] });
    else setSelecionar(tipo);
  }
  const pendentes = resumo.emBreve + resumo.vencidas;
  const contador = n => carregando ? "Carregando…" : erro ? "Ver registros" : `${n} registro${n === 1 ? "" : "s"}`;
  const voltar = () => { setPagina(null); onVoltarInicio(); };
  const fecharSeletor = () => { setSelecionar(null); onVoltarInicio(); };
  if (pagina) {
    return <div className="gr-feature-page"><Topo titulo={`${pagina.tipo}${pagina.carro ? ` · ${pagina.carro.name}` : ""}`} voltar={voltar}/>
      {pagina.tipo === "Abastecimentos" && pagina.carro && <AbastecimentosCarro carId={pagina.carro.id}/>}
      {pagina.tipo === "Manutenções" && pagina.carro && <Revisoes carId={pagina.carro.id}/>}
      {pagina.tipo === "Documentos" && pagina.carro && <Documentos carId={pagina.carro.id}/>}
      {pagina.tipo === "Tabela FIPE" && pagina.carro && <FipeVeiculo key={pagina.carro.id} carro={pagina.carro}/>}
      {!pagina.carro && pagina.tipo !== "Relatórios" && <section className="gr-info-panel">
        <p>Adicione um veículo para acessar esta seção.</p>
        <button type="button" className="gr-add" onClick={onAdicionar}>Adicionar veículo</button>
      </section>}
      {pagina.tipo === "Relatórios" && <Suspense fallback={<p role="status">Abrindo relatório…</p>}>
        <Relatorio nomeGaragem={nomeGaragem} carros={carros} resumo={resumo} dados={dados}
          erro={erro} carregando={carregando} />
      </Suspense>}
    </div>;
  }
  const atalhos = [
    {nome:"Abastecimentos",icone:"bomba",cor:"red",sub:contador(dados.abastecimentos.length),acao:() => escolher("Abastecimentos")},
    {nome:"Manutenções",icone:"chave",sub:contador(dados.services.length),acao:() => escolher("Manutenções")},
    {nome:"Documentos",icone:"documento",cor:"white",sub:"CRLV e IPVA",acao:() => escolher("Documentos")},
    {nome:"Alertas",icone:"sino",cor:pendentes > 0 ? "gr-alertas-pendentes" : undefined,sub:`${pendentes} pendente${pendentes === 1 ? "" : "s"}`,acao:() => onAlertas("TODAS")},
    {nome:"Relatórios",icone:"grafico",sub:"Resumo e PDF",acao:() => { setCarregando(true); setPagina({tipo:"Relatórios"}); }},
    {nome:"Tabela FIPE",icone:"moedas",sub:"Consultar valores",acao:() => escolher("Tabela FIPE")},
  ];
  return <div className="gr-home">
    <header className="gr-topbar"><button type="button" aria-label="Mais opções" aria-expanded={menuAberto} aria-controls={menuAberto ? "gr-menu" : undefined} onClick={onMenu}><Icone nome="menu"/></button><div className="gr-wordmark" aria-label="CarRev">Car<span>Rev</span></div><button type="button" aria-label={`Alertas: ${pendentes} pendentes`} onClick={() => onAlertas("TODAS")} className="gr-bell"><Icone nome="sino"/>{pendentes > 0 && <span className="gr-notification-dot"/>}</button></header>
    <div className="gr-stripes" aria-hidden="true"/>
    <main className="gr-main">
      <div className="gr-heading"><div><h1>{nomeGaragem}</h1><p>{carros.length} veículo{carros.length === 1 ? "" : "s"} cadastrado{carros.length === 1 ? "" : "s"}</p></div><button type="button" className="gr-text-button" onClick={onVeiculos}>Ver todos <span>→</span></button></div>
      <div className="gr-car-carousel" aria-label="Veículos da garagem">
        {carros.map(c => <article className="gr-vehicle" key={c.id}><button type="button" className="gr-vehicle-open" onClick={() => onAbrirCarro(c.id)}><div className="gr-vehicle-photo"><FotoVeiculo carro={c}/></div><div className="gr-vehicle-label"><h2>{c.name}</h2><p>{[c.year,c.model].filter(Boolean).join(" • ") || "Ver ficha do veículo"}</p></div></button><button type="button" className="gr-vehicle-menu" aria-label={`Opções de ${c.name}`} onClick={onVeiculos}><Icone nome="pontos"/></button></article>)}
        {!carros.length && <button type="button" className="gr-first-car" onClick={onAdicionar}><Icone nome="carro"/><strong>Sua história começa aqui</strong><span>Adicione seu primeiro veículo</span></button>}
      </div>
      <button type="button" className="gr-add" onClick={onAdicionar}><Icone nome="mais"/>Adicionar veículo</button>
      <div className="gr-shortcuts">{atalhos.map(a => <button type="button" className={`gr-shortcut ${a.cor || "gold"}`} key={a.nome} onClick={a.acao}><Icone nome={a.icone}/><strong>{a.nome}</strong><small>{a.sub}</small></button>)}</div>
      {erro && <p className="gr-inline-error" role="alert">{erro}</p>}
      <p className="gr-signature">SUA GARAGEM, SUA HISTÓRIA.</p>
    </main>
    {selecionar && <Seletor tipo={selecionar} carros={carros} fechar={fecharSeletor} escolher={c => {setPagina({tipo:selecionar,carro:c});setSelecionar(null);}}/>}
  </div>;
}
