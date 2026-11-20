import { useState } from "react";
import { jsPDF } from "jspdf";

export default function Relatorio({ nomeGaragem, carros, resumo, dados, erro, carregando }) {
  const [erroPdf, setErroPdf] = useState("");
  const data = new Date().toLocaleDateString("pt-BR");
  const total = dados.abastecimentos.reduce((soma, item) => soma + (Number(item.precoTotal) || 0), 0);
  const linhas = [
    ["Veículos", carros.length],
    ["Abastecimentos", dados.abastecimentos.length],
    ["Manutenções", dados.services.length],
    ["Total em abastecimentos", total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })],
    ["Revisões vencidas", resumo.vencidas],
  ];

  async function exportar(imprimir = false) {
    setErroPdf("");
    try {
      const pdf = new jsPDF();
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.text("CarRev — Resumo da garagem", 18, 24);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(13);
      const nome = pdf.splitTextToSize(nomeGaragem, 174);
      pdf.text(nome, 18, 37);
      let y = 45 + nome.length * 6;
      pdf.text(`Gerado em ${data}`, 18, y);
      y += 12;
      for (const [rotulo, valor] of linhas) {
        pdf.setDrawColor(210);
        pdf.line(18, y - 6, 192, y - 6);
        pdf.text(rotulo, 18, y);
        pdf.text(String(valor).replace(/\u00a0/g, " "), 192, y, { align: "right" });
        y += 12;
      }

      const arquivo = new File([pdf.output("blob")], "CarRev-resumo.pdf", { type: "application/pdf" });
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo] });
      } else if (imprimir) {
        window.print();
      } else {
        pdf.save(arquivo.name);
      }
    } catch (falha) {
      if (falha.name !== "AbortError") setErroPdf("Não foi possível abrir o PDF. Tente novamente.");
    }
  }

  return (
    <section className="gr-info-panel">
      <small>RESUMO DA GARAGEM</small>
      <h2>{nomeGaragem}</h2>
      <p className="gr-report-note">Dados da garagem consultados em {data}.</p>
      {carregando ? <p role="status">Carregando totais…</p> : erro ? <p role="alert">{erro}</p> : (
        <>
          {linhas.map(([rotulo, valor]) => <div className="gr-report-row" key={rotulo}><span>{rotulo}</span><b>{valor}</b></div>)}
          <button type="button" className="gr-add" onClick={() => exportar()}>Salvar / compartilhar PDF</button>
          <button type="button" className="gr-print" onClick={() => exportar(true)}>Imprimir</button>
          {erroPdf && <p role="alert">{erroPdf}</p>}
        </>
      )}
    </section>
  );
}
