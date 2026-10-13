// Lançamento de produtos estilo PDV de supermercado: leitor de código de
// barras (leitor USB/teclado ou câmera), cupom com os itens e visor de total.
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type SVGProps } from "react";
import type { CatalogosSaida } from "../api";
import { useProdutos } from "../produtosCache";
import { moeda } from "../formato";
import { IconeBarras, IconeLixeira, IconeX } from "./Icones";

type Produto = CatalogosSaida["produtos"][number];

export interface ItemForm {
  key: string;
  id?: number;
  produtoId: string;
  xprod: string;
  qcom: string;
  vuncom: string;
  remover?: boolean;
}

export interface Extras {
  vserv: string;
  vfrete: string;
  voutro: string;
  vdesc: string;
}

let seq = 0;
const novaKey = () => `n${++seq}`;

const num = (v: string) => Number(v) || 0;
const subtotal = (i: ItemForm) => num(i.qcom) * num(i.vuncom);
/** Valor unitário da saída: custo do produto */
const precoDe = (p: Produto) => {
  const v = p.valor_custo;
  return v == null || v === "" ? "" : Number(v).toFixed(2);
};
/** Arredonda para 3 casas sem lixo de ponto flutuante */
const arred = (n: number) => String(Math.round(n * 1000) / 1000);
const fmtQtde = (v: string) => num(v).toLocaleString("pt-BR", { maximumFractionDigits: 3 });

/** "Café Pilão" → "cafe pilao" */
const normalizar = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
const semZeros = (s: string) => s.replace(/^0+/, "");
/**
 * Códigos de barras de um produto, só os dígitos e sem zeros à esquerda.
 * Aceita vários no mesmo campo ("789..., 789...") e máscaras com espaço/hífen.
 */
const codigosBarras = (v: unknown): string[] =>
  String(v ?? "")
    .split(/[,;|/]+/)
    .map((c) => semZeros(c.replace(/\D/g, "")))
    .filter(Boolean);

/* ------------------------------------------------------------------------- */
/* Som do leitor                                                              */
/* ------------------------------------------------------------------------- */

const SOM_KEY = "progete_os_pdv_som";
let audio: AudioContext | null = null;

function bip(ok: boolean) {
  try {
    if (localStorage.getItem(SOM_KEY) === "off") return;
  } catch {
    // ignora
  }
  try {
    audio ??= new AudioContext();
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = "square";
    o.frequency.value = ok ? 1800 : 280;
    g.gain.value = 0.04;
    o.connect(g).connect(audio.destination);
    o.start();
    o.stop(audio.currentTime + (ok ? 0.07 : 0.25));
  } catch {
    // navegador sem áudio
  }
}

/* ------------------------------------------------------------------------- */
/* PDV                                                                        */
/* ------------------------------------------------------------------------- */

