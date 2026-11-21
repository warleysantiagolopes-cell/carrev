import "./Revisoes.css";
import { itemDaRevisao, itensDoPlano, revisaoPeriodica } from "../services/planoRevisao";
import Anexo from "./Anexo";
import SeletorAnexos from "./SeletorAnexos";
import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

const TIPO_PERSONALIZADO = "Outro";

const TIPOS_REVISAO = [
  "Troca de óleo",
  "Revisão",
  "Pneus",
  "Freios",
  "Bateria",
  "Arrefecimento",
  TIPO_PERSONALIZADO,
];

// Regras padrão de sugestão (ajuste livre depois)
const REGRAS_PROXIMA = {
  "Troca de óleo": { meses: 6, km: 5000 },
  "Revisão": { meses: 12, km: 10000 },
  "Pneus": { meses: 24, km: 40000 },
  "Freios": { meses: 18, km: 20000 },
  "Bateria": { meses: 24, km: null },
  "Arrefecimento": { meses: 24, km: null },
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

export default function Revisoes({ carId, modo }) {
  const db = useDb();
  const [carro, setCarro] = useState(null);
  const [revisoes, setRevisoes] = useState([]);

  // formulário novo
  const [tipo, setTipo] = useState("Troca de óleo");
  const [nomePersonalizado, setNomePersonalizado] = useState("");
  const [data, setData] = useState(dataHojeYYYYMMDD());
  const [km, setKm] = useState("");
  const [periodica, setPeriodica] = useState(true);
  const [proximaData, setProximaData] = useState("");
  const [proximoKm, setProximoKm] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [anexosNovos, setAnexosNovos] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [avisoCadastro, setAvisoCadastro] = useState("");
  const [erroCadastro, setErroCadastro] = useState("");

  // edição
  const [editId, setEditId] = useState(null);
  const [eTipo, setETipo] = useState("Troca de óleo");
  const [eNomePersonalizado, setENomePersonalizado] = useState("");
  const [eData, setEData] = useState(dataHojeYYYYMMDD());
  const [eKm, setEKm] = useState("");
  const [ePeriodica, setEPeriodica] = useState(false);
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [erroEdicao, setErroEdicao] = useState("");
  const [eProxData, setEProxData] = useState("");
  const [eProxKm, setEProxKm] = useState("");
  const [eObs, setEObs] = useState("");

  const carIdNum = useMemo(() => Number(carId), [carId]);

  async function carregar() {
    const c = await db.cars.get(carIdNum);
    setCarro(c || null);

    if (modo !== "historico") return;
    const list = await db.services.where("carId").equals(carIdNum).toArray();
    list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    setRevisoes(list);
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carIdNum, db, modo]);

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
    if (!periodica || modo === "historico") return;
    sugerirProximosCampos({ tipoLocal: tipo, dataLocal: data, kmLocal: km });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, data, km, periodica, modo]);

  async function adicionarRevisao(e) {
    e.preventDefault();
    if (!carIdNum) return;
    const personalizado = tipo === TIPO_PERSONALIZADO;
    const nome = personalizado ? nomePersonalizado.trim() : tipo;
    if (!nome) {
      setErroCadastro("Informe o nome da revisão.");
      return;
    }
    if (!data) return;

    const mileage = km.trim() !== "" ? Number(km) : null;
    const nextMileage = periodica && proximoKm.trim() !== "" ? Number(proximoKm) : null;

    if (mileage != null && (!Number.isFinite(mileage) || mileage < 0)) return;
    if (nextMileage != null && (!Number.isFinite(nextMileage) || nextMileage < 0)) return;

    if (salvando) return;
    setAvisoCadastro("");
    setErroCadastro("");
    if (periodica && !proximaData && nextMileage == null) {
      setErroCadastro("Informe a próxima data ou quilometragem da revisão periódica.");
      return;
    }
    setSalvando(true);
    let serviceId;
    try {
      serviceId = await db.services.add({
        carId: carIdNum,
        type: nome,
        tipoPersonalizado: personalizado,
        planoItemId: itemDaRevisao(itens, { type: nome })?.id ?? null,
        date: data,
        mileage,
        periodica,
        nextDate: periodica ? proximaData || null : null,
        nextMileage,
        notes: observacoes.trim() || "",
        createdAt: new Date().toISOString(),
      });
      await adicionarAnexos(db, "service", serviceId, anexosNovos);
      setAvisoCadastro("Revisão registrada.");
    } catch {
      setErroCadastro(serviceId
        ? "Revisão salva. Os anexos falharam e podem ser enviados pelo Histórico."
        : "Não foi possível salvar a revisão. Tente novamente.");
    } finally {
      setSalvando(false);
    }

    if (serviceId) {
      setNomePersonalizado("");
      setKm("");
      setPeriodica(true);
      setProximaData(addMesesYYYYMMDD(data, REGRAS_PROXIMA[tipo]?.meses));
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
    setErroEdicao("");
    setEPeriodica(revisaoPeriodica(r));
    const tipoAtual = itemDaRevisao(itens, r)?.nome || r.type || "Troca de óleo";
    const personalizado = r.tipoPersonalizado || !tipos.includes(tipoAtual);
    setETipo(personalizado ? TIPO_PERSONALIZADO : tipoAtual);
    setENomePersonalizado(personalizado || tipoAtual === TIPO_PERSONALIZADO ? r.type || "" : "");
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
    if (!editId || salvandoEdicao) return;
    if (!eData) return;
    const personalizado = eTipo === TIPO_PERSONALIZADO;
    const nome = personalizado ? eNomePersonalizado.trim() : eTipo;
    if (!nome) {
      setErroEdicao("Informe o nome da revisão.");
      return;
    }

    const payload = {
      type: nome,
      tipoPersonalizado: personalizado,
      planoItemId: itemDaRevisao(itens, { type: nome })?.id ?? null,
      date: eData,
      mileage: eKm.trim() !== "" ? Number(eKm) : null,
      periodica: ePeriodica,
      nextDate: ePeriodica ? eProxData || null : null,
      nextMileage: ePeriodica && eProxKm.trim() !== "" ? Number(eProxKm) : null,
      notes: eObs.trim() || "",
    };

    if (payload.mileage != null && (!Number.isFinite(payload.mileage) || payload.mileage < 0)) return;
    if (payload.nextMileage != null && (!Number.isFinite(payload.nextMileage) || payload.nextMileage < 0)) return;

    if (ePeriodica && !payload.nextDate && payload.nextMileage == null) {
      setErroEdicao("Informe a próxima data ou quilometragem da revisão periódica.");
      return;
    }

    setErroEdicao("");
    setSalvandoEdicao(true);
    try {
      const atualizado = await db.services.update(editId, payload);
      if (!atualizado) {
        setErroEdicao("Esta revisão não está mais disponível.");
        return;
      }
      await carregar();
      cancelarEdicao();
    } catch {
      setErroEdicao("Não foi possível atualizar a revisão.");
    } finally {
      setSalvandoEdicao(false);
    }
  }

  if (!carro) {
    return (
      <div style={{ padding: 16 }}>
        <p style={{ marginTop: 12 }}>Carro não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="revisoes-tela">
      <h2>{modo === "historico" ? "Histórico de revisões" : "Registrar revisão"}</h2>

      {modo !== "historico" && <form className="revisoes-formulario" onSubmit={adicionarRevisao}>
          <label>
            Tipo
            <select
              value={tipo}
              onChange={e => {
                setTipo(e.target.value);
                if (e.target.value === TIPO_PERSONALIZADO) {
                  setProximaData("");
                  setProximoKm("");
                }
              }}
            >
              {tipos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          {tipo === TIPO_PERSONALIZADO && (
            <label>
              O que foi feito?
              <input required value={nomePersonalizado} onChange={e => setNomePersonalizado(e.target.value)}
                placeholder="Ex.: Módulo ABS" />
            </label>
          )}

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

          <label className="revisoes-periodica">
            <input type="checkbox" checked={periodica} onChange={e => setPeriodica(e.target.checked)} />
            Esta revisão é periódica?
          </label>

          {periodica && <div className="revisoes-par revisoes-prazo">
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
          </div>}

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
          {avisoCadastro && <p role="status">{avisoCadastro}</p>}
      </form>}

      {modo === "historico" && (revisoes.length === 0 ? (
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
                      {revisaoPeriodica(r) ? <dl className="revisoes-resumo">
                        <div><dt>Próxima data</dt><dd>{formatarDataRevisao(r.nextDate) || "—"}</dd></div>
                        <div><dt>Próxima quilometragem</dt><dd>{r.nextMileage != null ? `${Number(r.nextMileage).toLocaleString("pt-BR")} km` : "—"}</dd></div>
                      </dl> : <p className="revisoes-observacao">Revisão avulsa</p>}
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

                      {eTipo === TIPO_PERSONALIZADO && (
                        <label>
                          O que foi feito?
                          <input value={eNomePersonalizado} onChange={e => setENomePersonalizado(e.target.value)}
                            placeholder="Ex.: Módulo ABS" />
                        </label>
                      )}

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

                      <label className="revisoes-periodica">
                        <input type="checkbox" checked={ePeriodica} onChange={e => setEPeriodica(e.target.checked)} />
                        Esta revisão é periódica?
                      </label>

                      {ePeriodica && <div className="revisoes-par revisoes-prazo">
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
                      </div>}

                      <label>
                        Observações
                        <textarea
                          value={eObs}
                          onChange={(e) => setEObs(e.target.value)}
                        />
                      </label>

                      <div className="revisoes-acoes">
                        <button type="button" onClick={salvarEdicao} disabled={salvandoEdicao}>
                          Salvar
                        </button>
                        <button type="button" onClick={cancelarEdicao} disabled={salvandoEdicao}>Cancelar</button>
                      </div>
                      {erroEdicao && <p role="alert">{erroEdicao}</p>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
      ))}
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
