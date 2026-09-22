import { useState, type FormEvent } from "react";
import { entrar, type Sessao } from "../api";
import { IconeCadeado } from "./Icones";

export function Login({
  dominio,
  onEntrar,
  onTrocarDominio,
}: {
  dominio: string;
  onEntrar: (s: Sessao) => void;
  /** ausente quando o domínio é fixo (PROGETE_URL no servidor) */
  onTrocarDominio?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      onEntrar(await entrar(email, senha));
    } catch (err: any) {
      setErro(err?.message ?? "Erro ao entrar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <div className="bolha" />
      <div className="bolha" />
      <div className="bolha" />

      <div className="login-conteudo fade-up">
        <form className="login-card" onSubmit={enviar}>
          <div className="login-topo">
            <div className="login-icone">
              <IconeCadeado width={32} height={32} />
            </div>
            {onTrocarDominio && <p className="etapa">Etapa 2 de 2 · Login</p>}
            <h1>Bem-vindo</h1>
            <p>Sistema de Ordem de Serviço · entre com sua conta da Progete</p>
          </div>

          <p className="conexao-atual">
            <span className="online">{dominio.replace(/^https?:\/\//, "")}</span>
            {onTrocarDominio && (
              <button type="button" className="link" onClick={onTrocarDominio}>
                Trocar
              </button>
            )}
          </p>

          <label>
            <span>E-mail</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="seu.email@empresa.com.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            <span>Senha</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              required
            />
          </label>

          {erro && <p className="erro login-erro">{erro}</p>}

          <button className="primario" type="submit" disabled={enviando}>
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
        <p className="login-rodape">Sistema O.S. © {new Date().getFullYear()} · Integrado à Progete</p>
      </div>
    </div>
  );
}
