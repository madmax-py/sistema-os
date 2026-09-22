// =========================================================================
// Função serverless (Vercel) — repassa as chamadas do navegador para a API
// da Progete. Existe só porque a Progete não libera CORS. Não guarda
// credenciais: o JWT de cada usuário chega no header Authorization e segue
// igual para a Progete.
//
// POST /api/progete   { base, method, path, query?, body? }
//   base: origem escolhida na tela de conexão (ex.: https://teste.progete.com.br)
//   → faz `method {base}/api/v1/{path}?{query}` e devolve status + corpo
//   path "status" → GET {base}/api/v1.json (verificação da conexão)
//
// GET /api/progete → { fixo }: domínio definido em PROGETE_URL, ou null
//
// Com PROGETE_URL definida, o domínio é fixo: o "base" do navegador é
// ignorado e o app pula a tela de conexão. Sem ela, só aceita domínios
// permitidos (*.progete.com.br + env PROGETE_HOSTS). Em todos os casos só
// as rotas da lista ROTAS — não é um proxy aberto.
// Em desenvolvimento, o vite.config.ts serve esta mesma função.
// =========================================================================

/** Domínio fixo (ex.: "https://teste.progete.com.br"); aceita também a URL com /api/v1 */
function dominioFixo(): string | null {
  const valor = process.env.PROGETE_URL?.trim();
  if (!valor) return null;
  try {
    return new URL(/^https?:\/\//i.test(valor) ? valor : `https://${valor}`).origin;
  } catch {
    console.error("[api/progete] PROGETE_URL inválida:", valor);
    return null;
  }
}

/**
 * Hosts extras permitidos, separados por vírgula (ex.: "192.168.1.6:3000").
 * Esses aceitam http; os *.progete.com.br só https.
 */
const HOSTS_EXTRAS = (process.env.PROGETE_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);

const CATALOGOS = "equipamentos|tipos|prioridades|fluxos|areas|outros|mantenedores|produtos";

const ROTAS: Array<[RegExp, string[]]> = [
  [/^status$/, ["GET"]],
  [/^auth\/authenticate$/, ["POST"]],
  [/^manutencaos$/, ["GET", "POST"]],
  [/^manutencaos\/\d+$/, ["GET", "PATCH"]],
  [new RegExp(`^manutencaos/(${CATALOGOS})$`), ["GET"]],
  [/^produto_unidade_medidas$/, ["GET"]],
];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Valida a origem pedida; devolve a origem normalizada ou null se não permitida */
function origemPermitida(base: string): string | null {
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  if (url.username || url.password) return null;
  const host = url.host.toLowerCase(); // inclui porta
  const progete = url.hostname === "progete.com.br" || url.hostname.endsWith(".progete.com.br");
  if (progete && url.protocol === "https:" && !url.port) return url.origin;
  if (HOSTS_EXTRAS.includes(host) && (url.protocol === "https:" || url.protocol === "http:")) return url.origin;
  return null;
}

export async function GET(): Promise<Response> {
  // Configuração pública: se houver domínio fixo, o app pula a tela de conexão
  return json(200, { fixo: dominioFixo() });
}

export async function POST(request: Request): Promise<Response> {
  let req: { base?: string; method?: string; path?: string; query?: Record<string, string>; body?: unknown };
  try {
    req = await request.json();
  } catch {
    return json(400, { erro: "JSON inválido" });
  }

  const origem = dominioFixo() ?? origemPermitida(String(req.base ?? ""));
  if (!origem) {
    return json(403, {
      erro: "Domínio não permitido. Use um endereço https://*.progete.com.br.",
      codigo: "dominio_nao_permitido",
    });
  }

  const method = String(req.method ?? "").toUpperCase();
  const path = String(req.path ?? "");
  if (!ROTAS.some(([re, metodos]) => re.test(path) && metodos.includes(method))) {
    return json(403, { erro: `Rota não permitida: ${method} ${path}` });
  }

  const destino = path === "status" ? `${origem}/api/v1.json` : `${origem}/api/v1/${path}`;
  const qs = req.query ? `?${new URLSearchParams(req.query)}` : "";
  const auth = request.headers.get("authorization");

  try {
    const resp = await fetch(`${destino}${qs}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(auth ? { Authorization: auth } : {}),
        ...(req.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      redirect: "manual", // não seguir redirecionamentos para fora do domínio validado
      signal: AbortSignal.timeout(path === "status" ? 10000 : 25000),
    });
    const texto = await resp.text();
    return new Response(texto || "null", {
      status: resp.status,
      headers: {
        "Content-Type": resp.headers.get("content-type") ?? "application/json",
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[api/progete]", destino, e);
    return json(502, { erro: "Não foi possível conectar a esse domínio.", codigo: "sem_conexao" });
  }
}
