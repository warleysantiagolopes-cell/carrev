import { useState } from "react";
import Cars from "./pages/Cars";
import { Icone } from "./pages/GaragemHome";
import Proximas from "./pages/Proximas";

const abas = [
  ["Início", "casa"],
  ["Veículos", "carro"],
  ["Abastecimentos", "bomba", "Abastec."],
  ["Registrar manutenção", "chave"],
];

export default function App({ nomeGaragem, controlesGaragem }) {
  const [rota, setRota] = useState({ destino: "Início", versao: 0 });
  const [menuAberto, setMenuAberto] = useState(false);

  function navegar(destino, filtro = "TODAS") {
    setMenuAberto(false);
    setRota(atual => ({ destino, filtro, versao: atual.versao + 1 }));
    window.scrollTo(0, 0);
  }

  return (
    <div className="gr-app">
      {rota.destino === "Alertas" ? (
        <Proximas key={rota.versao} filtroStatusInicial={rota.filtro} onBack={() => navegar("Início")} />
      ) : (
        <Cars
          key={rota.versao}
          destinoInicial={rota.destino}
          nomeGaragem={nomeGaragem}
          menuAberto={menuAberto}
          onMenu={() => setMenuAberto(aberto => !aberto)}
          onAbrirProximas={filtro => navegar("Alertas", filtro)}
        />
      )}
      {menuAberto && (
        <aside className="gr-more" id="gr-menu" aria-label="Mais opções">
          <div className="gr-more-heading">
            <strong>Mais opções</strong>
            <button type="button" onClick={() => setMenuAberto(false)} aria-label="Fechar menu">×</button>
          </div>
          {["Adicionar veículo", "Documentos", "Alertas", "Relatórios", "Tabela FIPE"].map(destino => (
            <button type="button" key={destino} onClick={() => navegar(destino)}>
              {destino}<span aria-hidden="true">→</span>
            </button>
          ))}
          {controlesGaragem}
        </aside>
      )}
      <nav className="gr-bottom-nav" aria-label="Navegação principal">
        {abas.map(([destino, icone, rotulo]) => (
          <button type="button" key={destino} onClick={() => navegar(destino)}>
            <Icone nome={icone} /><span>{rotulo || destino}</span>
          </button>
        ))}
        <button type="button" className={menuAberto ? "active" : ""} onClick={() => setMenuAberto(aberto => !aberto)}
          aria-expanded={menuAberto} aria-controls={menuAberto ? "gr-menu" : undefined}>
          <Icone nome="menu" /><span>Mais</span>
        </button>
      </nav>
    </div>
  );
}
