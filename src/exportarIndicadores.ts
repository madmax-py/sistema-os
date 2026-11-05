// Excel do Painel de Indicadores: os números e rankings do painel (com o filtro
// aplicado) + as planilhas de O.S./materiais/serviços das mesmas O.S.
import type { Catalogos, Manutencao } from "./api";
import { SEM_USUARIO, usuariosDasOS, type Contagem, type Filtro, type Indicadores } from "./dashboard";
import { planilhasDasOS } from "./exportar";
import { data, hoje } from "./formato";
import { baixar, gerarXlsx, type Celula, type Planilha } from "./xlsx";

const r2 = (v: number) => Math.round(v * 100) / 100;
const pct = (parte: number, todo: number) => (todo ? r2((parte / todo) * 100) : 0);

function descricaoFiltro(f: Filtro, lista: Manutencao[], c: Catalogos): string {
  const usuario =
    f.usuarioId === SEM_USUARIO
      ? "sem mantenedor interno"
      : usuariosDasOS(lista, c).find((u) => String(u.id) === f.usuarioId)?.rotulo;
  const equip = c.equipamentos.find((e) => String(e.id) === f.equipamentoId);
  return [
    `${data(f.dataInicio)} a ${data(f.dataFim)}`,
    f.finalizado && "somente finalizadas",
    f.tipoId && `tipo: ${c.tipos.find((t) => String(t.id) === f.tipoId)?.descricao ?? f.tipoId}`,
    equip && `equipamento: ${equip.descricao} · ${equip.codigo}`,
    f.usuarioId && `mantenedor interno: ${usuario ?? f.usuarioId}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function planilhasDosIndicadores(ind: Indicadores, lista: Manutencao[], c: Catalogos, f: Filtro): Planilha[] {
  const resumo: Celula[][] = [
    ["Indicador", "Valor"],
    ["Filtro", descricaoFiltro(f, lista, c)],
    ["Gerado em", `${data(hoje())} ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`],
    ["Ordens de serviço", ind.total],
    ["O.S. no período (sem os demais filtros)", ind.totalGeral],
    ["O.S. este mês", ind.mesAtual],
    ["O.S. mês anterior", ind.mesAnterior],
    ["Custo de materiais (R$)", r2(ind.custoMateriais)],
    ["Custo de terceiros (R$)", r2(ind.custoServicos)],
    ["Custo total (R$)", r2(ind.custoTotal)],
    ["Custo médio por O.S. (R$)", r2(ind.custoMedio)],
    ["Horas totais", r2(ind.horas)],
    ["Horas locais", r2(ind.horasLocais)],
    ["Horas de terceiros", r2(ind.horasTerceiros)],
    ["Horas médias por O.S.", r2(ind.horasMediasPorOS)],
    ["O.S. com execução interna", ind.osComExecucao],
    ["Prazo médio (dias, programada → finalizada)", ind.diasMedios === null ? "" : r2(ind.diasMedios)],
    ["O.S. recorrentes", ind.recorrentes],
    ["Serviços de terceiros", ind.qtdServicos],
    ["Itens de material", ind.qtdItens],
    ["Materiais distintos", ind.materiaisDistintos],
    ["Mantenedores locais envolvidos", ind.mantenedoresLocaisEnvolvidos],
    ["Mantenedores terceiros envolvidos", ind.mantenedoresEnvolvidos],
    ["Equipamentos atendidos", ind.equipamentosAtendidos],
    ["Equipamentos cadastrados", ind.equipamentosCadastrados],
  ];

  const mensal: Celula[][] = [
    ["Mês", "O.S.", "Custo materiais (R$)", "Custo terceiros (R$)", "Custo total (R$)", "Horas locais", "Horas terceiros", "Horas totais"],
    ...ind.meses.map((m) => [
      m.rotulo, m.os, r2(m.custoMateriais), r2(m.custoServicos), r2(m.custoMateriais + m.custoServicos),
      r2(m.horasLocais), r2(m.horasTerceiros), r2(m.horasLocais + m.horasTerceiros),
    ]),
  ];

  const grupos: [string, Contagem[]][] = [
    ["Tipo", ind.porTipo],
    ["Prioridade", ind.porPrioridade],
    ["Fluxo", ind.porFluxo],
    ["Área", ind.porArea],
    ["Outro", ind.porOutro],
    ["Solicitante", ind.porSolicitante],
    ["Dia da semana", ind.porDiaSemana],
  ];
  const distribuicao: Celula[][] = [["Agrupamento", "Item", "O.S.", "% do agrupamento"]];
  for (const [nome, lista] of grupos) {
    const total = lista.reduce((s, x) => s + x.valor, 0);
    for (const x of lista) distribuicao.push([nome, x.rotulo, x.valor, pct(x.valor, total)]);
  }

  const custoEquip = new Map(ind.equipamentosPorCusto.map((x) => [x.rotulo, x.valor]));
  const equipamentos: Celula[][] = [
    ["Equipamento", "O.S.", "Custo (R$)"],
    ...ind.equipamentosPorOS.map((x) => [x.rotulo, x.valor, r2(custoEquip.get(x.rotulo) ?? 0)]),
  ];

  return [
    { nome: "Resumo", linhas: resumo },
    { nome: "Por mês", linhas: mensal },
    { nome: "Distribuição", linhas: distribuicao },
    { nome: "Equipamentos", linhas: equipamentos },
    {
      nome: "Mantenedores locais",
      linhas: [["Mantenedor", "O.S.", "Horas"], ...ind.mantenedoresLocais.map((m) => [m.nome, m.os, r2(m.horas)])],
    },
    {
      nome: "Mantenedores terceiros",
      linhas: [
        ["Mantenedor", "Serviços", "O.S.", "Horas", "Custo (R$)"],
        ...ind.mantenedores.map((m) => [m.nome, m.servicos, m.os, r2(m.horas), r2(m.custo)]),
      ],
    },
    {
      nome: "Materiais usados",
      linhas: [
        ["Material", "Unidade", "Qtde", "Custo (R$)", "O.S."],
        ...ind.materiais.map((m) => [m.nome, m.unidade, r2(m.qtde), r2(m.custo), m.os]),
      ],
    },
    { nome: "Qualidade dos dados", linhas: [["Verificação", "Ocorrências"], ...ind.qualidade.map((q) => [q.rotulo, q.valor])] },
    ...planilhasDasOS(lista, c),
  ];
}

/** `lista` = as O.S. que entraram nos indicadores (já filtradas) */
export function exportarIndicadores(ind: Indicadores, lista: Manutencao[], c: Catalogos, f: Filtro) {
  baixar(gerarXlsx(planilhasDosIndicadores(ind, lista, c, f)), `indicadores-${f.dataInicio}-a-${f.dataFim}.xlsx`);
}
