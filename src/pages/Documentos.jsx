import "./Revisoes.css";
import "./Documentos.css";
import { useEffect, useMemo, useState } from "react";
import { useDb } from "../db/db";

const CNH_ANDROID_PACKAGE = "br.gov.serpro.cnhe";

const CNH_WEB_URL =
  "https://portalservicos.senatran.serpro.gov.br/#/home";

const CNH_IOS_URL =
  "https://apps.apple.com/br/app/cnh-do-brasil/id1275057217";

const IPVA_MG_URL =
  "https://veiculosmg.fazenda.mg.gov.br/";

function dataHora(valor) {
  if (!valor) return "";

  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(valor));
  } catch {
    return "";
  }
}

function formatarData(valor) {
  if (!valor) return "—";

  const [ano, mes, dia] = String(valor).split("-");

  if (!ano || !mes || !dia) {
    return valor;
  }

  return `${dia}/${mes}/${ano}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function Documentos({ carId }) {
  const db = useDb();
  const id = Number(carId);

  const [carro, setCarro] = useState(null);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const [renavamCopiado, setRenavamCopiado] = useState(false);

  /* ==================================================
     IPVA
  ================================================== */

  const anoAtual = new Date().getFullYear();

  const [exercicioIpva, setExercicioIpva] = useState(
    String(anoAtual)
  );

  const [valorIpva, setValorIpva] = useState("");
  const [vencimentoIpva, setVencimentoIpva] = useState("");
  const [dataPagamentoIpva, setDataPagamentoIpva] = useState("");

  async function carregar() {
    const c = await db.cars.get(id);
    setCarro(c || null);
  }

  useEffect(() => {
    carregar();
  }, [id]);

  /* ==================================================
     CARREGA DADOS DO IPVA
  ================================================== */

  useEffect(() => {
    if (!carro) return;

    const dados =
      carro.ipva?.[String(exercicioIpva)] || null;

    setValorIpva(
      dados?.valor != null
        ? String(dados.valor)
        : ""
    );

    setVencimentoIpva(
      dados?.vencimento || ""
    );

    setDataPagamentoIpva(
      dados?.dataPagamento || ""
    );
  }, [carro, exercicioIpva]);

  /* ==================================================
     PDF DO CRLV
  ================================================== */

  useEffect(() => {
    if (!carro?.crlvPdf) {
      setPdfUrl(null);
      return undefined;
    }

    const url = URL.createObjectURL(
      carro.crlvPdf
    );

    setPdfUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [carro?.crlvPdf]);

  /* ==================================================
     CRLV
  ================================================== */

  async function salvarPdf(file) {
    if (!file) return;

    const ehPdf =
      file.type === "application/pdf" ||
      file.name
        .toLowerCase()
        .endsWith(".pdf");

    if (!ehPdf) {
      alert(
        "Selecione um arquivo PDF do documento do veículo."
      );
      return;
    }

    setSalvando(true);

    try {
      await db.cars.update(id, {
        crlvPdf: file,
        crlvPdfName: file.name,
        crlvPdfUpdatedAt:
          new Date().toISOString(),
      });

      await carregar();
    } catch (erro) {
      console.error(
        "Erro ao salvar PDF:",
        erro
      );

      alert(
        "Não foi possível salvar o PDF."
      );
    } finally {
      setSalvando(false);
    }
  }

  async function removerPdf() {
    const ok = window.confirm(
      "Remover o CRLV salvo deste veículo?"
    );

    if (!ok) return;

    try {
      await db.cars.update(id, {
        crlvPdf: null,
        crlvPdfName: null,
        crlvPdfUpdatedAt: null,
      });

      await carregar();
    } catch (erro) {
      console.error(
        "Erro ao remover PDF:",
        erro
      );

      alert(
        "Não foi possível remover o documento."
      );
    }
  }

  /* ==================================================
     CNH DO BRASIL
  ================================================== */

  function abrirCnhBrasil() {
    const userAgent =
      navigator.userAgent || "";

    const isAndroid =
      /Android/i.test(userAgent);

    const isIOS =
      /iPhone|iPad|iPod/i.test(
        userAgent
      );

    if (isAndroid) {
      const intentUrl =
        `intent://#Intent;` +
        `scheme=cnhe;` +
        `package=${CNH_ANDROID_PACKAGE};` +
        `S.browser_fallback_url=${encodeURIComponent(
          CNH_WEB_URL
        )};` +
        `end`;

      window.location.href =
        intentUrl;

      return;
    }

    if (isIOS) {
      window.location.href =
        CNH_IOS_URL;

      return;
    }

    window.open(
      CNH_WEB_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* ==================================================
     RENAVAM
  ================================================== */

  const renavam =
    String(
      carro?.renavam || ""
    ).trim();

  async function copiarRenavam() {
    if (!renavam) {
      alert(
        "Cadastre o RENAVAM deste veículo primeiro."
      );

      return;
    }

    try {
      await navigator.clipboard.writeText(
        renavam
      );

      setRenavamCopiado(true);

      setTimeout(() => {
        setRenavamCopiado(false);
      }, 1800);

    } catch {
      const textarea =
        document.createElement(
          "textarea"
        );

      textarea.value = renavam;

      textarea.style.position =
        "fixed";

      textarea.style.opacity =
        "0";

      document.body.appendChild(
        textarea
      );

      textarea.focus();
      textarea.select();

      try {
        document.execCommand(
          "copy"
        );

        setRenavamCopiado(true);

        setTimeout(() => {
          setRenavamCopiado(false);
        }, 1800);

      } catch {
        alert(
          `RENAVAM: ${renavam}`
        );
      }

      document.body.removeChild(
        textarea
      );
    }
  }

  function abrirIpva() {
    if (!renavam) {
      const continuar =
        window.confirm(
          "Este veículo ainda não possui RENAVAM cadastrado no CarRev.\n\nDeseja abrir o portal oficial mesmo assim?"
        );

      if (!continuar) return;
    }

    window.open(
      IPVA_MG_URL,
      "_blank",
      "noopener,noreferrer"
    );
  }

  /* ==================================================
     DADOS DO IPVA
  ================================================== */

  const ipvaDoExercicio =
    carro?.ipva?.[
      String(exercicioIpva)
    ] || null;

  /*
    REGRA NOVA:
    Se ainda não existe registro do exercício,
    consideramos PENDENTE por padrão.
  */

  const statusIpva =
    ipvaDoExercicio?.status ||
    "PENDENTE";

  const anosDisponiveis =
    useMemo(() => {
      const anos = [];

      for (
        let ano = anoAtual;
        ano >= anoAtual - 5;
        ano--
      ) {
        anos.push(ano);
      }

      return anos;
    }, [anoAtual]);

  async function salvarDadosIpva({
    status = statusIpva,
    dataPagamento = dataPagamentoIpva,
  } = {}) {
    if (!carro) return;

    const valorNumerico =
      valorIpva.trim() === ""
        ? null
        : Number(
            valorIpva.replace(
              ",",
              "."
            )
          );

    if (
      valorNumerico != null &&
      (
        !Number.isFinite(
          valorNumerico
        ) ||
        valorNumerico < 0
      )
    ) {
      alert(
        "Informe um valor de IPVA válido."
      );

      return;
    }

    const ipvaAtual =
      carro.ipva || {};

    const novosDados = {
      ...ipvaAtual,

      [String(exercicioIpva)]: {
        status,

        valor:
          valorNumerico,

        vencimento:
          vencimentoIpva ||
          null,

        dataPagamento:
          status === "PAGO"
            ? (
                dataPagamento ||
                hojeISO()
              )
            : null,

        atualizadoEm:
          new Date().toISOString(),
      },
    };

    await db.cars.update(id, {
      ipva: novosDados,
    });

    await carregar();
  }

  async function registrarPagamento() {
    const dataFinal =
      dataPagamentoIpva ||
      hojeISO();

    setDataPagamentoIpva(
      dataFinal
    );

    await salvarDadosIpva({
      status: "PAGO",
      dataPagamento:
        dataFinal,
    });

    alert(
      `IPVA ${exercicioIpva} registrado como pago.`
    );
  }

  async function marcarPendente() {
    setDataPagamentoIpva("");

    await salvarDadosIpva({
      status: "PENDENTE",
      dataPagamento: "",
    });

    alert(
      `IPVA ${exercicioIpva} voltou para pendente.`
    );
  }

  function statusTexto() {
    if (statusIpva === "PAGO") {
      return "Pago";
    }

    return "Pendente";
  }

  function statusCor() {
    if (statusIpva === "PAGO") {
      return "#22c55e";
    }

    return "#ef4444";
  }

  /* ==================================================
     TELA
  ================================================== */

  return (
    <section className="revisoes-tela documentos-tela">
      <h2>Documentos</h2>

      <div className="documentos-grid">

        {/* ==================================================
            CRLV
        ================================================== */}

        <div className="documento-card revisoes-registro">

          <div className="documento-cabecalho">

            <div
              className="documento-icone pdf-icone"
              aria-hidden="true"
            >
              PDF
            </div>

            <div>

              <strong>
                CRLV do veículo
              </strong>

              <div className="documento-subtitulo">
                Guarde uma cópia em PDF para acesso rápido.
              </div>

            </div>

          </div>

          {carro?.crlvPdf ? (

            <div className="documento-arquivo">

              <div>

                <b>
                  {carro.crlvPdfName ||
                    "CRLV.pdf"}
                </b>

                {carro.crlvPdfUpdatedAt ? (

                  <div className="documento-meta">

                    Salvo em{" "}

                    {dataHora(
                      carro.crlvPdfUpdatedAt
                    )}

                  </div>

                ) : null}

              </div>

              <div className="documento-acoes">

                <a
                  className="botao-link"
                  href={
                    pdfUrl || "#"
                  }
                  target="_blank"
                  rel="noreferrer"
                  aria-disabled={
                    !pdfUrl
                  }
                >
                  Abrir PDF
                </a>

                <label className="botao-link secundario">

                  Substituir

                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    className="documento-seletor-pdf"
                    disabled={
                      salvando
                    }
                    onChange={(e) => {
                      const arquivo =
                        e.target
                          .files?.[0];

                      if (arquivo) {
                        salvarPdf(
                          arquivo
                        );
                      }

                      e.target.value =
                        "";
                    }}
                  />

                </label>

                <button
                  type="button"
                  className="botao-link perigo"
                  onClick={
                    removerPdf
                  }
                >
                  Excluir
                </button>

              </div>

            </div>

          ) : (

            <label className="upload-pdf">

              <span className="upload-pdf-titulo">

                {salvando
                  ? "Salvando..."
                  : "Adicionar CRLV em PDF"}

              </span>

              <span className="upload-pdf-texto">
                Toque aqui e selecione o documento salvo no celular ou computador.
              </span>

              <input
                type="file"
                accept="application/pdf,.pdf"
                className="documento-seletor-pdf"
                disabled={
                  salvando
                }
                onChange={(e) => {
                  const arquivo =
                    e.target
                      .files?.[0];

                  if (arquivo) {
                    salvarPdf(
                      arquivo
                    );
                  }

                  e.target.value =
                    "";
                }}
              />

            </label>

          )}

        </div>

        {/* ==================================================
            IPVA
        ================================================== */}

        <div className="documento-card revisoes-registro">

          <div className="documento-cabecalho">

            <div
              className="documento-icone"
              aria-hidden="true"
              style={{
                background:
                  statusIpva === "PAGO"
                    ? "rgba(34, 197, 94, 0.14)"
                    : "rgba(239, 68, 68, 0.14)",

                color:
                  statusIpva === "PAGO"
                    ? "#22c55e"
                    : "#ef4444",

                flexDirection:
                  "column",

                lineHeight: 1,
              }}
            >

              <span
                style={{
                  fontSize: 15,
                  fontWeight: 900,
                }}
              >
                IPVA
              </span>

              <small
                style={{
                  marginTop: 5,
                  fontSize: 8,
                }}
              >
                MG
              </small>

            </div>

            <div>

              <strong>
                IPVA
              </strong>

              <div className="documento-subtitulo">
                Controle o pagamento e consulte a situação oficial.
              </div>

            </div>

          </div>

          {/* EXERCÍCIO E STATUS */}

          <div
            style={{
              marginTop: 18,
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 10,
            }}
          >

            <label
              style={{
                display:
                  "grid",
                gap: 5,
                fontSize: 11,
                color:
                  "#c3d0bc",
              }}
            >

              Exercício

              <select
                value={
                  exercicioIpva
                }
                onChange={(e) =>
                  setExercicioIpva(
                    e.target.value
                  )
                }
              >

                {anosDisponiveis.map(
                  (ano) => (
                    <option
                      key={ano}
                      value={ano}
                    >
                      {ano}
                    </option>
                  )
                )}

              </select>

            </label>

            <div>

              <div
                style={{
                  color:
                    "#c3d0bc",
                  fontSize: 11,
                  marginBottom: 7,
                }}
              >
                Situação
              </div>

              <div
                style={{
                  minHeight: 42,
                  display:
                    "flex",
                  alignItems:
                    "center",
                  gap: 8,
                  padding:
                    "0 11px",
                  border:
                    "1px solid #668061",
                  borderRadius: 9,
                  background:
                    "#102d1c",
                  color:
                    statusCor(),
                  fontWeight: 800,
                  fontSize: 13,
                }}
              >

                <span>
                  ●
                </span>

                {statusTexto()}

              </div>

            </div>

          </div>

          {/* RENAVAM */}

          <div
            className="documento-arquivo"
            style={{
              marginTop: 12,
            }}
          >

            <div>

              <div
                style={{
                  color:
                    "#c3d0bc",
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                RENAVAM
              </div>

              <b
                style={{
                  fontSize: 16,
                  letterSpacing:
                    0.5,
                }}
              >
                {renavam ||
                  "Não cadastrado"}
              </b>

            </div>

            <div className="documento-acoes">

              <button
                type="button"
                className="botao-link secundario"
                onClick={
                  copiarRenavam
                }
                disabled={
                  !renavam
                }
              >

                {renavamCopiado
                  ? "✓ Copiado"
                  : "Copiar RENAVAM"}

              </button>

              <button
                type="button"
                className="botao-link"
                onClick={
                  abrirIpva
                }
              >
                Consultar situação oficial ↗
              </button>

            </div>

          </div>

          {/* ==================================================
              VALOR E VENCIMENTO
          ================================================== */}

          <div
            style={{
              display: "grid",
              gap: 10,
              marginTop: 12,
            }}
          >

            <label
              style={{
                display:
                  "grid",
                gap: 5,
                color:
                  "#c3d0bc",
                fontSize: 11,
              }}
            >

              Valor do IPVA

              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={
                  valorIpva
                }
                onChange={(e) =>
                  setValorIpva(
                    e.target.value
                  )
                }
                placeholder="Ex.: 1850,00"
              />

            </label>

            <label
              style={{
                display:
                  "grid",
                gap: 5,
                color:
                  "#c3d0bc",
                fontSize: 11,
              }}
            >

              Vencimento

              <input
                type="date"
                value={
                  vencimentoIpva
                }
                onChange={(e) =>
                  setVencimentoIpva(
                    e.target.value
                  )
                }
              />

            </label>

            {statusIpva ===
            "PAGO" ? (

              <label
                style={{
                  display:
                    "grid",
                  gap: 5,
                  color:
                    "#c3d0bc",
                  fontSize: 11,
                }}
              >

                Data do pagamento

                <input
                  type="date"
                  value={
                    dataPagamentoIpva
                  }
                  onChange={(e) =>
                    setDataPagamentoIpva(
                      e.target.value
                    )
                  }
                />

              </label>

            ) : null}

          </div>

          {/* ==================================================
              DADOS SALVOS
          ================================================== */}

          {ipvaDoExercicio ? (

            <div
              style={{
                marginTop: 12,
                padding: 12,
                border:
                  "1px solid #486447",
                borderRadius: 11,
                background:
                  "#102d1c",
                fontSize: 11,
                color:
                  "#c3d0bc",
                lineHeight: 1.6,
              }}
            >

              {ipvaDoExercicio?.valor !=
              null ? (

                <div>
                  <b>
                    Valor:
                  </b>{" "}
                  R${" "}
                  {Number(
                    ipvaDoExercicio.valor
                  ).toLocaleString(
                    "pt-BR",
                    {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    }
                  )}
                </div>

              ) : null}

              {ipvaDoExercicio?.vencimento ? (

                <div>
                  <b>
                    Vencimento:
                  </b>{" "}
                  {formatarData(
                    ipvaDoExercicio.vencimento
                  )}
                </div>

              ) : null}

              {statusIpva ===
                "PAGO" &&
              ipvaDoExercicio?.dataPagamento ? (

                <div>
                  <b>
                    Pago em:
                  </b>{" "}
                  {formatarData(
                    ipvaDoExercicio.dataPagamento
                  )}
                </div>

              ) : null}

            </div>

          ) : null}

          {/* ==================================================
              AÇÕES
          ================================================== */}

          <div
            className="documento-acoes"
            style={{
              marginTop: 14,
            }}
          >

            {statusIpva ===
            "PENDENTE" ? (

              <button
                type="button"
                className="botao-link"
                onClick={
                  registrarPagamento
                }
              >
                ✓ Registrar pagamento
              </button>

            ) : (

              <button
                type="button"
                className="botao-link perigo"
                onClick={
                  marcarPendente
                }
              >
                Marcar como pendente
              </button>

            )}

          </div>

          <button
            type="button"
            className="botao-link secundario"
            onClick={() =>
              salvarDadosIpva()
            }
            style={{
              width: "100%",
              marginTop: 10,
            }}
          >
            Salvar valor e vencimento
          </button>

          <div
            style={{
              marginTop: 12,
              color:
                "#c3d0bc",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            O CarRev considera o IPVA pendente até que o pagamento seja registrado. Use “Consultar situação oficial” para confirmar os dados no portal do Governo.
          </div>

        </div>

        {/* ==================================================
            CNH DO BRASIL
        ================================================== */}

        <button
          type="button"
          className="documento-card revisoes-registro cnh-card"
          onClick={
            abrirCnhBrasil
          }
          title="Abrir CNH do Brasil"
        >

          <div className="documento-cabecalho">

            <div
              className="documento-icone cnh-icone"
              aria-hidden="true"
            >

              <span>
                CNH
              </span>

              <small>
                BRASIL
              </small>

            </div>

            <div>

              <strong>
                CNH do Brasil
              </strong>

              <div className="documento-subtitulo">
                Consulte multas, infrações e informações oficiais do veículo.
              </div>

            </div>

          </div>

          <div className="cnh-acao">
            Abrir CNH do Brasil ↗
          </div>

        </button>

      </div>

      {/* ==================================================
          AVISO
      ================================================== */}

      <p className="documentos-aviso">

        O PDF do CRLV fica disponível nos documentos do veículo na sua garagem.

        {" "}

        O CarRev não recebe sua senha Gov.br nem os dados consultados nos serviços oficiais.

        {" "}

        A situação de pagamento do IPVA registrada no CarRev é um controle pessoal e não substitui a consulta oficial.

      </p>

    </section>
  );
}