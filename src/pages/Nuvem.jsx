import { useCallback, useEffect, useMemo, useState } from "react";
import App from "../App";
import { DbContext, abrirBancoGaragem } from "../db/db";
import { resultado, rpc, supabase } from "../db/supabase";
import "./Nuvem.css";

const chaveConvite = "carrev.convite";
const enderecoApp = () => location.origin + location.pathname;

function lerConvite() {
  if (location.hash.startsWith("#convite=")) {
    const token = new URLSearchParams(location.hash.slice(1)).get("convite");
    if (token && /^[0-9a-f-]{72}$/.test(token)) localStorage.setItem(chaveConvite, token);
    history.replaceState(null, "", location.pathname + location.search);
  }
  return localStorage.getItem(chaveConvite);
}

function Acesso({ convite }) {
  const [cadastro, setCadastro] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [erro, setErro] = useState("");

  async function enviar(evento) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    const credenciais = { email: dados.get("email").trim(), password: dados.get("senha") };
    setOcupado(true);
    setErro("");
    setMensagem("");
    try {
      if (cadastro) {
        const resposta = await resultado(supabase.auth.signUp({
          ...credenciais, options: { emailRedirectTo: enderecoApp() },
        }));
        if (!resposta.session) setMensagem("Confira seu e-mail para confirmar a conta. Se necessário, volte a abrir o link do convite.");
      } else {
        await resultado(supabase.auth.signInWithPassword(credenciais));
      }
    } catch (falha) {
      setErro("Não foi possível " + (cadastro ? "criar a conta" : "entrar") + ". " + falha.message);
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="nuvem-acesso">
      <h1 className="gr-wordmark">Car<span>Rev</span></h1>
      {convite && <p>Entre ou crie uma conta para aceitar o convite de garagem.</p>}
      <form onSubmit={enviar}>
        <label>E-mail<input name="email" type="email" autoComplete="email" required /></label>
        <label>Senha<input name="senha" type="password" minLength={6}
          autoComplete={cadastro ? "new-password" : "current-password"} required /></label>
        <button type="submit" className="nuvem-principal" disabled={ocupado}>{cadastro ? "Criar conta" : "Entrar"}</button>
      </form>
      <button type="button" onClick={() => { setCadastro(!cadastro); setErro(""); setMensagem(""); }}>
        {cadastro ? "Já tenho conta" : "Criar uma conta"}
      </button>
      {mensagem && <p role="status">{mensagem}</p>}
      {erro && <p role="alert">{erro}</p>}
    </main>
  );
}

