// src/pages/CarroDetalhe.jsx

import { useEffect, useState } from "react";
import { db } from "../db/db";

import Proximas from "./Proximas";
import Revisoes from "./Revisoes";
import Acabamentos from "./Acabamentos";
import Desejos from "./Desejos";
import Documentos from "./Documentos";

function textoOuTraco(v) {
  const t = String(v ?? "").trim();
  return t ? t : "—";
}

function formatarDinheiro(valor) {
  if (
    valor == null ||
    !Number.isFinite(Number(valor))
  ) {
    return "—";
  }

  return Number(valor).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatarPercentual(valor) {
  if (
    valor == null ||
    !Number.isFinite(Number(valor))
  ) {
    return "—";
  }

  return `${Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`;
}

export default function CarroDetalhe({
  carId,
  onBack,
}) {
  const [carro, setCarro] = useState(null);
  const [fotoUrl, setFotoUrl] = useState(null);
  const [aba, setAba] = useState("proximas");

  async function carregarCarro() {
    const c = await db.cars.get(Number(carId));

    setCarro(c || null);
  }

  useEffect(() => {
    carregarCarro();
  }, [carId]);

  useEffect(() => {
    if (fotoUrl) {
      URL.revokeObjectURL(fotoUrl);
    }

    if (carro?.photo) {
      setFotoUrl(
        URL.createObjectURL(carro.photo)
      );
    } else {
      setFotoUrl(null);
    }

    return () => {
      if (fotoUrl) {
        URL.revokeObjectURL(fotoUrl);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carro?.photo]);

  async function alterarFoto(file) {
    if (!file) return;

    await db.cars.update(Number(carId), {
      photo: file,
    });

    await carregarCarro();
  }

  async function removerFoto() {
    await db.cars.update(Number(carId), {
      photo: null,
    });

    await carregarCarro();
  }

  if (!carro) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={onBack}>
          Voltar
        </button>

        <p style={{ marginTop: 12 }}>
          Carro não encontrado.
        </p>
      </div>
    );
  }

  /* ==================================================
     QUILOMETRAGEM
  ================================================== */

  const kmTxt =
    typeof carro.currentMileage === "number"
      ? `${carro.currentMileage.toLocaleString(
          "pt-BR"
        )} km`
      : "—";

  /* ==================================================
     VALORES
  ================================================== */

  const valorPago =
    carro.purchasePrice != null &&
    Number.isFinite(
      Number(carro.purchasePrice)
    )
      ? Number(carro.purchasePrice)
      : null;

  const valorFipe =
    carro.fipeValue != null &&
    Number.isFinite(
      Number(carro.fipeValue)
    )
      ? Number(carro.fipeValue)
      : null;

  const temComparacao =
    valorPago != null &&
    valorPago > 0 &&
    valorFipe != null;

  const diferencaValor =
    temComparacao
      ? valorFipe - valorPago
      : null;

  const diferencaPercentual =
    temComparacao
      ? (
          (valorFipe - valorPago) /
          valorPago
        ) * 100
      : null;

  const valorizou =
    diferencaValor != null &&
    diferencaValor > 0;

  const desvalorizou =
    diferencaValor != null &&
    diferencaValor < 0;

  let corDiferenca =
    "#9ca3af";

  if (valorizou) {
    corDiferenca =
      "#22c55e";
  }

  if (desvalorizou) {
    corDiferenca =
      "#ef4444";
  }

  return (
    <div style={{ padding: 16 }}>

      <button onClick={onBack}>
        Voltar
      </button>

      <h2 style={{ marginTop: 12 }}>
        {carro.name}
      </h2>

      {/* ==================================================
          CARTÃO DE DADOS DO CARRO
      ================================================== */}

      <div
        style={{
          marginTop: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
          display: "flex",
          gap: 16,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >

        {/* ==================================================
            FOTO
        ================================================== */}

        <div>

          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={`Foto do ${carro.name}`}
              style={{
                width: 110,
                height: 110,
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid #ccc",
              }}
            />
          ) : (
            <div
              style={{
                width: 110,
                height: 110,
                borderRadius: 12,
                border: "1px dashed #aaa",
                display: "grid",
                placeItems: "center",
                fontSize: 12,
              }}
            >
              Sem foto
            </div>
          )}

          <div
            style={{
              marginTop: 8,
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >

            <label
              style={{
                display: "inline-block",
              }}
            >

              <span
                style={{
                  display: "inline-block",
                  padding: "6px 10px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  cursor: "pointer",
                  userSelect: "none",
                }}
              >
                Alterar foto
              </span>

              <input
                type="file"
                accept="image/*"
                style={{
                  display: "none",
                }}
                onChange={(e) => {
                  const f =
                    e.target.files?.[0];

                  if (f) {
                    alterarFoto(f);
                  }

                  e.target.value = "";
                }}
              />

            </label>

            {carro.photo ? (
              <button
                onClick={
                  removerFoto
                }
              >
                Remover foto
              </button>
            ) : null}

          </div>

        </div>

        {/* ==================================================
            DADOS PRINCIPAIS
        ================================================== */}

        <div
          style={{
            minWidth: 240,
          }}
        >

          <strong>
            Dados do carro
          </strong>

          <div
            style={{
              fontSize: 13,
              marginTop: 6,
              display: "grid",
              gap: 4,
            }}
          >

            <div>
              <b>Modelo:</b>{" "}
              {textoOuTraco(
                carro.model
              )}
            </div>

            <div>
              <b>Ano:</b>{" "}
              {textoOuTraco(
                carro.year
              )}
            </div>

            <div>
              <b>Placa:</b>{" "}
              {textoOuTraco(
                carro.plate
              )}
            </div>

            <div>
              <b>Chassi:</b>{" "}
              {textoOuTraco(
                carro.chassis
              )}
            </div>

            <div>
              <b>RENAVAM:</b>{" "}
              {textoOuTraco(
                carro.renavam
              )}
            </div>

            <div>
              <b>Combustível:</b>{" "}
              {textoOuTraco(
                carro.fuel
              )}
            </div>

            <div>
              <b>Quilometragem:</b>{" "}
              {kmTxt}
            </div>

          </div>

        </div>

        {/* ==================================================
            ITENS DE REFERÊNCIA
        ================================================== */}

        <div
          style={{
            minWidth: 240,
          }}
        >

          <strong>
            Itens de referência
          </strong>

          <div
            style={{
              fontSize: 13,
              marginTop: 6,
              display: "grid",
              gap: 4,
            }}
          >

            <div>
              <b>Óleo:</b>{" "}
              {textoOuTraco(
                carro.oil
              )}
            </div>

            <div>
              <b>Pneu:</b>{" "}
              {textoOuTraco(
                carro.tire
              )}
            </div>

            <div>
              <b>Lâmpadas:</b>{" "}
              {textoOuTraco(
                carro.bulbs
              )}
            </div>

          </div>

        </div>

      </div>

      {/* ==================================================
          VALOR DO VEÍCULO
      ================================================== */}

      <div
        style={{
          marginTop: 14,
          padding: 16,
          border:
            "1px solid #29313d",
          borderRadius: 14,
          background:
            "#0d1219",
        }}
      >

        <div
          style={{
            fontSize: 16,
            fontWeight: 800,
            marginBottom: 14,
          }}
        >
          Valor do veículo
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
          }}
        >

          {/* VALOR PAGO */}

          <div
            style={{
              padding: 12,
              border:
                "1px solid #252e39",
              borderRadius: 12,
              background:
                "#10161e",
            }}
          >

            <div
              style={{
                color:
                  "#8e98a7",
                fontSize: 11,
              }}
            >
              Valor pago
            </div>

            <div
              style={{
                marginTop: 5,
                color: "#fff",
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {formatarDinheiro(
                valorPago
              )}
            </div>

          </div>

          {/* FIPE */}

          <div
            style={{
              padding: 12,
              border:
                "1px solid #252e39",
              borderRadius: 12,
              background:
                "#10161e",
            }}
          >

            <div
              style={{
                color:
                  "#8e98a7",
                fontSize: 11,
              }}
            >
              FIPE atual
            </div>

            <div
              style={{
                marginTop: 5,
                color: "#fff",
                fontSize: 18,
                fontWeight: 800,
              }}
            >
              {carro.fipeValueFormatted ||
                formatarDinheiro(
                  valorFipe
                )}
            </div>

          </div>

          {/* DIFERENÇA */}

          <div
            style={{
              padding: 12,
              border:
                "1px solid #252e39",
              borderRadius: 12,
              background:
                "#10161e",
            }}
          >

            <div
              style={{
                color:
                  "#8e98a7",
                fontSize: 11,
              }}
            >
              Diferença
            </div>

            <div
              style={{
                marginTop: 5,
                color:
                  corDiferenca,
                fontSize: 18,
                fontWeight: 800,
              }}
            >

              {diferencaValor ==
              null
                ? "—"
                : `${
                    diferencaValor >
                    0
                      ? "+"
                      : ""
                  }${formatarDinheiro(
                    diferencaValor
                  )}`}

            </div>

          </div>

          {/* PERCENTUAL */}

          <div
            style={{
              padding: 12,
              border:
                "1px solid #252e39",
              borderRadius: 12,
              background:
                "#10161e",
            }}
          >

            <div
              style={{
                color:
                  "#8e98a7",
                fontSize: 11,
              }}
            >
              Variação
            </div>

            <div
              style={{
                marginTop: 5,
                color:
                  corDiferenca,
                fontSize: 18,
                fontWeight: 800,
              }}
            >

              {diferencaPercentual ==
              null
                ? "—"
                : `${
                    diferencaPercentual >
                    0
                      ? "+"
                      : ""
                  }${formatarPercentual(
                    diferencaPercentual
                  )}`}

            </div>

          </div>

        </div>

        {/* ==================================================
            DADOS FIPE
        ================================================== */}

        {carro.fipeCode ||
        carro.fipeReference ? (

          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop:
                "1px solid #252e39",
              color:
                "#8e98a7",
              fontSize: 11,
              lineHeight: 1.6,
            }}
          >

            {carro.fipeModel ? (

              <div>
                <b>
                  Veículo FIPE:
                </b>{" "}
                {carro.fipeBrand
                  ? `${carro.fipeBrand} `
                  : ""}
                {carro.fipeModel}
                {carro.fipeModelYear
                  ? ` • ${carro.fipeModelYear}`
                  : ""}
                {carro.fipeFuel
                  ? ` • ${carro.fipeFuel}`
                  : ""}
              </div>

            ) : null}

            {carro.fipeCode ? (

              <div>
                <b>
                  Código FIPE:
                </b>{" "}
                {carro.fipeCode}
              </div>

            ) : null}

            {carro.fipeReference ? (

              <div>
                <b>
                  Referência:
                </b>{" "}
                {carro.fipeReference}
              </div>

            ) : null}

          </div>

        ) : (

          <div
            style={{
              marginTop: 12,
              color:
                "#7f8999",
              fontSize: 11,
            }}
          >
            Tabela FIPE ainda não configurada para este veículo.
          </div>

        )}

      </div>

      {/* ==================================================
          ABAS
      ================================================== */}

      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >

        <button
          onClick={() =>
            setAba("proximas")
          }
          disabled={
            aba === "proximas"
          }
        >
          Próximas revisões
        </button>

        <button
          onClick={() =>
            setAba("revisoes")
          }
          disabled={
            aba === "revisoes"
          }
        >
          Revisões
        </button>

        <button
          onClick={() =>
            setAba(
              "acabamentos"
            )
          }
          disabled={
            aba === "acabamentos"
          }
        >
          Acabamentos
        </button>

        <button
          onClick={() =>
            setAba("desejos")
          }
          disabled={
            aba === "desejos"
          }
        >
          Desejos
        </button>

        <button
          onClick={() =>
            setAba("documentos")
          }
          disabled={
            aba === "documentos"
          }
        >
          Documentos
        </button>

      </div>

      {/* ==================================================
          CONTEÚDO DAS ABAS
      ================================================== */}

      <div
        style={{
          marginTop: 16,
        }}
      >

        {aba === "proximas" && (
          <Proximas
            carId={carId}
          />
        )}

        {aba === "revisoes" && (
          <Revisoes
            carId={carId}
          />
        )}

        {aba === "acabamentos" && (
          <Acabamentos
            carId={carId}
            carName={
              carro.name
            }
          />
        )}

        {aba === "desejos" && (
          <Desejos
            carId={carId}
            carName={
              carro.name
            }
          />
        )}

        {aba === "documentos" && (
          <Documentos
            carId={carId}
          />
        )}

      </div>

    </div>
  );
}