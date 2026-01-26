// src/pages/Cars.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";
import CarroDetalhe from "./CarroDetalhe";
import AbastecimentosCarro from "./AbastecimentosCarro";
import AlertasHome from "./AlertasHome";

const COMBUSTIVEIS = [
  "",
  "Gasolina",
  "Etanol",
  "Flex",
  "Diesel",
  "GNV",
  "Elétrico",
  "Híbrido",
];

// ===== Helpers para status de revisão futura =====
function diasAte(dataYYYYMMDD) {
  const [y, m, d] = String(dataYYYYMMDD).split("-").map(Number);
  const alvo = new Date(y, m - 1, d, 0, 0, 0, 0);
  const hoje = new Date();
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0);
  const diffMs = alvo.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function statusPorData(dias) {
  if (dias < 0) return "VENCIDA";
  if (dias <= 14) return "EM BREVE";
  return "OK";
}

function statusPorKm(kmRestante) {
  if (kmRestante < 0) return "VENCIDA";
  if (kmRestante <= 500) return "EM BREVE";
  return "OK";
}

function piorStatus(a, b) {
  const rank = { VENCIDA: 3, "EM BREVE": 2, OK: 1 };
  return rank[a] >= rank[b] ? a : b;
}

// Retorna o “pior” status do carro olhando todas as revisões futuras dele
async function calcularBadgeDoCarro(carId, kmAtual) {
  if (!db.services) {
    return { total: 0, vencidas: 0, emBreve: 0, ok: 0, status: "OK" };
  }

  const revisoes = await db.services.where("carId").equals(Number(carId)).toArray();
  const futuras = revisoes.filter((r) => r.nextDate || r.nextMileage != null);

  let vencidas = 0;
  let emBreve = 0;
  let ok = 0;
  let statusFinal = "OK";

  for (const r of futuras) {
    const dias = r.nextDate ? diasAte(r.nextDate) : null;
    const kmRestante =
      r.nextMileage != null && typeof kmAtual === "number" ? r.nextMileage - kmAtual : null;

    let st = "OK";
    if (dias != null) st = piorStatus(st, statusPorData(dias));
    if (kmRestante != null) st = piorStatus(st, statusPorKm(kmRestante));

    if (st === "VENCIDA") vencidas++;
    else if (st === "EM BREVE") emBreve++;
    else ok++;

    statusFinal = piorStatus(statusFinal, st);
  }

  return { total: futuras.length, vencidas, emBreve, ok, status: statusFinal };
}

