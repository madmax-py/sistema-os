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

export interface Produto extends Opcao {
  produto_unidade_medida_id: number | null;
  custo: number;
}

export interface Catalogos {
  equipamentos: Equipamento[];
  tipos: Opcao[];
  prioridades: Opcao[];
  fluxos: Opcao[];
  areas: Opcao[];
  outros: Opcao[];
  mantenedores: Mantenedor[];
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
  created_at: string;
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
  const [equipamentos, tipos, prioridades, fluxos, areas, outros, mantenedores, produtos, unidades] =
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
    ]);
  return { equipamentos, tipos, prioridades, fluxos, areas, outros, mantenedores, produtos, unidades };
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
