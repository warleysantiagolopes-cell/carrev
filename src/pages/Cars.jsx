import BotaoVoltar from "./BotaoVoltar";
import GaragemHome from "./GaragemHome";
// src/pages/Cars.jsx

import { useEffect, useRef, useState } from "react";
import { useDb } from "../db/db";

import CarroDetalhe from "./CarroDetalhe";
import LampadasVeiculo, { limparLampadas } from "./LampadasVeiculo";
import AbastecimentosCarro from "./AbastecimentosCarro";
import AlertasHome from "./AlertasHome";

import {
  listarMarcasFipe,
  listarModelosFipe,
  listarAnosFipe,
  consultarFipePorSelecao,
  converterPrecoFipe,
  atualizarFipeDoCarro,
} from "../services/fipe";

const COMBUSTIVEIS = [
  "",
  "Gasolina",
  "Etanol",
  "Flex",
  "Diesel",
  "GNV",
  "Elétrico",
  "Híbrido",
];

/* ==================================================
   HELPERS
================================================== */

function diasAte(dataYYYYMMDD) {
  const [y, m, d] = String(dataYYYYMMDD)
    .split("-")
    .map(Number);

  const alvo = new Date(
    y,
    m - 1,
    d,
    0,
    0,
    0,
    0
  );

  const hoje = new Date();

  const base = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate(),
    0,
    0,
    0,
    0
  );

  const diffMs =
    alvo.getTime() -
    base.getTime();

  return Math.round(
    diffMs /
      (1000 * 60 * 60 * 24)
  );
}

function statusPorData(dias) {
  if (dias < 0) return "VENCIDA";
  if (dias <= 14) {
    return "EM BREVE";
  }

  return "OK";
}

function statusPorKm(
  kmRestante
) {
  if (kmRestante < 0) {
    return "VENCIDA";
  }

  if (kmRestante <= 500) {
    return "EM BREVE";
  }

  return "OK";
}

function piorStatus(a, b) {
  const rank = {
    VENCIDA: 3,
    "EM BREVE": 2,
    OK: 1,
  };

  return rank[a] >= rank[b]
    ? a
    : b;
}

