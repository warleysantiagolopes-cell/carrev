import { useState } from "react";
import Cars from "./pages/Cars";
import Proximas from "./pages/Proximas";

export default function App() {
  const [tela, setTela] = useState("carros");

  return (
    <div>
      <nav style={{ padding: 12, borderBottom: "1px solid #333" }}>
        <button onClick={() => setTela("carros")} style={{ marginRight: 8 }}>
          Carros
        </button>
        <button onClick={() => setTela("proximas")}>Próximas revisões</button>
      </nav>

      {tela === "carros" && <Cars />}
      {tela === "proximas" && <Proximas />}
    </div>
  );
}