function Configuracoes({ garagem, ocupado, executar, atualizar }) {
  const [link, setLink] = useState("");
  const [editores, setEditores] = useState(null);
  const [aviso, setAviso] = useState("");

  async function compartilhar() {
    try {
      if (navigator.share) {
        await navigator.share({ title: "Convite para o CarRev", text: "Acesse minha garagem no CarRev", url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setAviso("Link copiado. Você pode colar no WhatsApp.");
      }
    } catch (falha) {
      if (falha.name !== "AbortError") setAviso("Selecione o link acima e copie para o WhatsApp.");
    }
  }

  function renomear(evento) {
    evento.preventDefault();
    const nome = new FormData(evento.currentTarget).get("nome").trim();
    if (!nome) return;
    executar(async () => {
      await rpc("renomear_garagem", { p_garagem: garagem.id, p_nome: nome });
      await atualizar();
    });
  }

  return (
    <details className="nuvem-painel">
      <summary>Configurações da garagem</summary>
      <form onSubmit={renomear}>
        <label>Nome da garagem<input name="nome" required maxLength={80} defaultValue={garagem.nome} /></label>
        <button type="submit" disabled={ocupado}>Salvar nome</button>
      </form>
      <h2>Convidar editor</h2>
      <p>O link pode ser usado uma vez e vence em 48 horas. Envie apenas para a pessoa que você quer convidar.</p>
      <div className="nuvem-acoes">
        <button type="button" disabled={ocupado} className="nuvem-principal" onClick={() => executar(async () => {
          const token = await rpc("gerar_convite", { p_garagem: garagem.id });
          setAviso("");
          setLink(enderecoApp() + "#convite=" + token);
        })}>Gerar convite</button>
        <button type="button" disabled={ocupado} onClick={() => executar(async () => {
          await rpc("revogar_convites", { p_garagem: garagem.id });
          setLink("");
          setAviso("Convites pendentes cancelados.");
        })}>Cancelar convites pendentes</button>
      </div>
      {link && <div className="nuvem-acoes">
        <label>Link do convite<input readOnly value={link} onFocus={e => e.target.select()} /></label>
        <button type="button" onClick={compartilhar}>Compartilhar convite</button>
      </div>}
      {aviso && <p role="status">{aviso}</p>}
      <h2>Editores</h2>
      <button type="button" disabled={ocupado} onClick={() => executar(async () => {
        setEditores(await rpc("listar_editores", { p_garagem: garagem.id }));
      })}>Consultar editores</button>
      {editores?.length === 0 && <p>Nenhum editor nesta garagem.</p>}
      {editores?.map(editor => <div className="nuvem-editor" key={editor.usuario_id}>
        <span>{editor.email || "Editor"}</span>
        <button type="button" disabled={ocupado} onClick={() => {
          if (!window.confirm("Remover o acesso deste editor?")) return;
          executar(async () => {
            await rpc("remover_editor", { p_garagem: garagem.id, p_usuario: editor.usuario_id });
            setEditores(lista => lista.filter(item => item.usuario_id !== editor.usuario_id));
          });
        }}>Remover acesso</button>
      </div>)}
    </details>
  );
}

function Garagens({ usuario, convite, descartarConvite }) {
  const [lista, setLista] = useState([]);
  const [ativa, setAtiva] = useState("");
  const [versao, setVersao] = useState(0);
  const [criacao, setCriacao] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [conviteVerificado, setConviteVerificado] = useState(null);
  const [avisoConvite, setAvisoConvite] = useState("");
  const garagem = lista.find(item => item.id === ativa);
  const db = useMemo(() => ativa ? abrirBancoGaragem(ativa) : null, [ativa]);
  const chaveAtiva = "carrev.garagem." + usuario.id;

  async function atualizar(preferida) {
    const garagens = await resultado(supabase.from("carrev_garagens").select("id,nome,dono").order("nome"));
    setLista(garagens);
    setAtiva(atual => {
      const escolha = preferida || atual || localStorage.getItem(chaveAtiva);
      return garagens.find(item => item.id === escolha)?.id ?? garagens[0]?.id ?? "";
    });
  }

  useEffect(() => {
    atualizar().catch(falha => setErro(falha.message)).finally(() => setCarregando(false));
  }, [usuario.id]);

  useEffect(() => {
    if (ativa) localStorage.setItem(chaveAtiva, ativa);
  }, [ativa, chaveAtiva]);

  useEffect(() => {
    if (!convite) return;
    let ativo = true;
    rpc("convite_pendente", { p_token: convite }).then(pendente => {
      if (!ativo) return;
      if (pendente === false) descartarConvite(convite);
      else setConviteVerificado(convite);
    }).catch(() => {
      // Preserva o convite em caso de falha temporária na consulta.
      if (ativo) setConviteVerificado(convite);
    });
    return () => { ativo = false; };
  }, [convite, descartarConvite]);

  function aceitarConvite() {
    executar(async () => {
      setAvisoConvite("");
      let id;
      try {
        id = await rpc("aceitar_convite", { p_token: convite });
      } catch (falha) {
        if (falha.message !== "Convite inválido, vencido, já usado ou da sua própria garagem.") throw falha;
        descartarConvite(convite);
        setAvisoConvite("Este convite não está mais disponível.");
        await atualizar();
        return;
      }
      descartarConvite(convite);
      setCriacao(false);
      await atualizar(id);
    });
  }

  async function executar(acao) {
    setOcupado(true);
    setErro("");
    try {
      await acao();
    } catch (falha) {
      setErro(falha.message || "Não foi possível concluir a operação.");
    } finally {
      setOcupado(false);
    }
  }

  function criar(evento) {
    evento.preventDefault();
    const nome = new FormData(evento.currentTarget).get("nome").trim();
    if (!nome) return;
    executar(async () => {
      const id = await rpc("criar_garagem", { p_nome: nome });
      setCriacao(false);
      await atualizar(id);
    });
  }

  const controlesGaragem = (
    <section className="nuvem-barra" aria-label="Garagem ativa">
      <div className="nuvem-acoes">
        {garagem && <label>Garagem ativa<select value={ativa} disabled={ocupado} onChange={e => { setCriacao(false); setErro(""); setAtiva(e.target.value); }}>
          {lista.map(item => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select></label>}
        {(garagem || erro) && <button type="button" disabled={ocupado} onClick={() => setCriacao(!criacao)}>Nova garagem</button>}
        <button type="button" disabled={ocupado} onClick={() => executar(async () => {
          await atualizar();
          setVersao(v => v + 1);
        })}>Atualizar</button>
        <button type="button" disabled={ocupado} onClick={() => executar(() => resultado(supabase.auth.signOut({ scope: "local" })))}>Sair</button>
      </div>
      {erro && !convite && <p role="alert">{erro}</p>}
      {(criacao || (!garagem && !convite && !carregando && !erro)) && (
        <form onSubmit={criar} className="nuvem-painel">
          <label>Nome da nova garagem<input name="nome" maxLength={80} placeholder="Minha garagem" required /></label>
          <button type="submit" className="nuvem-principal" disabled={ocupado}>Criar garagem</button>
        </form>
      )}
      {garagem?.dono === usuario.id && <Configuracoes key={garagem.id + ":" + garagem.nome} garagem={garagem}
        ocupado={ocupado} executar={executar} atualizar={atualizar} />}
    </section>
  );

  return (
    <>
      {avisoConvite && !convite && <p role="status" className="nuvem-barra">{avisoConvite}</p>}
      {convite && conviteVerificado === convite && <section className="nuvem-barra" aria-label="Convite">
        <div className="nuvem-painel">
          <p>Você recebeu um convite para acessar uma garagem como editor.</p>
          <div className="nuvem-acoes">
            <button type="button" className="nuvem-principal" disabled={ocupado} onClick={aceitarConvite}>Aceitar convite</button>
            <button type="button" disabled={ocupado} onClick={() => descartarConvite(convite)}>Dispensar</button>
          </div>
        </div>
        {erro && <p role="alert">{erro}</p>}
      </section>}
      {!garagem && (
        carregando
          ? <p className="nuvem-barra" role="status">Carregando garagens…</p>
          : controlesGaragem
      )}
      {garagem && db && (
        <DbContext.Provider value={db}>
          <App key={garagem.id + ":" + versao} nomeGaragem={garagem.nome} controlesGaragem={controlesGaragem} />
        </DbContext.Provider>
      )}
    </>
  );
}

function NuvemConectada() {
  const [sessao, setSessao] = useState(undefined);
  const [convite, setConvite] = useState(lerConvite);

  const descartarConvite = useCallback(token => {
    if (localStorage.getItem(chaveConvite) === token) localStorage.removeItem(chaveConvite);
    setConvite(atual => atual === token ? null : atual);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, atual) => setSessao(atual));
    function novoLink() {
      setConvite(lerConvite());
    }
    function sincronizarConvite(evento) {
      if (evento.key === chaveConvite) setConvite(localStorage.getItem(chaveConvite));
    }
    window.addEventListener("hashchange", novoLink);
    window.addEventListener("storage", sincronizarConvite);
    return () => {
      subscription.unsubscribe();
      window.removeEventListener("hashchange", novoLink);
      window.removeEventListener("storage", sincronizarConvite);
    };
  }, []);

  if (sessao === undefined) return <p className="nuvem-acesso" role="status">Carregando conta…</p>;
  if (!sessao) return <Acesso convite={convite} />;
  return <Garagens key={sessao.user.id} usuario={sessao.user} convite={convite} descartarConvite={descartarConvite} />;
}

export default function Nuvem() {
  if (!supabase) return <main className="nuvem-acesso">
    <h1 className="gr-wordmark">Car<span>Rev</span></h1>
    <p>Preencha a URL e a chave pública do Supabase em src/db/supabaseConfig.js para conectar o CarRev.</p>
  </main>;
  return <NuvemConectada />;
}