function dinheiroParaNumero(
  valor
) {
  const original =
    String(valor ?? "").trim();

  if (!original) {
    return null;
  }

  let texto = original
    .replace(/R\$/gi, "")
    .replace(/\s/g, "");

  /*
    Aceita:
    35000
    35000,50
    35000.50
    35.000,50
  */

  if (
    texto.includes(".") &&
    texto.includes(",")
  ) {
    texto = texto
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (
    texto.includes(",")
  ) {
    texto = texto.replace(
      ",",
      "."
    );
  }

  texto = texto.replace(
    /[^\d.-]/g,
    ""
  );

  const n = Number(texto);

  return Number.isFinite(n)
    ? n
    : null;
}

/* ==================================================
   BADGE DE REVISÕES
================================================== */

async function calcularBadgeDoCarro(db,
  carId,
  kmAtual
) {
  if (!db.services) {
    return {
      total: 0,
      vencidas: 0,
      emBreve: 0,
      ok: 0,
      status: "OK",
    };
  }

  const revisoes =
    await db.services
      .where("carId")
      .equals(
        Number(carId)
      )
      .toArray();

  const futuras =
    revisoes.filter(
      (r) =>
        r.nextDate ||
        r.nextMileage != null
    );

  let vencidas = 0;
  let emBreve = 0;
  let ok = 0;

  let statusFinal = "OK";

  for (const r of futuras) {
    const dias =
      r.nextDate
        ? diasAte(r.nextDate)
        : null;

    const kmRestante =
      r.nextMileage != null &&
      typeof kmAtual ===
        "number"
        ? r.nextMileage -
          kmAtual
        : null;

    let st = "OK";

    if (dias != null) {
      st = piorStatus(
        st,
        statusPorData(dias)
      );
    }

    if (
      kmRestante != null
    ) {
      st = piorStatus(
        st,
        statusPorKm(
          kmRestante
        )
      );
    }

    if (
      st === "VENCIDA"
    ) {
      vencidas++;
    } else if (
      st === "EM BREVE"
    ) {
      emBreve++;
    } else {
      ok++;
    }

    statusFinal =
      piorStatus(
        statusFinal,
        st
      );
  }

  return {
    total: futuras.length,
    vencidas,
    emBreve,
    ok,
    status:
      statusFinal,
  };
}

/* ==================================================
   COMPONENTE PRINCIPAL
================================================== */

export default function Cars({
  onAbrirProximas,
}) {
  const db = useDb();
  const [
    carros,
    setCarros,
  ] = useState([]);

  const [
    carroSelecionadoId,
    setCarroSelecionadoId,
  ] = useState(null);

  const [
    abastecerCarId,
    setAbastecerCarId,
  ] = useState(null);

  const [
    mostrarCadastro,
    setMostrarCadastro,
  ] = useState(false);

  const [modoLista, setModoLista] = useState(false);

  const listaCarrosRef =
    useRef(null);

  /* ==================================================
     RESUMO
  ================================================== */

  const [
    resumoGaragem,
    setResumoGaragem,
  ] = useState({
    veiculos: 0,
    emDia: 0,
    emBreve: 0,
    vencidas: 0,
  });

  /* ==================================================
     CADASTRO BÁSICO
  ================================================== */

  const [
    nome,
    setNome,
  ] = useState("");

  const [
    modelo,
    setModelo,
  ] = useState("");

  const [
    ano,
    setAno,
  ] = useState("");

  const [
    placa,
    setPlaca,
  ] = useState("");

  const [
    chassi,
    setChassi,
  ] = useState("");

  const [
    renavam,
    setRenavam,
  ] = useState("");

  const [
    combustivel,
    setCombustivel,
  ] = useState("");

  const [
    oleo,
    setOleo,
  ] = useState("");

  const [
    pneu,
    setPneu,
  ] = useState("");

  const [lampadas, setLampadas] = useState({});
  const [adquiridoEm, setAdquiridoEm] = useState("");

  const [
    valorPago,
    setValorPago,
  ] = useState("");

  /* ==================================================
     FIPE - CADASTRO
  ================================================== */

  const [
    fipeMarcas,
    setFipeMarcas,
  ] = useState([]);

  const [
    fipeModelos,
    setFipeModelos,
  ] = useState([]);

  const [
    fipeAnos,
    setFipeAnos,
  ] = useState([]);

  const [
    fipeMarcaId,
    setFipeMarcaId,
  ] = useState("");

  const [
    fipeModeloId,
    setFipeModeloId,
  ] = useState("");

  const [
    fipeAnoId,
    setFipeAnoId,
  ] = useState("");

  const [
    carregandoFipe,
    setCarregandoFipe,
  ] = useState(false);

  /* ==================================================
     EDIÇÃO
  ================================================== */

  const [
    editId,
    setEditId,
  ] = useState(null);

  const [
    editNome,
    setEditNome,
  ] = useState("");

  const [
    editModelo,
    setEditModelo,
  ] = useState("");

  const [
    editAno,
    setEditAno,
  ] = useState("");

  const [
    editPlaca,
    setEditPlaca,
  ] = useState("");

  const [
    editChassi,
    setEditChassi,
  ] = useState("");

  const [
    editRenavam,
    setEditRenavam,
  ] = useState("");

  const [
    editCombustivel,
    setEditCombustivel,
  ] = useState("");

  const [
    editOleo,
    setEditOleo,
  ] = useState("");

  const [
    editPneu,
    setEditPneu,
  ] = useState("");

  const [editLampadasPorTipo, setEditLampadasPorTipo] = useState({});
  const [editAdquiridoEm, setEditAdquiridoEm] = useState("");

  const [
    editLampadas,
    setEditLampadas,
  ] = useState("");

  const [
    editValorPago,
    setEditValorPago,
  ] = useState("");

  /* ==================================================
     FIPE - EDIÇÃO
  ================================================== */

  const [
    editFipeModelos,
    setEditFipeModelos,
  ] = useState([]);

  const [
    editFipeAnos,
    setEditFipeAnos,
  ] = useState([]);

  const [
    editFipeMarcaId,
    setEditFipeMarcaId,
  ] = useState("");

  const [
    editFipeModeloId,
    setEditFipeModeloId,
  ] = useState("");

  const [
    editFipeAnoId,
    setEditFipeAnoId,
  ] = useState("");

  /* ==================================================
     KM
  ================================================== */

  const [
    kmId,
    setKmId,
  ] = useState(null);

  const [
    kmValor,
    setKmValor,
  ] = useState("");

  /* ==================================================
     CARREGAMENTO GERAL
  ================================================== */

  async function carregarCarros() {
    const todos =
      await db.cars.toArray();

    todos.sort((a, b) =>
      String(
        a.name || ""
      ).localeCompare(
        String(
          b.name || ""
        ),
        "pt-BR"
      )
    );

    setCarros(todos);

    let emDia = 0;
    let emBreve = 0;
    let vencidas = 0;

    for (
      const carro of todos
    ) {
      const kmAtual =
        typeof carro.currentMileage ===
        "number"
          ? carro.currentMileage
          : null;

      const badge =
        await calcularBadgeDoCarro(db,
          carro.id,
          kmAtual
        );

      emDia += badge.ok;

      emBreve +=
        badge.emBreve;

      vencidas +=
        badge.vencidas;
    }

    setResumoGaragem({
      veiculos:
        todos.length,
      emDia,
      emBreve,
      vencidas,
    });
  }

  /* ==================================================
     CARREGA MARCAS FIPE
  ================================================== */

  async function carregarMarcasFipe() {
    if (
      fipeMarcas.length > 0
    ) {
      return;
    }

    try {
      setCarregandoFipe(
        true
      );

      const marcas =
        await listarMarcasFipe();

      setFipeMarcas(
        Array.isArray(marcas)
          ? marcas
          : []
      );
    } catch (erro) {
      console.error(
        "Erro ao carregar marcas FIPE:",
        erro
      );
    } finally {
      setCarregandoFipe(
        false
      );
    }
  }

  useEffect(() => {
    carregarCarros();
    carregarMarcasFipe();
  }, []);

  /* ==================================================
     FIPE - CADASTRO
  ================================================== */

  async function selecionarMarcaCadastro(
    marcaId
  ) {
    setFipeMarcaId(
      marcaId
    );

    setFipeModeloId("");
    setFipeAnoId("");

    setFipeModelos([]);
    setFipeAnos([]);

    if (!marcaId) return;

    try {
      setCarregandoFipe(
        true
      );

      const modelos =
        await listarModelosFipe(
          marcaId
        );

      setFipeModelos(
        Array.isArray(
          modelos
        )
          ? modelos
          : []
      );
    } catch (erro) {
      console.error(
        "Erro ao carregar modelos FIPE:",
        erro
      );

      alert(
        "Não foi possível carregar os modelos da FIPE."
      );
    } finally {
      setCarregandoFipe(
        false
      );
    }
  }

  async function selecionarModeloCadastro(
    modeloId
  ) {
    setFipeModeloId(
      modeloId
    );

    setFipeAnoId("");
    setFipeAnos([]);

    if (!modeloId) return;

    try {
      setCarregandoFipe(
        true
      );

      const anos =
        await listarAnosFipe(
          fipeMarcaId,
          modeloId
        );

      setFipeAnos(
        Array.isArray(anos)
          ? anos
          : []
      );
    } catch (erro) {
      console.error(
        "Erro ao carregar anos FIPE:",
        erro
      );

      alert(
        "Não foi possível carregar os anos da FIPE."
      );
    } finally {
      setCarregandoFipe(
        false
      );
    }
  }

  /* ==================================================
     CADASTRO
  ================================================== */

  function limparCadastro() {
    setNome("");
    setModelo("");
    setAno("");
    setPlaca("");
    setChassi("");
    setRenavam("");
    setCombustivel("");
    setOleo("");
    setPneu("");
    setLampadas({});
    setAdquiridoEm("");
    setValorPago("");

    setFipeMarcaId("");
    setFipeModeloId("");
    setFipeAnoId("");

    setFipeModelos([]);
    setFipeAnos([]);
  }

  function abrirCadastro() {
    cancelarEdicao();
    cancelarKm();

    carregarMarcasFipe();

    setMostrarCadastro(
      true
    );
  }

  function cancelarCadastro() {
    limparCadastro();

    setMostrarCadastro(
      false
    );
  }

  async function adicionarCarro(
    e
  ) {
    e.preventDefault();

    if (!nome.trim()) {
      alert(
        "Informe o nome ou apelido do veículo."
      );

      return;
    }

    const valorPagoNumero =
      valorPago.trim() === ""
        ? null
        : dinheiroParaNumero(
            valorPago
          );

    if (
      valorPago.trim() !== "" &&
      (
        valorPagoNumero ==
          null ||
        valorPagoNumero < 0
      )
    ) {
      alert(
        "Informe um valor pago válido."
      );

      return;
    }

    const temAlgumaFipe =
      Boolean(
        fipeMarcaId ||
          fipeModeloId ||
          fipeAnoId
      );

    const fipeCompleta =
      Boolean(
        fipeMarcaId &&
          fipeModeloId &&
          fipeAnoId
      );

    if (
      temAlgumaFipe &&
      !fipeCompleta
    ) {
      alert(
        "Para configurar a FIPE, selecione Marca, Modelo e Ano/Versão."
      );

      return;
    }

    let dadosFipe = null;

    if (fipeCompleta) {
      try {
        setCarregandoFipe(
          true
        );

        dadosFipe =
          await consultarFipePorSelecao({
            marcaId:
              fipeMarcaId,

            modeloId:
              fipeModeloId,

            anoId:
              fipeAnoId,
          });
      } catch (erro) {
        console.error(
          "Erro ao consultar FIPE:",
          erro
        );

        alert(
          erro?.message ||
            "Não foi possível consultar a FIPE."
        );

        return;
      } finally {
        setCarregandoFipe(
          false
        );
      }
    }

    const novoCarro = {
      name:
        nome.trim(),

      model:
        modelo.trim(),

      year:
        ano.trim(),

      plate:
        placa.trim(),

      chassis:
        chassi.trim(),

      renavam:
        renavam.trim(),

      fuel:
        combustivel || "",

      oil:
        oleo.trim(),

      tire:
        pneu.trim(),

      bulbsByPosition: limparLampadas(lampadas),
      acquiredOn: adquiridoEm || null,

      purchasePrice:
        valorPagoNumero,

      currentMileage:
        null,

      photo: null,

      /* FIPE */

      fipeBrandId:
        fipeCompleta
          ? String(
              fipeMarcaId
            )
          : null,

      fipeModelId:
        fipeCompleta
          ? String(
              fipeModeloId
            )
          : null,

      fipeYearId:
        fipeCompleta
          ? String(
              fipeAnoId
            )
          : null,

      fipeCode:
        dadosFipe?.codeFipe ||
        null,

      fipeBrand:
        dadosFipe?.brand ||
        null,

      fipeModel:
        dadosFipe?.model ||
        null,

      fipeModelYear:
        dadosFipe?.modelYear ??
        null,

      fipeFuel:
        dadosFipe?.fuel ||
        null,

      fipeValue:
        dadosFipe?.price
          ? converterPrecoFipe(
              dadosFipe.price
            )
          : null,

      fipeValueFormatted:
        dadosFipe?.price ||
        null,

      fipeReference:
        dadosFipe?.referenceMonth ||
        null,

      fipeUpdatedAt:
        dadosFipe
          ? new Date().toISOString()
          : null,
    };

    await db.cars.add(
      novoCarro
    );

    limparCadastro();

    setMostrarCadastro(
      false
    );

    await carregarCarros();
  }

  /* ==================================================
     RESUMO
  ================================================== */

  function abrirVeiculosResumo() {
    if (
      carros.length === 0
    ) {
      abrirCadastro();
      return;
    }

    if (
      carros.length === 1
    ) {
      setCarroSelecionadoId(
        carros[0].id
      );

      return;
    }

    listaCarrosRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "start",
      }
    );
  }

  function abrirRevisoesStatus(
    status
  ) {
    if (onAbrirProximas) {
      onAbrirProximas(
        status
      );
    }
  }

  /* ==================================================
     EXCLUIR
  ================================================== */

  async function excluirCarro(
    id
  ) {
    await db.cars.delete(id);
    await carregarCarros();
  }

  /* ==================================================
     FIPE - EDIÇÃO
  ================================================== */

  async function selecionarMarcaEdicao(
    marcaId
  ) {
    setEditFipeMarcaId(
      marcaId
    );

    setEditFipeModeloId(
      ""
    );

    setEditFipeAnoId("");

    setEditFipeModelos(
      []
    );

    setEditFipeAnos([]);

    if (!marcaId) return;

    try {
      setCarregandoFipe(
        true
      );

      const modelos =
        await listarModelosFipe(
          marcaId
        );

      setEditFipeModelos(
        Array.isArray(
          modelos
        )
          ? modelos
          : []
      );
    } catch (erro) {
      console.error(
        erro
      );

      alert(
        "Não foi possível carregar os modelos FIPE."
      );
    } finally {
      setCarregandoFipe(
        false
      );
    }
  }

  async function selecionarModeloEdicao(
    modeloId
  ) {
    setEditFipeModeloId(
      modeloId
    );

    setEditFipeAnoId("");
    setEditFipeAnos([]);

    if (!modeloId) return;

    try {
      setCarregandoFipe(
        true
      );

      const anos =
        await listarAnosFipe(
          editFipeMarcaId,
          modeloId
        );

      setEditFipeAnos(
        Array.isArray(anos)
          ? anos
          : []
      );
    } catch (erro) {
      console.error(
        erro
      );

      alert(
        "Não foi possível carregar os anos FIPE."
      );
    } finally {
      setCarregandoFipe(
        false
      );
    }
  }

  /* ==================================================
     EDIÇÃO
  ================================================== */

  async function iniciarEdicao(
    carro
  ) {
    cancelarKm();

    setMostrarCadastro(
      false
    );

    setEditId(
      carro.id
    );

    setEditNome(
      carro.name || ""
    );

    setEditModelo(
      carro.model || ""
    );

    setEditAno(
      String(
        carro.year || ""
      )
    );

    setEditPlaca(
      carro.plate || ""
    );

    setEditChassi(
      carro.chassis || ""
    );

    setEditRenavam(
      carro.renavam || ""
    );

    setEditCombustivel(
      carro.fuel || ""
    );

    setEditOleo(
      carro.oil || ""
    );

    setEditPneu(
      carro.tire || ""
    );

    setEditLampadas(carro.bulbs || "");
    setEditLampadasPorTipo(carro.bulbsByPosition ?? {});
    setEditAdquiridoEm(String(carro.acquiredOn ?? "").slice(0, 4));

    setEditValorPago(
      carro.purchasePrice !=
      null
        ? String(
            carro.purchasePrice
          )
        : ""
    );

    const marcaId =
      carro.fipeBrandId
        ? String(
            carro.fipeBrandId
          )
        : "";

    const modeloId =
      carro.fipeModelId
        ? String(
            carro.fipeModelId
          )
        : "";

    const anoId =
      carro.fipeYearId
        ? String(
            carro.fipeYearId
          )
        : "";

    setEditFipeMarcaId(
      marcaId
    );

    setEditFipeModeloId(
      modeloId
    );

    setEditFipeAnoId(
      anoId
    );

    setEditFipeModelos(
      []
    );

    setEditFipeAnos([]);

    await carregarMarcasFipe();

    if (marcaId) {
      try {
        const modelos =
          await listarModelosFipe(
            marcaId
          );

        setEditFipeModelos(
          Array.isArray(
            modelos
          )
            ? modelos
            : []
        );

        if (modeloId) {
          const anos =
            await listarAnosFipe(
              marcaId,
              modeloId
            );

          setEditFipeAnos(
            Array.isArray(
              anos
            )
              ? anos
              : []
          );
        }
      } catch (erro) {
        console.error(
          "Erro ao carregar configuração FIPE:",
          erro
        );
      }
    }
  }

  function cancelarEdicao() {
    setEditId(null);

    setEditNome("");
    setEditModelo("");
    setEditAno("");
    setEditPlaca("");
    setEditChassi("");
    setEditRenavam("");
    setEditCombustivel("");
    setEditOleo("");
    setEditPneu("");
    setEditLampadas("");
    setEditLampadasPorTipo({});
    setEditAdquiridoEm("");
    setEditValorPago("");

    setEditFipeMarcaId("");
    setEditFipeModeloId("");
    setEditFipeAnoId("");

    setEditFipeModelos([]);
    setEditFipeAnos([]);
  }

  async function salvarEdicao() {
    if (
      editId == null
    ) {
      return;
    }

    const nomeFinal =
      editNome.trim();

    if (!nomeFinal) {
      return;
    }

    if (editAdquiridoEm && !/^[1-9][0-9]{3}$/.test(editAdquiridoEm)) {
      alert("Informe o ano de aquisição com quatro dígitos.");
      return;
    }

    const valorPagoNumero =
      editValorPago.trim() ===
      ""
        ? null
        : dinheiroParaNumero(
            editValorPago
          );

    if (
      editValorPago.trim() !==
        "" &&
      (
        valorPagoNumero ==
          null ||
        valorPagoNumero < 0
      )
    ) {
      alert(
        "Informe um valor pago válido."
      );

      return;
    }

    const temAlgumaFipe =
      Boolean(
        editFipeMarcaId ||
          editFipeModeloId ||
          editFipeAnoId
      );

    const fipeCompleta =
      Boolean(
        editFipeMarcaId &&
          editFipeModeloId &&
          editFipeAnoId
      );

    if (
      temAlgumaFipe &&
      !fipeCompleta
    ) {
      alert(
        "Para configurar a FIPE, selecione Marca, Modelo e Ano/Versão."
      );

      return;
    }

    let dadosFipe = null;

    if (fipeCompleta) {
      try {
        setCarregandoFipe(
          true
        );

        dadosFipe =
          await consultarFipePorSelecao({
            marcaId:
              editFipeMarcaId,

            modeloId:
              editFipeModeloId,

            anoId:
              editFipeAnoId,
          });
      } catch (erro) {
        console.error(
          "Erro FIPE:",
          erro
        );

        alert(
          erro?.message ||
            "Não foi possível consultar a FIPE."
        );

        return;
      } finally {
        setCarregandoFipe(
          false
        );
      }
    }

    await db.cars.update(
      editId,
      {
        name:
          nomeFinal,

        model:
          editModelo.trim(),

        year:
          editAno.trim(),

        plate:
          editPlaca.trim(),

        chassis:
          editChassi.trim(),

        renavam:
          editRenavam.trim(),

        fuel:
          editCombustivel ||
          "",

        oil:
          editOleo.trim(),

        tire:
          editPneu.trim(),

        bulbs: editLampadas.trim(),
        bulbsByPosition: limparLampadas(editLampadasPorTipo),
        acquiredOn: editAdquiridoEm || null,

        purchasePrice:
          valorPagoNumero,

        /* FIPE */

        fipeBrandId:
          fipeCompleta
            ? String(
                editFipeMarcaId
              )
            : null,

        fipeModelId:
          fipeCompleta
            ? String(
                editFipeModeloId
              )
            : null,

        fipeYearId:
          fipeCompleta
            ? String(
                editFipeAnoId
              )
            : null,

        fipeCode:
          dadosFipe?.codeFipe ||
          null,

        fipeBrand:
          dadosFipe?.brand ||
          null,

        fipeModel:
          dadosFipe?.model ||
          null,

        fipeModelYear:
          dadosFipe?.modelYear ??
          null,

        fipeFuel:
          dadosFipe?.fuel ||
          null,

        fipeValue:
          dadosFipe?.price
            ? converterPrecoFipe(
                dadosFipe.price
              )
            : null,

        fipeValueFormatted:
          dadosFipe?.price ||
          null,

        fipeReference:
          dadosFipe?.referenceMonth ||
          null,

        fipeUpdatedAt:
          dadosFipe
            ? new Date().toISOString()
            : null,
      }
    );

    cancelarEdicao();

    await carregarCarros();
  }

  /* ==================================================
     ATUALIZAR KM + FIPE AUTOMÁTICA
  ================================================== */

  function iniciarKm(
    carro
  ) {
    cancelarEdicao();

    setMostrarCadastro(
      false
    );

    setKmId(
      carro.id
    );

    setKmValor(
      typeof carro.currentMileage ===
        "number"
        ? String(
            carro.currentMileage
          )
        : ""
    );
  }

  function cancelarKm() {
    setKmId(null);
    setKmValor("");
  }

  async function salvarKm() {
    if (
      kmId == null
    ) {
      return;
    }

    let kmFinal = null;

    if (
      kmValor.trim() !== ""
    ) {
      const n =
        Number(kmValor);

      if (
        !Number.isFinite(n) ||
        n < 0
      ) {
        alert(
          "Informe uma quilometragem válida."
        );

        return;
      }

      kmFinal = n;
    }

    /*
      Buscamos o carro antes
      para comparar a KM antiga.
    */

    const carroAntes =
      await db.cars.get(
        kmId
      );

    const kmAnterior =
      typeof carroAntes?.currentMileage ===
      "number"
        ? carroAntes.currentMileage
        : null;

    await db.cars.update(
      kmId,
      {
        currentMileage:
          kmFinal,
      }
    );

    /*
      FIPE automática apenas
      quando a quilometragem aumenta.
    */

    const kmAumentou =
      kmFinal != null &&
      (
        kmAnterior == null ||
        kmFinal >
          kmAnterior
      );

    if (
      kmAumentou &&
      carroAntes?.fipeCode &&
      carroAntes?.fipeYearId
    ) {
      const carroAtualizado = {
        ...carroAntes,

        currentMileage:
          kmFinal,
      };

      const resultado =
        await atualizarFipeDoCarro(
          carroAtualizado,
          db
        );

      if (
        !resultado?.atualizado
      ) {
        console.warn(
          "A quilometragem foi atualizada, mas a FIPE não pôde ser atualizada:",
          resultado?.motivo
        );
      }
    }

    cancelarKm();

    await carregarCarros();
  }

  /* ==================================================
     NAVEGAÇÃO
  ================================================== */

  if (
    abastecerCarId != null
  ) {
    return (
      <AbastecimentosCarro
        carId={
          abastecerCarId
        }
        aoVoltar={() => {
          setAbastecerCarId(
            null
          );

          carregarCarros();
        }}
      />
    );
  }

  if (
    carroSelecionadoId !=
    null
  ) {
    return (
      <CarroDetalhe
        carId={
          carroSelecionadoId
        }
        onBack={() => {
          setCarroSelecionadoId(null);
          carregarCarros();
        }}
      />
    );
  }

  if (!modoLista && !mostrarCadastro && editId == null && kmId == null) {
    return <GaragemHome
      carros={carros}
      resumo={resumoGaragem}
      onAdicionar={abrirCadastro}
      onAbrirCarro={setCarroSelecionadoId}
      onVeiculos={() => setModoLista(true)}
      onAlertas={abrirRevisoesStatus}
    />;
  }

  /* ==================================================
     HOME
  ================================================== */

  return (
    <div className="carrev-home gr-vehicle-list-page">
      <BotaoVoltar onClick={() => { setModoLista(false); setMostrarCadastro(false); cancelarEdicao(); cancelarKm(); carregarCarros(); }} />


      {!modoLista && (
        <>
          {/* LOGO */}

          <header className="carrev-home-header">

            <div className="carrev-logo">

              <span className="carrev-logo-car">
                CAR
              </span>

              <span className="carrev-logo-rev">
                REV
              </span>

            </div>

            <div className="carrev-tagline">
              Sua garagem sempre em dia
            </div>

          </header>

          {/* ALERTAS */}

          <div className="carrev-alertas-home">

            <AlertasHome
              onAbrirProximas={
                onAbrirProximas
              }
              onAbrirCarro={(id) =>
                setCarroSelecionadoId(
                  id
                )
              }
              limiteItens={6}
            />

          </div>

          {/* RESUMO */}

          <section className="carrev-resumo">

            <div className="carrev-resumo-header">

              <div>

                <div className="carrev-resumo-title">
                  Resumo da garagem
                </div>

                <div className="carrev-resumo-subtitle">
                  Toque em um indicador para acessar
                </div>

              </div>

            </div>

            <div
              className="carrev-resumo-grid"
              style={{
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              }}
            >

              <button
                type="button"
                className="carrev-resumo-card"
                onClick={
                  abrirVeiculosResumo
                }
              >

                <div className="carrev-resumo-icon azul">
                  🚗
                </div>

                <div className="carrev-resumo-numero">
                  {
                    resumoGaragem.veiculos
                  }
                </div>

                <div className="carrev-resumo-label">
                  {resumoGaragem.veiculos ===
                  1
                    ? "Veículo"
                    : "Veículos"}
                </div>

              </button>

              <button
                type="button"
                className="carrev-resumo-card"
                onClick={() =>
                  abrirRevisoesStatus(
                    "EM BREVE"
                  )
                }
              >

                <div className="carrev-resumo-icon amarelo">
                  ◷
                </div>

                <div className="carrev-resumo-numero">
                  {
                    resumoGaragem.emBreve
                  }
                </div>

                <div className="carrev-resumo-label">
                  Em breve
                </div>

              </button>

              <button
                type="button"
                className="carrev-resumo-card"
                onClick={() =>
                  abrirRevisoesStatus(
                    "VENCIDA"
                  )
                }
              >

                <div className="carrev-resumo-icon vermelho">
                  !
                </div>

                <div className="carrev-resumo-numero">
                  {
                    resumoGaragem.vencidas
                  }
                </div>

                <div className="carrev-resumo-label">
                  Vencidas
                </div>

              </button>

            </div>

          </section>
        </>
      )}

      {/* VEÍCULOS */}

      <section className="carrev-garagem-section">

        <div className="carrev-garagem-header">

          <div>

            <h1 className="carrev-garagem-title">
              Meus veículos
            </h1>
            <p className="gr-vehicle-count">
              {carros.length === 1 ? "1 veículo cadastrado" : `${carros.length} veículos cadastrados`}
            </p>

          </div>

        </div>

      </section>

      {/* ADICIONAR */}

      {!mostrarCadastro ? (

        <div
          style={{
            display: "flex",
            justifyContent:
              "flex-end",
            marginBottom: 18,
          }}
        >

          <button
            type="button"
            className="carrev-add-button"
            onClick={
              abrirCadastro
            }
          >

            <span className="carrev-add-plus">
              +
            </span>

            Adicionar veículo

          </button>

        </div>

      ) : null}

      {/* ==================================================
          CADASTRO
      ================================================== */}

      {mostrarCadastro ? (

        <form
          onSubmit={
            adicionarCarro
          }
          className="carrev-form-card"
        >

          <div className="carrev-form-title">
            Adicionar veículo
          </div>

          <div className="carrev-form-grid">

            <label>
              Nome / Apelido

              <input
                value={nome}
                onChange={(e) =>
                  setNome(
                    e.target.value
                  )
                }
                placeholder="Ex.: Fusca"
              />
            </label>

            <label>
              Modelo

              <input
                value={modelo}
                onChange={(e) =>
                  setModelo(
                    e.target.value
                  )
                }
                placeholder="Ex.: 1600 Itamar"
              />
            </label>

            <label>
              Ano

              <input
                value={ano}
                onChange={(e) =>
                  setAno(
                    e.target.value
                  )
                }
                placeholder="Ex.: 1994"
              />
            </label>

            <label>
              Placa

              <input
                value={placa}
                onChange={(e) =>
                  setPlaca(
                    e.target.value.toUpperCase()
                  )
                }
                placeholder="Ex.: ABC1D23"
              />
            </label>

            <label>
              Chassi

              <input
                value={chassi}
                onChange={(e) =>
                  setChassi(
                    e.target.value.toUpperCase()
                  )
                }
                placeholder="Ex.: 9BWZZZ377VT004251"
              />
            </label>

            <label>
              RENAVAM

              <input
                value={renavam}
                onChange={(e) =>
                  setRenavam(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                inputMode="numeric"
                placeholder="Ex.: 00123456789"
              />
            </label>

            <label>
              Valor pago

              <input
                value={valorPago}
                onChange={(e) =>
                  setValorPago(
                    e.target.value
                  )
                }
                inputMode="decimal"
                placeholder="Ex.: 35000,00"
              />
            </label>

            <label>
              Combustível

              <select
                value={
                  combustivel
                }
                onChange={(e) =>
                  setCombustivel(
                    e.target.value
                  )
                }
              >

                {COMBUSTIVEIS.map(
                  (c) => (
                    <option
                      key={c}
                      value={c}
                    >
                      {c ||
                        "Selecione"}
                    </option>
                  )
                )}

              </select>
            </label>

            <label>
              Óleo de motor

              <input
                value={oleo}
                onChange={(e) =>
                  setOleo(
                    e.target.value
                  )
                }
                placeholder="Ex.: 5W30"
              />
            </label>

            <label>
              Pneu

              <input
                value={pneu}
                onChange={(e) =>
                  setPneu(
                    e.target.value
                  )
                }
                placeholder="Ex.: 175/70 R13"
              />
            </label>

            <label>
              Adquirido em
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]{3}"
                maxLength={4}
                placeholder="AAAA"
                value={adquiridoEm}
                onChange={e => setAdquiridoEm(e.target.value.replace(/\D/g, ""))}
              />
            </label>

            <LampadasVeiculo valores={lampadas} onChange={setLampadas} />

          </div>

          {/* FIPE */}

          <div
            style={{
              marginTop: 10,
              paddingTop: 16,
              borderTop:
                "1px solid #29313d",
            }}
          >

            <div
              className="carrev-form-title"
              style={{
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              Tabela FIPE
            </div>

            <div
              style={{
                color:
                  "#8f99a8",
                fontSize: 12,
                marginBottom: 14,
              }}
            >
              Configure uma vez. Depois o valor FIPE será atualizado automaticamente quando a quilometragem aumentar.
            </div>

            <div className="carrev-form-grid">

              <label>
                Marca FIPE

                <select
                  value={
                    fipeMarcaId
                  }
                  disabled={
                    carregandoFipe
                  }
                  onChange={(e) =>
                    selecionarMarcaCadastro(
                      e.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Selecione
                  </option>

                  {fipeMarcas.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>
                Modelo / Versão FIPE

                <select
                  value={
                    fipeModeloId
                  }
                  disabled={
                    !fipeMarcaId ||
                    carregandoFipe
                  }
                  onChange={(e) =>
                    selecionarModeloCadastro(
                      e.target
                        .value
                    )
                  }
                >

                  <option value="">
                    Selecione
                  </option>

                  {fipeModelos.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>
                Ano / Combustível FIPE

                <select
                  value={
                    fipeAnoId
                  }
                  disabled={
                    !fipeModeloId ||
                    carregandoFipe
                  }
                  onChange={(e) =>
                    setFipeAnoId(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecione
                  </option>

                  {fipeAnos.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

            </div>

          </div>

          <div className="carrev-form-actions">

            <button
              type="submit"
              className="carrev-primary-button"
              disabled={
                carregandoFipe
              }
            >
              {carregandoFipe
                ? "Aguarde..."
                : "Salvar veículo"}
            </button>

            <button
              type="button"
              onClick={
                cancelarCadastro
              }
            >
              Cancelar
            </button>

          </div>

        </form>

      ) : null}

      {/* ==================================================
          LISTA
      ================================================== */}

      <div
        className="carrev-car-list"
        ref={
          listaCarrosRef
        }
      >

        {carros.length === 0 && !mostrarCadastro && (
          <p className="gr-info-panel">Adicione um veículo para começar sua garagem.</p>
        )}

        {carros.map((c) => (

          <CarCard
            key={c.id}

            carro={c}

            onAbrir={() =>
              setCarroSelecionadoId(
                c.id
              )
            }

            onExcluir={() =>
              excluirCarro(
                c.id
              )
            }

            onEditar={() =>
              iniciarEdicao(
                c
              )
            }

            onAtualizarKm={() =>
              iniciarKm(c)
            }

            onAbastecer={() =>
              setAbastecerCarId(
                c.id
              )
            }

            emKm={
              kmId === c.id
            }

            kmValor={
              kmValor
            }

            setKmValor={
              setKmValor
            }

            onSalvarKm={
              salvarKm
            }

            onCancelarKm={
              cancelarKm
            }

            emEdicao={
              editId === c.id
            }

            editNome={
              editNome
            }

            editModelo={
              editModelo
            }

            editAno={
              editAno
            }

            editPlaca={
              editPlaca
            }

            editChassi={
              editChassi
            }

            editRenavam={
              editRenavam
            }

            editCombustivel={
              editCombustivel
            }

            editOleo={
              editOleo
            }

            editPneu={
              editPneu
            }

            editAdquiridoEm={editAdquiridoEm}
            editLampadasPorTipo={editLampadasPorTipo}

            editLampadas={
              editLampadas
            }

            editValorPago={
              editValorPago
            }

            editFipeMarcaId={
              editFipeMarcaId
            }

            editFipeModeloId={
              editFipeModeloId
            }

            editFipeAnoId={
              editFipeAnoId
            }

            fipeMarcas={
              fipeMarcas
            }

            editFipeModelos={
              editFipeModelos
            }

            editFipeAnos={
              editFipeAnos
            }

            carregandoFipe={
              carregandoFipe
            }

            setEditNome={
              setEditNome
            }

            setEditModelo={
              setEditModelo
            }

            setEditAno={
              setEditAno
            }

            setEditPlaca={
              setEditPlaca
            }

            setEditChassi={
              setEditChassi
            }

            setEditRenavam={
              setEditRenavam
            }

            setEditCombustivel={
              setEditCombustivel
            }

            setEditOleo={
              setEditOleo
            }

            setEditPneu={
              setEditPneu
            }

            setEditAdquiridoEm={setEditAdquiridoEm}
            setEditLampadasPorTipo={setEditLampadasPorTipo}

            setEditLampadas={
              setEditLampadas
            }

            setEditValorPago={
              setEditValorPago
            }

            selecionarMarcaEdicao={
              selecionarMarcaEdicao
            }

            selecionarModeloEdicao={
              selecionarModeloEdicao
            }

            setEditFipeAnoId={
              setEditFipeAnoId
            }

            onSalvarEdicao={
              salvarEdicao
            }

            onCancelarEdicao={
              cancelarEdicao
            }
          />

        ))}

      </div>

    </div>
  );
}

/* ==================================================
   CARD DO VEÍCULO
================================================== */

function CarCard({
  carro,

  onAbrir,
  onExcluir,
  onEditar,
  onAtualizarKm,
  onAbastecer,

  emKm,
  kmValor,
  setKmValor,
  onSalvarKm,
  onCancelarKm,

  emEdicao,

  editNome,
  editModelo,
  editAno,
  editPlaca,
  editChassi,
  editRenavam,
  editCombustivel,
  editOleo,
  editPneu,
  editAdquiridoEm,
  editLampadasPorTipo,
  editLampadas,
  editValorPago,

  editFipeMarcaId,
  editFipeModeloId,
  editFipeAnoId,

  fipeMarcas,
  editFipeModelos,
  editFipeAnos,
  carregandoFipe,

  setEditNome,
  setEditModelo,
  setEditAno,
  setEditPlaca,
  setEditChassi,
  setEditRenavam,
  setEditCombustivel,
  setEditOleo,
  setEditPneu,
  setEditAdquiridoEm,
  setEditLampadasPorTipo,
  setEditLampadas,
  setEditValorPago,

  selecionarMarcaEdicao,
  selecionarModeloEdicao,
  setEditFipeAnoId,

  onSalvarEdicao,
  onCancelarEdicao,
}) {
  const db = useDb();
  const [
    fotoUrl,
    setFotoUrl,
  ] = useState(null);

  const [
    consumoMedioKmL,
    setConsumoMedioKmL,
  ] = useState(null);

  const [
    badge,
    setBadge,
  ] = useState({
    total: 0,
    vencidas: 0,
    emBreve: 0,
    ok: 0,
    status: "OK",
  });

  /* FOTO */

  useEffect(() => {
    let url = null;

    if (carro.photo) {
      url =
        URL.createObjectURL(
          carro.photo
        );

      setFotoUrl(url);
    } else {
      setFotoUrl(null);
    }

    return () => {
      if (url) {
        URL.revokeObjectURL(
          url
        );
      }
    };
  }, [carro.photo]);

  /* CONSUMO */

  useEffect(() => {
    async function calcularConsumoMedio() {
      if (
        !db.abastecimentos
      ) {
        setConsumoMedioKmL(
          null
        );

        return;
      }

      const lista =
        await db.abastecimentos
          .where("carId")
          .equals(
            carro.id
          )
          .toArray();

      const cheios =
        lista
          .filter(
            (a) =>
              a.tanqueCheio
          )
          .slice()
          .sort(
            (a, b) =>
              (a.km || 0) -
              (b.km || 0)
          );

      let soma = 0;
      let qtd = 0;

      for (
        let i = 1;
        i < cheios.length;
        i++
      ) {
        const dist =
          (cheios[i].km ||
            0) -
          (cheios[i - 1]
            .km || 0);

        const litros =
          Number(
            cheios[i]
              .litros
          );

        if (
          dist > 0 &&
          Number.isFinite(
            litros
          ) &&
          litros > 0
        ) {
          soma +=
            dist / litros;

          qtd++;
        }
      }

      setConsumoMedioKmL(
        qtd
          ? soma / qtd
          : null
      );
    }

    calcularConsumoMedio();
  }, [carro.id]);

  /* STATUS */

  useEffect(() => {
    async function carregarBadge() {
      const kmAtual =
        typeof carro.currentMileage ===
        "number"
          ? carro.currentMileage
          : null;

      const resultado =
        await calcularBadgeDoCarro(db,
          carro.id,
          kmAtual
        );

      setBadge(resultado);
    }

    carregarBadge();
  }, [
    carro.id,
    carro.currentMileage,
  ]);

  const kmTxt =
    typeof carro.currentMileage ===
      "number"
      ? `${Number(
          carro.currentMileage
        ).toLocaleString(
          "pt-BR"
        )} km`
      : "Quilometragem não informada";

  const detalhesVeiculo =
    [
      carro.model || null,

      carro.year
        ? String(
            carro.year
          )
        : null,

      carro.plate || null,
    ]
      .filter(Boolean)
      .join(" • ");

  const temBadge =
    badge.total > 0;

  let statusClasse =
    "ok";

  let statusTexto =
    "Manutenção em dia";

  if (temBadge) {
    if (
      badge.status ===
      "VENCIDA"
    ) {
      statusClasse =
        "vencida";

      statusTexto =
        badge.vencidas === 1
          ? "1 revisão vencida"
          : `${badge.vencidas} revisões vencidas`;

    } else if (
      badge.status ===
      "EM BREVE"
    ) {
      statusClasse =
        "breve";

      statusTexto =
        "Revisão em breve";
    }
  }

  return (
    <div className="carrev-car-wrapper">

      {!emEdicao &&
      !emKm ? (

        <div
          className={
            fotoUrl
              ? "carrev-car-card"
              : "carrev-car-card carrev-car-card-sem-foto"
          }
        >

          <div className="gr-list-car-media">
            {fotoUrl ? (

              <img
                src={fotoUrl}
                alt={`Foto do ${carro.name}`}
                className="carrev-car-photo"
              />

            ) : (

              <div className="carrev-car-placeholder">

                <div className="carrev-placeholder-icon">
                  🚗
                </div>

                <div className="carrev-placeholder-title">
                  Foto do veículo
                </div>

                <div className="carrev-placeholder-text">
                  Adicione uma foto em Editar veículo
                </div>

              </div>

            )}
          </div>

          <div className="carrev-car-content">

            <h2 className="carrev-car-name">
              {
                carro.name
              }
            </h2>

            {detalhesVeiculo ? (
              <div className="carrev-car-model">
                {
                  detalhesVeiculo
                }
              </div>
            ) : null}

            <div className="carrev-car-km">
              {kmTxt}
            </div>

            <div
              className={`carrev-car-status ${statusClasse}`}
            >
              <span>
                ●
              </span>

              {
                statusTexto
              }
            </div>

            <div className="carrev-car-consumo">

              Consumo médio:{" "}

              <strong>
                {consumoMedioKmL !=
                null
                  ? `${consumoMedioKmL.toFixed(
                      2
                    )} km/L`
                  : "—"}
              </strong>

            </div>

            <div className="carrev-car-bottom">

              <button
                type="button"
                className="carrev-primary-button"
                onClick={
                  onAbrir
                }
              >
                Ver veículo

                <span>
                  →
                </span>
              </button>

            </div>

            <div className="carrev-secondary-actions">

              <button
                type="button"
                onClick={
                  onAbastecer
                }
              >
                ⛽ Abastecer
              </button>

              <button
                type="button"
                onClick={
                  onAtualizarKm
                }
              >
                ◎ Atualizar km
              </button>

              <button
                type="button"
                onClick={
                  onEditar
                }
              >
                ✎ Editar
              </button>

              <button
                type="button"
                onClick={() => {
                  const ok =
                    window.confirm(
                      `Excluir o veículo "${carro.name}"?`
                    );

                  if (ok) {
                    onExcluir();
                  }
                }}
              >
                🗑 Excluir
              </button>

            </div>

          </div>

        </div>

      ) : null}

      {/* KM */}

      {emKm ? (

        <div className="carrev-form-card">

          <div className="carrev-form-title">
            Atualizar quilometragem
          </div>

          <label>

            Quilometragem atual (km)

            <input
              type="number"
              inputMode="numeric"
              value={
                kmValor
              }
              onChange={(e) =>
                setKmValor(
                  e.target.value
                )
              }
              placeholder="Ex.: 102350"
            />

          </label>

          <div className="carrev-form-actions">

            <button
              type="button"
              className="carrev-primary-button"
              onClick={
                onSalvarKm
              }
            >
              Salvar
            </button>

            <button
              type="button"
              onClick={
                onCancelarKm
              }
            >
              Cancelar
            </button>

          </div>

        </div>

      ) : null}

      {/* ==================================================
          EDITAR
      ================================================== */}

      {emEdicao ? (

        <div className="carrev-form-card">

          <div className="carrev-form-title">
            Editar veículo
          </div>

          <div className="carrev-form-grid">

            <label>
              Nome / Apelido

              <input
                value={
                  editNome
                }
                onChange={(e) =>
                  setEditNome(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Modelo

              <input
                value={
                  editModelo
                }
                onChange={(e) =>
                  setEditModelo(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Ano

              <input
                value={
                  editAno
                }
                onChange={(e) =>
                  setEditAno(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Placa

              <input
                value={
                  editPlaca
                }
                onChange={(e) =>
                  setEditPlaca(
                    e.target.value.toUpperCase()
                  )
                }
              />
            </label>

            <label>
              Chassi

              <input
                value={
                  editChassi
                }
                onChange={(e) =>
                  setEditChassi(
                    e.target.value.toUpperCase()
                  )
                }
              />
            </label>

            <label>
              RENAVAM

              <input
                value={
                  editRenavam
                }
                onChange={(e) =>
                  setEditRenavam(
                    e.target.value.replace(
                      /\D/g,
                      ""
                    )
                  )
                }
                inputMode="numeric"
              />
            </label>

            <label>
              Valor pago

              <input
                value={
                  editValorPago
                }
                onChange={(e) =>
                  setEditValorPago(
                    e.target.value
                  )
                }
                inputMode="decimal"
                placeholder="Ex.: 35000,00"
              />
            </label>

            <label>
              Combustível

              <select
                value={
                  editCombustivel
                }
                onChange={(e) =>
                  setEditCombustivel(
                    e.target.value
                  )
                }
              >

                {COMBUSTIVEIS.map(
                  (c) => (
                    <option
                      key={c}
                      value={c}
                    >
                      {c ||
                        "Selecione"}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              Óleo de motor

              <input
                value={
                  editOleo
                }
                onChange={(e) =>
                  setEditOleo(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Pneu

              <input
                value={
                  editPneu
                }
                onChange={(e) =>
                  setEditPneu(
                    e.target.value
                  )
                }
              />
            </label>

            <label>
              Adquirido em
              <input
                type="text"
                inputMode="numeric"
                pattern="[1-9][0-9]{3}"
                maxLength={4}
                placeholder="AAAA"
                value={editAdquiridoEm}
                onChange={e => setEditAdquiridoEm(e.target.value.replace(/\D/g, ""))}
              />
            </label>

            <LampadasVeiculo
              valores={editLampadasPorTipo}
              onChange={setEditLampadasPorTipo}
              observacao={editLampadas}
              onObservacao={carro.bulbs ? setEditLampadas : undefined}
            />

          </div>

          {/* FIPE EDIÇÃO */}

          <div
            style={{
              marginTop: 10,
              paddingTop: 16,
              borderTop:
                "1px solid #29313d",
            }}
          >

            <div
              className="carrev-form-title"
              style={{
                fontSize: 16,
                marginBottom: 12,
              }}
            >
              Tabela FIPE
            </div>

            {carro.fipeValueFormatted ? (

              <div
                style={{
                  marginBottom: 14,
                  padding: 12,
                  border:
                    "1px solid #29313d",
                  borderRadius: 12,
                  background:
                    "#0b1016",
                  color:
                    "#aeb7c4",
                  fontSize: 12,
                }}
              >

                <div>
                  <strong
                    style={{
                      color:
                        "#fff",
                    }}
                  >
                    FIPE atual:
                  </strong>{" "}
                  {
                    carro.fipeValueFormatted
                  }
                </div>

                {carro.fipeReference ? (
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    Referência:{" "}
                    {
                      carro.fipeReference
                    }
                  </div>
                ) : null}

                {carro.fipeCode ? (
                  <div
                    style={{
                      marginTop: 4,
                    }}
                  >
                    Código FIPE:{" "}
                    {
                      carro.fipeCode
                    }
                  </div>
                ) : null}

              </div>

            ) : null}

            <div className="carrev-form-grid">

              <label>
                Marca FIPE

                <select
                  value={
                    editFipeMarcaId
                  }
                  disabled={
                    carregandoFipe
                  }
                  onChange={(e) =>
                    selecionarMarcaEdicao(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Não configurada
                  </option>

                  {fipeMarcas.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>
                Modelo / Versão FIPE

                <select
                  value={
                    editFipeModeloId
                  }
                  disabled={
                    !editFipeMarcaId ||
                    carregandoFipe
                  }
                  onChange={(e) =>
                    selecionarModeloEdicao(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecione
                  </option>

                  {editFipeModelos.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>
                Ano / Combustível FIPE

                <select
                  value={
                    editFipeAnoId
                  }
                  disabled={
                    !editFipeModeloId ||
                    carregandoFipe
                  }
                  onChange={(e) =>
                    setEditFipeAnoId(
                      e.target.value
                    )
                  }
                >

                  <option value="">
                    Selecione
                  </option>

                  {editFipeAnos.map(
                    (item) => (
                      <option
                        key={
                          item.code
                        }
                        value={
                          item.code
                        }
                      >
                        {
                          item.name
                        }
                      </option>
                    )
                  )}

                </select>

              </label>

            </div>

          </div>

          <div className="carrev-form-actions">

            <button
              type="button"
              className="carrev-primary-button"
              onClick={
                onSalvarEdicao
              }
              disabled={
                carregandoFipe
              }
            >
              {carregandoFipe
                ? "Aguarde..."
                : "Salvar alterações"}
            </button>

            <button
              type="button"
              onClick={
                onCancelarEdicao
              }
            >
              Cancelar
            </button>

          </div>

        </div>

      ) : null}

    </div>
  );
}