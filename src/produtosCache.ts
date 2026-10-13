// Cache compartilhado dos produtos (PDV da saída e página de Produtos).
//
// 1º acesso: busca todos os produtos na Progete em segundo plano, página a
// página — a tela já mostra o que chegou ("carregamento lento").
// Depois: tudo sai do cache (localStorage + memória); a busca, os filtros e a
// paginação de 50 em 50 acontecem no navegador, sem tocar no servidor.
// Cache com mais de 30 min é reaproveitado na hora e renovado em segundo plano.
import { useSyncExternalStore } from "react";
import { buscarPaginaProdutos, getDominio, type CatalogosSaida } from "./api";

export type ProdutoCache = CatalogosSaida["produtos"][number];

export interface EstadoProdutos {
  lista: ProdutoCache[];
  /** todas as páginas chegaram */
  completo: boolean;
  carregando: boolean;
  /** quando a lista completa foi buscada (ms) */
  em: number | null;
  erro: string | null;
}

const CHAVE = "progete_os_produtos";
const VELHO_MS = 30 * 60 * 1000;
/** Pedimos 250 por página; se o servidor usar outro tamanho, segue o dele */
const POR_PAGINA = 250;
const MAX_PAGINAS = 200;

let estado: EstadoProdutos = { lista: [], completo: false, carregando: false, em: null, erro: null };
let dominioDoEstado: string | null = null;
let carga: Promise<void> | null = null;
const ouvintes = new Set<() => void>();

function publicar(parcial: Partial<EstadoProdutos>) {
  estado = { ...estado, ...parcial };
  ouvintes.forEach((f) => f());
}

const ordenar = (l: ProdutoCache[]) =>
  [...l].sort((a, b) => String(a.descricao ?? "").localeCompare(String(b.descricao ?? ""), "pt-BR"));

function lerDisco(dominio: string): { em: number; lista: ProdutoCache[] } | null {
  try {
    const c = JSON.parse(localStorage.getItem(CHAVE) ?? "null");
    return c && c.dominio === dominio && Array.isArray(c.lista) ? c : null;
  } catch {
    return null;
  }
}

function gravarDisco(dominio: string, em: number, lista: ProdutoCache[]) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify({ dominio, em, lista }));
  } catch {
    // sem espaço: fica só em memória nesta aba
  }
}

/** Busca todas as páginas; com `mostrarParcial`, a tela vê cada página que chega */
async function buscarTudo(mostrarParcial: boolean) {
  const dominio = getDominio() ?? "";
  const todos = new Map<number, ProdutoCache>();
  let tamanho = 0;
  for (let page = 1; page <= MAX_PAGINAS; page++) {
    const l = await buscarPaginaProdutos(page, POR_PAGINA);
    if (page === 1) tamanho = l.length;
    const antes = todos.size;
    l.forEach((p) => todos.set(p.id, p));
    if (mostrarParcial) publicar({ lista: ordenar([...todos.values()]) });
    // Fim: página vazia, menor que a 1ª, ou só repetidos (servidor ignorou "page")
    if (!l.length || l.length < tamanho || todos.size === antes) break;
  }
  if ((getDominio() ?? "") !== dominio) return; // trocou de domínio no meio
  const lista = ordenar([...todos.values()]);
  const em = Date.now();
  gravarDisco(dominio, em, lista);
  publicar({ lista, completo: true, em, erro: null });
}

function carregar(mostrarParcial: boolean): Promise<void> {
  if (carga) return carga;
  publicar({ carregando: true, erro: null });
  carga = buscarTudo(mostrarParcial)
    .catch((e) => publicar({ erro: (e as Error).message }))
    .finally(() => {
      carga = null;
      publicar({ carregando: false });
    });
  return carga;
}

/** Garante a lista: usa o cache e só vai ao servidor se não houver (ou se estiver velho) */
export function iniciarProdutos() {
  const dominio = getDominio() ?? "";
  if (dominioDoEstado !== dominio) {
    dominioDoEstado = dominio;
    const disco = lerDisco(dominio);
    estado = disco
      ? { lista: disco.lista, completo: true, carregando: false, em: disco.em, erro: null }
      : { lista: [], completo: false, carregando: false, em: null, erro: null };
    ouvintes.forEach((f) => f());
  }
  if (!estado.completo) carregar(true);
  else if (estado.em && Date.now() - estado.em > VELHO_MS) carregar(false); // renova sem esvaziar a tela
}

/** Botão "Atualizar": busca tudo de novo, mantendo a lista atual na tela até terminar */
export const atualizarProdutos = () => carregar(!estado.completo);

export function useProdutos(): EstadoProdutos {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => estado
  );
}
