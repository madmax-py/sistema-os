// Codificação de códigos de barras (EAN-13, EAN-8, UPC-A e Code 128) para
// desenhar na tela/impressão do navegador. A impressão na Zebra usa ZPL
// (zebra.ts), em que a própria impressora gera as barras.

export type TipoBarras = "EAN-13" | "EAN-8" | "UPC-A" | "CODE-128";

export interface CodigoBarras {
  tipo: TipoBarras;
  /** código limpo (o que vai nas barras) */
  valor: string;
  /** larguras alternadas barra/espaço, começando por barra, em módulos */
  larguras: number[];
}

/** Dígito verificador GS1 (EAN/UPC) dos dígitos sem o verificador */
function verificadorGs1(corpo: string): number {
  let soma = 0;
  for (let i = 0; i < corpo.length; i++) {
    const d = Number(corpo[corpo.length - 1 - i]);
    soma += i % 2 === 0 ? d * 3 : d;
  }
  return (10 - (soma % 10)) % 10;
}

const gs1Valido = (c: string) => verificadorGs1(c.slice(0, -1)) === Number(c[c.length - 1]);

/**
 * Código como vai nas barras: sem espaços, quebras de linha, acentos e
 * caracteres invisíveis; número salvo como decimal ("789….0") vira inteiro.
 */
export function limparBarras(codigo: unknown): string {
  if (codigo == null) return "";
  if (typeof codigo === "number") return Number.isFinite(codigo) ? BigInt(Math.round(codigo)).toString() : "";
  const c = String(codigo)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x21-\x7e]/g, "");
  return /^\d+\.0+$/.test(c) ? c.replace(/\.0+$/, "") : c;
}

/** Qual simbologia usar para o texto do cadastro (null = vazio/impossível) */
export function tipoBarras(codigo: unknown): TipoBarras | null {
  const c = limparBarras(codigo);
  if (!c) return null;
  if (/^\d{13}$/.test(c) && gs1Valido(c)) return "EAN-13";
  if (/^\d{8}$/.test(c) && gs1Valido(c)) return "EAN-8";
  if (/^\d{12}$/.test(c) && gs1Valido(c)) return "UPC-A";
  if (/^[\x20-\x7e]+$/.test(c)) return "CODE-128";
  return null;
}

/* ------------------------------------------------------------------------- */
/* EAN / UPC                                                                  */
/* ------------------------------------------------------------------------- */

const EAN_L = ["0001101", "0011001", "0010011", "0111101", "0100011", "0110001", "0101111", "0111011", "0110111", "0001011"];
const EAN_R = EAN_L.map((p) => [...p].map((b) => (b === "0" ? "1" : "0")).join(""));
const EAN_G = EAN_R.map((p) => [...p].reverse().join(""));
const PARIDADE = ["LLLLLL", "LLGLGG", "LLGGLG", "LLGGGL", "LGLLGG", "LGGLLG", "LGGGLL", "LGLGLG", "LGLGGL", "LGGLGL"];

/** "0110100…" → larguras alternadas começando por barra (o 1º módulo é sempre barra) */
function larguras(bits: string): number[] {
  const l: number[] = [];
  let atual = bits[0];
  let n = 0;
  for (const b of bits) {
    if (b === atual) n++;
    else {
      l.push(n);
      atual = b;
      n = 1;
    }
  }
  l.push(n);
  return l;
}

function ean13(c: string): string {
  const par = PARIDADE[Number(c[0])];
  let bits = "101";
  for (let i = 1; i <= 6; i++) bits += (par[i - 1] === "L" ? EAN_L : EAN_G)[Number(c[i])];
  bits += "01010";
  for (let i = 7; i <= 12; i++) bits += EAN_R[Number(c[i])];
  return bits + "101";
}

