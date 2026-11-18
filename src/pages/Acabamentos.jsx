import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

/* =======================
   Helpers
======================= */
function hojeYYYYMMDD() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function moedaBR(v) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(v);
  } catch {
    return `R$ ${Number(v).toFixed(2)}`;
  }
}

async function listarAnexos(db, entityType, entityId) {
  return await db.attachments
    .where("[entityType+entityId]")
    .equals([entityType, Number(entityId)])
    .toArray();
}

async function adicionarAnexos(db, entityType, entityId, files) {
  const arr = Array.from(files || []);
  if (arr.length === 0) return;

  const now = new Date().toISOString();
  await db.attachments.bulkAdd(
    arr.map((f) => ({
      entityType,
      entityId: Number(entityId),
      blob: f,
      createdAt: now,
    }))
  );
}

/* =======================
   Página
======================= */
export default function Acabamentos({ carId, carName, titulo = "Acabamentos" }) {
  const db = useDb();
  const [lista, setLista] = useState([]);

  const [peca, setPeca] = useState("");
  const [valor, setValor] = useState("");
  const [onde, setOnde] = useState("");
  const [data, setData] = useState(hojeYYYYMMDD());
  const [obs, setObs] = useState("");
  const [notaFiles, setNotaFiles] = useState([]);

  async function carregar() {
    const itens = await db.purchases
      .where("carId")
      .equals(Number(carId))
      .toArray();
    itens.sort((a, b) => (a.date < b.date ? 1 : -1));
    setLista(itens);
  }

  useEffect(() => {
    carregar();
  }, [carId]);

  async function adicionar(e) {
    e.preventDefault();
    if (!peca.trim()) return;

    const price = valor ? Number(valor) : null;
    if (price != null && (!Number.isFinite(price) || price < 0)) return;

    const purchaseId = await db.purchases.add({
      carId: Number(carId),
      part: peca.trim(),
      date: data || null,
      price,
      vendor: onde.trim() || "",
      notes: obs.trim() || "",
      createdAt: new Date().toISOString(),
    });

    if (notaFiles.length) {
      await adicionarAnexos(db, "purchase", purchaseId, notaFiles);
    }

    setPeca("");
    setValor("");
    setOnde("");
    setObs("");
    setNotaFiles([]);
    await carregar();
  }

  async function excluir(id) {
    const anexos = await listarAnexos(db, "purchase", id);
    if (anexos.length) {
      await db.attachments.bulkDelete(anexos.map((a) => a.id));
    }
    await db.purchases.delete(id);
    await carregar();
  }

  const total = useMemo(() => {
    return lista.reduce(
      (sum, x) => sum + (typeof x.price === "number" ? x.price : 0),
      0
    );
  }, [lista]);

  return (
    <div>
      <h3>{titulo} — {carName}</h3>

      <form onSubmit={adicionar} style={{ display: "grid", gap: 8, maxWidth: 560 }}>
        <label>
          Peça / item
          <input value={peca} onChange={(e) => setPeca(e.target.value)} />
        </label>

        <label>
          Valor (R$)
          <input
            type="number"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        </label>

        <label>
          Data
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </label>

        <label>
          Onde comprei
          <input value={onde} onChange={(e) => setOnde(e.target.value)} />
        </label>

        <label>
          Observações
          <input value={obs} onChange={(e) => setObs(e.target.value)} />
        </label>

        <label>
          Fotos das notas fiscais
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(e) =>
              setNotaFiles(e.target.files ? Array.from(e.target.files) : [])
            }
          />
        </label>

        <button type="submit">Adicionar</button>
      </form>

      <p style={{ marginTop: 10 }}>
        <strong>Total gasto:</strong> {moedaBR(total)}
      </p>

      <ul>
        {lista.map((x) => (
          <Item key={x.id} item={x} onExcluir={() => excluir(x.id)} />
        ))}
      </ul>
    </div>
  );
}

/* =======================
   Item
======================= */
function Item({ item, onExcluir }) {
  const db = useDb();
  const [anexos, setAnexos] = useState([]);

  async function carregar() {
    const list = await listarAnexos(db, "purchase", item.id);
    setAnexos(list);
  }

  useEffect(() => {
    carregar();
  }, [item.id]);

  async function adicionarMais(files) {
    if (!files?.length) return;
    await adicionarAnexos(db, "purchase", item.id, files);
    await carregar();
  }

  async function remover(id) {
    await db.attachments.delete(id);
    await carregar();
  }

  return (
    <li style={{ marginBottom: 14 }}>
      <strong>{item.part}</strong> — {moedaBR(item.price || 0)}

      <div>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={(e) =>
            adicionarMais(e.target.files ? Array.from(e.target.files) : [])
          }
        />
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {anexos.map((a) => (
          <Foto key={a.id} anexo={a} onRemover={() => remover(a.id)} />
        ))}
      </div>

      <button onClick={onExcluir}>Excluir</button>
    </li>
  );
}

function Foto({ anexo, onRemover }) {
  const [url, setUrl] = useState("");

  useEffect(() => {
    const u = URL.createObjectURL(anexo.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [anexo.id]);

  return (
    <div>
      <img src={url} alt="Nota" width={100} />
      <button onClick={onRemover}>Remover</button>
    </div>
  );
}
