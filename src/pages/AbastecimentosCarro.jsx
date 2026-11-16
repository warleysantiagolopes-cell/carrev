// src/pages/AbastecimentosCarro.jsx

import { useEffect, useMemo, useState } from "react";
import { db } from "../db/db";
import { atualizarFipeDoCarro } from "../services/fipe";

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

function formatarKm(n) {
  if (n == null || !Number.isFinite(Number(n))) return "—";
  return Number(n).toLocaleString("pt-BR");
}

function formatarData(data) {
  if (!data) return "—";

  const [ano, mes, dia] = String(data).split("-");

  if (!ano || !mes || !dia) return data;

  return `${dia}/${mes}/${ano}`;
}

export default function AbastecimentosCarro({
  carId,
  aoVoltar,
}) {
  const [carro, setCarro] = useState(null);
  const [historico, setHistorico] = useState([]);

  const [salvando, setSalvando] = useState(false);

  /* ==================================================
     FORMULÁRIO
  ================================================== */

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

    lista.sort(
      (a, b) =>
        (a.km || 0) -
        (b.km || 0)
    );

    setHistorico(lista);
  }

  useEffect(() => {
    carregar();
  }, [carId]);

  /* ==================================================
     SALVAR
  ================================================== */

  async function salvarAbastecimento(e) {
    e.preventDefault();

    const kmNum = numeroSeguro(km);
    const litrosNum = numeroSeguro(litros);

    const precoNum =
      precoTotal.trim() === ""
        ? null
        : numeroSeguro(precoTotal);

    if (kmNum == null || kmNum < 0) {
      alert("Informe uma quilometragem válida.");
      return;
    }

    if (litrosNum == null || litrosNum <= 0) {
      alert("Informe uma quantidade de litros válida.");
      return;
    }

    if (precoNum != null && precoNum < 0) {
      alert("Informe um valor válido.");
      return;
    }

    setSalvando(true);

    let kmFoiAtualizado = false;
    let fipeFoiAtualizada = false;
    let fipeFalhou = false;

    try {
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

      /* ==================================================
         ATUALIZA KM ATUAL
      ================================================== */

      if (carro) {
        const kmAtual =
          typeof carro.currentMileage === "number"
            ? carro.currentMileage
            : null;

        if (
          kmAtual == null ||
          kmNum > kmAtual
        ) {
          await db.cars.update(
            Number(carId),
            {
              currentMileage: kmNum,
            }
          );

          kmFoiAtualizado = true;

          /* ==================================================
             ATUALIZA FIPE AUTOMATICAMENTE
          ================================================== */

          if (
            carro.fipeCode &&
            carro.fipeYearId
          ) {
            const carroComNovaKm = {
              ...carro,
              currentMileage: kmNum,
            };

            const resultadoFipe =
              await atualizarFipeDoCarro(
                carroComNovaKm,
                db
              );

            if (resultadoFipe?.atualizado) {
              fipeFoiAtualizada = true;
            } else {
              fipeFalhou = true;

              console.warn(
                "A quilometragem foi atualizada, mas a FIPE não pôde ser atualizada:",
                resultadoFipe?.motivo
              );
            }
          }
        }
      }

      /* ==================================================
         LIMPA FORMULÁRIO
      ================================================== */

      setKm("");
      setLitros("");
      setPrecoTotal("");
      setLocal("");
      setTanqueCheio(true);

      await carregar();

      /* ==================================================
         AVISO FINAL
      ================================================== */

      if (kmFoiAtualizado) {
        let mensagem =
          `Abastecimento salvo com sucesso.\n\n` +
          `A quilometragem atual do veículo foi atualizada para ${kmNum.toLocaleString(
            "pt-BR"
          )} km.\n\n` +
          `O controle de revisões passará a usar essa nova quilometragem.`;

        if (fipeFoiAtualizada) {
          mensagem +=
            `\n\nA Tabela FIPE também foi atualizada automaticamente.`;
        }

        if (fipeFalhou) {
          mensagem +=
            `\n\nA quilometragem foi atualizada, mas não foi possível atualizar a FIPE neste momento.`;
        }

        alert(mensagem);
      } else {
        alert("Abastecimento salvo com sucesso.");
      }

    } catch (erro) {
      console.error(
        "Erro ao salvar abastecimento:",
        erro
      );

      alert(
        "Não foi possível salvar o abastecimento."
      );
    } finally {
      setSalvando(false);
    }
  }

  /* ==================================================
     EXCLUIR
  ================================================== */

  async function excluirAbastecimento(id) {
    const ok = window.confirm(
      "Excluir este abastecimento?"
    );

    if (!ok) return;

    await db.abastecimentos.delete(id);

    await carregar();
  }

  /* ==================================================
     CONSUMO
  ================================================== */

  const consumo = useMemo(() => {
    const cheios = historico
      .filter((a) => a.tanqueCheio)
      .slice()
      .sort(
        (a, b) =>
          (a.km || 0) -
          (b.km || 0)
      );

    const trechos = [];

    for (
      let i = 1;
      i < cheios.length;
      i++
    ) {
      const anterior =
        cheios[i - 1];

      const atual =
        cheios[i];

      const distancia =
        (atual.km || 0) -
        (anterior.km || 0);

      const litrosUsados =
        Number(atual.litros);

      if (
        distancia > 0 &&
        Number.isFinite(litrosUsados) &&
        litrosUsados > 0
      ) {
        const kmPorLitro =
          distancia / litrosUsados;

        const litrosPor100 =
          (litrosUsados / distancia) *
          100;

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

    const ultimo =
      trechos.length
        ? trechos[
            trechos.length - 1
          ]
        : null;

    const mediaKmL =
      trechos.length
        ? trechos.reduce(
            (s, t) =>
              s + t.kmPorLitro,
            0
          ) / trechos.length
        : null;

    return {
      trechos,
      ultimo,
      mediaKmL,
    };
  }, [historico]);

  /* ==================================================
     CARRO NÃO ENCONTRADO
  ================================================== */

  if (!carro) {
    return (
      <div className="carrev-abastecimento-page">

        <button
          type="button"
          className="carrev-back-button"
          onClick={aoVoltar}
        >
          ← Voltar
        </button>

        <div className="carrev-empty-card">
          Carro não encontrado.
        </div>

      </div>
    );
  }

  /* ==================================================
     TELA
  ================================================== */

  return (
    <div className="carrev-abastecimento-page">

      {/* TOPO */}

      <div className="carrev-abastecimento-top">

        <button
          type="button"
          className="carrev-back-button"
          onClick={aoVoltar}
        >
          ← Voltar
        </button>

        <div className="carrev-abastecimento-header">

          <div>

            <div className="carrev-abastecimento-kicker">
              Abastecimento
            </div>

            <h1>
              {carro.name}
            </h1>

            <div className="carrev-abastecimento-subtitle">
              Registre abastecimentos e acompanhe o consumo do veículo.
            </div>

          </div>

        </div>

      </div>

      {/* ==================================================
          RESUMO
      ================================================== */}

      <section className="carrev-abastecimento-resumo">

        <div className="carrev-consumo-card">

          <div className="carrev-consumo-icon">
            ⛽
          </div>

          <div>

            <div className="carrev-consumo-label">
              Último consumo
            </div>

            <div className="carrev-consumo-value">
              {consumo.ultimo
                ? `${formatarNumero(
                    consumo.ultimo.kmPorLitro
                  )} km/L`
                : "—"}
            </div>

          </div>

        </div>

        <div className="carrev-consumo-card">

          <div className="carrev-consumo-icon">
            ◎
          </div>

          <div>

            <div className="carrev-consumo-label">
              Média
            </div>

            <div className="carrev-consumo-value">
              {consumo.mediaKmL != null
                ? `${formatarNumero(
                    consumo.mediaKmL
                  )} km/L`
                : "—"}
            </div>

          </div>

        </div>

        <div className="carrev-consumo-card">

          <div className="carrev-consumo-icon">
            ▤
          </div>

          <div>

            <div className="carrev-consumo-label">
              Registros
            </div>

            <div className="carrev-consumo-value">
              {historico.length}
            </div>

          </div>

        </div>

      </section>

      {/* ==================================================
          NOVO ABASTECIMENTO
      ================================================== */}

      <section className="carrev-abastecimento-card">

        <div className="carrev-section-header">

          <div>

            <h2>
              Novo abastecimento
            </h2>

            <p>
              Preencha os dados do abastecimento.
            </p>

          </div>

        </div>

        <form
          onSubmit={salvarAbastecimento}
          className="carrev-abastecimento-form"
        >

          <div className="carrev-abastecimento-form-grid">

            <label>
              Data

              <input
                type="date"
                value={data}
                onChange={(e) =>
                  setData(e.target.value)
                }
                required
              />
            </label>

            <label>
              Quilometragem

              <input
                type="number"
                inputMode="numeric"
                value={km}
                onChange={(e) =>
                  setKm(e.target.value)
                }
                placeholder="Ex.: 45.210"
                required
              />
            </label>

            <label>
              Litros abastecidos

              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={litros}
                onChange={(e) =>
                  setLitros(e.target.value)
                }
                placeholder="Ex.: 42,50"
                required
              />
            </label>

            <label>
              Preço total

              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={precoTotal}
                onChange={(e) =>
                  setPrecoTotal(
                    e.target.value
                  )
                }
                placeholder="Ex.: 260,00"
              />
            </label>

            <label className="carrev-form-span-2">
              Posto / Local

              <input
                value={local}
                onChange={(e) =>
                  setLocal(e.target.value)
                }
                placeholder="Ex.: Posto X / Belo Horizonte"
              />
            </label>

          </div>

          <label className="carrev-checkbox-row">

            <input
              type="checkbox"
              checked={tanqueCheio}
              onChange={(e) =>
                setTanqueCheio(
                  e.target.checked
                )
              }
            />

            <div>

              <strong>
                Encheu o tanque
              </strong>

              <span>
                Use esta opção para calcular o consumo entre abastecimentos.
              </span>

            </div>

          </label>

          <button
            type="submit"
            className="carrev-primary-button"
            disabled={salvando}
          >
            {salvando
              ? "Salvando..."
              : "Salvar abastecimento"}
          </button>

        </form>

      </section>

      {/* ==================================================
          HISTÓRICO
      ================================================== */}

      <section className="carrev-abastecimento-card">

        <div className="carrev-section-header">

          <div>

            <h2>
              Histórico
            </h2>

            <p>
              Abastecimentos registrados para este veículo.
            </p>

          </div>

        </div>

        {historico.length === 0 ? (

          <div className="carrev-empty-card">
            Nenhum abastecimento cadastrado.
          </div>

        ) : (

          <div className="carrev-abastecimento-lista">

            {historico
              .slice()
              .sort(
                (a, b) =>
                  (b.km || 0) -
                  (a.km || 0)
              )
              .map((a) => (

                <article
                  key={a.id}
                  className="carrev-abastecimento-item"
                >

                  <div className="carrev-abastecimento-item-main">

                    <div className="carrev-abastecimento-item-icon">
                      ⛽
                    </div>

                    <div>

                      <div className="carrev-abastecimento-item-title">
                        {formatarData(
                          a.data
                        )}
                      </div>

                      <div className="carrev-abastecimento-item-info">

                        <span>
                          ◎{" "}
                          {formatarKm(
                            a.km
                          )}{" "}
                          km
                        </span>

                        <span>
                          {formatarNumero(
                            Number(
                              a.litros
                            )
                          )}{" "}
                          L
                        </span>

                        {a.precoTotal != null ? (
                          <span>
                            R${" "}
                            {formatarNumero(
                              Number(
                                a.precoTotal
                              ),
                              2
                            )}
                          </span>
                        ) : null}

                        {a.local ? (
                          <span>
                            {a.local}
                          </span>
                        ) : null}

                      </div>

                      <div className="carrev-abastecimento-tanque">
                        {a.tanqueCheio
                          ? "Tanque cheio"
                          : "Abastecimento parcial"}
                      </div>

                    </div>

                  </div>

                  <button
                    type="button"
                    className="carrev-danger-button"
                    onClick={() =>
                      excluirAbastecimento(
                        a.id
                      )
                    }
                  >
                    Excluir
                  </button>

                </article>

              ))}

          </div>

        )}

      </section>

      {/* ==================================================
          CONSUMO
      ================================================== */}

      <section className="carrev-abastecimento-card">

        <div className="carrev-section-header">

          <div>

            <h2>
              Consumo
            </h2>

            <p>
              Calculado entre abastecimentos marcados como tanque cheio.
            </p>

          </div>

        </div>

        {consumo.trechos.length === 0 ? (

          <div className="carrev-empty-card">
            Para calcular o consumo, marque
            <strong>
              {" "}“Encheu o tanque”
            </strong>
            {" "}em pelo menos dois abastecimentos.
          </div>

        ) : (

          <div className="carrev-consumo-lista">

            {consumo.trechos
              .slice()
              .reverse()
              .map((t, idx) => (

                <article
                  key={idx}
                  className="carrev-consumo-item"
                >

                  <div>

                    <div className="carrev-consumo-item-title">
                      {formatarKm(
                        t.deKm
                      )}
                      {" → "}
                      {formatarKm(
                        t.paraKm
                      )}
                      {" km"}
                    </div>

                    <div className="carrev-consumo-item-meta">
                      {formatarKm(
                        t.distancia
                      )}
                      {" km • "}

                      {formatarNumero(
                        t.litrosUsados
                      )}
                      {" L"}

                      {t.data
                        ? ` • ${formatarData(
                            t.data
                          )}`
                        : ""}
                    </div>

                  </div>

                  <div className="carrev-consumo-item-result">

                    <strong>
                      {formatarNumero(
                        t.kmPorLitro
                      )}{" "}
                      km/L
                    </strong>

                    <span>
                      {formatarNumero(
                        t.litrosPor100
                      )}{" "}
                      L/100 km
                    </span>

                  </div>

                </article>

              ))}

          </div>

        )}

      </section>

    </div>
  );
}