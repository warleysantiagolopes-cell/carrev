// src/pages/AlertasHome.jsx

import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

/* ==================================================
   HELPERS DE STATUS
================================================== */

function diasAte(dataYYYYMMDD) {
  const [y, m, d] = String(dataYYYYMMDD)
    .split("-")
    .map(Number);

  const alvo = new Date(
    y,
    m - 1,
    d,
    0,
    0,
    0,
    0
  );

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

  const diffMs =
    alvo.getTime() -
    base.getTime();

  return Math.round(
    diffMs /
      (1000 * 60 * 60 * 24)
  );
}

function statusPorData(dias) {
  if (dias < 0) {
    return "VENCIDA";
  }

  if (dias <= 14) {
    return "EM BREVE";
  }

  return "OK";
}

function statusPorKm(
  kmRestante
) {
  if (kmRestante < 0) {
    return "VENCIDA";
  }

  if (kmRestante <= 500) {
    return "EM BREVE";
  }

  return "OK";
}

function piorStatus(a, b) {
  const rank = {
    VENCIDA: 3,
    "EM BREVE": 2,
    OK: 1,
  };

  return rank[a] >= rank[b]
    ? a
    : b;
}

/* ==================================================
   COMPONENTE
================================================== */

export default function AlertasHome({
  onAbrirProximas,
}) {
  const db = useDb();
  const [itens, setItens] =
    useState([]);

  const [
    carregando,
    setCarregando,
  ] = useState(false);

  /* ==================================================
     CARREGAR REVISÕES
  ================================================== */

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

          const kmAtual =
            typeof carro?.currentMileage ===
            "number"
              ? carro.currentMileage
              : null;

          const dias =
            r.nextDate
              ? diasAte(
                  r.nextDate
                )
              : null;

          const kmRestante =
            r.nextMileage != null &&
            kmAtual != null
              ? r.nextMileage -
                kmAtual
              : null;

          let status = "OK";

          if (dias != null) {
            status =
              piorStatus(
                status,
                statusPorData(
                  dias
                )
              );
          }

          if (
            kmRestante != null
          ) {
            status =
              piorStatus(
                status,
                statusPorKm(
                  kmRestante
                )
              );
          }

          return {
            ...r,
            kmAtual,
            diasAte: dias,
            kmRestante,
            status,
          };
        });

      setItens(lista);

    } catch (erro) {
      console.error(
        "Erro ao carregar alertas:",
        erro
      );

    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  /* ==================================================
     RESUMO
  ================================================== */

  const resumo = useMemo(
    () => {
      const vencidas =
        itens.filter(
          (i) =>
            i.status ===
            "VENCIDA"
        ).length;

      const emBreve =
        itens.filter(
          (i) =>
            i.status ===
            "EM BREVE"
        ).length;

      const ok =
        itens.filter(
          (i) =>
            i.status ===
            "OK"
        ).length;

      return {
        vencidas,
        emBreve,
        ok,
      };
    },
    [itens]
  );

  const temVencida =
    resumo.vencidas > 0;

  const temEmBreve =
    resumo.emBreve > 0;

  /* ==================================================
     TEXTO DO ALERTA
  ================================================== */

  let painelClasse =
    "carrev-alert-panel ok";

  let icone = "✓";

  let titulo =
    "Tudo em dia";

  let descricao =
    "Nenhuma revisão exige atenção agora.";

  if (temVencida) {
    painelClasse =
      "carrev-alert-panel vencida";

    icone = "!";

    titulo =
      resumo.vencidas === 1
        ? "1 revisão vencida"
        : `${resumo.vencidas} revisões vencidas`;

    descricao =
      resumo.vencidas === 1
        ? "Há uma manutenção que precisa da sua atenção."
        : "Há manutenções que precisam da sua atenção.";

  } else if (temEmBreve) {
    painelClasse =
      "carrev-alert-panel breve";

    icone = "◷";

    titulo =
      resumo.emBreve === 1
        ? "1 revisão se aproximando"
        : `${resumo.emBreve} revisões se aproximando`;

    descricao =
      resumo.emBreve === 1
        ? "Há uma manutenção se aproximando."
        : "Algumas manutenções estão próximas.";
  }

  /* ==================================================
     NAVEGAÇÃO
  ================================================== */

  const podeAbrir =
    Boolean(
      onAbrirProximas
    );

  function abrirRevisoes() {
    if (!podeAbrir) {
      return;
    }

    onAbrirProximas();
  }

  function tecladoAbrir(
    e
  ) {
    if (!podeAbrir) {
      return;
    }

    if (
      e.key === "Enter" ||
      e.key === " "
    ) {
      e.preventDefault();

      abrirRevisoes();
    }
  }

  /* ==================================================
     TELA
  ================================================== */

  return (
    <section className="carrev-alertas-wrap">

      <div
        className={
          painelClasse
        }
        onClick={
          abrirRevisoes
        }
        onKeyDown={
          tecladoAbrir
        }
        role={
          podeAbrir
            ? "button"
            : undefined
        }
        tabIndex={
          podeAbrir
            ? 0
            : undefined
        }
        title={
          podeAbrir
            ? "Abrir revisões"
            : undefined
        }
        style={{
          cursor:
            podeAbrir
              ? "pointer"
              : "default",
        }}
      >

        {/* ==================================================
            AVISO
        ================================================== */}

        <div className="carrev-alert-main">

          <div className="carrev-alert-icon">
            {icone}
          </div>

          <div className="carrev-alert-text">

            <div className="carrev-alert-title">
              {titulo}
            </div>

            <div className="carrev-alert-description">
              {descricao}
            </div>

          </div>

        </div>

        {/* ==================================================
            AÇÃO
        ================================================== */}

        <div className="carrev-alert-actions">

          <button
            type="button"
            className="carrev-alert-refresh"
            disabled={
              carregando
            }
            onClick={(e) => {
              /*
                Impede que o clique
                em Atualizar também
                abra as revisões.
              */

              e.stopPropagation();

              carregar();
            }}
          >

            {carregando
              ? "Atualizando..."
              : "Atualizar"}

          </button>

          {podeAbrir ? (

            <span
              style={{
                color:
                  "#6f98ff",
                fontSize: 12,
                fontWeight: 700,
                whiteSpace:
                  "nowrap",
              }}
            >
              Ver revisões →
            </span>

          ) : null}

        </div>

      </div>

    </section>
  );
}