import { useEffect, useState, type ReactNode } from "react";
import type { Sessao } from "../api";
import { Logo } from "./Logo";
import { IconeGrafico, IconeLista, IconeLua, IconeMais, IconeMenu, IconeSair, IconeSol } from "./Icones";

export type Pagina = "lista" | "nova" | "painel";

function useTema() {
  const [escuro, setEscuro] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", escuro);
    try {
      localStorage.setItem("theme", escuro ? "dark" : "light");
    } catch {
      // ignora
    }
  }, [escuro]);
  return [escuro, () => setEscuro((e) => !e)] as const;
}

export function Layout({
  sessao,
  pagina,
  onPagina,
  onSair,
  children,
}: {
  sessao: Sessao;
  pagina: Pagina | null;
  onPagina: (p: Pagina) => void;
  onSair: () => void;
  children: ReactNode;
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const [escuro, alternarTema] = useTema();

  const itens: { id: Pagina; rotulo: string; icone: ReactNode }[] = [
    { id: "lista", rotulo: "Ordens de Serviço", icone: <IconeLista width={16} height={16} /> },
    { id: "nova", rotulo: "Nova O.S.", icone: <IconeMais width={16} height={16} /> },
    { id: "painel", rotulo: "Painel de Indicadores", icone: <IconeGrafico width={16} height={16} /> },
  ];

  return (
    <>
      <div className="aurora" aria-hidden>
        <span />
        <span />
        <span />
      </div>

      {menuAberto && <div className="sombra-menu" onClick={() => setMenuAberto(false)} />}

      <aside className={`menu${menuAberto ? " aberto" : ""}`} aria-hidden={!menuAberto}>
        <div className="menu-cabecalho">
          <div className="nome-app">
            <Logo />
            <small>Sistema O.S.</small>
          </div>
          <div className="online" title={sessao.dominio}>
            {sessao.dominio.replace(/^https?:\/\//, "")}
          </div>
        </div>

        <div className="menu-usuario">
          <div className={`avatar${sessao.admin ? " admin" : ""}`}>{sessao.nome.charAt(0).toUpperCase()}</div>
          <div className="dados">
            <p className="nome">{sessao.nome}</p>
            <p className="email">{sessao.email}</p>
            <span className={`selo${sessao.admin ? " admin" : ""}`}>{sessao.admin ? "👑 ADMIN" : "🔧 USUÁRIO"}</span>
          </div>
        </div>

        <nav>
          <p className="rotulo">Menu principal</p>
          {itens.map((item) => (
            <button
              key={item.id}
              className={`item-menu${pagina === item.id ? " ativo" : ""}`}
              onClick={() => {
                onPagina(item.id);
                setMenuAberto(false);
              }}
            >
              <span className="chip">{item.icone}</span>
              {item.rotulo}
              {pagina === item.id && <span className="seta">›</span>}
            </button>
          ))}
        </nav>

        <div className="menu-rodape">
          <button className="sair" onClick={onSair}>
            <span className="chip">
              <IconeSair width={16} height={16} />
            </span>
            Sair do Sistema
          </button>
          <small>ProFinanças · Sistema O.S. © {new Date().getFullYear()}</small>
        </div>
      </aside>

      <header className="topo">
        <button className="botao-menu" onClick={() => setMenuAberto((a) => !a)} aria-label="Menu">
          <IconeMenu width={20} height={20} />
        </button>
        <div className="topo-titulo">
          <Logo />
          <span className="divisor" />
          Sistema O.S.
        </div>
        <button className="icone" onClick={alternarTema} aria-label="Alternar tema">
          {escuro ? <IconeSol width={20} height={20} /> : <IconeLua width={20} height={20} />}
        </button>
      </header>

      <main className="conteudo">{children}</main>
    </>
  );
}
