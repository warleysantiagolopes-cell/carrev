import "./BotaoVoltar.css";

export default function BotaoVoltar({ onClick }) {
  if (!onClick) return null;

  return (
    <button type="button" className="carrev-voltar" onClick={onClick}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m14 5-7 7 7 7" />
      </svg>
      Voltar
    </button>
  );
}
