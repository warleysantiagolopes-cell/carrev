import { useEffect, useRef, useState } from "react";
import { useDb } from "../db/db";

export default function ImprimirFicha({ carId, nomeCarro }) {
  const db = useDb();
  const [ficha, setFicha] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const sessao = useRef(null);

  useEffect(() => {
    const atual = { ativa: true, url: null };
    sessao.current = atual;
    return () => {
      atual.ativa = false;
      if (atual.url) URL.revokeObjectURL(atual.url);
    };
  }, []);

  function fechar() {
    if (sessao.current.url) URL.revokeObjectURL(sessao.current.url);
    sessao.current.url = null;
    setFicha(null);
    setErro("");
  }

  async function preparar() {
    if (gerando) return;
    fechar();
    const atual = sessao.current;
    setGerando(true);
    try {
      const { gerarFichaVeiculo } = await import("../services/fichaVeiculoPdf");
      const pdf = await gerarFichaVeiculo(db, carId);
      if (!atual.ativa) return;

      const nomeSeguro = nomeCarro.replace(/[^\p{L}\p{N} -]+/gu, "-").trim().slice(0, 80) || "veiculo";
      const arquivo = new File([pdf], `CarRev - ${nomeSeguro}.pdf`, { type: "application/pdf" });
      atual.url = URL.createObjectURL(arquivo);
      setFicha({ arquivo, url: atual.url, compartilhar: navigator.canShare?.({ files: [arquivo] }) === true });
    } catch {
      if (atual.ativa) setErro("Não foi possível gerar a ficha completa. Confira a conexão e tente novamente.");
    } finally {
      if (atual.ativa) setGerando(false);
    }
  }

  async function compartilhar() {
    setErro("");
    try {
      await navigator.share({ files: [ficha.arquivo] });
    } catch (falha) {
      if (falha.name !== "AbortError") setErro("Não foi possível compartilhar. Você pode abrir ou baixar o PDF.");
    }
  }

  return (
    <section className="ficha-exportacao" aria-label="Impressão da ficha">
      <button type="button" className="gr-add" onClick={preparar} disabled={gerando}>
        {gerando ? "Preparando ficha completa…" : "Imprimir ficha"}
      </button>
      {gerando && <p role="status">Carregando os dados e arquivos deste veículo.</p>}
      {ficha && (
        <div className="ficha-exportacao-opcoes">
          <p role="status">Ficha pronta. Abra o PDF e escolha Imprimir no leitor.</p>
          {ficha.compartilhar && <button type="button" onClick={compartilhar}>Imprimir / compartilhar PDF</button>}
          <a href={ficha.url} target="_blank" rel="noopener noreferrer">Abrir PDF</a>
          <a href={ficha.url} download={ficha.arquivo.name}>Baixar PDF</a>
          <button type="button" onClick={fechar}>Fechar</button>
        </div>
      )}
      {erro && <p className="ficha-erro" role="alert">{erro}</p>}
    </section>
  );
}
