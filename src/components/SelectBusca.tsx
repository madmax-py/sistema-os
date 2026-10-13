// Select com campo de pesquisa (substitui o <select> em listas grandes).
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { IconeBusca } from "./Icones";

export interface OpcaoBusca {
  id: number;
  rotulo: string;
}

/** Máximo de opções desenhadas por vez (a pesquisa estreita o resto) */
const LIMITE = 200;

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function SelectBusca({
  value,
  onChange,
  opcoes,
  obrigatorio,
  vazio = "Selecione…",
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: OpcaoBusca[];
  obrigatorio?: boolean;
  vazio?: string;
}) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [sel, setSel] = useState(0);
  const raiz = useRef<HTMLDivElement>(null);
  const lista = useRef<HTMLUListElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  const idLista = useId();

  const atual = opcoes.find((o) => String(o.id) === value);

  // Primeira linha "vazio" serve para limpar quando o campo não é obrigatório
  const { filtradas, cortadas } = useMemo(() => {
    const palavras = normalizar(termo.trim()).split(/\s+/).filter(Boolean);
    const l = palavras.length
      ? opcoes.filter((o) => {
          const t = normalizar(o.rotulo);
          return palavras.every((w) => t.includes(w));
        })
      : opcoes;
    return {
      filtradas: [...(obrigatorio || palavras.length ? [] : [null]), ...l.slice(0, LIMITE)],
      cortadas: l.length > LIMITE,
    };
  }, [opcoes, termo, obrigatorio]);

  // Ao abrir, começa na opção escolhida
  useEffect(() => {
    if (!aberto) return;
    const i = filtradas.findIndex((o) => (o ? String(o.id) === value : value === ""));
    setSel(i >= 0 ? i : 0);
  }, [aberto, termo]);

  useEffect(() => {
    lista.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel, aberto]);

  // Fecha ao clicar fora
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !raiz.current?.contains(e.target as Node) && fechar(false);
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);

  const fechar = (focar = true) => {
    setAberto(false);
    setTermo("");
    if (focar) gatilho.current?.focus();
  };

  const escolher = (o: OpcaoBusca | null) => {
    onChange(o ? String(o.id) : "");
    fechar();
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtradas.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault(); // não envia o formulário
      if (filtradas[sel] !== undefined) escolher(filtradas[sel]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      fechar();
    } else if (e.key === "Tab") {
      fechar(false);
    }
  };

  return (
    <div className={`select-busca${aberto ? " aberto" : ""}`} ref={raiz}>
      <button
        type="button"
        ref={gatilho}
        className={`select-busca-gatilho${atual ? "" : " vazio"}`}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        onClick={() => (aberto ? fechar() : setAberto(true))}
        onKeyDown={(e) => {
          // Digitar com o campo fechado já abre a pesquisa com a letra
          if (!aberto && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
            e.preventDefault();
            setTermo(e.key);
            setAberto(true);
          } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
            // Teclado tratado aqui (sem o clique nativo do botão)
            e.preventDefault();
            if (!aberto) setAberto(true);
          }
        }}
      >
        <span>{atual?.rotulo ?? vazio}</span>
      </button>

      {/* Mantém a validação nativa do formulário (campo obrigatório) */}
      <input
        className="select-busca-validacao"
        tabIndex={-1}
        aria-hidden
        required={obrigatorio}
        value={value}
        onChange={() => {}}
        onFocus={() => gatilho.current?.focus()}
      />

      {aberto && (
        // preventDefault: o <label> em volta não deve "clicar" no gatilho de novo
        <div className="select-busca-painel" onClick={(e) => e.preventDefault()}>
          <div className="select-busca-pesquisa">
            <IconeBusca width={16} height={16} />
            <input
              autoFocus
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={teclas}
              placeholder="Pesquisar…"
              aria-controls={idLista}
              aria-autocomplete="list"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <ul id={idLista} role="listbox" ref={lista}>
            {filtradas.length === 0 && <li className="select-busca-nada">Nada encontrado.</li>}
            {filtradas.map((o, i) => (
              <li
                key={o?.id ?? "vazio"}
                role="option"
                aria-selected={o ? String(o.id) === value : value === ""}
                className={`${i === sel ? "ativa" : ""}${o ? "" : " limpar"}`}
                onMouseEnter={() => setSel(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  escolher(o);
                }}
              >
                {o?.rotulo ?? vazio}
              </li>
            ))}
            {cortadas && (
              <li className="select-busca-nada">Pesquise para ver mais opções…</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
