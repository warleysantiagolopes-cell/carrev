import { useState } from "react";
import Cars from "./pages/Cars";
import Proximas from "./pages/Proximas";

export default function App() {
  const [tela, setTela] = useState("carros");

  const [filtroRevisoes, setFiltroRevisoes] = useState("TODAS");

  function abrirProximas(filtro = "TODAS") {
    setFiltroRevisoes(filtro);
    setTela("proximas");
  }

  function voltarParaGaragem() {
    setTela("carros");
    setFiltroRevisoes("TODAS");
  }

  if (tela === "proximas") {
    return (
      <Proximas
        filtroStatusInicial={filtroRevisoes}
        onBack={voltarParaGaragem}
      />
    );
  }

  return (
    <Cars
      onAbrirProximas={abrirProximas}
    />
  );
}