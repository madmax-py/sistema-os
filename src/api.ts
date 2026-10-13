// Cliente da API de Manutenção da Progete (via /api/progete).

/* ------------------------------------------------------------------------- */
/* Tipos                                                                      */
/* ------------------------------------------------------------------------- */

export interface Opcao {
  id: number;
  descricao: string;
}

export interface Equipamento extends Opcao {
  codigo: string;
  localizacao: string | null;
  fabricante: string | null;
  marca: string | null;
  modelo: string | null;
  n_serie: string | null;
  ativo: boolean;
  manutencao_setor_id: number | null;
  manutencao_familia_equipamento_id: number | null;
}

export interface Mantenedor {
  id: number;
  nome: string;
  cargo: string | null;
  custo_hora: number;
}

/** Usuário da empresa que executa a O.S. (mantenedor interno) */
export interface EmpresaUsuario {
  id: number;
  nome?: string | null;
  name?: string | null;
  email?: string | null;
  cargo?: string | null;
  funcao?: string | null;
  descricao?: string | null;
}

/** "Mario Telles (Suporte)" — tolera os nomes de campo que a Progete pode usar */
export function nomeUsuario(u: EmpresaUsuario | undefined, id?: number | null): string {
  if (!u) return id ? `#${id}` : "";
  const nome = u.nome || u.name || u.descricao || u.email || `#${u.id}`;
  const papel = u.cargo || u.funcao;
  return papel ? `${nome} (${papel})` : nome;
}

export interface Produto extends Opcao {
  produto_unidade_medida_id: number | null;
  custo: number;
}

export interface Catalogos {
  equipamentos: Equipamento[];
  /** setores dos equipamentos (manutencao_setor_id) */
  setores: Opcao[];
  tipos: Opcao[];
  prioridades: Opcao[];
  fluxos: Opcao[];
  areas: Opcao[];
  outros: Opcao[];
  /** mantenedores terceiros (aba de serviços) */
  mantenedores: Mantenedor[];
  /** usuários da empresa (mantenedor interno, em Dados gerais) */
  usuarios: EmpresaUsuario[];
  produtos: Produto[];
  unidades: Opcao[];
}

export interface ManutencaoItem {
  id: number;
  manutencao_produto_id: number;
  dt: string;
  qtde: number;
  preco_unit: number;
  nr_doc: string | null;
}

export interface ManutencaoServico {
  id: number;
  manutencao_mantenedor_id: number;
  dt_inicio: string;
  hr_inicio: string | null;
  dt_termino: string;
  hr_termino: string | null;
  desc_atividade: string | null;
  nr_doc: string | null;
  vlcusto: number;
}

export interface Manutencao {
  id: number;
  manutencao_equipamento_id: number;
  manutencao_tipo_id: number;
  manutencao_prioridade_id: number;
  manutencao_fluxo_id: number;
  manutencao_area_id: number;
  manutencao_outro_id: number;
  dt_programada: string;
  dt_finalizada: string;
  solicitante: string;
  descricao_defeito: string | null;
  cod_ficha_producao: string | null;
  infad: string | null;
  recorrente: boolean;
  vezes_recorrente: number;
  dias_recorrente: number;
  empresa_usuario_id: number | null;
  dt_inicio: string | null;
  hr_inicio: string | null;
  dt_termino: string | null;
  hr_termino: string | null;
  desc_atividade: string | null;
  created_at: string;
  empresa_usuario?: EmpresaUsuario;
  manutencao_equipamento?: Equipamento;
  manutencao_tipo?: Opcao;
  manutencao_prioridade?: Opcao;
  manutencao_fluxo?: Opcao;
  manutencao_area?: Opcao;
  manutencao_outro?: Opcao;
  manutencao_items?: ManutencaoItem[];
  manutencao_servicos?: ManutencaoServico[];
}

/** Corpo de POST/PATCH manutencaos — exatamente os campos do permit do controller */
export interface ManutencaoPayload {
  manutencao_equipamento_id: number;
  manutencao_outro_id: number;
  manutencao_tipo_id: number;
  manutencao_prioridade_id: number;
  manutencao_fluxo_id: number;
  manutencao_area_id: number;
  dt_programada: string;
  dt_finalizada: string;
  solicitante: string;
  descricao_defeito: string;
  cod_ficha_producao: string;
  infad: string;
  recorrente: boolean;
  vezes_recorrente: number;
  dias_recorrente: number;
  empresa_usuario_id: number | null;
  dt_inicio: string;
  hr_inicio: string;
  dt_termino: string;
  hr_termino: string;
  desc_atividade: string;
  manutencao_items_attributes: Array<{
    id?: number;
    manutencao_produto_id?: number;
    dt?: string;
    qtde?: number;
    preco_unit?: number;
    nr_doc?: string;
    _destroy?: boolean;
  }>;
  manutencao_servicos_attributes: Array<{
    id?: number;
    manutencao_mantenedor_id?: number;
    dt_inicio?: string;
    hr_inicio?: string;
    dt_termino?: string;
    hr_termino?: string;
    desc_atividade?: string;
    nr_doc?: string;
    vlcusto?: number;
    _destroy?: boolean;
  }>;
}

