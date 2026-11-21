import { useRef } from "react";

export default function SeletorAnexos({ onSelecionar, desabilitado }) {
  const arquivos = useRef(null);
  const camera = useRef(null);

  function selecionar(evento) {
    const selecionados = Array.from(evento.currentTarget.files);
    evento.currentTarget.value = "";
    if (selecionados.length) onSelecionar(selecionados);
  }

  return (
    <div className="gr-attachment-actions">
      <input ref={arquivos} type="file" multiple hidden onChange={selecionar} />
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={selecionar} />
      <button type="button" disabled={desabilitado} onClick={() => arquivos.current.click()}>Escolher arquivos</button>
      <button type="button" disabled={desabilitado} onClick={() => camera.current.click()}>Tirar foto</button>
    </div>
  );
}
