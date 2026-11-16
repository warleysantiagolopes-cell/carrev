// src/services/fipe.js

const FIPE_BASE_URL =
  "https://fipe.parallelum.com.br/api/v2";

/* ==================================================
   FUNÇÃO INTERNA
================================================== */

async function consultar(url) {
  const resposta = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  if (!resposta.ok) {
    if (resposta.status === 404) {
      throw new Error(
        "Veículo não encontrado na Tabela FIPE."
      );
    }

    if (resposta.status === 429) {
      throw new Error(
        "Limite de consultas da FIPE atingido. Tente novamente mais tarde."
      );
    }

    throw new Error(
      "Não foi possível consultar a Tabela FIPE."
    );
  }

  return resposta.json();
}

/* ==================================================
   MARCAS
================================================== */

export async function listarMarcasFipe() {
  return consultar(
    `${FIPE_BASE_URL}/cars/brands`
  );
}

/* ==================================================
   MODELOS
================================================== */

export async function listarModelosFipe(
  marcaId
) {
  if (!marcaId) return [];

  return consultar(
    `${FIPE_BASE_URL}/cars/brands/${marcaId}/models`
  );
}

/* ==================================================
   ANOS / COMBUSTÍVEL
================================================== */

export async function listarAnosFipe(
  marcaId,
  modeloId
) {
  if (!marcaId || !modeloId) {
    return [];
  }

  return consultar(
    `${FIPE_BASE_URL}/cars/brands/${marcaId}/models/${modeloId}/years`
  );
}

/* ==================================================
   DETALHE DA FIPE
================================================== */

export async function consultarFipePorSelecao({
  marcaId,
  modeloId,
  anoId,
}) {
  if (
    !marcaId ||
    !modeloId ||
    !anoId
  ) {
    throw new Error(
      "Selecione marca, modelo e ano FIPE."
    );
  }

  return consultar(
    `${FIPE_BASE_URL}/cars/brands/${marcaId}/models/${modeloId}/years/${anoId}`
  );
}

/* ==================================================
   ANOS PELO CÓDIGO FIPE
================================================== */

export async function listarAnosPorCodigoFipe(
  codigoFipe
) {
  if (!codigoFipe) return [];

  return consultar(
    `${FIPE_BASE_URL}/cars/${encodeURIComponent(
      codigoFipe
    )}/years`
  );
}

/* ==================================================
   ATUALIZAÇÃO AUTOMÁTICA
================================================== */

export async function consultarFipeAtual({
  codigoFipe,
  anoFipeId,
}) {
  if (!codigoFipe || !anoFipeId) {
    return null;
  }

  const dados = await consultar(
    `${FIPE_BASE_URL}/cars/${encodeURIComponent(
      codigoFipe
    )}/years/${encodeURIComponent(
      anoFipeId
    )}`
  );

  return {
    codigoFipe:
      dados.codeFipe || codigoFipe,

    marca:
      dados.brand || "",

    modelo:
      dados.model || "",

    anoModelo:
      dados.modelYear || null,

    combustivel:
      dados.fuel || "",

    valor:
      converterPrecoFipe(
        dados.price
      ),

    valorFormatado:
      dados.price || "",

    referencia:
      dados.referenceMonth || "",

    atualizadoEm:
      new Date().toISOString(),
  };
}

/* ==================================================
   CONVERTE:
   "R$ 42.680,00"
   PARA:
   42680
================================================== */

export function converterPrecoFipe(
  valor
) {
  if (!valor) return null;

  const numero = Number(
    String(valor)
      .replace(/[^\d,]/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(numero)
    ? numero
    : null;
}

/* ==================================================
   ATUALIZA O CARRO AUTOMATICAMENTE
================================================== */

export async function atualizarFipeDoCarro(
  carro,
  db
) {
  if (!carro?.id) {
    return {
      atualizado: false,
      motivo:
        "Veículo inválido.",
    };
  }

  if (
    !carro.fipeCode ||
    !carro.fipeYearId
  ) {
    return {
      atualizado: false,
      motivo:
        "FIPE ainda não configurada para este veículo.",
    };
  }

  try {
    const fipe =
      await consultarFipeAtual({
        codigoFipe:
          carro.fipeCode,

        anoFipeId:
          carro.fipeYearId,
      });

    if (!fipe) {
      return {
        atualizado: false,
        motivo:
          "FIPE não encontrada.",
      };
    }

    await db.cars.update(
      carro.id,
      {
        fipeCode:
          fipe.codigoFipe,

        fipeBrand:
          fipe.marca,

        fipeModel:
          fipe.modelo,

        fipeModelYear:
          fipe.anoModelo,

        fipeFuel:
          fipe.combustivel,

        fipeValue:
          fipe.valor,

        fipeValueFormatted:
          fipe.valorFormatado,

        fipeReference:
          fipe.referencia,

        fipeUpdatedAt:
          fipe.atualizadoEm,
      }
    );

    return {
      atualizado: true,
      fipe,
    };

  } catch (erro) {
    console.error(
      "Erro ao atualizar FIPE:",
      erro
    );

    return {
      atualizado: false,
      motivo:
        erro?.message ||
        "Erro ao consultar FIPE.",
    };
  }
}