/* ------------------------------------------------------------------------- */
/* Sessão (JWT da Progete no localStorage)                                   */
/* ------------------------------------------------------------------------- */

export interface Sessao {
  /** origem da API em que o token foi emitido (ex.: https://teste.progete.com.br) */
  dominio: string;
  token: string;
  email: string;
  nome: string;
  admin: boolean;
  /** expiração do JWT, em segundos (claim "exp") */
  exp: number;
}

const SESSAO_KEY = "progete_os_sessao";
const DOMINIO_KEY = "progete_os_dominio";

/* ------------------------------------------------------------------------- */
/* Domínio da API (escolhido na tela de conexão)                              */
/* ------------------------------------------------------------------------- */

export function getDominio(): string | null {
  try {
    return localStorage.getItem(DOMINIO_KEY);
  } catch {
    return null;
  }
}

/**
 * "teste.progete.com.br", "https://teste.progete.com.br/api/v1.json" etc.
 * → "https://teste.progete.com.br". Sem protocolo, assume https.
 */
export function normalizarDominio(entrada: string): string | null {
  const t = entrada.trim();
  if (!t) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    return url.origin.toLowerCase();
  } catch {
    return null;
  }
}

export interface ResultadoVerificacao {
  ok: boolean;
  origem: string;
  /** URL consultada, para mostrar ao usuário */
  url: string;
  mensagem: string;
}

/** Consulta {origem}/api/v1.json — a API válida responde { code: "api_ativada" } */
export async function verificarDominio(entrada: string): Promise<ResultadoVerificacao> {
  const origem = normalizarDominio(entrada);
  if (!origem) return { ok: false, origem: "", url: "", mensagem: "Endereço inválido." };
  const url = `${origem}/api/v1.json`;
  try {
    const resp = await fetch("/api/progete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base: origem, method: "GET", path: "status" }),
      signal: AbortSignal.timeout(15000),
    });
    const data = await resp.json().catch(() => null);
    if (resp.ok && data?.code === "api_ativada") {
      localStorage.setItem(DOMINIO_KEY, origem);
      return { ok: true, origem, url, mensagem: data.sucess ?? "API ativada." };
    }
    if (data?.codigo === "dominio_nao_permitido" || data?.codigo === "sem_conexao") {
      return { ok: false, origem, url, mensagem: data.erro };
    }
    return {
      ok: false,
      origem,
      url,
      mensagem:
        resp.status === 404
          ? "Esse endereço respondeu, mas não tem a API da Progete (404)."
          : `Esse endereço não respondeu como a API da Progete (HTTP ${resp.status}).`,
    };
  } catch {
    return { ok: false, origem, url, mensagem: "Sem conexão com o servidor." };
  }
}

/**
 * Domínio fixo definido no servidor (PROGETE_URL no .env / Vercel), ou null.
 * Com domínio fixo, o app pula a tela de conexão.
 */
export async function carregarDominioFixo(): Promise<string | null> {
  try {
    const data = await fetch("/api/progete", { signal: AbortSignal.timeout(10000) }).then((r) => r.json());
    const fixo = typeof data?.fixo === "string" ? normalizarDominio(data.fixo) : null;
    if (fixo) localStorage.setItem(DOMINIO_KEY, fixo);
    return fixo;
  } catch {
    return null;
  }
}

let aoExpirar: (() => void) | null = null;

/** Registra o que fazer quando a Progete recusar o token (volta ao login). */
export function onSessaoExpirada(fn: () => void) {
  aoExpirar = fn;
}

export function getSessao(): Sessao | null {
  try {
    const s: Sessao | null = JSON.parse(localStorage.getItem(SESSAO_KEY) ?? "null");
    if (!s || s.exp * 1000 <= Date.now() || s.dominio !== getDominio()) return null;
    return s;
  } catch {
    return null;
  }
}

export function sair() {
  try {
    localStorage.removeItem(SESSAO_KEY);
  } catch {
    // ignora
  }
}

function claims(token: string): Record<string, any> {
  try {
    const b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), "="));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------------- */
