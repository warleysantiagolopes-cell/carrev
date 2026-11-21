import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";
import "./Revisoes.css";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const PRIORIDADES = ["Baixa", "Média", "Alta"];

export default function Desejos({ carId, hoje, titulo = "Lista de desejos" }) {
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
    <div className="revisoes-tela">
      <h2>{titulo}</h2>
      <form className="revisoes-formulario" onSubmit={adicionar}>
        <label>
          Peça desejada
          <input value={peca} onChange={e => setPeca(e.target.value)} required />
        </label>
        <div className="revisoes-par">
          <label>
            Custo estimado (R$)
            <input type="number" inputMode="decimal" min="0" step="0.01"
              value={estimado} onChange={e => setEstimado(e.target.value)} />
          </label>
          <label>
            Prioridade
            <select value={prioridade} onChange={e => setPrioridade(e.target.value)}>
              {PRIORIDADES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
        </div>
        <label>
          Onde comprar
          <input value={onde} onChange={e => setOnde(e.target.value)} />
        </label>
        <label>
          Observações
          <textarea value={obs} onChange={e => setObs(e.target.value)} />
        </label>
        <button type="submit" className="gr-add">Adicionar desejo</button>
      </form>

      <div className="revisoes-registro-topo revisoes-historico-titulo">
        <h3>Itens desejados</h3>
        <strong>Total estimado · {moeda.format(totalEstimado)}</strong>
      </div>
      {lista.length === 0 && <p>Nenhum desejo cadastrado ainda.</p>}
      <ul className="revisoes-historico">
        {lista.map(item => (
          <li className="revisoes-registro" key={item.id}>
            <div className="revisoes-registro-topo">
              <div>
                <strong>{item.part}</strong>
                <p>Prioridade {item.priority?.toLocaleLowerCase("pt-BR")}{item.vendor ? ` · ${item.vendor}` : ""}</p>
              </div>
              {item.estimatedPrice != null && <strong>{moeda.format(item.estimatedPrice)}</strong>}
            </div>
            {item.notes && <p className="revisoes-observacao">{item.notes}</p>}
            <div className="revisoes-acoes">
              <button type="button" onClick={() => marcarComoComprado(item)}>Marcar como comprado</button>
              <button type="button" className="revisoes-excluir" onClick={() => excluir(item.id)}>Excluir</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
