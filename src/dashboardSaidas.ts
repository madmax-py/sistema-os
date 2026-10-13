// Cálculos do painel de saída de produtos — tudo derivado de GET produto_saidas
// (com tipo, fluxo, usuário, destino e itens aninhados) + cadastros da saída.
// Hoje a Progete devolve só as saídas não liberadas do mês atual; os filtros
// e séries funcionam com o que vier, se a rota passar a devolver mais.
import type { CatalogosSaida, ProdutoSaida } from "./api";
import { hoje } from "./formato";

export interface Contagem {
  rotulo: string;
  valor: number;
}

export type Situacao = "Pendente" | "Finalizada" | "Liberada" | "Entregue" | "Recusada";

export interface FiltroSaidas {
  empresaId: string;
  usuarioId: string;
  tipoId: string;
  situacao: "" | Situacao;
  equipamentoId: string;
  veiculoId: string;
  centroCustoId: string;
}

export const FILTRO_SAIDAS_VAZIO: FiltroSaidas = {
  empresaId: "",
  usuarioId: "",
  tipoId: "",
  situacao: "",
  equipamentoId: "",
  veiculoId: "",
  centroCustoId: "",
};

export interface LinhaProduto {
  nome: string;
  qtde: number;
  valor: number;
  saidas: number;
}

export interface IndicadoresSaidas {
  total: number;
  totalGeral: number;
  hoje: number;
  ultimos7: number;
  valorTotal: number;
  valorProdutos: number;
  /** serviços + frete + outros */
  valorExtras: number;
  descontos: number;
  ticketMedio: number;
  itens: number;
  volumes: number;
  produtosDistintos: number;
  itensPorSaida: number;
  pendentes: number;
  finalizadas: number;
  entregues: number;
  recusadas: number;
  semDestino: number;
  /** período coberto pelos dados (datas de emissão) */
  primeira: string | null;
  ultima: string | null;
  porDia: Contagem[];
  valorPorDia: Contagem[];
  porDiaSemana: Contagem[];
  porSituacao: Contagem[];
  porTipo: Contagem[];
  porFluxo: Contagem[];
  porUsuario: Contagem[];
  valorPorUsuario: Contagem[];
  porEmpresa: Contagem[];
  porDestino: Contagem[];
  equipamentos: Contagem[];
  veiculos: Contagem[];
  centrosCusto: Contagem[];
  produtos: LinhaProduto[];
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const n = (v: unknown) => Number(v) || 0;
const dia = (iso: string) => new Date(`${iso.slice(0, 10)}T12:00:00`);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Mesmo nome que a tela usa para qualquer cadastro aninhado */
const nomeDe = (o: Record<string, any> | null | undefined) =>
  o ? o.descricao || o.nome || o.nome_fantasia || o.placa || `#${o.id}` : "";

export function situacaoDe(s: ProdutoSaida): Situacao {
  if (s.recusado) return "Recusada";
  if (s.entregue) return "Entregue";
  if (s.liberado) return "Liberada";
  if (s.finalizado) return "Finalizada";
  return "Pendente";
}

/** Valor dos produtos da saída: vprod salvo, ou a soma dos itens */
export const valorProdutos = (s: ProdutoSaida) =>
  s.vprod != null
    ? n(s.vprod)
    : (s.produto_saida_items ?? []).reduce((t, i) => t + n(i.qcom) * n(i.vuncom), 0);

export const valorTotal = (s: ProdutoSaida) =>
  valorProdutos(s) + n(s.vserv) + n(s.vfrete) + n(s.voutro) - n(s.vdesc);

/** Agrupa e ordena do maior para o menor */
function contar<T>(lista: T[], chave: (x: T) => string | undefined, peso: (x: T) => number = () => 1): Contagem[] {
  const m = new Map<string, number>();
  for (const x of lista) {
    const k = chave(x);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + peso(x));
  }
  return [...m.entries()].map(([rotulo, valor]) => ({ rotulo, valor })).sort((a, b) => b.valor - a.valor);
}

export function filtrarSaidas(lista: ProdutoSaida[], f: FiltroSaidas): ProdutoSaida[] {
  return lista.filter(
    (s) =>
      (!f.empresaId || String(s.empresa_id) === f.empresaId) &&
      (!f.usuarioId || String(s.empresa_usuario_id) === f.usuarioId) &&
      (!f.tipoId || String(s.produto_saida_tipo_id) === f.tipoId) &&
      (!f.situacao || situacaoDe(s) === f.situacao) &&
      (!f.equipamentoId || String(s.equipamento_id) === f.equipamentoId) &&
      (!f.veiculoId || String(s.veiculo_id) === f.veiculoId) &&
      (!f.centroCustoId || String(s.lancamento_centro_custo_id) === f.centroCustoId)
  );
}