function ean8(c: string): string {
  let bits = "101";
  for (let i = 0; i < 4; i++) bits += EAN_L[Number(c[i])];
  bits += "01010";
  for (let i = 4; i < 8; i++) bits += EAN_R[Number(c[i])];
  return bits + "101";
}

/* ------------------------------------------------------------------------- */
/* Code 128                                                                   */
/* ------------------------------------------------------------------------- */

// Larguras barra/espaço de cada símbolo (valores 0–106; 106 = stop)
const C128 = (
  "212222 222122 222221 121223 121322 131222 122213 122312 132212 221213 " +
  "221312 231212 112232 122132 122231 113222 123122 123221 223211 221132 " +
  "221231 213212 223112 312131 311222 321122 321221 312212 322112 322211 " +
  "212123 212321 232121 111323 131123 131321 112313 132113 132311 211313 " +
  "231113 231311 112133 112331 132131 113123 113321 133121 313121 211331 " +
  "231131 213113 213311 213131 311123 311321 331121 312113 312311 332111 " +
  "314111 221411 431111 111224 111422 121124 121421 141122 141221 112214 " +
  "112412 122114 122411 142112 142211 241211 221114 413111 241112 134111 " +
  "111242 121142 121241 114212 124112 124211 411212 421112 421211 212141 " +
  "214121 412121 111143 111341 131141 114113 114311 411113 411311 113141 " +
  "114131 311141 411131 211412 211214 211232 2331112"
).split(" ");

const START_B = 104;
const START_C = 105;
const CODE_C = 99;

/** Valores Code 128: subconjunto C (pares de dígitos) quando o texto é só número */
function code128Valores(c: string): number[] {
  const v: number[] = [];
  if (/^\d+$/.test(c) && c.length >= 2) {
    let resto = c;
    if (c.length % 2) {
      // Ímpar: 1º dígito em B, o resto em pares no C
      v.push(START_B, c.charCodeAt(0) - 32, CODE_C);
      resto = c.slice(1);
    } else v.push(START_C);
    for (let i = 0; i < resto.length; i += 2) v.push(Number(resto.slice(i, i + 2)));
  } else {
    v.push(START_B);
    for (const ch of c) v.push(ch.charCodeAt(0) - 32);
  }
  const soma = v.reduce((s, x, i) => s + x * (i === 0 ? 1 : i), 0);
  return [...v, soma % 103, 106];
}

/** Módulos do Code 128 (também usado para estimar a largura no ZPL) */
export function code128Modulos(c: string): number {
  return code128Valores(c).length * 11 + 2; // stop tem 13 módulos
}

/* ------------------------------------------------------------------------- */
/* API                                                                        */
/* ------------------------------------------------------------------------- */

export function codificar(codigo: unknown): CodigoBarras | null {
  const valor = limparBarras(codigo);
  const tipo = tipoBarras(valor);
  if (!tipo) return null;
  switch (tipo) {
    case "EAN-13":
      return { tipo, valor, larguras: larguras(ean13(valor)) };
    case "UPC-A":
      // UPC-A = EAN-13 com 0 na frente
      return { tipo, valor, larguras: larguras(ean13(`0${valor}`)) };
    case "EAN-8":
      return { tipo, valor, larguras: larguras(ean8(valor)) };
    default:
      return { tipo, valor, larguras: code128Valores(valor).flatMap((x) => [...C128[x]].map(Number)) };
  }
}

/** SVG das barras (sem texto), com zona de silêncio de 10 módulos dos lados */
export function svgBarras(cb: CodigoBarras, altura = 50): string {
  const total = cb.larguras.reduce((s, x) => s + x, 0);
  const margem = 10;
  let x = margem;
  let rects = "";
  cb.larguras.forEach((w, i) => {
    if (i % 2 === 0) rects += `<rect x="${x}" y="0" width="${w}" height="${altura}"/>`;
    x += w;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total + margem * 2} ${altura}" preserveAspectRatio="none" shape-rendering="crispEdges" fill="#000">${rects}</svg>`;
}
