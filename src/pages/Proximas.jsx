import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";

function diasAte(dataYYYYMMDD) {
  const [y, m, d] = String(dataYYYYMMDD).split("-").map(Number);
  if (!y || !m || !d) return null;

  const alvo = new Date(y, m - 1, d, 0, 0, 0, 0);
  const hoje = new Date();
  const base = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    0,
    0,
    0,
    0
  );

  const diffMs = alvo.getTime() - base.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function statusPorData(dias) {
  if (dias == null) return "OK";
  if (dias < 0) return "VENCIDA";
  if (dias <= 14) return "EM BREVE";
  return "OK";
}

function statusPorKm(kmRestante) {
  if (kmRestante == null) return "OK";
  if (kmRestante < 0) return "VENCIDA";
  if (kmRestante <= 500) return "EM BREVE";
  return "OK";
}

function piorStatus(a, b) {
  const rank = { VENCIDA: 3, "EM BREVE": 2, OK: 1 };
  return rank[a] >= rank[b] ? a : b;
}

/**
 * - Se você chamar <Proximas carId={id} />, ele filtra automaticamente.
 * - Se chamar <Proximas />, ele vira uma tela geral (com filtro).
 */
export default function Proximas({ carId = null }) {
  const [carros, setCarros] = useState([]);
  const [itens, setItens] = useState([]);
  const [filtroCarroId, setFiltroCarroId] = useState("todos");

  // Se veio carId (tela dentro do detalhe do carro), trava o filtro nesse carro.
  useEffect(() => {
    if (carId != null) {
      setFiltroCarroId(String(carId));
    } else {
      setFiltroCarroId("todos");
    }
  }, [carId]);

  async function carregar() {
    // serviços/revisões
    const revisoes = await db.services.toArray();
    const carrosDb = await db.cars.toArray();

    const carrosMap = {};
    carrosDb.forEach((c) => {
      carrosMap[c.id] = c;
    });

    // Aqui a lógica continua baseada em nextDate / nextMileage.
    // Se o seu Revisoes.jsx não estiver gravando esses campos, a lista ficará vazia.
    const lista = revisoes
      .filter((r) => r.nextDate || r.nextMileage != null)
      .map((r) => {
        const carro = carrosMap[r.carId];
        const carroNome = carro?.name || "Carro";
        const kmAtual =
          typeof carro?.currentMileage === "number" ? carro.currentMileage : null;

        const dias = r.nextDate ? diasAte(r.nextDate) : null;

        const kmRestante =
          r.nextMileage != null && kmAtual != null
            ? Number(r.nextMileage) - Number(kmAtual)
            : null;

        let status = "OK";
        status = piorStatus(status, statusPorData(dias));
        status = piorStatus(status, statusPorKm(kmRestante));

        return {
          ...r,
          carroNome,
          kmAtual,
          diasAte: dias,
          kmRestante,
          status,
        };
      });

    const filtrada =
      filtroCarroId === "todos"
        ? lista
        : lista.filter((x) => String(x.carId) === String(filtroCarroId));

    const rank = { VENCIDA: 0, "EM BREVE": 1, OK: 2 };

    filtrada.sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];

      const aDias = a.diasAte ?? Infinity;
      const bDias = b.diasAte ?? Infinity;
      if (aDias !== bDias) return aDias - bDias;

      const aKm = a.kmRestante ?? Infinity;
      const bKm = b.kmRestante ?? Infinity;
      return aKm - bKm;
    });

    setCarros(carrosDb);
    setItens(filtrada);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroCarroId]);

  const resumo = useMemo(() => {
    const vencidas = itens.filter((i) => i.status === "VENCIDA").length;
    const emBreve = itens.filter((i) => i.status === "EM BREVE").length;
    const ok = itens.filter((i) => i.status === "OK").length;
    return { vencidas, emBreve, ok };
  }, [itens]);

  const mostrarFiltro = carId == null; // só mostra dropdown quando for tela geral

  return (
    <div>
      <h3 style={{ marginTop: 0 }}>Próximas revisões</h3>

      <div style={{ marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div>
          <strong>Resumo:</strong> Vencidas: {resumo.vencidas} | Em breve:{" "}
          {resumo.emBreve} | OK: {resumo.ok}
        </div>

        {mostrarFiltro ? (
          <div>
            <label>
              Filtrar por carro:{" "}
              <select
                value={filtroCarroId}
                onChange={(e) => setFiltroCarroId(e.target.value)}
              >
                <option value="todos">Todos</option>
                {carros.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        <button onClick={carregar}>Atualizar</button>
      </div>

      {itens.length === 0 ? (
        <p>Nenhuma revisão futura cadastrada.</p>
      ) : (
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {itens.map((r) => (
            <li key={r.id} style={{ marginBottom: 14 }}>
              <div>
                <strong>{r.carroNome}</strong> — {r.type} —{" "}
                <strong>{r.status}</strong>
              </div>

              <div style={{ fontSize: 14 }}>
                {r.nextDate ? (
                  <>Data: {r.nextDate} ({r.diasAte} dia(s))</>
                ) : (
                  <>Data: —</>
                )}
                {" | "}
                {r.nextMileage != null ? <>Km alvo: {r.nextMileage}</> : <>Km alvo: —</>}
                {" | "}
                {r.kmAtual != null ? <>Km atual: {r.kmAtual}</> : <>Km atual: não informado</>}
                {r.kmRestante != null ? <> | Faltam: {r.kmRestante} km</> : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
