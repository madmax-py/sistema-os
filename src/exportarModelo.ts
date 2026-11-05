// Planilha "Relatório de atividades de manutenção" — reproduz o modelo enviado
// pelo cliente: aba "Resumo Geral" (quadros por setor) e aba "Detalhamento"
// (um bloco por setor com cada O.S.).
import type { Catalogos, Manutencao } from "./api";
import { horasIntervalo, nomes } from "./exportar";
import { data, hora } from "./formato";
import { baixar, coluna, escapar, gerarXlsxBruto } from "./xlsx";

/* ------------------------------------------------------------------------- */
/* Estilos (mesmas fontes, cores e bordas do modelo)                          */
/* ------------------------------------------------------------------------- */

const FMT_HORAS = 165; // [h]:mm — soma acima de 24h

const FONTES = [
  `<sz val="11"/><name val="Calibri"/>`, // 0 normal
  `<b/><sz val="14"/><color rgb="FFFFFFFF"/><name val="Calibri"/>`, // 1 empresa
  `<b/><sz val="12"/><color rgb="FFFFFFFF"/><name val="Calibri"/>`, // 2 título
  `<b/><sz val="11"/><color rgb="FF000000"/><name val="Calibri"/>`, // 3 negrito preto
  `<b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/>`, // 4 negrito branco
  `<b/><sz val="13"/><color rgb="FFFFFFFF"/><name val="Calibri"/>`, // 5 título do setor
  `<b/><sz val="11"/><color rgb="FF0F2C45"/><name val="Calibri"/>`, // 6 total de registros
];

const BORDAS = [
  `<left/><right/><top/><bottom/><diagonal/>`,
  `<left style="medium"/><right style="medium"/><top style="medium"/><bottom style="medium"/><diagonal/>`,
  `<left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/><diagonal/>`,
  ...[0].map(() => {
    const l = `style="thin"><color rgb="FF808080"/>`;
    return `<left ${l}</left><right ${l}</right><top ${l}</top><bottom ${l}</bottom><diagonal/>`;
  }),
];
const BORDA = { nenhuma: 0, media: 1, fina: 2, cinza: 3 };

interface Xf {
  fonte: number;
  cor?: string; // ARGB do fundo
  borda: number;
  h?: "center" | "left" | "right";
  quebra?: boolean;
  horas?: boolean;
}

/** Junta os estilos usados e gera o styles.xml no final */
class Estilos {
  private fundos: string[] = [];
  private xfs: string[] = [`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`];
  private indice = new Map<string, number>();

  id(x: Xf): number {
    const chave = JSON.stringify(x);
    const ja = this.indice.get(chave);
    if (ja !== undefined) return ja;
    let fill = 0;
    if (x.cor) {
      let f = this.fundos.indexOf(x.cor);
      if (f < 0) f = this.fundos.push(x.cor) - 1;
      fill = f + 2;
    }
    const fmt = x.horas ? FMT_HORAS : 0;
    this.xfs.push(
      `<xf numFmtId="${fmt}" fontId="${x.fonte}" fillId="${fill}" borderId="${x.borda}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="${x.h ?? "center"}" vertical="center"${x.quebra ? ' wrapText="1"' : ""}/></xf>`
    );
    const n = this.xfs.length - 1;
    this.indice.set(chave, n);
    return n;
  }

