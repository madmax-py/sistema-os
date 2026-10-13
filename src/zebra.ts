// Etiquetas de código de barras para impressora térmica Zebra.
// - ZPL: a impressora desenha as barras (melhor nitidez). Vai direto pela
//   Zebra Browser Print (app da Zebra instalado no computador) ou em arquivo .zpl.
// - Navegador: HTML no tamanho da etiqueta para imprimir pelo driver da Zebra.
import { code128Modulos, codificar, limparBarras, svgBarras, tipoBarras, type TipoBarras } from "./codigoBarras";
import { moeda } from "./formato";
import { baixar } from "./xlsx";

export interface ConfigEtiqueta {
  /** tamanho da etiqueta em mm */
  largura: number;
  altura: number;
  /** resolução da impressora */
  dpi: 203 | 300;
  descricao: boolean;
  codigo: boolean;
  preco: boolean;
}

export const CONFIG_PADRAO: ConfigEtiqueta = {
  largura: 50,
  altura: 30,
  dpi: 203,
  descricao: true,
  codigo: true,
  preco: false,
};

export interface Etiqueta {
  descricao: string;
  codigo: string;
  barras: string;
  preco: number | null;
  quantidade: number;
}

const CONFIG_KEY = "progete_os_etiqueta";

export function lerConfig(): ConfigEtiqueta {
  try {
    return { ...CONFIG_PADRAO, ...JSON.parse(localStorage.getItem(CONFIG_KEY) ?? "{}") };
  } catch {
    return CONFIG_PADRAO;
  }
}

export function salvarConfig(c: ConfigEtiqueta) {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(c));
  } catch {
    // ignora
  }
}

/* ------------------------------------------------------------------------- */
/* ZPL                                                                        */
/* ------------------------------------------------------------------------- */

/** Texto seguro dentro de ^FH^FD (escapa ^ ~ e _ em hexadecimal) */
const textoZpl = (t: string) => t.replace(/_/g, "_5F").replace(/\^/g, "_5E").replace(/~/g, "_7E");

/** Módulos da simbologia (sem zona de silêncio), para centralizar */
function modulos(tipo: TipoBarras, valor: string): number {
  if (tipo === "EAN-13" || tipo === "UPC-A") return 95;
  if (tipo === "EAN-8") return 67;
  return code128Modulos(valor);
}

/**
 * Comando de barras ZPL (a impressora calcula o dígito verificador do EAN/UPC).
 * Sem a linha legível da Zebra: o número é escrito à parte, com tamanho fixo.
 */
function comandoBarras(tipo: TipoBarras, valor: string, altura: number): string {
  switch (tipo) {
    case "EAN-13":
      return `^BEN,${altura},N,N^FD${valor.slice(0, 12)}^FS`;
    case "EAN-8":
      return `^B8N,${altura},N,N^FD${valor.slice(0, 7)}^FS`;
    case "UPC-A":
      return `^BUN,${altura},N,N,Y^FD${valor.slice(0, 11)}^FS`;
    default:
      // Modo A: a impressora escolhe os subconjuntos (números ficam compactos)
      return `^BCN,${altura},N,N,N,A^FH^FD${textoZpl(valor)}^FS`;
  }
}

/** ZPL de uma etiqueta (com ^PQ para as cópias) */
export function zplEtiqueta(e: Etiqueta, c: ConfigEtiqueta): string {
  const barras = limparBarras(e.barras);
  const tipo = tipoBarras(barras);
  if (!tipo) return "";
  const dpmm = c.dpi === 300 ? 12 : 8;
  const L = Math.round(c.largura * dpmm);
  const A = Math.round(c.altura * dpmm);
  const margem = Math.round(1.5 * dpmm);
  const util = L - margem * 2;
  const fonte = Math.max(18, Math.round(2.6 * dpmm)); // ~2,6 mm
  const linhas: string[] = ["^XA", "^CI28", `^PW${L}`, `^LL${A}`, "^LH0,0"];

  let y = margem;
  if (c.descricao) {
    // Até 2 linhas, centralizado
    linhas.push(`^FO${margem},${y}^A0N,${fonte},${fonte}^FB${util},2,2,C^FH^FD${textoZpl(e.descricao)}^FS`);
    y += fonte * 2 + 4;
  }

  // Rodapé (código interno / preço) numa linha só
  const rodape = [c.codigo && e.codigo ? `Cód. ${e.codigo}` : "", c.preco && e.preco != null ? moeda(e.preco) : ""]
    .filter(Boolean)
    .join("   ");
  const alturaRodape = rodape ? fonte + 4 : 0;

  // Barras: largura do módulo que caiba na etiqueta, centralizada
  const mods = modulos(tipo, barras);
  const modulo = Math.max(1, Math.min(4, Math.floor(util / mods)));
  const larguraBarras = mods * modulo;
  const x = Math.max(0, Math.round((L - larguraBarras) / 2));
  const fonteNumero = Math.round(fonte * 0.9);
  // No EAN/UPC as barras-guia descem abaixo das demais
  const guias = tipo === "CODE-128" ? 0 : Math.round(dpmm * 1.5);
  const alturaBarras = Math.max(dpmm * 5, A - y - margem - alturaRodape - fonteNumero - guias - 6);
  linhas.push(`^BY${modulo},3,${alturaBarras}`);
  linhas.push(`^FO${x},${y}${comandoBarras(tipo, barras, alturaBarras)}`);
  // Número embaixo das barras
  linhas.push(
    `^FO${margem},${y + alturaBarras + guias + 3}^A0N,${fonteNumero},${fonteNumero}^FB${util},1,0,C^FH^FD${textoZpl(barras)}^FS`
  );

  if (rodape) {
    linhas.push(`^FO${margem},${A - margem - fonte}^A0N,${fonte},${fonte}^FB${util},1,0,C^FH^FD${textoZpl(rodape)}^FS`);
  }

  linhas.push(`^PQ${Math.max(1, Math.floor(e.quantidade))},0,1,Y`, "^XZ");
  return linhas.join("\n");
}