/* Chamadas                                                                   */
/* ------------------------------------------------------------------------- */

export class ApiErro extends Error {
  status: number;
  /** Erros de validação da Progete: { campo: [mensagens] } */
  erros?: Record<string, string[]>;
  constructor(mensagem: string, status: number, erros?: Record<string, string[]>) {
    super(mensagem);
    this.status = status;
    this.erros = erros;
  }
}

async function chamar<T>(
  method: string,
  path: string,
  opts: { query?: Record<string, string>; body?: unknown } = {}
): Promise<T> {
  const sessao = getSessao();
  const base = getDominio();
  if (!base) throw new ApiErro("Nenhum domínio de API configurado.", 0);
  let resp: Response;
  try {
    resp = await fetch("/api/progete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(sessao ? { Authorization: `Bearer ${sessao.token}` } : {}),
      },
      body: JSON.stringify({ base, method, path, ...opts }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ApiErro("Sem conexão com o servidor.", 0);
  }

  const data = await resp.json().catch(() => null);

  if (resp.status === 401 && path !== "auth/authenticate") {
    sair();
    aoExpirar?.();
    throw new ApiErro("Sessão expirada. Entre novamente.", 401);
  }
  if (!resp.ok) {
    throw new ApiErro(data?.erro ?? data?.error ?? `Erro ${resp.status}`, resp.status);
  }
  return data as T;
}

export async function entrar(email: string, password: string): Promise<Sessao> {
  try {
    const data = await chamar<{ token?: string }>("POST", "auth/authenticate", {
      query: { email: email.trim(), password },
    });
    if (!data?.token) throw new ApiErro("A Progete não devolveu o token.", 502);
    const c = claims(data.token);
    const sessao: Sessao = {
      dominio: getDominio() ?? "",
      token: data.token,
      email: email.trim().toLowerCase(),
      nome: c.name ?? email,
      admin: c.admin === true,
      exp: typeof c.exp === "number" ? c.exp : Date.now() / 1000 + 12 * 3600,
    };
    localStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
    return sessao;
  } catch (e) {
    if (e instanceof ApiErro && e.status === 401) throw new ApiErro("E-mail ou senha incorretos.", 401);
    throw e;
  }
}

export async function carregarCatalogos(): Promise<Catalogos> {
  const get = <T,>(p: string) => chamar<T>("GET", p);
  const [equipamentos, tipos, prioridades, fluxos, areas, outros, mantenedores, produtos, unidades, usuarios] =
    await Promise.all([
      get<Equipamento[]>("manutencaos/equipamentos"),
      get<Opcao[]>("manutencaos/tipos"),
      get<Opcao[]>("manutencaos/prioridades"),
      get<Opcao[]>("manutencaos/fluxos"),
      get<Opcao[]>("manutencaos/areas"),
      get<Opcao[]>("manutencaos/outros"),
      get<Mantenedor[]>("manutencaos/mantenedores"),
      get<Produto[]>("manutencaos/produtos"),
      get<Opcao[]>("produto_unidade_medidas"),
      carregarUsuarios(),
    ]);
  const setores = await carregarSetores(equipamentos);
  return { equipamentos, setores, tipos, prioridades, fluxos, areas, outros, mantenedores, usuarios, produtos, unidades };
}

/**
 * Setores dos equipamentos: GET manutencaos/setores. Se a rota falhar, a lista
 * sai dos ids usados nos equipamentos ("Setor 3") para o filtro continuar útil.
 */
async function carregarSetores(equipamentos: Equipamento[]): Promise<Opcao[]> {
  try {
    const l = await chamar<Array<Opcao & { nome?: string }>>("GET", "manutencaos/setores");
    if (Array.isArray(l)) {
      return l
        .map((x) => ({ id: x.id, descricao: x.descricao || x.nome || `Setor ${x.id}` }))
        .sort((a, b) => a.descricao.localeCompare(b.descricao, "pt-BR"));
    }
  } catch (e) {
    if (e instanceof ApiErro && e.status === 401) throw e;
    console.warn("[api] GET manutencaos/setores falhou; usando os ids dos equipamentos.", e);
  }
  const ids = [...new Set(equipamentos.map((e) => e.manutencao_setor_id).filter((x): x is number => x != null))];
  return ids.sort((a, b) => a - b).map((id) => ({ id, descricao: `Setor ${id}` }));
}

/**
 * Usuários da empresa (mantenedor interno). Tenta manutencaos/empresa_usuarios
 * e depois empresa_usuarios; se nenhuma existir, segue com a lista vazia em vez
 * de derrubar o carregamento dos outros cadastros.
 */
async function carregarUsuarios(): Promise<EmpresaUsuario[]> {
  for (const rota of ["manutencaos/empresa_usuarios", "empresa_usuarios"]) {
    try {
      const l = await chamar<EmpresaUsuario[]>("GET", rota);
      if (Array.isArray(l)) return l;
    } catch (e) {
      if (e instanceof ApiErro && e.status === 401) throw e;
    }
  }
  console.warn("[api] GET empresa_usuarios indisponível; mantenedor interno sem opções.");
  return [];
}

export const listarManutencoes = () => chamar<Manutencao[]>("GET", "manutencaos");

/**
 * GET manutencaos/:id da Progete devolve só os campos simples (sem
 * equipamento, tipo, itens e serviços); a listagem traz tudo aninhado.
 * Por isso a O.S. é lida da listagem.
 */
export async function lerManutencao(id: number): Promise<Manutencao> {
  const m = (await listarManutencoes()).find((x) => x.id === id);
  if (!m) throw new ApiErro(`O.S. nº ${id} não encontrada.`, 404);
  return m;
}

/**
 * Cria (id = null) ou atualiza uma manutenção. A Progete responde 200 também
 * em erro de validação ({ campo: [mensagens] }) — sucesso é ter "id".
 */
export async function salvarManutencao(id: number | null, payload: ManutencaoPayload): Promise<Manutencao> {
  const resp = await chamar<any>(id ? "PATCH" : "POST", id ? `manutencaos/${id}` : "manutencaos", {
    body: { manutencao: payload },
  });
  if (resp && typeof resp.id === "number") return resp as Manutencao;
  if (resp && typeof resp === "object") {
    throw new ApiErro("A Progete recusou os dados.", 422, resp as Record<string, string[]>);
  }
  // PATCH pode responder sem corpo (204): relê o registro
  if (id) return lerManutencao(id);
  throw new ApiErro("Resposta inesperada da Progete.", 502);
}

/* ------------------------------------------------------------------------- */
/* Saída de produtos (produto_saidas)                                         */
/* ------------------------------------------------------------------------- */

/** Cliente usado nas saídas quando o payload não informa outro */
export const CLIENTE_ID_PADRAO = 776;

export interface ProdutoSaidaItem {
  id: number;
  produto_id: number;
  xprod: string | null;
  qcom: number;
  vuncom: number;
}

export interface ProdutoSaida {
  id: number;
  empresa_id: number;
  empresa_usuario_id: number | null;
  produto_saida_tipo_id: number | null;
  produto_saida_fluxo_id: number | null;
  cliente_id: number | null;
  colaborador_id: number | null;
  equipamento_id: number | null;
  veiculo_id: number | null;
  lancamento_centro_custo_id: number | null;
  dhemi: string;
  vserv: number | null;
  vprod: number | null;
  vdesc: number | null;
  voutro: number | null;
  vfrete: number | null;
  finalizado: boolean;
  entregue: boolean;
  liberado: boolean;
  recusado: boolean;
  descprod: string | null;
  descserv: string | null;
  infcancel: string | null;
  infcpl: string | null;
  empresa_usuario?: { id: number; nome: string };
  produto_saida_tipo?: Opcao;
  produto_saida_fluxo?: Opcao;
  colaborador?: Record<string, unknown> | null;
  equipamento?: Record<string, unknown> | null;
  veiculo?: Record<string, unknown> | null;
  lancamento_centro_custo?: Record<string, unknown> | null;
  produto_saida_items?: ProdutoSaidaItem[];
}

/** Corpo de POST/PATCH produto_saidas — exatamente os campos do permit do controller */
export interface ProdutoSaidaPayload {
  empresa_id?: number;
  empresa_usuario_id?: number | null;
  produto_saida_tipo_id?: number | null;
  produto_saida_fluxo_id?: number | null;
  cliente_id?: number | null;
  equipamento_id?: number | null;
  colaborador_id?: number | null;
  veiculo_id?: number | null;
  lancamento_centro_custo_id?: number | null;
  dhemi?: string;
  vserv?: number;
  vprod?: number;
  vdesc?: number;
  voutro?: number;
  vfrete?: number;
  finalizado?: boolean;
  entregue?: boolean;
  liberado?: boolean;
  recusado?: boolean;
  descprod?: string;
  infcancel?: string;
  descserv?: string;
  infcpl?: string;
  produto_saida_items_attributes?: Array<{
    id?: number;
    produto_id?: number;
    xprod?: string;
    qcom?: number;
    vuncom?: number;
    _destroy?: boolean;
  }>;
}

export interface CatalogosSaida {
  empresas: Array<{ id: number; nome_fantasia: string }>;
  tipos: Opcao[];
  fluxos: Opcao[];
  usuarios: Array<{ id: number; nome: string }>;
  equipamentos: Opcao[];
  veiculos: Opcao[];
  centro_custos: Opcao[];
  produtos: Array<Record<string, any> & { id: number; descricao: string }>;
}

/** Uma página da rota de produtos (o cache completo fica em produtosCache.ts) */
export async function buscarPaginaProdutos(page: number, porPagina: number): Promise<any[]> {
  const l = await chamar<any[]>("GET", "produto_saidas/produtos", {
    query: { page: String(page), per_page: String(porPagina) },
  });
  if (!Array.isArray(l)) throw new ApiErro("Resposta inválida da rota de produtos.", 502);
  return l;
}

/**
 * Carrega os cadastros de saída um a um: se uma rota falhar (a Progete tem
 * devolvido 500 em algumas), a lista dela fica vazia e a rota vai em "falhas"
 * em vez de derrubar a tela inteira.
 */
export async function carregarCatalogosSaida(): Promise<{ catalogos: CatalogosSaida; falhas: string[] }> {
  // Produtos não entram aqui: vêm do cache compartilhado (produtosCache.ts)
  const nomes = ["empresas", "tipos", "fluxos", "usuarios", "equipamentos", "veiculos", "centro_custos"] as const;
  const resultados = await Promise.allSettled(
    nomes.map((n) => chamar<any[]>("GET", `produto_saidas/${n}`))
  );
  const catalogos = { produtos: [] } as unknown as CatalogosSaida;
  const falhas: string[] = [];
  resultados.forEach((r, i) => {
    if (r.status === "rejected" && r.reason instanceof ApiErro && r.reason.status === 401) throw r.reason;
    const ok = r.status === "fulfilled" && Array.isArray(r.value);
    if (!ok) {
      falhas.push(`produto_saidas/${nomes[i]} (${r.status === "rejected" ? (r.reason as Error).message : "resposta inválida"})`);
      console.error("[api] GET produto_saidas/" + nomes[i], r.status === "rejected" ? r.reason : r.value);
    }
    (catalogos as any)[nomes[i]] = ok ? (r as PromiseFulfilledResult<any[]>).value : [];
  });
  return { catalogos, falhas };
}

/** A Progete devolve as saídas não liberadas do mês atual, de todas as empresas (até 500 por página) */
export const listarProdutoSaidas = (page = 1) =>
  chamar<ProdutoSaida[]>("GET", "produto_saidas", { query: { page: String(page) } });

/** Todas as páginas da listagem de saídas (500 por página no servidor) */
export async function listarTodasProdutoSaidas(): Promise<ProdutoSaida[]> {
  const todas = new Map<number, ProdutoSaida>();
  let tamanho = 0;
  for (let page = 1; page <= 40; page++) {
    const l = await listarProdutoSaidas(page);
    if (!Array.isArray(l)) break;
    if (page === 1) tamanho = l.length;
    const antes = todas.size;
    l.forEach((x) => todas.set(x.id, x));
    if (!l.length || l.length < tamanho || todas.size === antes) break;
  }
  return [...todas.values()];
}

export const lerProdutoSaida = (id: number) => chamar<ProdutoSaida>("GET", `produto_saidas/${id}`);

/**
 * Cria (id = null) ou atualiza uma saída. Na criação, cliente_id vai como
 * CLIENTE_ID_PADRAO se o payload não trouxer outro. Como em manutencaos, erro
 * de validação volta com 200 ({ campo: [mensagens] }) — sucesso é ter "id".
 */
export async function salvarProdutoSaida(
  id: number | null,
  payload: ProdutoSaidaPayload
): Promise<ProdutoSaida> {
  const corpo = id ? payload : { ...payload, cliente_id: payload.cliente_id ?? CLIENTE_ID_PADRAO };
  const resp = await chamar<any>(id ? "PATCH" : "POST", id ? `produto_saidas/${id}` : "produto_saidas", {
    body: { produto_saida: corpo },
  });
  if (resp && typeof resp.id === "number") return resp as ProdutoSaida;
  if (resp && typeof resp === "object") {
    throw new ApiErro("A Progete recusou os dados.", 422, resp as Record<string, string[]>);
  }
  if (id) return lerProdutoSaida(id);
  throw new ApiErro("Resposta inesperada da Progete.", 502);
}

export const excluirProdutoSaida = (id: number) => chamar<ProdutoSaida>("DELETE", `produto_saidas/${id}`);
