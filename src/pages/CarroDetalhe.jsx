import BotaoVoltar from "./BotaoVoltar";
import { useEffect, useRef, useState } from "react";
import { useDb } from "../db/db";
import { Icone } from "./GaragemHome";
import AbastecimentosCarro from "./AbastecimentosCarro";
import PlanoRevisao from "./PlanoRevisao";
import Proximas from "./Proximas";
import Revisoes from "./Revisoes";
import Acabamentos from "./Acabamentos";
import Desejos from "./Desejos";
import Documentos from "./Documentos";
import ImprimirFicha from "./ImprimirFicha";
import { tiposLampadas } from "./LampadasVeiculo";
import "./CarroDetalhe.css";

const abas = [
  { id: "geral", titulo: "Visão geral", icone: "carro" },
  { id: "revisoes", titulo: "Registrar revisão", icone: "chave" },
  { id: "historico", titulo: "Histórico de revisões", icone: "documento" },
  { id: "plano", titulo: "Plano de revisão", icone: "calendario" },
  { id: "proximas", titulo: "Próximas revisões", icone: "sino" },
  { id: "documentos", titulo: "Documentos", icone: "documento" },
  { id: "acabamentos", titulo: "Registrar item estético", icone: "brilho" },
  { id: "desejos", titulo: "Lista de desejos", icone: "coracao" },
];

const desenhos = {
  camera: "M3 7h4l2-3h6l2 3h4v13H3z M16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  velocimetro: "M4 19a9 9 0 1 1 16 0Z M12 16l4-5 M5 14h2m10 0h2M12 6v2",
  calendario: "M4 5h16v16H4z M4 10h16M8 3v4m8-4v4m-8 7h2m4 0h2m-8 3h2",
  placa: "M3 6h18v12H3z M7 10h10M7 14h10",
  gota: "M12 3c2 4 6 8 6 12a6 6 0 1 1-12 0c0-4 4-8 6-12z",
  pneu: "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z",
  lampada: "M9 18v-3a6 6 0 1 1 6 0v3z M10 22h4",
  brilho: "m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z",
  coracao: "M12 21 4 13a5 5 0 0 1 8-6 5 5 0 0 1 8 6z",
};

function IconeFicha({ nome }) {
  const desenho = desenhos[nome];
  if (!desenho) return <Icone nome={nome} />;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={desenho} />
    </svg>
  );
}

function numeroOuNulo(valor) {
  return valor != null && Number.isFinite(Number(valor)) ? Number(valor) : null;
}

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const percentual = new Intl.NumberFormat("pt-BR", {
  style: "percent", minimumFractionDigits: 2, maximumFractionDigits: 2, signDisplay: "exceptZero",
});