export const gerarZpl = (etiquetas: Etiqueta[], c: ConfigEtiqueta) =>
  etiquetas
    .map((e) => zplEtiqueta(e, c))
    .filter(Boolean)
    .join("\n");

export function baixarZpl(etiquetas: Etiqueta[], c: ConfigEtiqueta) {
  baixar(new Blob([gerarZpl(etiquetas, c)], { type: "text/plain;charset=utf-8" }), `etiquetas-${Date.now()}.zpl`);
}

/* ------------------------------------------------------------------------- */
/* Zebra Browser Print                                                        */
/* ------------------------------------------------------------------------- */

// Serviço local do app "Zebra Browser Print" (mesmo protocolo do BrowserPrint.js)
const BROWSER_PRINT = ["http://127.0.0.1:9100", "https://127.0.0.1:9101"];

export class ErroZebra extends Error {}

/** Envia o ZPL para a impressora padrão da Browser Print; devolve o nome dela */
export async function enviarZebra(zpl: string): Promise<string> {
  let semServico = true;
  for (const base of BROWSER_PRINT) {
    let texto: string;
    try {
      const r = await fetch(`${base}/default?type=printer`, { signal: AbortSignal.timeout(4000) });
      if (!r.ok) continue;
      texto = await r.text();
    } catch {
      continue;
    }
    semServico = false;
    if (!texto.trim()) throw new ErroZebra("A Browser Print está aberta, mas sem impressora padrão. Escolha a Zebra nas configurações dela.");
    const device = JSON.parse(texto);
    const r = await fetch(`${base}/write`, {
      method: "POST",
      // text/plain evita a pré-verificação CORS, como o BrowserPrint.js faz
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify({ device, data: zpl }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new ErroZebra(`A impressora recusou o envio (HTTP ${r.status}).`);
    return device.name ?? "Zebra";
  }
  throw new ErroZebra(
    semServico
      ? "Não encontrei a Zebra Browser Print neste computador. Instale/abra o app da Zebra (e aceite este site nele) ou baixe o arquivo .zpl."
      : "Não foi possível falar com a Zebra Browser Print."
  );
}

/* ------------------------------------------------------------------------- */
/* Pré-visualização / impressão pelo navegador                                */
/* ------------------------------------------------------------------------- */

const esc = (t: unknown) =>
  String(t ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

/** HTML de uma etiqueta (usado na pré-visualização e na impressão pelo driver) */
export function htmlEtiqueta(e: Etiqueta, c: ConfigEtiqueta): string {
  const cb = codificar(e.barras);
  if (!cb) return "";
  const rodape = [c.codigo && e.codigo ? `Cód. ${esc(e.codigo)}` : "", c.preco && e.preco != null ? moeda(e.preco) : ""]
    .filter(Boolean)
    .join(" &nbsp; ");
  return `<div class="etq">
    ${c.descricao ? `<div class="etq-desc">${esc(e.descricao)}</div>` : ""}
    <div class="etq-barras">${svgBarras(cb, 60)}</div>
    <div class="etq-num">${esc(cb.valor)}</div>
    ${rodape ? `<div class="etq-rod">${rodape}</div>` : ""}
  </div>`;
}

export const estiloEtiqueta = (c: ConfigEtiqueta) => `
  .etq { width: ${c.largura}mm; height: ${c.altura}mm; padding: 1.5mm; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; overflow: hidden; background: #fff; color: #000; font-family: Arial, Helvetica, sans-serif; }
  .etq-desc { width: 100%; font-size: 2.6mm; line-height: 1.15; font-weight: 700; text-align: center; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
  .etq-barras { flex: 1; width: 100%; min-height: 5mm; margin-top: 0.8mm; }
  .etq-barras svg { width: 100%; height: 100%; display: block; }
  .etq-num { font-size: 2.4mm; letter-spacing: 0.3mm; line-height: 1.2; }
  .etq-rod { font-size: 2.4mm; line-height: 1.2; font-weight: 700; }
`;

/** Imprime pelo navegador (driver da Zebra), uma etiqueta por página */
export function imprimirNavegador(etiquetas: Etiqueta[], c: ConfigEtiqueta) {
  const paginas = etiquetas
    .flatMap((e) => Array.from({ length: Math.max(1, Math.floor(e.quantidade)) }, () => htmlEtiqueta(e, c)))
    .filter(Boolean)
    .map((h) => `<div class="pagina">${h}</div>`)
    .join("");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas</title><style>
    @page { size: ${c.largura}mm ${c.altura}mm; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .pagina { width: ${c.largura}mm; height: ${c.altura}mm; break-after: page; overflow: hidden; }
    .pagina:last-child { break-after: auto; }
    ${estiloEtiqueta(c)}
  </style></head><body>${paginas}</body></html>`;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  iframe.srcdoc = html;
  iframe.onload = () => {
    const janela = iframe.contentWindow;
    if (!janela) return;
    const encerrar = () => setTimeout(() => iframe.remove(), 500);
    janela.addEventListener("afterprint", encerrar);
    janela.focus();
    janela.print();
    setTimeout(encerrar, 60000);
  };
  document.body.append(iframe);
}
