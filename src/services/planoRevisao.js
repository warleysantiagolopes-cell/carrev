import { calcularVencimento } from "./vencimentoRevisao.js";

const normalizar = nome => String(nome ?? "").trim().normalize("NFC").toLocaleLowerCase("pt-BR");

export function itensDoPlano(carro) {
  return Array.isArray(carro?.planoRevisao) ? carro.planoRevisao : [];
}

export function itemDaRevisao(itens, revisao) {
  return revisao.planoItemId
    ? itens.find(item => item.id === revisao.planoItemId)
    : itens.find(item => normalizar(item.nome) === normalizar(revisao.type))
      ?? itens.find(item => item.nomesAnteriores?.some(nome => normalizar(nome) === normalizar(revisao.type)));
}

function adicionarMeses(valor, meses) {
  const [ano, mes, dia] = valor.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes + meses, 0));
  ultimoDia.setUTCDate(Math.min(dia, ultimoDia.getUTCDate()));
  return ultimoDia.toISOString().slice(0, 10);
}

export function calcularPlano(carro, revisoes) {
  const itens = itensDoPlano(carro);
  const execucoes = new Map(itens.map(item => [item.id, []]));
  for (const revisao of revisoes) {
    const item = itemDaRevisao(itens, revisao);
    if (item) execucoes.get(item.id).push(revisao);
  }
  return itens.map(item => {
    const historico = execucoes.get(item.id);
    const dataBase = historico.reduce((ultima, r) => r.date > ultima ? r.date : ultima, item.dataBase || "");
    const kmBase = historico.reduce((maior, r) =>
      Number.isFinite(r.mileage) && r.mileage >= 0 && (maior == null || r.mileage > maior) ? r.mileage : maior,
    item.kmBase ?? null);
    return {
      ...item,
      id: `plano:${item.id}`,
      carId: carro.id,
      type: item.nome,
      date: dataBase,
      nextDate: item.meses && dataBase ? adicionarMeses(dataBase, item.meses) : null,
      nextMileage: item.km && kmBase !== null ? kmBase + item.km : null,
    };
  });
}

export function reunirPrazos(carro, revisoes) {
  const itens = itensDoPlano(carro);
  const plano = calcularPlano(carro, revisoes);
  const definidos = plano.filter(item => item.nextDate || item.nextMileage != null);
  const ids = new Set(definidos.map(item => item.id));
  return [
    ...revisoes.filter(r => (r.nextDate || r.nextMileage != null) && !ids.has(`plano:${itemDaRevisao(itens, r)?.id}`)),
    ...definidos,
  ];
}

export function prazosDaGaragem(carros, revisoes) {
  const porCarro = new Map();
  for (const revisao of revisoes) {
    const id = Number(revisao.carId);
    if (!porCarro.has(id)) porCarro.set(id, []);
    porCarro.get(id).push(revisao);
  }

  return carros.flatMap(carro => {
    const kmAtual = typeof carro.currentMileage === "number" ? carro.currentMileage : null;
    return reunirPrazos(carro, porCarro.get(Number(carro.id)) || []).map(revisao => ({
      ...revisao,
      carroNome: carro.name || "Carro",
      kmAtual,
      ...calcularVencimento(revisao, kmAtual),
    }));
  });
}
