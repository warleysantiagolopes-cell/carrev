// src/pages/CarroDetalhe.jsx
import { useEffect, useState } from "react";
import { db } from "../db/db";

import Proximas from "./Proximas";
import Revisoes from "./Revisoes";
import Acabamentos from "./Acabamentos";
import Desejos from "./Desejos";

function textoOuTraco(v) {
  const t = String(v ?? "").trim();
  return t ? t : "—";
}

export default function CarroDetalhe({ carId, onBack }) {
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
    if (fotoUrl) URL.revokeObjectURL(fotoUrl);

    if (carro?.photo) {
      setFotoUrl(URL.createObjectURL(carro.photo));
    } else {
      setFotoUrl(null);
    }

    return () => {
      if (fotoUrl) URL.revokeObjectURL(fotoUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carro?.photo]);

  async function alterarFoto(file) {
    if (!file) return;
    await db.cars.update(Number(carId), { photo: file });
    await carregarCarro();
  }

  async function removerFoto() {
    await db.cars.update(Number(carId), { photo: null });
    await carregarCarro();
  }

  if (!carro) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={onBack}>Voltar</button>
        <p style={{ marginTop: 12 }}>Carro não encontrado.</p>
      </div>
    );
  }

  const kmTxt =
    typeof carro.currentMileage === "number"
      ? `${carro.currentMileage} km`
      : "—";

  return (
    <div style={{ padding: 16 }}>
      <button onClick={onBack}>Voltar</button>

      <h2 style={{ marginTop: 12 }}>{carro.name}</h2>

      {/* Cartão de dados do carro */}
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
        {/* Foto */}
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
            <label style={{ display: "inline-block" }}>
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
                capture="environment"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) alterarFoto(f);
                  e.target.value = "";
                }}
              />
            </label>

            {carro.photo ? (
              <button onClick={removerFoto}>Remover foto</button>
            ) : null}
          </div>
        </div>

        {/* Dados principais */}
        <div style={{ minWidth: 240 }}>
          <strong>Dados do carro</strong>
          <div
            style={{
              fontSize: 13,
              marginTop: 6,
              display: "grid",
              gap: 4,
            }}
          >
            <div>
              <b>Modelo:</b> {textoOuTraco(carro.model)}
            </div>
            <div>
              <b>Ano:</b> {textoOuTraco(carro.year)}
            </div>
            <div>
              <b>Placa:</b> {textoOuTraco(carro.plate)}
            </div>
            <div>
              <b>Combustível:</b> {textoOuTraco(carro.fuel)}
            </div>
            <div>
              <b>Quilometragem:</b> {kmTxt}
            </div>
          </div>
        </div>

        {/* Itens de referência */}
        <div style={{ minWidth: 240 }}>
          <strong>Itens de referência</strong>
          <div
            style={{
              fontSize: 13,
              marginTop: 6,
              display: "grid",
              gap: 4,
            }}
          >
            <div>
              <b>Óleo:</b> {textoOuTraco(carro.oil)}
            </div>
            <div>
              <b>Pneu:</b> {textoOuTraco(carro.tire)}
            </div>
            <div>
              <b>Lâmpadas:</b> {textoOuTraco(carro.bulbs)}
            </div>
          </div>
        </div>
      </div>

      {/* Abas */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button onClick={() => setAba("proximas")} disabled={aba === "proximas"}>
          Próximas revisões
        </button>
        <button onClick={() => setAba("revisoes")} disabled={aba === "revisoes"}>
          Revisões
        </button>
        <button
          onClick={() => setAba("acabamentos")}
          disabled={aba === "acabamentos"}
        >
          Acabamentos
        </button>
        <button onClick={() => setAba("desejos")} disabled={aba === "desejos"}>
          Desejos
        </button>
      </div>

      <div style={{ marginTop: 16 }}>
        {aba === "proximas" && <Proximas carId={carId} />}
        {aba === "revisoes" && <Revisoes carId={carId} />}
        {aba === "acabamentos" && (
          <Acabamentos carId={carId} carName={carro.name} />
        )}
        {aba === "desejos" && (
          <Desejos carId={carId} carName={carro.name} />
        )}
      </div>
    </div>
  );
}