  xml(): string {
    const fills = [`<fill><patternFill patternType="none"/></fill>`, `<fill><patternFill patternType="gray125"/></fill>`]
      .concat(this.fundos.map((c) => `<fill><patternFill patternType="solid"><fgColor rgb="${c}"/><bgColor indexed="64"/></patternFill></fill>`));
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="${FMT_HORAS}" formatCode="[h]:mm"/></numFmts><fonts count="${FONTES.length}">${FONTES.map((f) => `<font>${f}</font>`).join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills><borders count="${BORDAS.length}">${BORDAS.map((b) => `<border>${b}</border>`).join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfs.length}">${this.xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

const AZUL = "FF0000FF";
const CINZA = "FFD9D9D9";
const BRANCO = "FFFFFFFF";
const ZEBRA = "FFFAFAFA";
const MARINHO = "FF0F2C45";
const AZUL_CAB = "FF2B579A";
const AZUL_CLARO = "FFE8F4F8";

/** Cor de fundo + fonte (branca ou preta) */
type Cor = { fundo: string; branca: boolean };

/** Cores do modelo por tipo/categoria; o que não estiver aqui usa a paleta */
const CORES_FIXAS: Record<string, Cor> = {
  CORRETIVA: { fundo: "FFED7D31", branca: true },
  FABRICACAO: { fundo: "FF00B0F0", branca: false },
  INSTALACAO: { fundo: "FFBFBFBF", branca: false },
  MONTAGEM: { fundo: "FF7030A0", branca: true },
  PREVENTIVA: { fundo: "FFFF66CC", branca: false },
  ELETRICA: { fundo: "FF00B050", branca: false },
  MECANICA: { fundo: "FFFFFF00", branca: false },
  SOLDAGEM: { fundo: "FFFF0000", branca: true },
};
const PALETA: Cor[] = [
  { fundo: "FF4472C4", branca: true },
  { fundo: "FF70AD47", branca: false },
  { fundo: "FFFFC000", branca: false },
  { fundo: "FF5B9BD5", branca: true },
  { fundo: "FFA5A5A5", branca: false },
  { fundo: "FF9E480E", branca: true },
];

const chave = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
const caixaAlta = (t: string | null | undefined) => (t ?? "").toLocaleUpperCase("pt-BR");

/** Cada valor recebe sempre a mesma cor no arquivo inteiro */
function coresDe(valores: string[]): Map<string, Cor> {
  const m = new Map<string, Cor>();
  let p = 0;
  for (const v of valores) m.set(v, CORES_FIXAS[chave(v)] ?? PALETA[p++ % PALETA.length]);
  return m;
}

/* ------------------------------------------------------------------------- */
/* Folha                                                                      */
/* ------------------------------------------------------------------------- */

type Valor = string | number | null | undefined;

class Folha {
  private linhas = new Map<number, Map<number, string>>();
  private alturas = new Map<number, number>();
  private mesclas: string[] = [];

  /** linha e coluna começam em 1 */
  set(l: number, c: number, v: Valor, estilo: number) {
    const ref = `${coluna(c - 1)}${l}`;
    let xml: string;
    if (v === null || v === undefined || v === "") xml = `<c r="${ref}" s="${estilo}"/>`;
    else if (typeof v === "number") xml = `<c r="${ref}" s="${estilo}"><v>${v}</v></c>`;
    else xml = `<c r="${ref}" s="${estilo}" t="inlineStr"><is><t xml:space="preserve">${escapar(v)}</t></is></c>`;
    if (!this.linhas.has(l)) this.linhas.set(l, new Map());
    this.linhas.get(l)!.set(c, xml);
  }

  /** Mescla e aplica o estilo em todas as células (para a borda sair inteira) */
  mesclar(l1: number, c1: number, l2: number, c2: number, v: Valor, estilo: number) {
    for (let l = l1; l <= l2; l++) for (let c = c1; c <= c2; c++) this.set(l, c, l === l1 && c === c1 ? v : null, estilo);
    if (l1 !== l2 || c1 !== c2) this.mesclas.push(`${coluna(c1 - 1)}${l1}:${coluna(c2 - 1)}${l2}`);
  }

  altura(l: number, h: number) {
    this.alturas.set(l, h);
  }

  xml(o: { larguras: number[]; congelar: number; zoom?: number }): string {
    const linhas = [...this.linhas.keys()]
      .sort((a, b) => a - b)
      .map((l) => {
        const cel = this.linhas.get(l)!;
        const h = this.alturas.get(l);
        const attr = h ? ` ht="${h}" customHeight="1"` : "";
        return `<row r="${l}"${attr}>${[...cel.keys()].sort((a, b) => a - b).map((c) => cel.get(c)).join("")}</row>`;
      })
      .join("");
    const cols = o.larguras.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const mesclas = this.mesclas.length ? `<mergeCells count="${this.mesclas.length}">${this.mesclas.map((r) => `<mergeCell ref="${r}"/>`).join("")}</mergeCells>` : "";
    const pane = `<pane ySplit="${o.congelar}" topLeftCell="A${o.congelar + 1}" activePane="bottomLeft" state="frozen"/>`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr><sheetViews><sheetView workbookViewId="0" zoomScale="${o.zoom ?? 100}">${pane}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${linhas}</sheetData>${mesclas}<printOptions horizontalCentered="1"/><pageMargins left="0.25" right="0.25" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
  }
}

/* ------------------------------------------------------------------------- */
/* Dados                                                                      */
/* ------------------------------------------------------------------------- */

interface Linha {
  m: Manutencao;
  setor: string;
  ativo: string;
  tipo: string;
  categoria: string;
  /** mantenedor → horas trabalhadas nesta O.S. */
  mantenedores: Map<string, number>;
  horas: number;
  data: string;
  inicio: string;
  fim: string;
}

const SEM_SETOR = "SEM SETOR";

function linhasDe(lista: Manutencao[], c: Catalogos): Linha[] {
  return lista.map((m) => {
    const n = nomes(m, c);
    const eq = m.manutencao_equipamento ?? c.equipamentos.find((x) => x.id === m.manutencao_equipamento_id);
    const setorId = eq?.manutencao_setor_id ?? c.equipamentos.find((x) => x.id === m.manutencao_equipamento_id)?.manutencao_setor_id;
    const setor = caixaAlta(c.setores.find((s) => s.id === setorId)?.descricao) || SEM_SETOR;

    // Mantenedor interno (horas da própria O.S.) + terceiros (horas de cada serviço)
    const mantenedores = new Map<string, number>();
    const soma = (nome: string, h: number) => mantenedores.set(nome, (mantenedores.get(nome) ?? 0) + h);
    if (n.executor) soma(caixaAlta(n.executor), horasIntervalo(m));
    const servs = m.manutencao_servicos ?? [];
    for (const s of servs) {
      const nome = c.mantenedores.find((x) => x.id === s.manutencao_mantenedor_id)?.nome ?? `#${s.manutencao_mantenedor_id}`;
      soma(caixaAlta(nome), horasIntervalo(s));
    }
    // Tempo de serviço da O.S.: o período dela (vários mantenedores juntos contam
    // uma vez só); sem período próprio, a soma dos serviços
    const horas = horasIntervalo(m) || servs.reduce((a, s) => a + horasIntervalo(s), 0);

    // Período: o da própria O.S.; sem ele, do primeiro ao último serviço
    const ordenados = [...servs].sort((a, b) => `${a.dt_inicio}${hora(a.hr_inicio)}`.localeCompare(`${b.dt_inicio}${hora(b.hr_inicio)}`));
    const inicio = hora(m.hr_inicio) || hora(ordenados[0]?.hr_inicio);
    const fim = hora(m.hr_termino) || hora(ordenados[ordenados.length - 1]?.hr_termino);
    const dia = m.dt_inicio || ordenados[0]?.dt_inicio || m.dt_programada;

    return {
      m,
      setor,
      ativo: caixaAlta(n.equipamento),
      tipo: caixaAlta(n.tipo) || "SEM TIPO",
      categoria: caixaAlta(n.area) || "SEM CATEGORIA",
      mantenedores,
      horas,
      data: dia ?? "",
      inicio,
      fim,
    };
  });
}

/** Setores na ordem do cadastro, só os que aparecem; "sem setor" por último */
function ordemSetores(linhas: Linha[], c: Catalogos): string[] {
  const usados = new Set(linhas.map((l) => l.setor));
  const ordem = c.setores.map((s) => caixaAlta(s.descricao)).filter((s) => usados.has(s));
  const resto = [...usados].filter((s) => !ordem.includes(s) && s !== SEM_SETOR).sort((a, b) => a.localeCompare(b, "pt-BR"));
  return [...new Set([...ordem, ...resto, ...(usados.has(SEM_SETOR) ? [SEM_SETOR] : [])])];
}

const ordenar = (l: Iterable<string>) => [...new Set(l)].sort((a, b) => a.localeCompare(b, "pt-BR"));
/** horas → fração de dia (é assim que o Excel guarda tempo) */
const dias = (h: number) => Math.round(h * 60) / 1440;
const ddmm = (iso: string) => data(iso).slice(0, 5);

/* ------------------------------------------------------------------------- */
/* Abas                                                                       */
/* ------------------------------------------------------------------------- */

interface Opcoes {
  empresa: string;
  dataInicio: string;
  dataFim: string;
}

function tituloRelatorio(o: Opcoes) {
  return `RELATÓRIO DE ATIVIDADES DE MANUTENÇÃO ${ddmm(o.dataInicio)} A ${ddmm(o.dataFim)}`;
}

function resumo(linhas: Linha[], setores: string[], est: Estilos, cores: Map<string, Cor>, o: Opcoes): string {
  const f = new Folha();
  const mantenedores = ordenar(linhas.flatMap((l) => [...l.mantenedores.keys()]));
  const tipos = ordenar(linhas.map((l) => l.tipo));
  const categorias = ordenar(linhas.map((l) => l.categoria));

  const esqLarg = mantenedores.length + 2; // setor + mantenedores + total
  const dirIni = esqLarg + 2; // uma coluna de respiro
  const dirLarg = Math.max(tipos.length, categorias.length) + 2;
  const ultima = dirIni + dirLarg - 1;

  const s = {
    empresa: est.id({ fonte: 1, cor: AZUL, borda: BORDA.media }),
    titulo: est.id({ fonte: 2, cor: AZUL, borda: BORDA.media }),
    sub: est.id({ fonte: 3, cor: CINZA, borda: BORDA.media }),
    quadro: est.id({ fonte: 3, cor: BRANCO, borda: BORDA.fina }),
    cab: est.id({ fonte: 3, cor: BRANCO, borda: BORDA.fina, quebra: true }),
    setor: est.id({ fonte: 0, cor: BRANCO, borda: BORDA.fina, h: "right" }),
    num: est.id({ fonte: 0, cor: BRANCO, borda: BORDA.fina }),
    hrs: est.id({ fonte: 0, cor: BRANCO, borda: BORDA.fina, horas: true }),
    total: est.id({ fonte: 3, cor: CINZA, borda: BORDA.fina }),
    totalHrs: est.id({ fonte: 3, cor: CINZA, borda: BORDA.fina, horas: true }),
  };
  const colorido = (v: string) => {
    const cor = cores.get(v)!;
    return est.id({ fonte: cor.branca ? 4 : 3, cor: cor.fundo, borda: BORDA.fina, quebra: true });
  };

  f.mesclar(1, 1, 1, ultima, caixaAlta(o.empresa), s.empresa);
  f.mesclar(2, 1, 2, ultima, tituloRelatorio(o), s.titulo);
  f.mesclar(3, 1, 3, ultima, "RESUMO GERAL", s.sub);
  [1, 2].forEach((l) => f.altura(l, 21.75));
  f.altura(3, 19.5);

  /** Um quadro setor × colunas, com total por linha e por coluna */
  const quadro = (
    linhaIni: number,
    colIni: number,
    titulo: string,
    colunas: string[],
    valor: (setor: string, col: string) => number,
    horas: boolean,
    cabColorido: boolean
  ) => {
    const larg = colunas.length + 2;
    f.mesclar(linhaIni, colIni, linhaIni, colIni + larg - 1, titulo, s.quadro);
    const cab = linhaIni + 1;
    f.altura(cab, 31.3);
    f.set(cab, colIni, "SETOR", s.cab);
    colunas.forEach((col, i) => f.set(cab, colIni + 1 + i, col, cabColorido ? colorido(col) : s.cab));
    f.set(cab, colIni + larg - 1, "TOTAL", s.cab);

    const totais = colunas.map(() => 0);
    setores.forEach((setor, r) => {
      const l = cab + 1 + r;
      f.set(l, colIni, setor, s.setor);
      let soma = 0;
      colunas.forEach((col, i) => {
        const v = valor(setor, col);
        soma += v;
        totais[i] += v;
        f.set(l, colIni + 1 + i, v ? (horas ? dias(v) : v) : null, horas ? s.hrs : s.num);
      });
      f.set(l, colIni + larg - 1, soma ? (horas ? dias(soma) : soma) : null, horas ? s.hrs : s.num);
    });
    const lt = cab + 1 + setores.length;
    f.set(lt, colIni, "TOTAL", s.total);
    totais.forEach((v, i) => f.set(lt, colIni + 1 + i, horas ? dias(v) : v, horas ? s.totalHrs : s.total));
    const geral = totais.reduce((a, b) => a + b, 0);
    f.set(lt, colIni + larg - 1, horas ? dias(geral) : geral, horas ? s.totalHrs : s.total);
    return lt;
  };

  const doSetor = (setor: string) => linhas.filter((l) => l.setor === setor);
  const conta = (setor: string, p: (l: Linha) => boolean) => doSetor(setor).filter(p).length;

  const fim1 = Math.max(
    quadro(4, 1, "TOTAL DE MANUTENÇÕES", mantenedores, (st, mt) => conta(st, (l) => l.mantenedores.has(mt)), false, false),
    quadro(4, dirIni, "TOTAL TIPOS DE MANUTENÇÃO", tipos, (st, t) => conta(st, (l) => l.tipo === t), false, true)
  );
  const ini2 = fim1 + 2;
  quadro(
    ini2,
    1,
    "TOTAL DE HORAS",
    mantenedores,
    (st, mt) => doSetor(st).reduce((a, l) => a + (l.mantenedores.get(mt) ?? 0), 0),
    true,
    false
  );
  quadro(ini2, dirIni, "TOTAL CATEGORIA DE MANUTENÇÃO", categorias, (st, cat) => conta(st, (l) => l.categoria === cat), false, true);

  const larguras = [18, ...mantenedores.map(() => 11), 8, 2, 18, ...Array(dirLarg - 2).fill(12), 8];
  return f.xml({ larguras, congelar: 3 });
}

/** Estimativa de linhas de texto numa célula com quebra automática */
const linhasTexto = (t: string, largura: number) =>
  t.split("\n").reduce((n, p) => n + Math.max(1, Math.ceil(p.length / (largura * 0.95))), 0);

function detalhamento(linhas: Linha[], setores: string[], est: Estilos, cores: Map<string, Cor>, o: Opcoes): string {
  const f = new Folha();
  const larguras = [16, 55, 17, 14, 12, 10, 10, 21, 12, 35, 22];
  const ultima = larguras.length;
  const s = {
    empresa: est.id({ fonte: 1, cor: AZUL, borda: BORDA.media }),
    titulo: est.id({ fonte: 2, cor: AZUL, borda: BORDA.media }),
    setor: est.id({ fonte: 5, cor: MARINHO, borda: BORDA.media }),
    cab: est.id({ fonte: 4, cor: AZUL_CAB, borda: BORDA.fina, quebra: true }),
    registros: est.id({ fonte: 6, cor: AZUL_CLARO, borda: BORDA.media }),
  };
  const cel = (zebra: boolean, h: "center" | "left", horas = false) =>
    est.id({ fonte: 0, cor: zebra ? ZEBRA : BRANCO, borda: BORDA.cinza, h, quebra: true, horas });
  const colorido = (v: string) => {
    const cor = cores.get(v)!;
    return est.id({ fonte: cor.branca ? 4 : 3, cor: cor.fundo, borda: BORDA.cinza, quebra: true });
  };

  f.mesclar(1, 1, 1, ultima, caixaAlta(o.empresa), s.empresa);
  f.mesclar(2, 1, 2, ultima, tituloRelatorio(o), s.titulo);
  f.altura(1, 21.75);
  f.altura(2, 21.75);

  let l = 3;
  for (const setor of setores) {
    const doSetor = linhas
      .filter((x) => x.setor === setor)
      .sort(
        (a, b) =>
          a.categoria.localeCompare(b.categoria, "pt-BR") ||
          a.data.localeCompare(b.data) ||
          a.inicio.localeCompare(b.inicio) ||
          a.m.id - b.m.id
      );

    f.mesclar(l, 1, l, ultima, setor, s.setor);
    f.altura(l, 21.75);
    l++;

    // Cabeçalho em duas linhas; só "Período" se divide em início/fim
    const cab = ["TIPO DO ATIVO", "ATIVIDADE", "TIPO DE MANUTENÇÃO", "CATEGORIA", "DATA", "PERÍODO", "", "MANTENEDOR(ES)", "TEMPO DE SERVIÇO", "OBSERVAÇÕES", "FICHA DE PRODUÇÃO (COD.)"];
    cab.forEach((t, i) => {
      if (i === 5) f.mesclar(l, 6, l, 7, t, s.cab);
      else if (i !== 6) f.mesclar(l, i + 1, l + 1, i + 1, t, s.cab);
    });
    f.set(l + 1, 6, "INÍCIO", s.cab);
    f.set(l + 1, 7, "FIM", s.cab);
    f.altura(l, 21.75);
    f.altura(l + 1, 21.75);
    l += 2;

    doSetor.forEach((x, i) => {
      const z = i % 2 === 1;
      const atividade = caixaAlta(x.m.desc_atividade);
      const obs = caixaAlta(x.m.descricao_defeito);
      const mant = [...x.mantenedores.keys()].join(", ");
      f.set(l, 1, x.ativo, cel(z, "center"));
      f.set(l, 2, atividade, cel(z, "left"));
      f.set(l, 3, x.tipo, colorido(x.tipo));
      f.set(l, 4, x.categoria, colorido(x.categoria));
      f.set(l, 5, x.data ? data(x.data) : "", cel(z, "center"));
      f.set(l, 6, x.inicio, cel(z, "center"));
      f.set(l, 7, x.fim, cel(z, "center"));
      f.set(l, 8, mant, cel(z, "center"));
      f.set(l, 9, x.horas ? dias(x.horas) : null, cel(z, "center", true));
      f.set(l, 10, obs, cel(z, "left"));
      f.set(l, 11, caixaAlta(x.m.cod_ficha_producao), cel(z, "center"));
      const n = Math.max(
        linhasTexto(x.ativo, 16),
        linhasTexto(atividade, 55),
        linhasTexto(mant, 21),
        linhasTexto(obs, 35),
        linhasTexto(caixaAlta(x.m.cod_ficha_producao), 22)
      );
      f.altura(l, n <= 1 ? 16.4 : Math.round((n * 14.9 + 1.5) * 100) / 100);
      l++;
    });
  }

  f.mesclar(l, 1, l, ultima, `TOTAL DE REGISTROS: ${linhas.length}`, s.registros);
  return f.xml({ larguras, congelar: 2, zoom: 80 });
}

/* ------------------------------------------------------------------------- */

export function gerarModeloAtividades(lista: Manutencao[], c: Catalogos, o: Opcoes): Blob {
  const linhas = linhasDe(lista, c);
  const setores = ordemSetores(linhas, c);
  const cores = coresDe([...ordenar(linhas.map((l) => l.tipo)), ...ordenar(linhas.map((l) => l.categoria))]);
  const est = new Estilos();
  const abas = [
    { nome: "Resumo Geral", xml: resumo(linhas, setores, est, cores, o), titulosImpressao: "$1:$5" },
    { nome: "Detalhamento", xml: detalhamento(linhas, setores, est, cores, o), titulosImpressao: "$1:$2" },
  ];
  return gerarXlsxBruto(abas, est.xml());
}

export function exportarModeloAtividades(lista: Manutencao[], c: Catalogos, o: Opcoes) {
  baixar(gerarModeloAtividades(lista, c, o), `relatorio-atividades-${o.dataInicio}-a-${o.dataFim}.xlsx`);
}