export function calcularSaidas(todas: ProdutoSaida[], c: CatalogosSaida, f: FiltroSaidas): IndicadoresSaidas {
  const lista = filtrarSaidas(todas, f);
  const h = hoje();
  const seteDias = iso(new Date(dia(h).getTime() - 6 * 86_400_000));

  const nomeUsuario = (s: ProdutoSaida) =>
    s.empresa_usuario?.nome ?? (s.empresa_usuario_id ? nomeDe(c.usuarios.find((u) => u.id === s.empresa_usuario_id)) : "") ?? "";
  const nomeEmpresa = (s: ProdutoSaida) =>
    c.empresas.find((e) => e.id === s.empresa_id)?.nome_fantasia || `Empresa #${s.empresa_id}`;
  const nomeCad = (aninhado: unknown, l: Array<{ id: number }>, id: number | null) =>
    nomeDe((aninhado as Record<string, any>) ?? (id ? l.find((x) => x.id === id) : undefined));

  // Datas: série diária contínua entre a primeira e a última emissão
  const datas = lista.map((s) => s.dhemi?.slice(0, 10)).filter(Boolean).sort() as string[];
  const primeira = datas[0] ?? null;
  const ultima = datas[datas.length - 1] ?? null;
  const porDia: Contagem[] = [];
  const valorPorDia: Contagem[] = [];
  if (primeira && ultima) {
    const qtd = new Map<string, number>();
    const val = new Map<string, number>();
    for (const s of lista) {
      const d = s.dhemi?.slice(0, 10);
      if (!d) continue;
      qtd.set(d, (qtd.get(d) ?? 0) + 1);
      val.set(d, (val.get(d) ?? 0) + valorTotal(s));
    }
    for (let d = dia(primeira); iso(d) <= ultima && porDia.length < 400; d = new Date(d.getTime() + 86_400_000)) {
      const k = iso(d);
      const rotulo = `${k.slice(8, 10)}/${k.slice(5, 7)}`;
      porDia.push({ rotulo, valor: qtd.get(k) ?? 0 });
      valorPorDia.push({ rotulo, valor: val.get(k) ?? 0 });
    }
  }

  const porDiaSemana = DIAS.map((rotulo) => ({ rotulo, valor: 0 }));
  for (const s of lista) if (s.dhemi) porDiaSemana[dia(s.dhemi).getDay()].valor++;

  // Produtos
  const produtos = new Map<string, LinhaProduto>();
  let itens = 0;
  let volumes = 0;
  for (const s of lista) {
    const vistos = new Set<string>();
    for (const i of s.produto_saida_items ?? []) {
      const nome = i.xprod?.trim() || `Produto #${i.produto_id}`;
      const linha = produtos.get(nome) ?? { nome, qtde: 0, valor: 0, saidas: 0 };
      linha.qtde += n(i.qcom);
      linha.valor += n(i.qcom) * n(i.vuncom);
      if (!vistos.has(nome)) {
        linha.saidas++;
        vistos.add(nome);
      }
      produtos.set(nome, linha);
      itens++;
      volumes += n(i.qcom);
    }
  }

  const valorTot = lista.reduce((t, s) => t + valorTotal(s), 0);
  const valorProd = lista.reduce((t, s) => t + valorProdutos(s), 0);
  const descontos = lista.reduce((t, s) => t + n(s.vdesc), 0);
  const situacoes = contar(lista, situacaoDe);
  const conta = (sit: Situacao) => situacoes.find((x) => x.rotulo === sit)?.valor ?? 0;

  const destinoDe = (s: ProdutoSaida) =>
    s.equipamento_id ? "Equipamento" : s.veiculo_id ? "Veículo" : s.lancamento_centro_custo_id ? "Centro de custo" : "Sem destino";

  return {
    total: lista.length,
    totalGeral: todas.length,
    hoje: lista.filter((s) => s.dhemi?.startsWith(h)).length,
    ultimos7: lista.filter((s) => (s.dhemi?.slice(0, 10) ?? "") >= seteDias).length,
    valorTotal: valorTot,
    valorProdutos: valorProd,
    valorExtras: valorTot - valorProd + descontos,
    descontos,
    ticketMedio: lista.length ? valorTot / lista.length : 0,
    itens,
    volumes,
    produtosDistintos: produtos.size,
    itensPorSaida: lista.length ? itens / lista.length : 0,
    pendentes: conta("Pendente"),
    finalizadas: conta("Finalizada"),
    entregues: conta("Entregue"),
    recusadas: conta("Recusada"),
    semDestino: lista.filter((s) => destinoDe(s) === "Sem destino").length,
    primeira,
    ultima,
    porDia,
    valorPorDia,
    porDiaSemana,
    porSituacao: situacoes,
    porTipo: contar(lista, (s) => nomeCad(s.produto_saida_tipo, c.tipos, s.produto_saida_tipo_id) || "Sem tipo"),
    porFluxo: contar(lista, (s) => nomeCad(s.produto_saida_fluxo, c.fluxos, s.produto_saida_fluxo_id) || "Sem fluxo"),
    porUsuario: contar(lista, (s) => nomeUsuario(s) || "Sem usuário"),
    valorPorUsuario: contar(lista, (s) => nomeUsuario(s) || "Sem usuário", valorTotal),
    porEmpresa: contar(lista, nomeEmpresa),
    porDestino: contar(lista, destinoDe),
    equipamentos: contar(lista, (s) => (s.equipamento_id ? nomeCad(s.equipamento, c.equipamentos, s.equipamento_id) : undefined), valorTotal),
    veiculos: contar(lista, (s) => (s.veiculo_id ? nomeCad(s.veiculo, c.veiculos, s.veiculo_id) : undefined), valorTotal),
    centrosCusto: contar(
      lista,
      (s) => (s.lancamento_centro_custo_id ? nomeCad(s.lancamento_centro_custo, c.centro_custos, s.lancamento_centro_custo_id) : undefined),
      valorTotal
    ),
    produtos: [...produtos.values()],
  };
}