function Dados({ campos }) {
  return (
    <dl className="ficha-dados">
      {campos.map(([rotulo, valor, icone]) => (
        <div key={rotulo}>
          <dt>{icone && <IconeFicha nome={icone} />}{rotulo}</dt>
          <dd>{String(valor ?? "").trim() || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function ValorVeiculo({ carro }) {
  const pago = numeroOuNulo(carro.purchasePrice);
  const fipe = numeroOuNulo(carro.fipeValue);
  const diferenca = pago > 0 && fipe !== null ? fipe - pago : null;
  const modeloFipe = [ [carro.fipeBrand, carro.fipeModel].filter(Boolean).join(" "),
    carro.fipeModelYear, carro.fipeFuel ].filter(Boolean).join(" · ");

  return (
    <section className="ficha-painel">
      <h2><Icone nome="moedas" />Valor do veículo</h2>
      <Dados campos={[
        ["FIPE atual", carro.fipeValueFormatted || (fipe !== null ? moeda.format(fipe) : null)],
        ["Valor pago", pago !== null ? moeda.format(pago) : null],
        ["Diferença", diferenca !== null ? (diferenca > 0 ? "+" : "") + moeda.format(diferenca) : null],
        ["Variação", diferenca !== null ? percentual.format(diferenca / pago) : null],
      ]} />
      {carro.fipeCode || carro.fipeReference ? (
        <div className="ficha-fipe-meta">
          {carro.fipeModel && <p>{modeloFipe}</p>}
          {carro.fipeCode && <p>Código FIPE {carro.fipeCode}</p>}
          {carro.fipeReference && <p>Referência {carro.fipeReference}</p>}
        </div>
      ) : <p className="ficha-fipe-meta">Tabela FIPE ainda não configurada para este veículo.</p>}
    </section>
  );
}

export default function CarroDetalhe({ carId, onBack }) {
  const db = useDb();
  const [carro, setCarro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [fotoUrl, setFotoUrl] = useState("");
  const [salvandoFoto, setSalvandoFoto] = useState(false);
  const [aba, setAba] = useState("geral");
  const [abastecimentos, setAbastecimentos] = useState(false);
  const seletorFoto = useRef(null);
  const foto = carro?.photo;

  useEffect(() => {
    return db.cars.observar(Number(carId), {
      next(registro) {
        setCarro(registro ?? null);
        setCarregando(false);
      },
      error() {
        setErro("Não foi possível carregar o veículo.");
        setCarregando(false);
      },
    });
  }, [db, carId]);

  useEffect(() => {
    if (!(foto instanceof Blob)) {
      setFotoUrl("");
      return;
    }

    const url = URL.createObjectURL(foto);
    setFotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  async function salvarFoto(novaFoto) {
    setSalvandoFoto(true);
    setErro("");
    try {
      const atualizados = await db.cars.update(Number(carId), { photo: novaFoto });
      if (!atualizados) throw new Error("Veículo não encontrado");
    } catch {
      setErro("Não foi possível salvar a foto. Tente novamente.");
    } finally {
      setSalvandoFoto(false);
    }
  }

  if (abastecimentos) {
    return <AbastecimentosCarro carId={carId} aoVoltar={() => setAbastecimentos(false)} />;
  }

  const km = typeof carro?.currentMileage === "number"
    ? carro.currentMileage.toLocaleString("pt-BR") + " km"
    : null;

  return (
    <main className="ficha-carro">
      <header className="ficha-topo">
        <BotaoVoltar onClick={onBack} />
        <h1>{carro?.name || "Ficha do veículo"}</h1>
        <span className="gr-mini-brand" aria-hidden="true">CR</span>
      </header>

      {carregando && <p role="status">Carregando veículo…</p>}
      {erro && <p role="alert" className="ficha-erro">{erro}</p>}
      {!carregando && !carro && !erro && <p>Carro não encontrado.</p>}

      {carro && (
        <>
          <ImprimirFicha key={carro.id} carId={carro.id} nomeCarro={carro.name || "Veículo"} />
          <nav className="ficha-abas" aria-label="Seções do veículo">
            {abas.map(({ id, titulo, icone }) => (
              <button key={id} type="button" aria-pressed={aba === id} onClick={() => setAba(id)}>
                <IconeFicha nome={icone} />{titulo}
              </button>
            ))}
          </nav>

          {aba === "geral" && (
            <>
              <section className="ficha-apresentacao" aria-label="Foto e identificação do veículo">
                <div className="ficha-foto">
                  {fotoUrl ? (
                    <img src={fotoUrl} alt={`Foto do ${carro.name}`} />
                  ) : (
                    <div className="ficha-sem-foto"><Icone nome="carro" /><span>Sem foto</span></div>
                  )}
                </div>
                <div className="ficha-identificacao">
                  <div>
                    <h2>{carro.name}</h2>
                    <p>{[carro.model, carro.year].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="ficha-acoes-foto">
                    <input ref={seletorFoto} type="file" accept="image/*" hidden onChange={evento => {
                      const arquivo = evento.currentTarget.files?.[0];
                      evento.currentTarget.value = "";
                      if (arquivo) salvarFoto(arquivo);
                    }} />
                    <button type="button" disabled={salvandoFoto} onClick={() => seletorFoto.current?.click()}>
                      <IconeFicha nome="camera" />{foto ? "Alterar foto" : "Adicionar foto"}
                    </button>
                    {foto && <button type="button" disabled={salvandoFoto} onClick={() => salvarFoto(null)}>
                      Remover foto
                    </button>}
                  </div>
                </div>
              </section>

              <section className="ficha-painel">
                <h2><Icone nome="carro" />Dados do carro</h2>
                <Dados campos={[
                  ["Quilometragem", km, "velocimetro"],
                  ["Combustível", carro.fuel, "bomba"],
                  ["Modelo", carro.model, "carro"],
                  ["Ano", carro.year, "calendario"],
                  ["Placa", carro.plate, "placa"],
                  ["RENAVAM", carro.renavam, "documento"],
                  ["Chassi", carro.chassis, "documento"],
                  ["Adquirido em", String(carro.acquiredOn ?? "").slice(0, 4), "calendario"],
                ]} />
              </section>

              <div className="ficha-acoes">
                <button type="button" onClick={() => setAba("revisoes")}><Icone nome="chave" />Registrar revisão</button>
                <button type="button" onClick={() => setAbastecimentos(true)}><Icone nome="bomba" />Abrir abastecimentos</button>
              </div>

              <section className="ficha-painel">
                <h2><Icone nome="chave" />Itens de referência</h2>
                <Dados campos={[
                  ["Óleo de motor", carro.oil, "gota"],
                  ["Pneu", carro.tire, "pneu"],
                ]} />
                <details className="ficha-lampadas">
                  <summary><IconeFicha nome="lampada" />Lâmpadas</summary>
                  <Dados campos={tiposLampadas.map(([id, rotulo]) => [rotulo, carro.bulbsByPosition?.[id]])} />
                  {carro.bulbs && <Dados campos={[["Anotação anterior", carro.bulbs]]} />}
                </details>
              </section>

              <ValorVeiculo carro={carro} />
            </>
          )}

          {aba === "plano" && <PlanoRevisao key={carro.id} carro={carro} />}
          {aba === "proximas" && <Proximas carId={carId} />}
          {aba === "revisoes" && <Revisoes key="cadastro" modo="cadastro" carId={carId} />}
          {aba === "historico" && <Revisoes key="historico" modo="historico" carId={carId} />}
          {aba === "acabamentos" && <Acabamentos carId={carId} />}
          {aba === "desejos" && <Desejos carId={carId} />}
          {aba === "documentos" && <Documentos carId={carId} />}
        </>
      )}
    </main>
  );
}
