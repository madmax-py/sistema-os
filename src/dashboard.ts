// Cálculos do painel de indicadores — tudo derivado de GET manutencaos
// (com itens e serviços aninhados) + catálogos. Nada é armazenado.
import type { Catalogos, Manutencao, ManutencaoServico } from "./api";
import { hoje, hora } from "./formato";

export type Periodo = "todos" | "30d" | "90d" | "12m" | "ano";

export interface Filtro {
  periodo: Periodo;
  tipoId: string;
  equipamentoId: string;
}

export interface Contagem {
  rotulo: string;
  valor: number;
  detalhe?: string;
}

export interface LinhaMantenedor {
  nome: string;
  servicos: number;
  os: number;
  horas: number;
  custo: number;
}

export interface LinhaMaterial {
  nome: string;
  unidade: string;
  qtde: number;
  custo: number;
  os: number;
}

export interface Mes {
  chave: string; // "2026-09"
  rotulo: string; // "set/26"
  os: number;
  custoMateriais: number;
  custoServicos: number;
  horas: number;
}

export interface Indicadores {
  total: number;
  totalGeral: number;
  mesAtual: number;
  mesAnterior: number;
  hoje: number;
  custoMateriais: number;
  custoServicos: number;
  custoTotal: number;
  custoMedio: number;
  horas: number;
  horasMediasPorOS: number;
  diasMedios: number | null;
  recorrentes: number;
  qtdServicos: number;
  qtdItens: number;
  mantenedoresEnvolvidos: number;
  materiaisDistintos: number;
  equipamentosAtendidos: number;
  equipamentosCadastrados: number;
  meses: Mes[];
  porTipo: Contagem[];
  porPrioridade: Contagem[];
  porFluxo: Contagem[];
  porArea: Contagem[];
  porOutro: Contagem[];
  equipamentosPorOS: Contagem[];
  equipamentosPorCusto: Contagem[];
  porDiaSemana: Contagem[];
  porSolicitante: Contagem[];
  mantenedores: LinhaMantenedor[];
  materiais: LinhaMaterial[];
  qualidade: Contagem[];
  recentes: Manutencao[];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const dia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const somaDias = (iso: string, n: number) => {
  const d = dia(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

function inicioDoPeriodo(p: Periodo): string | null {
  const h = hoje();
  if (p === "30d") return somaDias(h, -29);
  if (p === "90d") return somaDias(h, -89);
  if (p === "12m") return `${Number(h.slice(0, 4)) - 1}-${h.slice(5, 7)}-01`;
  if (p === "ano") return `${h.slice(0, 4)}-01-01`;
  return null;
}

/** Horas de um serviço; null se faltar horário, negativo se término < início */
export function horasServico(s: ManutencaoServico): number | null {
  const hi = hora(s.hr_inicio);
  const ht = hora(s.hr_termino);
  if (!s.dt_inicio || !s.dt_termino || !hi || !ht) return null;
  return (Date.parse(`${s.dt_termino}T${ht}`) - Date.parse(`${s.dt_inicio}T${hi}`)) / 3_600_000;
}

const custoMateriaisOS = (m: Manutencao) =>
  (m.manutencao_items ?? []).reduce((s, i) => s + (i.qtde ?? 0) * (i.preco_unit ?? 0), 0);
const custoServicosOS = (m: Manutencao) =>
  (m.manutencao_servicos ?? []).reduce((s, x) => s + (x.vlcusto ?? 0), 0);
const horasOS = (m: Manutencao) =>
  (m.manutencao_servicos ?? []).reduce((s, x) => s + Math.max(horasServico(x) ?? 0, 0), 0);

function contar<T>(lista: T[], chave: (x: T) => string | undefined, peso: (x: T) => number = () => 1): Contagem[] {
  const mapa = new Map<string, number>();
  for (const x of lista) {
    const k = chave(x) ?? "Não informado";
    mapa.set(k, (mapa.get(k) ?? 0) + peso(x));
  }
  return [...mapa.entries()]
    .map(([rotulo, valor]) => ({ rotulo, valor }))
    .sort((a, b) => b.valor - a.valor || a.rotulo.localeCompare(b.rotulo));
}

export function filtrar(lista: Manutencao[], f: Filtro): Manutencao[] {
  const inicio = inicioDoPeriodo(f.periodo);
  return lista.filter(
    (m) =>
      (!inicio || (m.dt_programada ?? "") >= inicio) &&
      (!f.tipoId || String(m.manutencao_tipo_id) === f.tipoId) &&
      (!f.equipamentoId || String(m.manutencao_equipamento_id) === f.equipamentoId)
  );
}

function serieMensal(lista: Manutencao[], f: Filtro): Mes[] {
  const h = hoje();
  const datas = lista.map((m) => m.dt_programada).filter(Boolean).sort();
  // Janela: do início do período (ou da O.S. mais antiga) até o mês atual, no máximo 24 meses
  const inicio = inicioDoPeriodo(f.periodo) ?? datas[0] ?? h;
  const fimChave = (datas[datas.length - 1] ?? h) > h ? datas[datas.length - 1] : h;
  const meses: Mes[] = [];
  let a = Number(inicio.slice(0, 4));
  let mm = Number(inicio.slice(5, 7));
  const fa = Number(fimChave.slice(0, 4));
  const fm = Number(fimChave.slice(5, 7));
  while ((a < fa || (a === fa && mm <= fm)) && meses.length < 60) {
    const chave = `${a}-${String(mm).padStart(2, "0")}`;
    meses.push({ chave, rotulo: `${MESES[mm - 1]}/${String(a).slice(2)}`, os: 0, custoMateriais: 0, custoServicos: 0, horas: 0 });
    mm++;
    if (mm > 12) {
      mm = 1;
      a++;
    }
  }
  const porChave = new Map(meses.map((x) => [x.chave, x]));
  for (const m of lista) {
    const x = porChave.get((m.dt_programada ?? "").slice(0, 7));
    if (!x) continue;
    x.os++;
    x.custoMateriais += custoMateriaisOS(m);
    x.custoServicos += custoServicosOS(m);
    x.horas += horasOS(m);
  }
  return meses.slice(-24);
}

export function calcular(todas: Manutencao[], catalogos: Catalogos, f: Filtro): Indicadores {
  const lista = filtrar(todas, f);
  const h = hoje();
  const mesAtual = h.slice(0, 7);
  const dAnt = dia(`${mesAtual}-01`);
  dAnt.setMonth(dAnt.getMonth() - 1);
  const mesAnterior = dAnt.toISOString().slice(0, 7);

  const nomeEquip = (m: Manutencao) => {
    const e = m.manutencao_equipamento ?? catalogos.equipamentos.find((x) => x.id === m.manutencao_equipamento_id);
    return e ? `${e.descricao} · ${e.codigo}` : undefined;
  };
  const desc = (l: { id: number; descricao: string }[], id: number, aninhado?: { descricao: string }) =>
    aninhado?.descricao ?? l.find((x) => x.id === id)?.descricao;

  const servicos = lista.flatMap((m) => (m.manutencao_servicos ?? []).map((s) => ({ os: m.id, s })));
  const itens = lista.flatMap((m) => (m.manutencao_items ?? []).map((i) => ({ os: m.id, i })));

  const custoMateriais = lista.reduce((s, m) => s + custoMateriaisOS(m), 0);
  const custoServicos = lista.reduce((s, m) => s + custoServicosOS(m), 0);
  const horas = lista.reduce((s, m) => s + horasOS(m), 0);

  const duracoes = lista
    .filter((m) => m.dt_programada && m.dt_finalizada)
    .map((m) => (dia(m.dt_finalizada).getTime() - dia(m.dt_programada).getTime()) / 86_400_000)
    .filter((d) => d >= 0);

  // Mantenedores
  const mapaMant = new Map<number, LinhaMantenedor & { osSet: Set<number> }>();
  for (const { os, s } of servicos) {
    const id = s.manutencao_mantenedor_id;
    const nome = catalogos.mantenedores.find((x) => x.id === id)?.nome ?? `#${id}`;
    const l = mapaMant.get(id) ?? { nome, servicos: 0, os: 0, horas: 0, custo: 0, osSet: new Set<number>() };
    l.servicos++;
    l.osSet.add(os);
    l.horas += Math.max(horasServico(s) ?? 0, 0);
    l.custo += s.vlcusto ?? 0;
    mapaMant.set(id, l);
  }
  const mantenedores = [...mapaMant.values()]
    .map(({ osSet, ...l }) => ({ ...l, os: osSet.size }))
    .sort((a, b) => b.horas - a.horas || b.servicos - a.servicos);

  // Materiais
  const mapaMat = new Map<number, LinhaMaterial & { osSet: Set<number> }>();
  for (const { os, i } of itens) {
    const p = catalogos.produtos.find((x) => x.id === i.manutencao_produto_id);
    const unidade = catalogos.unidades.find((u) => u.id === p?.produto_unidade_medida_id)?.descricao ?? "";
    const l = mapaMat.get(i.manutencao_produto_id) ?? {
      nome: p?.descricao ?? `#${i.manutencao_produto_id}`,
      unidade,
      qtde: 0,
      custo: 0,
      os: 0,
      osSet: new Set<number>(),
    };
    l.qtde += i.qtde ?? 0;
    l.custo += (i.qtde ?? 0) * (i.preco_unit ?? 0);
    l.osSet.add(os);
    mapaMat.set(i.manutencao_produto_id, l);
  }
  const materiais = [...mapaMat.values()]
    .map(({ osSet, ...l }) => ({ ...l, os: osSet.size }))
    .sort((a, b) => b.custo - a.custo || b.qtde - a.qtde);

  // Qualidade dos dados
  const servicosInvertidos = servicos.filter(({ s }) => (horasServico(s) ?? 0) < 0).length;
  const servicosSemHora = servicos.filter(({ s }) => horasServico(s) === null).length;
  const qualidade: Contagem[] = [
    { rotulo: "Serviços com término antes do início", valor: servicosInvertidos },
    { rotulo: "Serviços sem horário", valor: servicosSemHora },
    { rotulo: "O.S. sem serviços", valor: lista.filter((m) => !(m.manutencao_servicos ?? []).length).length },
    { rotulo: "O.S. sem materiais", valor: lista.filter((m) => !(m.manutencao_items ?? []).length).length },
    { rotulo: "O.S. sem descrição do defeito", valor: lista.filter((m) => !m.descricao_defeito?.trim()).length },
    { rotulo: "Serviços sem custo", valor: servicos.filter(({ s }) => !s.vlcusto).length },
  ];

  const porDia = contar(lista.filter((m) => m.dt_programada), (m) => DIAS[dia(m.dt_programada).getDay()]);
  const porDiaSemana = [1, 2, 3, 4, 5, 6, 0].map((d) => ({
    rotulo: DIAS[d],
    valor: porDia.find((x) => x.rotulo === DIAS[d])?.valor ?? 0,
  }));

  return {
    total: lista.length,
    totalGeral: todas.length,
    mesAtual: lista.filter((m) => m.dt_programada?.startsWith(mesAtual)).length,
    mesAnterior: lista.filter((m) => m.dt_programada?.startsWith(mesAnterior)).length,
    hoje: lista.filter((m) => m.dt_programada === h).length,
    custoMateriais,
    custoServicos,
    custoTotal: custoMateriais + custoServicos,
    custoMedio: lista.length ? (custoMateriais + custoServicos) / lista.length : 0,
    horas,
    horasMediasPorOS: lista.length ? horas / lista.length : 0,
    diasMedios: duracoes.length ? duracoes.reduce((s, d) => s + d, 0) / duracoes.length : null,
    recorrentes: lista.filter((m) => m.recorrente).length,
    qtdServicos: servicos.length,
    qtdItens: itens.length,
    mantenedoresEnvolvidos: mantenedores.length,
    materiaisDistintos: materiais.length,
    equipamentosAtendidos: new Set(lista.map((m) => m.manutencao_equipamento_id)).size,
    equipamentosCadastrados: catalogos.equipamentos.length,
    meses: serieMensal(lista, f),
    porTipo: contar(lista, (m) => desc(catalogos.tipos, m.manutencao_tipo_id, m.manutencao_tipo)),
    porPrioridade: contar(lista, (m) => desc(catalogos.prioridades, m.manutencao_prioridade_id, m.manutencao_prioridade)),
    porFluxo: contar(lista, (m) => desc(catalogos.fluxos, m.manutencao_fluxo_id, m.manutencao_fluxo)),
    porArea: contar(lista, (m) => desc(catalogos.areas, m.manutencao_area_id, m.manutencao_area)),
    porOutro: contar(lista, (m) => desc(catalogos.outros, m.manutencao_outro_id, m.manutencao_outro)),
    equipamentosPorOS: contar(lista, nomeEquip),
    equipamentosPorCusto: contar(lista, nomeEquip, (m) => custoMateriaisOS(m) + custoServicosOS(m)).filter((x) => x.valor > 0),
    porDiaSemana,
    porSolicitante: contar(lista, (m) => m.solicitante?.trim() || undefined),
    mantenedores,
    materiais,
    qualidade,
    recentes: [...lista].sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? "") || b.id - a.id).slice(0, 5),
  };
}
