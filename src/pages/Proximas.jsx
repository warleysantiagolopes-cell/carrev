import BotaoVoltar from "./BotaoVoltar";
// src/pages/Proximas.jsx

import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

import { calcularVencimento } from "../services/vencimentoRevisao";

function formatarData(data) {
  if (!data) return "—";

  const [ano, mes, dia] = String(data).split("-");

  if (!ano || !mes || !dia) {
    return data;
  }

  return `${dia}/${mes}/${ano}`;
}

function formatarKm(valor) {
  if (
    valor == null ||
    !Number.isFinite(Number(valor))
  ) {
    return "—";
  }

  return Number(valor).toLocaleString("pt-BR");
}

export default function Proximas({
  carId = null,
  filtroStatusInicial = "TODAS",
  onBack = null,
}) {
  const db = useDb();
  const [carros, setCarros] = useState([]);
  const [todosItens, setTodosItens] = useState([]);

  const [filtroCarroId, setFiltroCarroId] =
    useState("todos");

  const [filtroStatus, setFiltroStatus] =
    useState(
      filtroStatusInicial === "OK"
        ? "TODAS"
        : filtroStatusInicial || "TODAS"
    );

  const [carregando, setCarregando] =
    useState(false);

  useEffect(() => {
    if (carId != null) {
      setFiltroCarroId(String(carId));
    } else {
      setFiltroCarroId("todos");
    }
  }, [carId]);

  useEffect(() => {
    if (filtroStatusInicial === "OK") {
      setFiltroStatus("TODAS");
    } else {
      setFiltroStatus(
        filtroStatusInicial || "TODAS"
      );
    }
  }, [filtroStatusInicial]);

  async function carregar() {
    setCarregando(true);

    try {
      const revisoes =
        await db.services.toArray();

      const carrosDb =
        await db.cars.toArray();

      const carrosMap = {};

      carrosDb.forEach((c) => {
        carrosMap[c.id] = c;
      });

      const lista = revisoes
        .filter(
          (r) =>
            r.nextDate ||
            r.nextMileage != null
        )
        .map((r) => {
          const carro =
            carrosMap[r.carId];

          const carroNome =
            carro?.name || "Carro";

          const kmAtual =
            typeof carro?.currentMileage === "number"
              ? carro.currentMileage
              : null;

          const vencimento = calcularVencimento(r, kmAtual);

          return {
            ...r,
            carroNome,
            kmAtual,
            ...vencimento,
          };
        });

      const rank = {
        VENCIDA: 0,
        "EM BREVE": 1,
        OK: 2,
      };

      lista.sort((a, b) => {
        if (
          rank[a.status] !==
          rank[b.status]
        ) {
          return (
            rank[a.status] -
            rank[b.status]
          );
        }

        const aDias =
          a.diasAte ?? Infinity;

        const bDias =
          b.diasAte ?? Infinity;

        if (aDias !== bDias) {
          return aDias - bDias;
        }

        const aKm =
          a.kmRestante ?? Infinity;

        const bKm =
          b.kmRestante ?? Infinity;

        return aKm - bKm;
      });

      setCarros(carrosDb);
      setTodosItens(lista);

    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  /* ==================================================
     ITENS FILTRADOS
  ================================================== */

  const itens = useMemo(() => {
    let lista = [...todosItens];

    if (filtroCarroId !== "todos") {
      lista = lista.filter(
        (x) =>
          String(x.carId) ===
          String(filtroCarroId)
      );
    }

    if (filtroStatus !== "TODAS") {
      lista = lista.filter(
        (x) =>
          x.status === filtroStatus
      );
    }

    return lista;

  }, [
    todosItens,
    filtroCarroId,
    filtroStatus,
  ]);

  /* ==================================================
     RESUMO
  ================================================== */

  const resumoGeral = useMemo(() => {
    let base = [...todosItens];

    if (filtroCarroId !== "todos") {
      base = base.filter(
        (x) =>
          String(x.carId) ===
          String(filtroCarroId)
      );
    }

    return {
      total: base.length,

      vencidas: base.filter(
        (i) =>
          i.status === "VENCIDA"
      ).length,

      emBreve: base.filter(
        (i) =>
          i.status === "EM BREVE"
      ).length,
    };

  }, [
    todosItens,
    filtroCarroId,
  ]);

  const mostrarFiltroCarro =
    carId == null;

  /* ==================================================
     TÍTULO
  ================================================== */

  function tituloFiltro() {
    if (
      filtroStatus === "VENCIDA"
    ) {
      return "Revisões vencidas";
    }

    if (
      filtroStatus === "EM BREVE"
    ) {
      return "Revisões em breve";
    }

    return "Próximas revisões";
  }

  /* ==================================================
     COR
  ================================================== */

  function corStatus(status) {
    if (
      status === "VENCIDA"
    ) {
      return "#ef4444";
    }

    if (
      status === "EM BREVE"
    ) {
      return "#f59e0b";
    }

    return "#22c55e";
  }

  /* ==================================================
     TELA
  ================================================== */

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 980,
        margin: "0 auto",
        padding: 18,
        color: "#fff",
      }}
    >

      {/* ==================================================
          CABEÇALHO
      ================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >

        <div>

          {onBack ? (
            <div style={{ marginBottom: 14 }}><BotaoVoltar onClick={onBack} /></div>
          ) : null}

          <h2
            style={{
              margin: 0,
              fontSize: 28,
            }}
          >
            {tituloFiltro()}
          </h2>

          <div
            style={{
              marginTop: 5,
              fontSize: 13,
              color: "#8f99a8",
            }}
          >
            Acompanhe as próximas manutenções da sua garagem.
          </div>

        </div>

      </div>

      {/* ==================================================
          RESUMO
      ================================================== */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 18,
        }}
      >

        {/* TODAS */}

        <button
          type="button"
          onClick={() =>
            setFiltroStatus("TODAS")
          }
          style={{
            padding: 14,
            textAlign: "left",
            borderColor:
              filtroStatus === "TODAS"
                ? "#4d82ff"
                : undefined,
          }}
        >

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
            }}
          >
            {resumoGeral.total}
          </div>

          <div
            style={{
              color: "#9ba4b2",
              fontSize: 12,
            }}
          >
            Todas
          </div>

        </button>

        {/* EM BREVE */}

        <button
          type="button"
          onClick={() =>
            setFiltroStatus(
              "EM BREVE"
            )
          }
          style={{
            padding: 14,
            textAlign: "left",
            borderColor:
              filtroStatus ===
              "EM BREVE"
                ? "#f59e0b"
                : undefined,
          }}
        >

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#f59e0b",
            }}
          >
            {resumoGeral.emBreve}
          </div>

          <div
            style={{
              color: "#9ba4b2",
              fontSize: 12,
            }}
          >
            Em breve
          </div>

        </button>

        {/* VENCIDAS */}

        <button
          type="button"
          onClick={() =>
            setFiltroStatus(
              "VENCIDA"
            )
          }
          style={{
            padding: 14,
            textAlign: "left",
            borderColor:
              filtroStatus ===
              "VENCIDA"
                ? "#ef4444"
                : undefined,
          }}
        >

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#ef4444",
            }}
          >
            {resumoGeral.vencidas}
          </div>

          <div
            style={{
              color: "#9ba4b2",
              fontSize: 12,
            }}
          >
            Vencidas
          </div>

        </button>

      </div>

      {/* ==================================================
          FILTROS
      ================================================== */}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >

        {mostrarFiltroCarro ? (

          <select
            value={filtroCarroId}
            onChange={(e) =>
              setFiltroCarroId(
                e.target.value
              )
            }
          >

            <option value="todos">
              Todos os veículos
            </option>

            {carros.map((c) => (
              <option
                key={c.id}
                value={c.id}
              >
                {c.name}
              </option>
            ))}

          </select>

        ) : null}

        <select
          value={filtroStatus}
          onChange={(e) =>
            setFiltroStatus(
              e.target.value
            )
          }
        >

          <option value="TODAS">
            Todos os status
          </option>

          <option value="EM BREVE">
            Em breve
          </option>

          <option value="VENCIDA">
            Vencidas
          </option>

        </select>

        <button
          type="button"
          onClick={carregar}
          disabled={carregando}
        >
          {carregando
            ? "Atualizando..."
            : "Atualizar"}
        </button>

      </div>

      {/* ==================================================
          LISTA
      ================================================== */}

      {itens.length === 0 ? (

        <div
          style={{
            padding: 24,
            border:
              "1px solid #242c36",
            borderRadius: 16,
            background: "#0e131a",
            color: "#8f99a8",
          }}
        >
          Nenhuma revisão encontrada para este filtro.
        </div>

      ) : (

        <div
          style={{
            display: "grid",
            gap: 12,
          }}
        >

          {itens.map((r) => (

            <article
              key={r.id}
              style={{
                padding: 16,
                border:
                  "1px solid #242c36",

                borderLeft:
                  `3px solid ${corStatus(
                    r.status
                  )}`,

                borderRadius: 15,

                background:
                  "#0e131a",
              }}
            >

              {/* ==================================================
                  CABEÇALHO DO ITEM
              ================================================== */}

              <div
                style={{
                  display: "flex",
                  justifyContent:
                    "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >

                <div>

                  <strong
                    style={{
                      fontSize: 15,
                    }}
                  >
                    {r.carroNome}
                  </strong>

                  <div
                    style={{
                      marginTop: 3,
                      color: "#9ba4b2",
                      fontSize: 13,
                    }}
                  >
                    {r.type ||
                      "Revisão"}
                  </div>

                </div>

                <strong
                  style={{
                    color:
                      corStatus(
                        r.status
                      ),
                    fontSize: 12,
                  }}
                >

                  {r.status === "OK"
                    ? "PROGRAMADA"
                    : r.status}

                </strong>

              </div>

              {/* ==================================================
                  DADOS
              ================================================== */}

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "7px 16px",
                  marginTop: 13,
                  color: "#a3abb7",
                  fontSize: 12,
                }}
              >

                {r.nextDate ? (

                  <span>
                    📅{" "}
                    {formatarData(
                      r.nextDate
                    )}
                  </span>

                ) : null}

                {r.diasAte != null ? (

                  <span>

                    {r.diasAte < 0
                      ? `${Math.abs(
                          r.diasAte
                        )} dia(s) atrasada`

                      : r.diasAte === 0
                      ? "Hoje"

                      : `Faltam ${r.diasAte} dia(s)`}

                  </span>

                ) : null}

                {r.nextMileage != null ? (

                  <span>
                    ◎ Alvo:{" "}
                    {formatarKm(
                      r.nextMileage
                    )}{" "}
                    km
                  </span>

                ) : null}

                {r.kmAtual != null ? (

                  <span>
                    Atual:{" "}
                    {formatarKm(
                      r.kmAtual
                    )}{" "}
                    km
                  </span>

                ) : null}

                {r.kmRestante != null ? (

                  <span>

                    {r.kmRestante < 0
                      ? `${formatarKm(
                          Math.abs(
                            r.kmRestante
                          )
                        )} km vencidos`

                      : `Faltam ${formatarKm(
                          r.kmRestante
                        )} km`}

                  </span>

                ) : null}

              </div>

            </article>

          ))}

        </div>

      )}

    </div>
  );
}