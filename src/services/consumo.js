export function calcularConsumo(historico) {
  const cheios = historico.filter(item => item.tanqueCheio)
    .sort((a, b) => (a.km || 0) - (b.km || 0));
  const trechos = [];

  for (let i = 1; i < cheios.length; i++) {
    const anterior = cheios[i - 1];
    const atual = cheios[i];
    const distancia = (atual.km || 0) - (anterior.km || 0);
    const litrosUsados = Number(atual.litros);
    if (distancia > 0 && Number.isFinite(litrosUsados) && litrosUsados > 0) {
      trechos.push({
        data: atual.data,
        deKm: anterior.km,
        paraKm: atual.km,
        distancia,
        litrosUsados,
        kmPorLitro: distancia / litrosUsados,
        litrosPor100: (litrosUsados / distancia) * 100,
      });
    }
  }

  return {
    trechos,
    ultimo: trechos.at(-1) ?? null,
    mediaKmL: trechos.length
      ? trechos.reduce((soma, trecho) => soma + trecho.kmPorLitro, 0) / trechos.length
      : null,
  };
}