export function Pdv({
  produtos,
  itens,
  setItens,
  extras,
  onExtra,
}: {
  produtos: Produto[];
  itens: ItemForm[];
  setItens: (f: (l: ItemForm[]) => ItemForm[]) => void;
  extras: Extras;
  onExtra: (k: keyof Extras, v: string) => void;
}) {
  const { completo } = useProdutos();
  const [termo, setTermo] = useState("");
  const [sel, setSel] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; erro: boolean } | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [som, setSom] = useState(() => {
    try {
      return localStorage.getItem(SOM_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const entrada = useRef<HTMLInputElement>(null);
  const cupom = useRef<HTMLDivElement>(null);

  // Índice de busca: código de barras, código e descrição normalizados
  const indice = useMemo(
    () =>
      produtos.map((p) => ({
        p,
        barras: codigosBarras(p.codigo_barras),
        codigo: normalizar(p.codigo),
        texto: normalizar(`${p.descricao} ${p.codigo ?? ""} ${p.codigo_barras ?? ""}`),
      })),
    [produtos]
  );
  const porId = useMemo(() => new Map(produtos.map((p) => [String(p.id), p])), [produtos]);

  // "3*7891234567890" ou "3x café" → quantidade 3
  const { qtde, busca } = useMemo(() => {
    const m = /^(\d+(?:[.,]\d+)?)\s*[*xX]\s*(.+)$/.exec(termo.trim());
    return m ? { qtde: Number(m[1].replace(",", ".")), busca: m[2].trim() } : { qtde: 1, busca: termo.trim() };
  }, [termo]);

  const exato = (codigo: string) => {
    const c = normalizar(codigo);
    if (!c) return undefined;
    const digitos = /^[\d\s.-]+$/.test(c) ? semZeros(c.replace(/\D/g, "")) : "";
    return (
      (digitos ? indice.find((x) => x.barras.includes(digitos)) : undefined) ??
      indice.find((x) => x.codigo === c)
    )?.p;
  };

  const sugestoes = useMemo(() => {
    const t = normalizar(busca);
    if (t.length < 2) return [];
    const palavras = t.split(/\s+/);
    return indice
      .filter((x) => palavras.every((w) => x.texto.includes(w)))
      .slice(0, 8)
      .map((x) => x.p);
  }, [busca, indice]);

  useEffect(() => setSel(0), [busca]);

  // F2 volta para o leitor de qualquer lugar da tela
  useEffect(() => {
    const f = (e: globalThis.KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        entrada.current?.focus();
      }
    };
    window.addEventListener("keydown", f);
    return () => window.removeEventListener("keydown", f);
  }, []);

  // Rola o cupom até o item lançado
  useEffect(() => {
    if (ultimo) cupom.current?.querySelector(`[data-key="${ultimo}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [ultimo, itens]);

  const avisar = (texto: string, erro = false) => {
    setAviso({ texto, erro });
    bip(!erro);
  };

  const adicionar = (p: Produto, q = qtde) => {
    if (!(q > 0)) return avisar("Quantidade inválida.", true);
    const pid = String(p.id);
    // Produto já no cupom → soma a quantidade na mesma linha
    const existente = itens.find((i) => !i.remover && i.produtoId === pid);
    const key = existente?.key ?? novaKey();
    setItens((l) =>
      l.some((i) => i.key === key)
        ? l.map((i) => (i.key === key ? { ...i, qcom: arred(num(i.qcom) + q) } : i))
        : [...l, { key, produtoId: pid, xprod: p.descricao, qcom: arred(q), vuncom: precoDe(p) }]
    );
    setUltimo(key);
    avisar(`${fmtQtde(String(q))} × ${p.descricao}`);
    setTermo("");
  };

  const lancar = () => {
    if (!busca) return;
    const p = exato(busca) ?? sugestoes[sel];
    if (p) return adicionar(p);
    avisar(
      /^\d+$/.test(busca)
        ? `Código ${busca} não encontrado entre os ${produtos.length} produtos carregados${completo ? "" : " (a lista ainda está carregando)"}.`
        : `Nenhum produto com "${busca}".`,
      true
    );
    entrada.current?.select();
  };

  const teclas = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault(); // não envia o formulário
      lancar();
    } else if (e.key === "ArrowDown" && sugestoes.length) {
      e.preventDefault();
      setSel((s) => (s + 1) % sugestoes.length);
    } else if (e.key === "ArrowUp" && sugestoes.length) {
      e.preventDefault();
      setSel((s) => (s - 1 + sugestoes.length) % sugestoes.length);
    } else if (e.key === "Escape") {
      setTermo("");
    }
  };

  const setItem = (key: string, patch: Partial<ItemForm>) =>
    setItens((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const passo = (i: ItemForm, d: number) => {
    const decimal = !!porId.get(i.produtoId)?.qtde_decimal;
    const novo = num(i.qcom) + d;
    setItem(i.key, { qcom: arred(Math.max(decimal ? 0.001 : 1, novo)) });
  };

  const remover = (i: ItemForm) =>
    i.id ? setItem(i.key, { remover: !i.remover }) : setItens((l) => l.filter((x) => x.key !== i.key));

  const ativos = itens.filter((i) => !i.remover);
  const vprod = ativos.reduce((t, i) => t + subtotal(i), 0);
  const volumes = ativos.reduce((t, i) => t + num(i.qcom), 0);
  const total = vprod + num(extras.vserv) + num(extras.vfrete) + num(extras.voutro) - num(extras.vdesc);
  const itemVisor = itens.find((i) => i.key === ultimo && !i.remover) ?? ativos[ativos.length - 1];

  const temCamera = typeof window !== "undefined" && "BarcodeDetector" in window && !!navigator.mediaDevices;

  return (
    <div className="pdv">
      <div className="pdv-principal">
        {/* Leitor */}
        <div className="pdv-leitor">
          <div className="pdv-entrada">
            <IconeBarras />
            <input
              ref={entrada}
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={teclas}
              placeholder="Passe o leitor ou digite código / descrição"
              aria-label="Código de barras, código ou descrição do produto"
              autoComplete="off"
              spellCheck={false}
              inputMode="search"
            />
            {qtde !== 1 && <span className="pdv-mult">× {fmtQtde(String(qtde))}</span>}
            {temCamera && (
              <button type="button" onClick={() => setCamera(true)} title="Ler código pela câmera">
                <IconeCamera width={18} height={18} />
                <span className="texto-aba">Câmera</span>
              </button>
            )}
          </div>

          {sugestoes.length > 0 && !exato(busca) && (
            <ul className="pdv-sugestoes" role="listbox">
              {sugestoes.map((p, n) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={n === sel}
                  className={n === sel ? "ativa" : undefined}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    adicionar(p);
                    entrada.current?.focus();
                  }}
                  onMouseEnter={() => setSel(n)}
                >
                  <span className="pdv-sug-desc">
                    {p.descricao}
                    <small>
                      {p.codigo ? `Cód. ${p.codigo}` : ""}
                      {p.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                    </small>
                  </span>
                  <b>{moeda(Number(precoDe(p)))}</b>
                </li>
              ))}
            </ul>
          )}

          <div className="pdv-dicas">
            {aviso ? (
              <span className={aviso.erro ? "pdv-erro" : "pdv-ok"}>{aviso.texto}</span>
            ) : (
              <span>
                <kbd>Enter</kbd> lança · <kbd>3*código</kbd> quantidade · <kbd>↑</kbd>
                <kbd>↓</kbd> escolhe · <kbd>F2</kbd> volta ao leitor
              </span>
            )}
            <button
              type="button"
              className="pdv-som"
              onClick={() => {
                const s = !som;
                setSom(s);
                try {
                  localStorage.setItem(SOM_KEY, s ? "on" : "off");
                } catch {
                  // ignora
                }
              }}
              title={som ? "Desligar bipe" : "Ligar bipe"}
            >
              {som ? "🔊" : "🔇"}
            </button>
          </div>
        </div>

        {/* Cupom */}
        <div className="pdv-cupom" ref={cupom}>
          <div className="pdv-linha pdv-cab">
            <span>#</span>
            <span>Produto</span>
            <span className="dir">Qtde</span>
            <span className="dir">Unitário</span>
            <span className="dir">Total</span>
            <span />
          </div>
          {itens.length === 0 && (
            <div className="pdv-vazio">
              <IconeBarras width={40} height={40} />
              <p>Nenhum produto lançado.</p>
              <small>Passe o leitor de código de barras ou busque pela descrição.</small>
            </div>
          )}
          {itens.map((i, n) => {
            const p = porId.get(i.produtoId);
            return (
              <div
                key={i.key}
                data-key={i.key}
                className={`pdv-linha${i.remover ? " removido" : ""}${i.key === ultimo ? " recente" : ""}`}
              >
                <span className="pdv-n">{String(n + 1).padStart(3, "0")}</span>
                <span className="pdv-desc">
                  {i.xprod || p?.descricao || `Produto #${i.produtoId}`}
                  <small>
                    {p?.codigo ? `Cód. ${p.codigo}` : `ID ${i.produtoId}`}
                    {p?.codigo_barras ? ` · ${p.codigo_barras}` : ""}
                  </small>
                </span>
                <span className="pdv-qtde">
                  <button type="button" onClick={() => passo(i, -1)} disabled={i.remover} aria-label="Diminuir">
                    −
                  </button>
                  <input
                    type="number"
                    step="any"
                    min={0}
                    value={i.qcom}
                    disabled={i.remover}
                    onChange={(e) => setItem(i.key, { qcom: e.target.value })}
                    aria-label="Quantidade"
                  />
                  <button type="button" onClick={() => passo(i, 1)} disabled={i.remover} aria-label="Aumentar">
                    +
                  </button>
                </span>
                <span className="pdv-unit">
                  <input
                    type="number"
                    step="0.01"
                    min={0}
                    value={i.vuncom}
                    disabled={i.remover}
                    onChange={(e) => setItem(i.key, { vuncom: e.target.value })}
                    aria-label="Valor unitário"
                  />
                </span>
                <span className="pdv-sub">{moeda(subtotal(i))}</span>
                <button
                  type="button"
                  className="icone pequeno perigo"
                  onClick={() => remover(i)}
                  title={i.remover ? "Desfazer remoção" : "Remover item"}
                  aria-label={i.remover ? "Desfazer remoção" : "Remover item"}
                >
                  {i.remover ? "↺" : <IconeLixeira width={15} height={15} />}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Visor e totais */}
      <aside className="pdv-lateral">
        <div className="pdv-visor">
          {itemVisor ? (
            <>
              <span className="pdv-visor-rotulo">Último item</span>
              <b className="pdv-visor-desc">{itemVisor.xprod}</b>
              <span className="pdv-visor-conta">
                {fmtQtde(itemVisor.qcom)} × {moeda(num(itemVisor.vuncom))}
              </span>
              <span className="pdv-visor-valor">{moeda(subtotal(itemVisor))}</span>
            </>
          ) : (
            <span className="pdv-visor-livre">CAIXA LIVRE</span>
          )}
        </div>

        <div className="pdv-resumo">
          <div>
            <span>Itens</span>
            <b>{ativos.length}</b>
          </div>
          <div>
            <span>Volumes</span>
            <b>{fmtQtde(String(volumes))}</b>
          </div>
          <div>
            <span>Produtos</span>
            <b>{moeda(vprod)}</b>
          </div>
          {(
            [
              ["vserv", "Serviços"],
              ["vfrete", "Frete"],
              ["voutro", "Outros"],
              ["vdesc", "Desconto"],
            ] as const
          ).map(([k, r]) => (
            <label key={k} className={k === "vdesc" ? "desconto" : undefined}>
              <span>{r}</span>
              <input
                type="number"
                step="0.01"
                min={0}
                placeholder="0,00"
                value={extras[k]}
                onChange={(e) => onExtra(k, e.target.value)}
              />
            </label>
          ))}
        </div>

        <div className="pdv-total">
          <span>Total</span>
          <b>{moeda(total)}</b>
        </div>
      </aside>

      {camera && (
        <Camera
          onCodigo={(c) => {
            const p = exato(c);
            if (p) adicionar(p, 1);
            else avisar(`Código ${c} não encontrado entre os ${produtos.length} produtos carregados.`, true);
          }}
          onFechar={() => {
            setCamera(false);
            entrada.current?.focus();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Leitura pela câmera (BarcodeDetector: Chrome/Edge/Android)                 */
/* ------------------------------------------------------------------------- */

function Camera({ onCodigo, onFechar }: { onCodigo: (codigo: string) => void; onFechar: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [lido, setLido] = useState<string | null>(null);
  const cb = useRef(onCodigo);
  cb.current = onCodigo;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let ativo = true;
    // Mesmo código só conta de novo depois de 1,5 s
    let anterior = { codigo: "", em: 0 };

    (async () => {
      try {
        const Detector = (window as any).BarcodeDetector;
        const formatos: string[] = await Detector.getSupportedFormats?.().catch(() => []) ?? [];
        const desejados = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf", "qr_code"];
        const detector = new Detector({ formats: desejados.filter((f) => !formatos.length || formatos.includes(f)) });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (!ativo || !video.current) return;
        video.current.srcObject = stream;
        await video.current.play();
        timer = window.setInterval(async () => {
          if (!video.current || video.current.readyState < 2) return;
          try {
            const [c] = await detector.detect(video.current);
            const codigo: string | undefined = c?.rawValue;
            if (!codigo) return;
            if (codigo === anterior.codigo && Date.now() - anterior.em < 1500) return;
            anterior = { codigo, em: Date.now() };
            setLido(codigo);
            cb.current(codigo);
          } catch {
            // quadro sem leitura
          }
        }, 250);
      } catch (e) {
        setErro(
          (e as Error)?.name === "NotAllowedError"
            ? "Permissão da câmera negada."
            : "Não foi possível abrir a câmera neste dispositivo."
        );
      }
    })();

    return () => {
      ativo = false;
      clearInterval(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div className="pdv-camera" role="dialog" aria-label="Leitura pela câmera" onClick={onFechar}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <div className="pdv-camera-topo">
          <b>Aponte para o código de barras</b>
          <button type="button" className="icone pequeno" onClick={onFechar} aria-label="Fechar câmera">
            <IconeX width={16} height={16} />
          </button>
        </div>
        {erro ? (
          <div className="erro-caixa">{erro}</div>
        ) : (
          <div className="pdv-camera-video">
            <video ref={video} muted playsInline />
            <span className="pdv-camera-mira" />
          </div>
        )}
        <p className="muted">{lido ? `Último lido: ${lido}` : "A leitura é contínua: cada código lido entra no cupom."}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Ícones locais                                                              */
/* ------------------------------------------------------------------------- */

type P = SVGProps<SVGSVGElement>;

function IconeCamera(p: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18} {...p}>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
      <circle cx="12" cy="13" r="3" />
    </svg>
  );
}

