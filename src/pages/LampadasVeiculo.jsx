export const tiposLampadas = [
  ["farolBaixo", "Farol baixo"],
  ["farolAlto", "Farol alto"],
  ["setaDianteira", "Seta dianteira"],
  ["posicaoDianteira", "Luz de posição dianteira"],
  ["farolMilha", "Farol de milha"],
  ["freio", "Luz de freio"],
  ["re", "Luz de ré"],
  ["setaTraseira", "Seta traseira"],
  ["neblina", "Luz de neblina"],
];

export function limparLampadas(valores) {
  return Object.fromEntries(
    tiposLampadas
      .map(([id]) => [id, (valores[id] ?? "").trim()])
      .filter(([, valor]) => valor)
  );
}

export default function LampadasVeiculo({ valores, onChange, observacao, onObservacao }) {
  return (
    <details style={{ gridColumn: "1 / -1" }}>
      <summary style={{ cursor: "pointer", padding: "8px 0" }}>Lâmpadas</summary>
      <div className="carrev-form-grid">
        {tiposLampadas.map(([id, rotulo]) => (
          <label key={id}>
            {rotulo}
            <input
              value={valores[id] ?? ""}
              onChange={evento => onChange({ ...valores, [id]: evento.target.value })}
              placeholder="Modelo da lâmpada"
            />
          </label>
        ))}
        {onObservacao && (
          <label>
            Anotação anterior
            <input value={observacao} onChange={evento => onObservacao(evento.target.value)} />
          </label>
        )}
      </div>
    </details>
  );
}
