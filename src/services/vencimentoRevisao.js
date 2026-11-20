function diasAte(dataYYYYMMDD) {
  const [y, m, d] = String(dataYYYYMMDD).split("-").map(Number);

  if (!y || !m || !d) return null;

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
    alvo.getTime() - base.getTime();

  return Math.round(
    diffMs / (1000 * 60 * 60 * 24)
  );
}

function statusPorData(dias) {
  if (dias == null) return "OK";
  if (dias < 0) return "VENCIDA";
  if (dias <= 14) return "EM BREVE";

  return "OK";
}

function statusPorKm(kmRestante) {
  if (kmRestante == null) return "OK";
  if (kmRestante < 0) return "VENCIDA";
  if (kmRestante <= 500) return "EM BREVE";

  return "OK";
}

function piorStatus(a, b) {
  const rank = {
    VENCIDA: 3,
    "EM BREVE": 2,
    OK: 1,
  };

  return rank[a] >= rank[b] ? a : b;
}

export function calcularVencimento(revisao, kmAtual) {
  const dias = revisao.nextDate ? diasAte(revisao.nextDate) : null;
  const kmRestante = revisao.nextMileage != null && kmAtual != null
    ? Number(revisao.nextMileage) - Number(kmAtual) : null;

  return {
    diasAte: dias,
    kmRestante,
    status: piorStatus(statusPorData(dias), statusPorKm(kmRestante)),
  };
}
