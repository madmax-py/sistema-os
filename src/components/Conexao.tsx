import { useState, type FormEvent } from "react";
import { getDominio, normalizarDominio, verificarDominio, type ResultadoVerificacao } from "../api";
import { IconeAlerta, IconeGlobo } from "./Icones";
import { Logo } from "./Logo";

/** Etapa 1: escolher o domínio da API e confirmar que ela responde. */
export function Conexao({ onConectado }: { onConectado: (origem: string) => void }) {
  const [protocolo, setProtocolo] = useState(() => (getDominio()?.startsWith("http://") ? "http://" : "https://"));
  const [dominio, setDominio] = useState(() => getDominio()?.replace(/^https?:\/\//, "") ?? "");
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);

  const origem = normalizarDominio(`${protocolo}${dominio}`);

  const verificar = async (e: FormEvent) => {
    e.preventDefault();
    setResultado(null);
    setVerificando(true);
    const r = await verificarDominio(`${protocolo}${dominio}`);
    setVerificando(false);
    setResultado(r);
  };

  return (
    <div className="login">
      <div className="bolha" />
      <div className="bolha" />
      <div className="bolha" />

      <div className="login-conteudo fade-up">
        <form className="login-card" onSubmit={verificar}>
          <div className="login-topo">
            <Logo className="login-logo" />
            <div className="login-icone">
              <IconeGlobo width={32} height={32} />
            </div>
            <p className="etapa">Etapa 1 de 2 · Conexão</p>
            <h1>Conectar à API</h1>
            <p>Informe o domínio da Progete que este sistema deve usar.</p>
          </div>

          <label>
            <span>Domínio da API</span>
            <div className="campo-prefixo">
              <select
                aria-label="Protocolo"
                value={protocolo}
                onChange={(e) => {
                  setProtocolo(e.target.value);
                  setResultado(null);
                }}
              >
                <option value="https://">https://</option>
                <option value="http://">http://</option>
              </select>
              <input
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                placeholder={protocolo === "http://" ? "192.168.1.6:3000" : "teste.progete.com.br"}
                value={dominio}
                onChange={(e) => {
                  const valor = e.target.value;
                  const prefixo = valor.match(/^https?:\/\//i)?.[0].toLowerCase();
                  if (prefixo) setProtocolo(prefixo);
                  setDominio(valor.replace(/^https?:\/\//i, ""));
                  setResultado(null);
                }}
                required
                autoFocus
              />
            </div>
          </label>
          {origem && !resultado && (
            <p className="dica-url">
              Será verificado: <code>{origem}/api/v1.json</code>
            </p>
          )}

          {resultado && (
            <div className={`verificacao ${resultado.ok ? "ok" : "falha"}`} role="status">
              <b>{resultado.ok ? "✓ Conexão verificada" : "✕ Não foi possível conectar"}</b>
              <span>{resultado.mensagem}</span>
              {resultado.url && <code>{resultado.url}</code>}
            </div>
          )}

          {resultado?.ok ? (
            <button className="primario" type="button" onClick={() => onConectado(resultado.origem)} autoFocus>
              Continuar para o login
            </button>
          ) : (
            <button className="primario" type="submit" disabled={verificando || !origem}>
              {verificando ? "Verificando…" : "Verificar conexão"}
            </button>
          )}

          <p className="nota">
            <IconeAlerta width={14} height={14} /> Aceitos (https): <code>*.progete.com.br</code>, <code>*.profinancas.com.br</code>{" "}
            e <code>*.progete.com</code>. Em desenvolvimento, qualquer domínio (inclusive http local).
          </p>
        </form>
        <p className="login-rodape">ProFinanças · Sistema O.S. © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
