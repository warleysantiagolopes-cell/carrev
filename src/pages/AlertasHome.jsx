// src/pages/AlertasHome.jsx
import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";

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

export default function AlertasHome({
  onAbrirProximas,
  onAbrirCarro,
  limiteItens = 6,
}) {
  const [itens, setItens] = useState([]);

  async function carregar() {
    const revisoes = await db.services.toArray();
    const carrosDb = await db.cars.toArray();

    const carrosMap = {};
    carrosDb.forEach((c) => (carrosMap[c.id] = c));

    const lista = revisoes
      .filter((r) => r.nextDate || r.nextMileage != null)
      .map((r) => {
        const carro = carrosMap[r.carId];
        const carroNome = carro?.name || "Carro";
        const kmAtual = typeof carro?.currentMileage === "number" ? carro.currentMileage : null;

        const dias = r.nextDate ? diasAte(r.nextDate) : null;
        const kmRestante =
          r.nextMileage != null && kmAtual != null ? r.nextMileage - kmAtual : null;

        let status = "OK";
        if (dias != null) status = piorStatus(status, statusPorData(dias));
        if (kmRestante != null) status = piorStatus(status, statusPorKm(kmRestante));

        return { ...r, carroNome, kmAtual, diasAte: dias, kmRestante, status };
      });

    const rank = { VENCIDA: 0, "EM BREVE": 1, OK: 2 };
    lista.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];

      const aDias = a.diasAte ?? Infinity;
      const bDias = b.diasAte ?? Infinity;
      if (aDias !== bDias) return aDias - bDias;

      const aKm = a.kmRestante ?? Infinity;
      const bKm = b.kmRestante ?? Infinity;
      return aKm - bKm;
    });

    setItens(lista);
  }

  useEffect(() => {
    carregar();
  }, []);

  const resumo = useMemo(() => {
    const vencidas = itens.filter((i) => i.status === "VENCIDA").length;
    const emBreve = itens.filter((i) => i.status === "EM BREVE").length;
    const ok = itens.filter((i) => i.status === "OK").length;
    return { vencidas, emBreve, ok };
  }, [itens]);

  const temAlerta = resumo.vencidas > 0 || resumo.emBreve > 0;
  const topItens = useMemo(() => itens.slice(0, limiteItens), [itens, limiteItens]);

  // ===== Tema escuro (simples, inline) =====
  const painelStyle = {
    border: temAlerta ? "1px solid #3a2a00" : "1px solid #2a2a2a",
    background: temAlerta ? "#14120a" : "#111",
    color: "#eee",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  };

  const cardItemStyle = {
    border: "1px solid #2a2a2a",
    borderRadius: 10,
    padding: 10,
    background: "#0f0f0f",
    color: "#eee",
  };

  const labelCriticoStyle = {
    fontWeight: 800,
    color: temAlerta ? "#f5b301" : "#9ca3af",
  };

  const statusCor = (st) => {
    if (st === "VENCIDA") return "#ef4444";
    if (st === "EM BREVE") return "#f59e0b";
    return "#22c55e";
  };

  return (
    <div style={painelStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>
            {temAlerta ? "Atenção: revisões pendentes" : "Revisões em dia"}
          </div>
          <div style={{ fontSize: 13, marginTop: 4, color: "#cfcfcf" }}>
            <strong style={{ color: "#eee" }}>Vencidas:</strong> {resumo.vencidas} {" | "}
            <strong style={{ color: "#eee" }}>Em breve:</strong> {resumo.emBreve} {" | "}
            <strong style={{ color: "#eee" }}>OK:</strong> {resumo.ok}
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={carregar}>Atualizar</button>
          {onAbrirProximas ? <button onClick={onAbrirProximas}>Ver todas</button> : null}
        </div>
      </div>

      {itens.length === 0 ? (
        <p style={{ marginTop: 10, fontSize: 13, color: "#cfcfcf" }}>
          Nenhuma revisão futura cadastrada (adicione “Próxima data” ou “Próximo km” nas revisões).
        </p>
      ) : (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
            <span style={labelCriticoStyle}>Mais críticas:</span>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            {topItens.map((r) => (
              <div key={r.id} style={cardItemStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                  <div>
                    <strong>{r.carroNome}</strong> — {r.type}
                  </div>
                  <div style={{ fontWeight: 900, color: statusCor(r.status) }}>{r.status}</div>
                </div>

                <div style={{ fontSize: 13, marginTop: 6, color: "#cfcfcf" }}>
                  {r.nextDate ? <>Data: {r.nextDate} ({r.diasAte} dia(s))</> : <>Data: —</>}
                  {" | "}
                  {r.nextMileage != null ? <>Km alvo: {r.nextMileage}</> : <>Km alvo: —</>}
                  {" | "}
                  {r.kmAtual != null ? <>Km atual: {r.kmAtual}</> : <>Km atual: não informado</>}
                  {r.kmRestante != null ? <> | Faltam: {r.kmRestante} km</> : null}
                </div>

                {(onAbrirCarro || onAbrirProximas) ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {onAbrirCarro ? <button onClick={() => onAbrirCarro(r.carId)}>Abrir carro</button> : null}
                    {onAbrirProximas ? <button onClick={onAbrirProximas}>Abrir lista completa</button> : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
