import { useEffect, useMemo, useState } from "react";
import { limparBarras, tipoBarras } from "../codigoBarras";
import { moeda } from "../formato";
import { atualizarProdutos, iniciarProdutos, useProdutos } from "../produtosCache";
import {
  baixarZpl,
  enviarZebra,
  estiloEtiqueta,
  gerarZpl,
  htmlEtiqueta,
  imprimirNavegador,
  lerConfig,
  salvarConfig,
  type ConfigEtiqueta,
  type Etiqueta,
} from "../zebra";
import { IconeAtualizar, IconeBarras, IconeBusca, IconeImpressora, IconeX } from "./Icones";

type Produto = Record<string, any> & { id: number; descricao: string };
type Filtro = "todos" | "com" | "sem";

/** Linhas mostradas por vez (tudo já está no cache; a tela cresce de 50 em 50) */
const POR_PAGINA = 50;

const normalizar = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const temBarras = (p: Produto) => tipoBarras(p.codigo_barras) !== null;

const etiquetaDe = (p: Produto, quantidade: number): Etiqueta => ({
  descricao: p.descricao,
  codigo: String(p.codigo ?? ""),
  barras: limparBarras(p.codigo_barras),
  preco: p.valor_venda != null && p.valor_venda !== "" ? Number(p.valor_venda) : null,
  quantidade,
});

