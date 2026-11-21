import "./Revisoes.css";
import { itemDaRevisao, itensDoPlano } from "../services/planoRevisao";
import BotaoVoltar from "./BotaoVoltar";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDb } from "../db/db";

const TIPOS_REVISAO = [
  "Troca de óleo",
  "Revisão",
  "Pneus",
  "Freios",
  "Bateria",
  "Arrefecimento",
  "Outro",
];

// Regras padrão de sugestão (ajuste livre depois)
const REGRAS_PROXIMA = {
  "Troca de óleo": { meses: 6, km: 5000 },
  "Revisão": { meses: 12, km: 10000 },
  "Pneus": { meses: 24, km: 40000 },
  "Freios": { meses: 18, km: 20000 },
  "Bateria": { meses: 24, km: null },
  "Arrefecimento": { meses: 24, km: null },
  "Outro": { meses: null, km: null },
};

function dataHojeYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addMesesYYYYMMDD(dataYYYYMMDD, meses) {
  if (!dataYYYYMMDD || !meses) return "";
  const [y, m, d] = String(dataYYYYMMDD).split("-").map(Number);
  if (!y || !m || !d) return "";

  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  dt.setMonth(dt.getMonth() + meses);

  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ===== Anexos (compatível com db.js atual) =====
async function listarAnexos(db, ownerType, ownerId) {
  return await db.attachments
    .where("[ownerType+ownerId]")
    .equals([ownerType, Number(ownerId)])
    .toArray();
}

async function adicionarAnexos(db, ownerType, ownerId, files) {
  const arr = Array.from(files || []);
  if (arr.length === 0) return;

  const now = new Date().toISOString();
  await db.attachments.bulkAdd(
    arr.map((f) => ({
      ownerType,
      ownerId: Number(ownerId),
      category: f.type.startsWith("image/") ? "foto" : "arquivo",
      nomeArquivo: f.name,
      blob: f,
      createdAt: now,
    }))
  );
}

function SeletorAnexos({ onSelecionar, desabilitado }) {
  const arquivos = useRef(null);
  const camera = useRef(null);

  function selecionar(evento) {
    const selecionados = Array.from(evento.currentTarget.files);
    evento.currentTarget.value = "";
    if (selecionados.length) onSelecionar(selecionados);
  }

  return (
    <div className="gr-attachment-actions">
      <input ref={arquivos} type="file" multiple hidden onChange={selecionar} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={selecionar} />
      <button type="button" disabled={desabilitado} onClick={() => arquivos.current.click()}>Escolher arquivos</button>
      <button type="button" disabled={desabilitado} onClick={() => camera.current.click()}>Tirar foto</button>
    </div>
  );
}

export default function Revisoes({ carId, onBack, titulo = "Revisões" }) {
  const db = useDb();
  const [carro, setCarro] = useState(null);
  const [revisoes, setRevisoes] = useState([]);

  // formulário novo
  const [tipo, setTipo] = useState("Troca de óleo");
  const [data, setData] = useState(dataHojeYYYYMMDD());
  const [km, setKm] = useState("");
  const [proximaData, setProximaData] = useState("");
  const [proximoKm, setProximoKm] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [anexosNovos, setAnexosNovos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroCadastro, setErroCadastro] = useState("");

  // edição
  const [editId, setEditId] = useState(null);
  const [eTipo, setETipo] = useState("Troca de óleo");
  const [eData, setEData] = useState(dataHojeYYYYMMDD());
  const [eKm, setEKm] = useState("");
  const [eProxData, setEProxData] = useState("");
  const [eProxKm, setEProxKm] = useState("");
  const [eObs, setEObs] = useState("");

  const carIdNum = useMemo(() => Number(carId), [carId]);

  async function carregar() {
    const c = await db.cars.get(carIdNum);
    setCarro(c || null);

    const list = await db.services.where("carId").equals(carIdNum).toArray();
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setRevisoes(list);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carIdNum]);

  // ===== Sugestão automática (novo) =====
  function sugerirProximosCampos({ tipoLocal, dataLocal, kmLocal }) {
    const regra = REGRAS_PROXIMA[tipoLocal] || { meses: null, km: null };

    // Sugere próxima data (se vazio)
    if (!proximaData && regra.meses) {
      const sugData = addMesesYYYYMMDD(dataLocal, regra.meses);
      if (sugData) setProximaData(sugData);
    }

    // Sugere próximo km (se vazio e se km atual informado)
    if (!proximoKm && regra.km) {
      const kmN = String(kmLocal || "").trim() !== "" ? Number(kmLocal) : null;
      if (kmN != null && Number.isFinite(kmN) && kmN >= 0) {
        setProximoKm(String(kmN + regra.km));
      }
    }
  }

  useEffect(() => {
    // Só sugere se o usuário ainda não preencheu
    sugerirProximosCampos({ tipoLocal: tipo, dataLocal: data, kmLocal: km });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, data, km]);

  async function adicionarRevisao(e) {
    e.preventDefault();
    if (!carIdNum) return;
    if (!tipo) return;
    if (!data) return;

    const mileage = km.trim() !== "" ? Number(km) : null;
    const nextMileage = proximoKm.trim() !== "" ? Number(proximoKm) : null;

    if (mileage != null && (!Number.isFinite(mileage) || mileage < 0)) return;
    if (nextMileage != null && (!Number.isFinite(nextMileage) || nextMileage < 0)) return;

    if (salvando) return;
    setSalvando(true);
    setErroCadastro("");
    let serviceId;
    try {
      serviceId = await db.services.add({
        carId: carIdNum,
        type: tipo,
        planoItemId: itemDaRevisao(itens, { type: tipo })?.id ?? null,
        date: data,
        mileage,
        nextDate: proximaData || null,
        nextMileage,
        notes: observacoes.trim() || "",
        createdAt: new Date().toISOString(),
      });
      await adicionarAnexos(db, "service", serviceId, anexosNovos);
    } catch {
      setErroCadastro(serviceId
        ? "Revisão salva. Os anexos falharam e podem ser enviados pelo Histórico."
        : "Não foi possível salvar a revisão. Tente novamente.");
    } finally {
      setSalvando(false);
    }

    if (serviceId) {
      setKm("");
      setProximaData("");
      setProximoKm("");
      setObservacoes("");
      setAnexosNovos([]);
      await carregar();
    }
  }

  async function excluirRevisao(id) {
    const anexos = await listarAnexos(db, "service", id);
    if (anexos.length) {
      await db.attachments.bulkDelete(anexos.map((a) => a.id));
    }
    await db.services.delete(id);
    await carregar();
  }

  const itens = itensDoPlano(carro).filter(item => item.kmAlvo == null);
  const tipos = [...new Set([...TIPOS_REVISAO, ...itens.map(item => item.nome)])];

  function iniciarEdicao(r) {
    setEditId(r.id);
    setETipo(itemDaRevisao(itens, r)?.nome || r.type || "Troca de óleo");
    setEData(r.date || dataHojeYYYYMMDD());
    setEKm(r.mileage != null ? String(r.mileage) : "");
    setEProxData(r.nextDate || "");
    setEProxKm(r.nextMileage != null ? String(r.nextMileage) : "");
    setEObs(r.notes || "");
  }

  function cancelarEdicao() {
    setEditId(null);
    setETipo("Troca de óleo");
    setEData(dataHojeYYYYMMDD());
    setEKm("");
    setEProxData("");
    setEProxKm("");
    setEObs("");
  }

  async function salvarEdicao() {
    if (!editId) return;
    if (!eTipo || !eData) return;

    const payload = {
      type: eTipo,
      planoItemId: itemDaRevisao(itens, { type: eTipo })?.id ?? null,
      date: eData,
      mileage: eKm.trim() !== "" ? Number(eKm) : null,
      nextDate: eProxData || null,
      nextMileage: eProxKm.trim() !== "" ? Number(eProxKm) : null,
      notes: eObs.trim() || "",
    };

    if (payload.mileage != null && (!Number.isFinite(payload.mileage) || payload.mileage < 0)) return;
    if (payload.nextMileage != null && (!Number.isFinite(payload.nextMileage) || payload.nextMileage < 0)) return;

    await db.services.update(editId, payload);
    cancelarEdicao();
    await carregar();
  }

  if (!carro) {
    return (
      <div style={{ padding: 16 }}>
        <BotaoVoltar onClick={onBack} />
        <p style={{ marginTop: 12 }}>Carro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="revisoes-tela">
      <BotaoVoltar onClick={onBack} />
      <h2>{titulo === "Registrar revisão" ? titulo : `${titulo} — ${carro.name}`}</h2>

      <form className="revisoes-formulario" onSubmit={adicionarRevisao}>
        <label>
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
          >
            {tipos.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <div className="revisoes-par">
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
              placeholder="ex.: 82500"
            />
          </label>
        </div>

        <div className="revisoes-par revisoes-prazo">
          <label>
            Próxima data
            <input
              type="date"
              value={proximaData}
              onChange={(e) => setProximaData(e.target.value)}
            />
          </label>

          <label>
            Próxima quilometragem (km)
            <input
              type="number"
              inputMode="numeric"
              value={proximoKm}
              onChange={(e) => setProximoKm(e.target.value)}
              placeholder="ex.: 90000"
            />
          </label>
        </div>

        <label>
          Observações
          <textarea
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
          />
        </label>

        <fieldset className="gr-attachment-picker">
          <legend>Anexos da revisão (opcional)</legend>
          <SeletorAnexos desabilitado={salvando} onSelecionar={arquivos => setAnexosNovos(atuais => [...atuais, ...arquivos])} />
          {anexosNovos.length > 0 && <ul>
            {anexosNovos.map((arquivo, indice) => <li key={indice}>
              {arquivo.name}{" "}
              <button type="button" disabled={salvando} onClick={() => setAnexosNovos(atuais => atuais.filter((_, i) => i !== indice))}>
                Remover
              </button>
            </li>)}
          </ul>}
        </fieldset>

        <button type="submit" className="gr-add" disabled={salvando}>{salvando ? "Salvando…" : "Adicionar"}</button>
        {erroCadastro && <p role="alert">{erroCadastro}</p>}
      </form>

      <h3 className="revisoes-historico-titulo">Histórico</h3>

      {revisoes.length === 0 ? (
        <p>Nenhuma revisão cadastrada ainda.</p>
      ) : (
        <ul className="revisoes-historico">
          {revisoes.map((r) => {
            const emEdicao = editId === r.id;

            return (
              <li className="revisoes-registro" key={r.id}>
                {!emEdicao ? (
                  <>
                    <div className="revisoes-registro-topo">
                      <div>
                        <strong>{r.type}</strong>
                        <p>{[formatarDataRevisao(r.date), r.mileage != null ? `${Number(r.mileage).toLocaleString("pt-BR")} km` : null].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="revisoes-acoes">
                        <button type="button" onClick={() => iniciarEdicao(r)}>Editar</button>
                        <button type="button" onClick={() => excluirRevisao(r.id)}>Excluir</button>
                      </div>
                    </div>
                    <dl className="revisoes-resumo">
                      <div><dt>Próxima data</dt><dd>{formatarDataRevisao(r.nextDate) || "—"}</dd></div>
                      <div><dt>Próxima quilometragem</dt><dd>{r.nextMileage != null ? `${Number(r.nextMileage).toLocaleString("pt-BR")} km` : "—"}</dd></div>
                    </dl>
                    {r.notes && <p className="revisoes-observacao"><strong>Observações</strong> {r.notes}</p>}
                    <FotosDaEntidade ownerType="service" ownerId={r.id} />
                  </>
                ) : (
                  <div className="revisoes-formulario revisoes-edicao">
                    <strong>Editando revisão</strong>

                    <label>
                      Tipo
                      <select
                        value={eTipo}
                        onChange={(e) => setETipo(e.target.value)}
                      >
                        {[...new Set([...tipos, eTipo])].map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="revisoes-par">
                      <label>
                        Data
                        <input
                          type="date"
                          value={eData}
                          onChange={(e) => setEData(e.target.value)}
                        />
                      </label>

                      <label>
                        Quilometragem (km)
                        <input
                          type="number"
                          inputMode="numeric"
                          value={eKm}
                          onChange={(e) => setEKm(e.target.value)}
                        />
                      </label>
                    </div>

                    <div className="revisoes-par revisoes-prazo">
                      <label>
                        Próxima data
                        <input
                          type="date"
                          value={eProxData}
                          onChange={(e) => setEProxData(e.target.value)}
                        />
                      </label>

                      <label>
                        Próxima quilometragem (km)
                        <input
                          type="number"
                          inputMode="numeric"
                          value={eProxKm}
                          onChange={(e) => setEProxKm(e.target.value)}
                        />
                      </label>
                    </div>

                    <label>
                      Observações
                      <textarea
                        value={eObs}
                        onChange={(e) => setEObs(e.target.value)}
                      />
                    </label>

                    <div className="revisoes-acoes">
                      <button type="button" onClick={salvarEdicao}>
                        Salvar
                      </button>
                      <button onClick={cancelarEdicao}>Cancelar</button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function formatarDataRevisao(valor) {
  return String(valor ?? "").replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$3/$2/$1");
}

function FotosDaEntidade({ ownerType, ownerId }) {
  const db = useDb();
  const [anexos, setAnexos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");

  async function carregar() {
    const list = await db.attachments
      .where("[ownerType+ownerId]")
      .equals([ownerType, Number(ownerId)])
      .toArray();
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    setAnexos(list);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerType, ownerId]);

  async function adicionarMais(files) {
    setEnviando(true);
    setErroEnvio("");
    try {
      await adicionarAnexos(db, ownerType, ownerId, files);
      await carregar();
    } catch {
      setErroEnvio("Não foi possível adicionar os anexos.");
    } finally {
      setEnviando(false);
    }
  }

  async function remover(attachId) {
    await db.attachments.delete(attachId);
    await carregar();
  }

  return (
    <div className="revisoes-anexos">
      <strong>Anexos</strong>
      <SeletorAnexos onSelecionar={adicionarMais} desabilitado={enviando} />
      {enviando && <p role="status">Enviando anexos…</p>}
      {erroEnvio && <p role="alert">{erroEnvio}</p>}

      {anexos.length === 0 ? (
        <p style={{ fontSize: 13, marginTop: 6 }}>Nenhum anexo.</p>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
          {anexos.map((a) => (
            <Anexo key={a.id} anexo={a} onRemover={() => remover(a.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function Anexo({ anexo, onRemover }) {
  const elemento = useRef(null);
  const disponivel = anexo.blob instanceof Blob;
  const imagem = anexo.blob?.type?.startsWith("image/") || anexo.category === "foto";
  const nome = anexo.nomeArquivo || (imagem ? "Foto da revisão" : "Arquivo da revisão");

  useEffect(() => {
    if (!disponivel) return;
    const url = URL.createObjectURL(anexo.blob);
    elemento.current.setAttribute(imagem ? "src" : "href", url);
    return () => URL.revokeObjectURL(url);
  }, [anexo.blob, disponivel, imagem]);

  return (
    <div className="gr-attachment">
      {disponivel && imagem && <img ref={elemento} alt={nome} />}
      {disponivel && !imagem && <a ref={elemento} download={nome}>{nome}</a>}
      {!disponivel && <span>Arquivo indisponível</span>}
      <button type="button" onClick={onRemover}>Remover</button>
    </div>
  );
}
