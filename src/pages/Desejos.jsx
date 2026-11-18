import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

const PRIORIDADES = ["Baixa", "Média", "Alta"];

export default function Desejos({ carId, carName, hoje, titulo = "Desejos" }) {
  const db = useDb();
  const [lista, setLista] = useState([]);

  const [peca, setPeca] = useState("");
  const [estimado, setEstimado] = useState("");
  const [onde, setOnde] = useState("");
  const [prioridade, setPrioridade] = useState("Média");
  const [obs, setObs] = useState("");

  async function carregar() {
    const itens = await db.wishlist.where("carId").equals(Number(carId)).toArray();
    // Alta primeiro, depois média, depois baixa; dentro disso, mais recente primeiro
    const rank = { "Alta": 0, "Média": 1, "Baixa": 2 };
    itens.sort((a, b) => {
      if (rank[a.priority] !== rank[b.priority]) return rank[a.priority] - rank[b.priority];
      return (a.createdAt < b.createdAt ? 1 : -1);
    });
    setLista(itens);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carId]);

  async function adicionar(e) {
    e.preventDefault();
    if (!peca.trim()) return;

    const price = estimado.trim() !== "" ? Number(estimado) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) return;

    await db.wishlist.add({
      carId: Number(carId),
      part: peca.trim(),
      estimatedPrice: price,
      vendor: onde.trim() || "",
      priority: prioridade,
      notes: obs.trim() || "",
      createdAt: new Date().toISOString(),
    });

    setPeca("");
    setEstimado("");
    setOnde("");
    setObs("");
    setPrioridade("Média");
    await carregar();
  }

  async function excluir(id) {
    await db.wishlist.delete(id);
    await carregar();
  }

  // Extra útil: “comprar” um desejo e jogar para acabamentos
  async function marcarComoComprado(item) {
    await db.purchases.add({
      carId: Number(carId),
      part: item.part,
      date: hoje || null,
      price: item.estimatedPrice ?? null,
      vendor: item.vendor || "",
      notes: item.notes || "",
      createdAt: new Date().toISOString(),
    });

    await db.wishlist.delete(item.id);
    await carregar();
  }

  const totalEstimado = useMemo(() => {
    return lista.reduce((sum, x) => sum + (typeof x.estimatedPrice === "number" ? x.estimatedPrice : 0), 0);
  }, [lista]);

  return (
    <div>
      <h3>{titulo} — {carName}</h3>

      <form onSubmit={adicionar} style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <label>
          Peça desejada
          <input value={peca} onChange={(e) => setPeca(e.target.value)} style={{ display: "block", width: "100%" }} />
        </label>

        <div style={{ display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" }}>
          <label>
            Custo estimado (R$)
            <input type="number" inputMode="decimal" value={estimado} onChange={(e) => setEstimado(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>

          <label>
            Prioridade
            <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} style={{ display: "block", width: "100%" }}>
              {PRIORIDADES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>

        <label>
          Onde comprar (loja/site)
          <input value={onde} onChange={(e) => setOnde(e.target.value)} style={{ display: "block", width: "100%" }} />
        </label>

        <label>
          Observações
          <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" style={{ display: "block", width: "100%" }} />
        </label>

        <button type="submit">Adicionar desejo</button>
      </form>

      <div style={{ marginTop: 14 }}>
        <strong>Total estimado:</strong> R$ {totalEstimado.toFixed(2)}
      </div>

      <h4 style={{ marginTop: 14 }}>Lista de desejos</h4>
      {lista.length === 0 ? (
        <p>Nenhum desejo cadastrado ainda.</p>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {lista.map((x) => (
            <li key={x.id} style={{ marginBottom: 10 }}>
              <div>
                <strong>{x.part}</strong> — Prioridade: <strong>{x.priority}</strong>
                {typeof x.estimatedPrice === "number" ? ` — R$ ${x.estimatedPrice.toFixed(2)}` : ""}
              </div>
              <div style={{ fontSize: 14 }}>
                {x.vendor ? `Onde: ${x.vendor}` : ""}
                {x.notes ? ` — Obs.: ${x.notes}` : ""}
              </div>

              <div style={{ marginTop: 6 }}>
                <button onClick={() => marcarComoComprado(x)} style={{ marginRight: 8 }}>
                  Marcar como comprado
                </button>
                <button onClick={() => excluir(x.id)}>
                  Excluir
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
