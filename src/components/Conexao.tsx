import { useState, type FormEvent } from "react";
import { getDominio, normalizarDominio, verificarDominio, type ResultadoVerificacao } from "../api";
import { IconeAlerta, IconeGlobo } from "./Icones";

/** Etapa 1: escolher o domínio da API e confirmar que ela responde. */
export function Conexao({ onConectado }: { onConectado: (origem: string) => void }) {
  const [dominio, setDominio] = useState(() => getDominio()?.replace(/^https:\/\//, "") ?? "");
  const [verificando, setVerificando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoVerificacao | null>(null);

  const origem = normalizarDominio(dominio);

  const verificar = async (e: FormEvent) => {
    e.preventDefault();
    setResultado(null);
    setVerificando(true);
    const r = await verificarDominio(dominio);
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
              <em>https://</em>
              <input
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                placeholder="teste.progete.com.br"
                value={dominio}
                onChange={(e) => {
                  setDominio(e.target.value.replace(/^https?:\/\//i, ""));
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
            <IconeAlerta width={14} height={14} /> Aceitos: endereços <code>*.progete.com.br</code> (https).
          </p>
        </form>
        <p className="login-rodape">Sistema O.S. © {new Date().getFullYear()} · Integrado à Progete</p>
      </div>
    </div>
  );
}