export function Produtos() {
  const { lista, completo, carregando, erro } = useProdutos();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [limite, setLimite] = useState(POR_PAGINA);
  // id → produto + quantidade de etiquetas (vale entre buscas diferentes)
  const [sel, setSel] = useState<Map<number, { produto: Produto; qtd: number }>>(new Map());
  const [imprimir, setImprimir] = useState<Etiqueta[] | null>(null);

  useEffect(iniciarProdutos, []);

  // Texto pesquisável e tipo de barras calculados uma vez por lista
  const indice = useMemo(
    () =>
      (lista as Produto[]).map((p) => ({
        p,
        texto: normalizar(`${p.descricao} ${p.codigo ?? ""} ${limparBarras(p.codigo_barras)}`),
        barras: temBarras(p),
      })),
    [lista]
  );

  const filtrados = useMemo(() => {
    const palavras = normalizar(busca.trim()).split(/\s+/).filter(Boolean);
    return indice
      .filter(
        (x) =>
          (filtro === "todos" || (filtro === "com") === x.barras) &&
          palavras.every((w) => x.texto.includes(w))
      )
      .map((x) => x.p);
  }, [indice, busca, filtro]);

  useEffect(() => setLimite(POR_PAGINA), [busca, filtro]);

  const visiveis = filtrados.slice(0, limite);
  const stats = useMemo(() => {
    const com = indice.filter((x) => x.barras).length;
    return { total: indice.length, com, sem: indice.length - com };
  }, [indice]);

  // "Marcar todos" vale para as linhas visíveis
  const marcaveis = visiveis.filter(temBarras);
  const todosMarcados = marcaveis.length > 0 && marcaveis.every((p) => sel.has(p.id));

  const alternar = (p: Produto) =>
    setSel((m) => {
      const n = new Map(m);
      if (n.has(p.id)) n.delete(p.id);
      else n.set(p.id, { produto: p, qtd: 1 });
      return n;
    });

  const alternarTodos = () =>
    setSel((m) => {
      const n = new Map(m);
      if (todosMarcados) marcaveis.forEach((p) => n.delete(p.id));
      else marcaveis.forEach((p) => n.has(p.id) || n.set(p.id, { produto: p, qtd: 1 }));
      return n;
    });

  const setQtd = (id: number, q: number) =>
    setSel((m) => {
      const item = m.get(id);
      return item ? new Map(m).set(id, { ...item, qtd: Math.max(1, Math.min(999, q || 1)) }) : m;
    });

  const totalEtiquetas = [...sel.values()].reduce((s, x) => s + x.qtd, 0);
  const selecionadas = () => [...sel.values()].map((x) => etiquetaDe(x.produto, x.qtd));

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeBarras width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Estoque · Progete</p>
            <h1>Produtos</h1>
            <p className="desc">Consulta de produtos e etiquetas de código de barras para Zebra.</p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica azul">
            <b>
              {stats.total}
              {completo ? "" : "…"}
            </b>
            <span>Produtos</span>
          </div>
          <div className="estatistica verde">
            <b>{stats.com}</b>
            <span>Com código</span>
          </div>
          <div className="estatistica ambar">
            <b>{stats.sem}</b>
            <span>Sem código</span>
          </div>
        </div>
      </div>

      <div className="barra">
        <div className="campo-busca">
          <IconeBusca />
          <input
            placeholder="Buscar por descrição, código ou código de barras…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="acoes">
          <select value={filtro} onChange={(e) => setFiltro(e.target.value as Filtro)} aria-label="Filtrar por código de barras">
            <option value="todos">Todos</option>
            <option value="com">Com código de barras</option>
            <option value="sem">Sem código de barras</option>
          </select>
          <button onClick={atualizarProdutos} disabled={carregando} title="Buscar a lista de novo na Progete">
            <IconeAtualizar width={16} height={16} className={carregando ? "girando" : undefined} />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
      <StatusProdutos />

      {erro && !lista.length && <div className="erro-caixa">Não foi possível carregar os produtos: {erro}</div>}
      {!lista.length && carregando && <p className="muted">Buscando produtos na Progete…</p>}
      {lista.length > 0 && filtrados.length === 0 && (
        <div className="vazio">
          {busca.trim() ? `Nenhum produto com "${busca.trim()}".` : "Nenhum produto neste filtro."}
          {!completo && " A lista ainda está carregando."}
        </div>
      )}

      {visiveis.length > 0 && (
        <div className="tabela-wrap">
          <table className="tabela-produtos">
            <thead>
              <tr>
                <th className="col-acao">
                  <input
                    type="checkbox"
                    checked={todosMarcados}
                    onChange={alternarTodos}
                    disabled={!marcaveis.length}
                    aria-label="Marcar os produtos da tela com código de barras"
                    title="Marcar os produtos da tela com código de barras"
                  />
                </th>
                <th>Código</th>
                <th>Descrição</th>
                <th>Código de barras</th>
                <th className="num-col">Custo</th>
                <th className="num-col">Venda</th>
                <th className="col-acao">Etiquetas</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => {
                const tipo = tipoBarras(p.codigo_barras);
                const item = sel.get(p.id);
                return (
                  <tr key={p.id} className={item ? "marcado" : undefined}>
                    <td className="col-acao">
                      <input
                        type="checkbox"
                        checked={!!item}
                        disabled={!tipo}
                        onChange={() => alternar(p)}
                        aria-label={`Marcar ${p.descricao}`}
                        title={tipo ? undefined : "Sem código de barras"}
                      />
                    </td>
                    <td className="mono">{p.codigo ?? "—"}</td>
                    <td>{p.descricao}</td>
                    <td>
                      {tipo ? (
                        <span className="barras-celula">
                          <span className="mono">{limparBarras(p.codigo_barras)}</span>
                          <span className="pilula">{tipo}</span>
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="num-col">{p.valor_custo != null ? moeda(Number(p.valor_custo)) : "—"}</td>
                    <td className="num-col">{p.valor_venda != null ? moeda(Number(p.valor_venda)) : "—"}</td>
                    <td className="col-acao">
                      {item ? (
                        <input
                          className="qtd-etiquetas"
                          type="number"
                          min={1}
                          max={999}
                          value={item.qtd}
                          onChange={(e) => setQtd(p.id, Number(e.target.value))}
                          aria-label="Quantidade de etiquetas"
                        />
                      ) : (
                        <button
                          type="button"
                          className="icone pequeno"
                          disabled={!tipo}
                          onClick={() => setImprimir([etiquetaDe(p, 1)])}
                          title={tipo ? "Imprimir etiqueta deste produto" : "Sem código de barras"}
                          aria-label={`Imprimir etiqueta de ${p.descricao}`}
                        >
                          <IconeImpressora width={16} height={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtrados.length > limite && (
            <div className="mais-linhas">
              <span className="muted">
                Mostrando {visiveis.length} de {filtrados.length}.
              </span>
              <button type="button" onClick={() => setLimite((l) => l + POR_PAGINA)}>
                Mostrar mais {Math.min(POR_PAGINA, filtrados.length - limite)}
              </button>
            </div>
          )}
        </div>
      )}

      {sel.size > 0 && (
        <div className="barra-selecao">
          <span>
            <b>{sel.size}</b> produto(s) · <b>{totalEtiquetas}</b> etiqueta(s)
          </span>
          <div className="acoes">
            <button type="button" onClick={() => setSel(new Map())}>
              Limpar
            </button>
            <button type="button" className="primario" onClick={() => setImprimir(selecionadas())}>
              <IconeImpressora width={16} height={16} /> Imprimir etiquetas
            </button>
          </div>
        </div>
      )}

      {imprimir && <PainelEtiquetas etiquetas={imprimir} onFechar={() => setImprimir(null)} />}
    </div>
  );
}

/** Situação do cache: progresso do 1º carregamento, horário da lista, erro de renovação */
export function StatusProdutos() {
  const { lista, completo, carregando, em, erro } = useProdutos();
  if (!completo && carregando) {
    return (
      <div className="status-produtos">
        <span className="barra-progresso" aria-hidden>
          <span />
        </span>
        Carregando produtos da Progete… {lista.length} até agora
      </div>
    );
  }
  return (
    <p className="muted status-produtos">
      {em ? `Lista de ${new Date(em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}` : ""}
      {carregando && completo ? " · atualizando em segundo plano…" : ""}
      {erro && lista.length ? ` · não foi possível atualizar (${erro}); usando a lista guardada` : ""}
    </p>
  );
}

/* ------------------------------------------------------------------------- */
/* Impressão                                                                  */
/* ------------------------------------------------------------------------- */

function PainelEtiquetas({ etiquetas, onFechar }: { etiquetas: Etiqueta[]; onFechar: () => void }) {
  const [cfg, setCfg] = useState<ConfigEtiqueta>(lerConfig);
  const [status, setStatus] = useState<{ texto: string; erro?: boolean } | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => salvarConfig(cfg), [cfg]);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar]);

  const set = <K extends keyof ConfigEtiqueta>(k: K, v: ConfigEtiqueta[K]) => setCfg((c) => ({ ...c, [k]: v }));
  const total = etiquetas.reduce((s, e) => s + e.quantidade, 0);
  const zpl = useMemo(() => gerarZpl(etiquetas, cfg), [etiquetas, cfg]);

  const enviar = async () => {
    setEnviando(true);
    setStatus(null);
    try {
      const nome = await enviarZebra(zpl);
      setStatus({ texto: `${total} etiqueta(s) enviada(s) para ${nome}.` });
    } catch (e) {
      setStatus({ texto: (e as Error).message, erro: true });
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(zpl);
      setStatus({ texto: "ZPL copiado." });
    } catch {
      setStatus({ texto: "Não foi possível copiar.", erro: true });
    }
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-etiquetas" onClick={onFechar}>
      <div className="card painel-etiquetas" onClick={(e) => e.stopPropagation()}>
        <div className="painel-topo">
          <h3 id="titulo-etiquetas">
            Etiquetas de código de barras
            <small>
              {etiquetas.length} produto(s) · {total} etiqueta(s)
            </small>
          </h3>
          <button type="button" className="icone pequeno" onClick={onFechar} aria-label="Fechar">
            <IconeX width={16} height={16} />
          </button>
        </div>

        <div className="painel-corpo">
          <div className="campos">
            <label>
              <span>Largura (mm)</span>
              <input type="number" min={20} max={110} value={cfg.largura} onChange={(e) => set("largura", Number(e.target.value) || 50)} />
            </label>
            <label>
              <span>Altura (mm)</span>
              <input type="number" min={10} max={150} value={cfg.altura} onChange={(e) => set("altura", Number(e.target.value) || 30)} />
            </label>
            <label>
              <span>Resolução</span>
              <select value={cfg.dpi} onChange={(e) => set("dpi", Number(e.target.value) as 203 | 300)}>
                <option value={203}>203 dpi (8 pontos/mm)</option>
                <option value={300}>300 dpi (12 pontos/mm)</option>
              </select>
            </label>
            {(
              [
                ["descricao", "Descrição"],
                ["codigo", "Código interno"],
                ["preco", "Preço de venda"],
              ] as const
            ).map(([k, r]) => (
              <label key={k} className="checkbox">
                <input type="checkbox" checked={cfg[k]} onChange={(e) => set(k, e.target.checked)} />
                <span>{r}</span>
              </label>
            ))}
          </div>

          <div className="previa">
            <span className="previa-rotulo">Prévia · {etiquetas[0].descricao}</span>
            <style>{estiloEtiqueta(cfg)}</style>
            <div className="previa-etiqueta" dangerouslySetInnerHTML={{ __html: htmlEtiqueta(etiquetas[0], cfg) }} />
          </div>

          {status && <div className={status.erro ? "erro-caixa" : "ok-caixa"}>{status.texto}</div>}

          <details className="zpl">
            <summary>Ver ZPL</summary>
            <pre>{zpl}</pre>
          </details>
        </div>

        <div className="painel-acoes">
          <button type="button" onClick={copiar}>
            Copiar ZPL
          </button>
          <button type="button" onClick={() => baixarZpl(etiquetas, cfg)}>
            Baixar .zpl
          </button>
          <button type="button" onClick={() => imprimirNavegador(etiquetas, cfg)} title="Imprimir pelo driver da impressora">
            Imprimir pelo navegador
          </button>
          <button type="button" className="primario" onClick={enviar} disabled={enviando}>
            <IconeImpressora width={16} height={16} /> {enviando ? "Enviando…" : "Enviar para a Zebra"}
          </button>
        </div>
      </div>
    </div>
  );
}
