import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function numeroSeguro(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatarNumero(n, casas = 2) {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toFixed(casas);
}

export default function AbastecimentosCarro({ carId, aoVoltar }) {
  const [carro, setCarro] = useState(null);
  const [historico, setHistorico] = useState([]);

  // Formulário
  const [data, setData] = useState(hojeISO());
  const [km, setKm] = useState("");
  const [litros, setLitros] = useState("");
  const [precoTotal, setPrecoTotal] = useState("");
  const [local, setLocal] = useState("");
  const [tanqueCheio, setTanqueCheio] = useState(true);

  async function carregar() {
    const c = await db.cars.get(Number(carId));
    setCarro(c || null);

    const lista = await db.abastecimentos
      .where("carId")
      .equals(Number(carId))
      .toArray();

    lista.sort((a, b) => (a.km || 0) - (b.km || 0));
    setHistorico(lista);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId]);

  async function salvarAbastecimento(e) {
    e.preventDefault();

    const kmNum = numeroSeguro(km);
    const litrosNum = numeroSeguro(litros);
    const precoNum = precoTotal.trim() === "" ? null : numeroSeguro(precoTotal);

    if (kmNum == null || kmNum < 0) return;
    if (litrosNum == null || litrosNum <= 0) return;
    if (precoNum != null && precoNum < 0) return;

    await db.abastecimentos.add({
      carId: Number(carId),
      data,
      km: kmNum,
      litros: litrosNum,
      precoTotal: precoNum,
      local: (local || "").trim(),
      tanqueCheio: Boolean(tanqueCheio),
      criadoEm: new Date().toISOString(),
    });

    // Atualiza km atual do carro (se maior)
    if (carro) {
      const kmAtual =
        typeof carro.currentMileage === "number" ? carro.currentMileage : null;

      if (kmAtual == null || kmNum > kmAtual) {
        await db.cars.update(Number(carId), { currentMileage: kmNum });
      }
    }

    // Limpa campos
    setKm("");
    setLitros("");
    setPrecoTotal("");
    setLocal("");
    setTanqueCheio(true);

    await carregar();
  }

  async function excluirAbastecimento(id) {
    await db.abastecimentos.delete(id);
    await carregar();
  }

  // ===== Consumo (entre tanques cheios) =====
  const consumo = useMemo(() => {
    const cheios = historico
      .filter((a) => a.tanqueCheio)
      .slice()
      .sort((a, b) => (a.km || 0) - (b.km || 0));

    const trechos = [];
    for (let i = 1; i < cheios.length; i++) {
      const anterior = cheios[i - 1];
      const atual = cheios[i];

      const distancia = (atual.km || 0) - (anterior.km || 0);
      const litrosUsados = Number(atual.litros);

      if (distancia > 0 && Number.isFinite(litrosUsados) && litrosUsados > 0) {
        const kmPorLitro = distancia / litrosUsados;
        const litrosPor100 = (litrosUsados / distancia) * 100;

        trechos.push({
          data: atual.data,
          deKm: anterior.km,
          paraKm: atual.km,
          distancia,
          litrosUsados,
          kmPorLitro,
          litrosPor100,
        });
      }
    }

    const ultimo = trechos.length ? trechos[trechos.length - 1] : null;
    const mediaKmL =
      trechos.length
        ? trechos.reduce((s, t) => s + t.kmPorLitro, 0) / trechos.length
        : null;

    return { trechos, ultimo, mediaKmL };
  }, [historico]);

  if (!carro) {
    return (
      <div style={{ padding: 16 }}>
        <button onClick={aoVoltar}>Voltar</button>
        <p style={{ marginTop: 12 }}>Carro não encontrado.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      <button onClick={aoVoltar}>Voltar</button>

      <h2 style={{ marginTop: 12 }}>Abastecer — {carro.name}</h2>

      <div style={{ marginTop: 8, fontSize: 13 }}>
        <div>
          <b>Último consumo:</b>{" "}
          {consumo.ultimo ? `${formatarNumero(consumo.ultimo.kmPorLitro)} km/L` : "—"}
        </div>
        <div>
          <b>Média (tanque cheio):</b>{" "}
          {consumo.mediaKmL != null ? `${formatarNumero(consumo.mediaKmL)} km/L` : "—"}
        </div>
      </div>

      {/* Formulário */}
      <div
        style={{
          marginTop: 12,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <form
          onSubmit={salvarAbastecimento}
          style={{ display: "grid", gap: 10, maxWidth: 760 }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "1fr 1fr 1fr",
            }}
          >
            <label>
              Data
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </label>

            <label>
              Quilometragem (km)
              <input
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                placeholder="ex.: 45210"
              />
            </label>

            <label>
              Litros abastecidos
              <input
                type="number"
                inputMode="decimal"
                value={litros}
                onChange={(e) => setLitros(e.target.value)}
                placeholder="ex.: 42.5"
              />
            </label>
          </div>

          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "1fr 1fr",
            }}
          >
            <label>
              Preço total (opcional)
              <input
                type="number"
                inputMode="decimal"
                value={precoTotal}
                onChange={(e) => setPrecoTotal(e.target.value)}
                placeholder="ex.: 260.00"
              />
            </label>

            <label>
              Local (opcional)
              <input
                value={local}
                onChange={(e) => setLocal(e.target.value)}
                placeholder="ex.: Posto X / Cidade"
              />
            </label>
          </div>

          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={tanqueCheio}
              onChange={(e) => setTanqueCheio(e.target.checked)}
            />
            Encheu o tanque
          </label>

          <button type="submit">Salvar abastecimento</button>
        </form>
      </div>

      {/* Histórico */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>Histórico</div>

        {historico.length === 0 ? (
          <div style={{ fontSize: 13 }}>Nenhum abastecimento cadastrado.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {historico
              .slice()
              .sort((a, b) => (b.km || 0) - (a.km || 0))
              .map((a) => (
                <div
                  key={a.id}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <div>
                      <b>Data:</b> {a.data || "—"} • <b>KM:</b> {a.km}
                    </div>
                    <div>
                      <b>Litros:</b> {a.litros} • <b>Tanque cheio:</b>{" "}
                      {a.tanqueCheio ? "Sim" : "Não"}
                      {a.precoTotal != null
                        ? ` • R$ ${formatarNumero(Number(a.precoTotal), 2)}`
                        : ""}
                      {a.local ? ` • ${a.local}` : ""}
                    </div>
                  </div>

                  <button onClick={() => excluirAbastecimento(a.id)}>
                    Excluir
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Trechos de consumo */}
      <div
        style={{
          marginTop: 14,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 10 }}>
          Consumo (entre abastecimentos com “tanque cheio”)
        </div>

        {consumo.trechos.length === 0 ? (
          <div style={{ fontSize: 13 }}>
            Para calcular, marque “Encheu o tanque” em pelo menos <b>dois</b>{" "}
            abastecimentos.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {consumo.trechos
              .slice()
              .reverse()
              .map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    border: "1px solid #eee",
                    borderRadius: 10,
                    padding: 10,
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <div>
                      <b>Trecho:</b> {t.deKm} → {t.paraKm} ({t.distancia} km) •{" "}
                      <b>Litros:</b> {t.litrosUsados}
                    </div>
                    <div>
                      <b>Consumo:</b> {formatarNumero(t.kmPorLitro)} km/L •{" "}
                      <b>{formatarNumero(t.litrosPor100)}</b> L/100 km
                      {t.data ? ` • Data: ${t.data}` : ""}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
