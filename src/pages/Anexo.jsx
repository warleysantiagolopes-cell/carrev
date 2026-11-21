import { useEffect, useRef } from "react";

export default function Anexo({ anexo, onRemover, desabilitado, contexto = "revisão" }) {
  const elemento = useRef(null);
  const disponivel = anexo.blob instanceof Blob;
  const imagem = anexo.blob?.type?.startsWith("image/") || anexo.category === "foto";
  const nome = anexo.nomeArquivo || anexo.blob?.name || `${imagem ? "Foto" : "Arquivo"} · ${contexto}`;

  useEffect(() => {
    if (!disponivel) return;
    const url = URL.createObjectURL(anexo.blob);
    elemento.current.setAttribute(imagem ? "src" : "href", url);
    return () => URL.revokeObjectURL(url);
  }, [anexo.blob, disponivel, imagem]);

  return (
    <div className="gr-attachment">
      {disponivel && imagem && <img ref={elemento} alt={nome} />}
      {disponivel && !imagem && <a ref={elemento} download={nome}>{nome}</a>}
      {!disponivel && <span>Arquivo indisponível</span>}
      <button type="button" disabled={desabilitado} onClick={onRemover}>Remover</button>
    </div>
  );
}