export default function Cars({ onAbrirProximas }) {
  const [carros, setCarros] = useState([]);
  const [carroSelecionadoId, setCarroSelecionadoId] = useState(null);
  const [abastecerCarId, setAbastecerCarId] = useState(null);

  // mostrar/ocultar cadastro
  const [mostrarCadastro, setMostrarCadastro] = useState(false);

  // cadastro
  const [nome, setNome] = useState("");
  const [modelo, setModelo] = useState("");
  const [ano, setAno] = useState("");
  const [placa, setPlaca] = useState("");
  const [combustivel, setCombustivel] = useState("");
  const [oleo, setOleo] = useState("");
  const [pneu, setPneu] = useState("");
  const [lampadas, setLampadas] = useState("");

  // edição completa
  const [editId, setEditId] = useState(null);
  const [editNome, setEditNome] = useState("");
  const [editModelo, setEditModelo] = useState("");
  const [editAno, setEditAno] = useState("");
  const [editPlaca, setEditPlaca] = useState("");
  const [editCombustivel, setEditCombustivel] = useState("");
  const [editOleo, setEditOleo] = useState("");
  const [editPneu, setEditPneu] = useState("");
  const [editLampadas, setEditLampadas] = useState("");

  // atualização rápida de km
  const [kmId, setKmId] = useState(null);
  const [kmValor, setKmValor] = useState("");

  async function carregarCarros() {
    const todos = await db.cars.toArray();
    todos.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "pt-BR"));
    setCarros(todos);
  }

  useEffect(() => {
    carregarCarros();
  }, []);

  const qtdCarros = useMemo(() => carros.length, [carros]);

  function limparCadastro() {
    setNome("");
    setModelo("");
    setAno("");
    setPlaca("");
    setCombustivel("");
    setOleo("");
    setPneu("");
    setLampadas("");
  }

  function abrirCadastro() {
    cancelarEdicao();
    cancelarKm();
    setMostrarCadastro(true);
  }

  function cancelarCadastro() {
    limparCadastro();
    setMostrarCadastro(false);
  }

  async function adicionarCarro(e) {
    e.preventDefault();
    if (!nome.trim()) return;

    await db.cars.add({
      name: nome.trim(),
      model: modelo.trim(),
      year: ano.trim(),
      plate: placa.trim(),
      fuel: combustivel || "",
      oil: oleo.trim(),
      tire: pneu.trim(),
      bulbs: lampadas.trim(),
      currentMileage: null,
      photo: null,
    });

    limparCadastro();
    setMostrarCadastro(false);
    carregarCarros();
  }

  async function excluirCarro(id) {
    await db.cars.delete(id);

    // revisões
    if (db.services) {
      const revisoes = await db.services.where("carId").equals(id).toArray();
      if (revisoes.length) await db.services.bulkDelete(revisoes.map((r) => r.id));
    }

    // compras/acabamentos
    if (db.purchases) {
      const compras = await db.purchases.where("carId").equals(id).toArray();
      if (compras.length) await db.purchases.bulkDelete(compras.map((x) => x.id));
    }

    // desejos
    if (db.wishlist) {
      const desejos = await db.wishlist.where("carId").equals(id).toArray();
      if (desejos.length) await db.wishlist.bulkDelete(desejos.map((x) => x.id));
    }

    // abastecimentos
    if (db.abastecimentos) {
      const abs = await db.abastecimentos.where("carId").equals(id).toArray();
      if (abs.length) await db.abastecimentos.bulkDelete(abs.map((a) => a.id));
    }

    carregarCarros();
  }

  // ===== edição completa =====
  function iniciarEdicao(carro) {
    cancelarKm();
    setMostrarCadastro(false);

    setEditId(carro.id);
    setEditNome(carro.name || "");
    setEditModelo(carro.model || "");
    setEditAno(String(carro.year || ""));
    setEditPlaca(carro.plate || "");
    setEditCombustivel(carro.fuel || "");
    setEditOleo(carro.oil || "");
    setEditPneu(carro.tire || "");
    setEditLampadas(carro.bulbs || "");
  }

  function cancelarEdicao() {
    setEditId(null);
    setEditNome("");
    setEditModelo("");
    setEditAno("");
    setEditPlaca("");
    setEditCombustivel("");
    setEditOleo("");
    setEditPneu("");
    setEditLampadas("");
  }

  async function salvarEdicao() {
    if (editId == null) return;
    const nomeFinal = editNome.trim();
    if (!nomeFinal) return;

    await db.cars.update(editId, {
      name: nomeFinal,
      model: editModelo.trim(),
      year: editAno.trim(),
      plate: editPlaca.trim(),
      fuel: editCombustivel || "",
      oil: editOleo.trim(),
      tire: editPneu.trim(),
      bulbs: editLampadas.trim(),
    });

    cancelarEdicao();
    await carregarCarros();
  }

  // ===== atualização rápida de km =====
  function iniciarKm(carro) {
    cancelarEdicao();
    setMostrarCadastro(false);

    setKmId(carro.id);
    setKmValor(typeof carro.currentMileage === "number" ? String(carro.currentMileage) : "");
  }

  function cancelarKm() {
    setKmId(null);
    setKmValor("");
  }

  async function salvarKm() {
    if (kmId == null) return;

    let kmFinal = null;
    if (kmValor.trim() !== "") {
      const n = Number(kmValor);
      if (!Number.isFinite(n) || n < 0) return;
      kmFinal = n;
    }

    await db.cars.update(kmId, { currentMileage: kmFinal });
    cancelarKm();
    await carregarCarros();
  }

  // ===== Navegação =====
  if (abastecerCarId != null) {
    return (
      <AbastecimentosCarro
        carId={abastecerCarId}
        aoVoltar={() => {
          setAbastecerCarId(null);
          carregarCarros();
        }}
      />
    );
  }

  if (carroSelecionadoId != null) {
    return (
      <CarroDetalhe carId={carroSelecionadoId} onBack={() => setCarroSelecionadoId(null)} />
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {/* Painel de alertas na HOME (dark) */}
      <AlertasHome
        onAbrirProximas={onAbrirProximas}
        onAbrirCarro={(id) => setCarroSelecionadoId(id)}
        limiteItens={6}
      />

      {/* Destaque */}
      <div
        style={{
          border: "1px solid #2a2a2a",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14,
          background: "#111",
          color: "#eee",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Carros cadastrados</div>
            <div style={{ fontSize: 13, marginTop: 4, color: "#cfcfcf" }}>
              Total: <strong style={{ color: "#eee" }}>{qtdCarros}</strong>
            </div>
          </div>

          {!mostrarCadastro ? (
            <button onClick={abrirCadastro} style={{ height: 36 }}>
              Adicionar carro
            </button>
          ) : null}
        </div>

        {mostrarCadastro ? (
          <form
            onSubmit={adicionarCarro}
            style={{ marginTop: 12, display: "grid", gap: 10, maxWidth: 760 }}
          >
            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label>
                Nome / Apelido
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="ex.: Jimny / Fusca"
                />
              </label>

              <label>
                Modelo
                <input
                  value={modelo}
                  onChange={(e) => setModelo(e.target.value)}
                  placeholder="ex.: Amarok Trendline 2.0"
                />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Ano
                <input value={ano} onChange={(e) => setAno(e.target.value)} placeholder="ex.: 2010" />
              </label>

              <label>
                Placa
                <input
                  value={placa}
                  onChange={(e) => setPlaca(e.target.value)}
                  placeholder="ex.: ABC1D23"
                />
              </label>

              <label>
                Combustível
                <select value={combustivel} onChange={(e) => setCombustivel(e.target.value)}>
                  {COMBUSTIVEIS.map((c) => (
                    <option key={c} value={c}>
                      {c || "Selecione"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Óleo
                <input value={oleo} onChange={(e) => setOleo(e.target.value)} placeholder="ex.: 5W30" />
              </label>

              <label>
                Pneu
                <input value={pneu} onChange={(e) => setPneu(e.target.value)} placeholder="ex.: 235/65 R17" />
              </label>

              <label>
                Lâmpadas
                <input value={lampadas} onChange={(e) => setLampadas(e.target.value)} placeholder="ex.: H7 / H4 / LED" />
              </label>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button type="submit">Salvar carro</button>
              <button type="button" onClick={cancelarCadastro}>
                Cancelar
              </button>
            </div>
          </form>
        ) : null}
      </div>

      {/* Lista */}
      <div style={{ display: "grid", gap: 12 }}>
        {carros.map((c) => (
          <CarCard
            key={c.id}
            carro={c}
            onAbrir={() => setCarroSelecionadoId(c.id)}
            onExcluir={() => excluirCarro(c.id)}
            onEditar={() => iniciarEdicao(c)}
            onAtualizarKm={() => iniciarKm(c)}
            onAbastecer={() => setAbastecerCarId(c.id)}
            // km
            emKm={kmId === c.id}
            kmValor={kmValor}
            setKmValor={setKmValor}
            onSalvarKm={salvarKm}
            onCancelarKm={cancelarKm}
            // edição
            emEdicao={editId === c.id}
            editNome={editNome}
            editModelo={editModelo}
            editAno={editAno}
            editPlaca={editPlaca}
            editCombustivel={editCombustivel}
            editOleo={editOleo}
            editPneu={editPneu}
            editLampadas={editLampadas}
            setEditNome={setEditNome}
            setEditModelo={setEditModelo}
            setEditAno={setEditAno}
            setEditPlaca={setEditPlaca}
            setEditCombustivel={setEditCombustivel}
            setEditOleo={setEditOleo}
            setEditPneu={setEditPneu}
            setEditLampadas={setEditLampadas}
            onSalvarEdicao={salvarEdicao}
            onCancelarEdicao={cancelarEdicao}
          />
        ))}
      </div>
    </div>
  );
}

function CarCard({
  carro,
  onAbrir,
  onExcluir,
  onEditar,
  onAtualizarKm,
  onAbastecer,

  emKm,
  kmValor,
  setKmValor,
  onSalvarKm,
  onCancelarKm,

  emEdicao,
  editNome,
  editModelo,
  editAno,
  editPlaca,
  editCombustivel,
  editOleo,
  editPneu,
  editLampadas,
  setEditNome,
  setEditModelo,
  setEditAno,
  setEditPlaca,
  setEditCombustivel,
  setEditOleo,
  setEditPneu,
  setEditLampadas,
  onSalvarEdicao,
  onCancelarEdicao,
}) {
  const [fotoUrl, setFotoUrl] = useState(null);
  const [consumoMedioKmL, setConsumoMedioKmL] = useState(null);

  // badge (revisões futuras)
  const [badge, setBadge] = useState({ total: 0, vencidas: 0, emBreve: 0, ok: 0, status: "OK" });

  useEffect(() => {
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    if (carro.photo) setFotoUrl(URL.createObjectURL(carro.photo));
    else setFotoUrl(null);

    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carro.photo]);

  // Consumo médio para exibir na HOME (entre tanques cheios)
  useEffect(() => {
    async function calcularConsumoMedio() {
      if (!db.abastecimentos) {
        setConsumoMedioKmL(null);
        return;
      }

      const lista = await db.abastecimentos.where("carId").equals(carro.id).toArray();
      const cheios = lista
        .filter((a) => a.tanqueCheio)
        .slice()
        .sort((a, b) => (a.km || 0) - (b.km || 0));

      let soma = 0;
      let qtd = 0;

      for (let i = 1; i < cheios.length; i++) {
        const dist = (cheios[i].km || 0) - (cheios[i - 1].km || 0);
        const litros = Number(cheios[i].litros);

        if (dist > 0 && Number.isFinite(litros) && litros > 0) {
          soma += dist / litros;
          qtd++;
        }
      }

      setConsumoMedioKmL(qtd ? soma / qtd : null);
    }

    calcularConsumoMedio();
  }, [carro.id]);

  // Badge por carro: revisões futuras (OK / EM BREVE / VENCIDA)
  useEffect(() => {
    async function carregarBadge() {
      const kmAtual = typeof carro.currentMileage === "number" ? carro.currentMileage : null;
      const b = await calcularBadgeDoCarro(carro.id, kmAtual);
      setBadge(b);
    }
    carregarBadge();
    // atualiza quando muda o km do carro (ou o id)
  }, [carro.id, carro.currentMileage]);

  const kmTxt =
    typeof carro.currentMileage === "number" ? `${carro.currentMileage} km` : "km não informado";

  const linha2 = [carro.model ? carro.model : null, carro.year ? `Ano ${carro.year}` : null, carro.plate ? `Placa ${carro.plate}` : null, carro.fuel ? carro.fuel : null]
    .filter(Boolean)
    .join(" • ");

  // ===== Badge UI (tema escuro) =====
  const temBadge = badge.total > 0;

  const badgeTxt =
    badge.status === "OK"
      ? `OK (${badge.total})`
      : badge.status === "EM BREVE"
      ? `EM BREVE (${badge.emBreve}/${badge.total})`
      : `VENCIDA (${badge.vencidas}/${badge.total})`;

  const badgeStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 900,
    border: "1px solid #2a2a2a",
    background: "#0f0f0f",
    color: "#eee",
    whiteSpace: "nowrap",
  };

  const dotStyle = {
    width: 8,
    height: 8,
    borderRadius: 999,
    background:
      badge.status === "VENCIDA"
        ? "#ef4444"
        : badge.status === "EM BREVE"
        ? "#f59e0b"
        : "#22c55e",
  };

  return (
    <div
      style={{
        border: "1px solid #2a2a2a",
        borderRadius: 12,
        padding: 12,
        display: "flex",
        gap: 12,
        alignItems: "center",
        background: "#111",
        color: "#eee",
      }}
    >
      {fotoUrl ? (
        <img
          src={fotoUrl}
          alt={`Foto do ${carro.name}`}
          style={{
            width: 78,
            height: 78,
            objectFit: "cover",
            borderRadius: 12,
            border: "1px solid #2a2a2a",
          }}
        />
      ) : (
        <div
          style={{
            width: 78,
            height: 78,
            borderRadius: 12,
            border: "1px dashed #3a3a3a",
            display: "grid",
            placeItems: "center",
            fontSize: 12,
            color: "#cfcfcf",
            background: "#0f0f0f",
          }}
        >
          Sem foto
        </div>
      )}

      <div style={{ flex: 1 }}>
        {!emEdicao && !emKm && (
          <>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
              <strong style={{ fontSize: 16 }}>{carro.name}</strong>
              <span style={{ fontSize: 13, color: "#cfcfcf" }}>{kmTxt}</span>

              {temBadge ? (
                <span style={badgeStyle} title="Status das próximas revisões deste carro">
                  <span style={dotStyle} />
                  {badgeTxt}
                </span>
              ) : null}
            </div>

            {linha2 ? <div style={{ fontSize: 13, marginTop: 4, color: "#cfcfcf" }}>{linha2}</div> : null}

            <div style={{ fontSize: 13, marginTop: 4, color: "#cfcfcf" }}>
              <b style={{ color: "#eee" }}>Consumo médio:</b>{" "}
              {consumoMedioKmL != null ? `${consumoMedioKmL.toFixed(2)} km/L` : "—"}
            </div>

            <div style={{ marginTop: 15, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={onAbrir}>Abrir</button>
              <button onClick={onAbastecer}>Abastecer</button>
              <button onClick={onAtualizarKm}>Atualizar km</button>
              <button onClick={onEditar}>Editar</button>
              <button onClick={onExcluir}>Excluir</button>
            </div>
          </>
        )}

        {emKm && (
          <div style={{ display: "grid", gap: 8, maxWidth: 420 }}>
            <strong>Atualizar quilometragem</strong>

            <label>
              Quilometragem atual (km)
              <input
                type="number"
                inputMode="numeric"
                value={kmValor}
                onChange={(e) => setKmValor(e.target.value)}
                placeholder="Deixe vazio para não informar"
                style={{ display: "block", width: "100%" }}
              />
            </label>

            <div>
              <button onClick={onSalvarKm} style={{ marginRight: 8 }}>
                Salvar
              </button>
              <button onClick={onCancelarKm}>Cancelar</button>
            </div>
          </div>
        )}

        {emEdicao && (
          <div style={{ display: "grid", gap: 10, maxWidth: 760 }}>
            <strong>Editar carro</strong>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
              <label>
                Nome / Apelido
                <input value={editNome} onChange={(e) => setEditNome(e.target.value)} />
              </label>

              <label>
                Modelo
                <input value={editModelo} onChange={(e) => setEditModelo(e.target.value)} />
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Ano
                <input value={editAno} onChange={(e) => setEditAno(e.target.value)} />
              </label>

              <label>
                Placa
                <input value={editPlaca} onChange={(e) => setEditPlaca(e.target.value)} />
              </label>

              <label>
                Combustível
                <select value={editCombustivel} onChange={(e) => setEditCombustivel(e.target.value)}>
                  {COMBUSTIVEIS.map((c) => (
                    <option key={c} value={c}>
                      {c || "Selecione"}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <label>
                Óleo
                <input value={editOleo} onChange={(e) => setEditOleo(e.target.value)} />
              </label>

              <label>
                Pneu
                <input value={editPneu} onChange={(e) => setEditPneu(e.target.value)} />
              </label>

              <label>
                Lâmpadas
                <input value={editLampadas} onChange={(e) => setEditLampadas(e.target.value)} />
              </label>
            </div>

            <div>
              <button onClick={onSalvarEdicao} style={{ marginRight: 8 }}>
                Salvar
              </button>
              <button onClick={onCancelarEdicao}>Cancelar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
