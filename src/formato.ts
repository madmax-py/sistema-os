/** "2026-09-22" → "22/09/2026" */
export function data(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [a, m, d] = iso.slice(0, 10).split("-");
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

/** A Progete devolve horário como "2000-01-01T08:00:00.000-02:00" → "08:00" */
export function hora(valor: string | null | undefined): string {
  if (!valor) return "";
  const m = /T(\d{2}:\d{2})/.exec(valor) ?? /^(\d{2}:\d{2})/.exec(valor);
  return m ? m[1] : "";
}

export function moeda(v: number | null | undefined): string {
  return (v ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Nomes amigáveis dos campos para as mensagens de validação da Progete */
const ROTULOS: Record<string, string> = {
  manutencao_equipamento: "Equipamento",
  manutencao_tipo: "Tipo",
  manutencao_prioridade: "Prioridade",
  manutencao_fluxo: "Fluxo",
  manutencao_area: "Área",
  manutencao_outro: "Outro",
  solicitante: "Solicitante",
  dt_programada: "Data programada",
  dt_finalizada: "Data finalizada",
  "manutencao_items.manutencao_produto": "Material",
  "manutencao_items.dt": "Data do material",
  "manutencao_servicos.manutencao_mantenedor": "Mantenedor",
  "manutencao_servicos.dt_inicio": "Data de início do serviço",
  "manutencao_servicos.dt_termino": "Data de término do serviço",
};

export function mensagensValidacao(erros: Record<string, string[] | string>): string[] {
  return Object.entries(erros).map(([campo, msgs]) => {
    const rotulo = ROTULOS[campo] ?? campo.replace(/_/g, " ");
    return `${rotulo}: ${Array.isArray(msgs) ? msgs.join(", ") : msgs}`;
  });
}
