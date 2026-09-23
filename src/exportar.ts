// Exportação das O.S.: planilha (.xlsx) e PDF (via impressão do navegador).
// Tudo é montado no próprio app — a API da Progete não gera esses arquivos.
import type { Catalogos, Manutencao } from "./api";
import { data, hora, hoje } from "./formato";
import { baixar, gerarXlsx, type Celula, type Planilha } from "./xlsx";

const custoMateriais = (m: Manutencao) =>
  (m.manutencao_items ?? []).reduce((s, i) => s + (i.qtde ?? 0) * (i.preco_unit ?? 0), 0);
const custoServicos = (m: Manutencao) =>
  (m.manutencao_servicos ?? []).reduce((s, x) => s + (x.vlcusto ?? 0), 0);

const horasServico = (s: { dt_inicio: string; hr_inicio: string | null; dt_termino: string; hr_termino: string | null }) => {
  const hi = hora(s.hr_inicio);
  const ht = hora(s.hr_termino);
  if (!s.dt_inicio || !s.dt_termino || !hi || !ht) return 0;
  const h = (Date.parse(`${s.dt_termino}T${ht}`) - Date.parse(`${s.dt_inicio}T${hi}`)) / 3_600_000;
  return h > 0 ? h : 0;
};

const arredondar = (v: number) => Math.round(v * 100) / 100;

function nomes(m: Manutencao, c: Catalogos) {
  const eq = m.manutencao_equipamento ?? c.equipamentos.find((x) => x.id === m.manutencao_equipamento_id);
  const desc = (l: { id: number; descricao: string }[], id: number, aninhado?: { descricao: string }) =>
    aninhado?.descricao ?? l.find((x) => x.id === id)?.descricao ?? "";
  return {
    equipamento: eq?.descricao ?? "",
    codigo: eq?.codigo ?? "",
    localizacao: eq?.localizacao ?? "",
    tipo: desc(c.tipos, m.manutencao_tipo_id, m.manutencao_tipo),
    prioridade: desc(c.prioridades, m.manutencao_prioridade_id, m.manutencao_prioridade),
    fluxo: desc(c.fluxos, m.manutencao_fluxo_id, m.manutencao_fluxo),
    area: desc(c.areas, m.manutencao_area_id, m.manutencao_area),
    outro: desc(c.outros, m.manutencao_outro_id, m.manutencao_outro),
  };
}

/* ------------------------------------------------------------------------- */
/* Planilha (.xlsx)                                                           */
/* ------------------------------------------------------------------------- */

export function planilhasDasOS(lista: Manutencao[], c: Catalogos): Planilha[] {
  const os: Celula[][] = [
    [
      "Nº", "Programada", "Finalizada", "Equipamento", "Código", "Localização", "Tipo", "Prioridade",
      "Fluxo", "Área", "Outro", "Solicitante", "Descrição do defeito", "Informações adicionais",
      "Ficha de produção", "Recorrente", "Materiais", "Custo materiais (R$)", "Serviços", "Horas",
      "Custo serviços (R$)", "Custo total (R$)", "Criada em",
    ],
  ];
  const materiais: Celula[][] = [["O.S.", "Equipamento", "Material", "Unidade", "Data", "Qtde", "Preço unit. (R$)", "Total (R$)", "Nº doc"]];
  const servicos: Celula[][] = [["O.S.", "Equipamento", "Mantenedor", "Início", "Hora início", "Término", "Hora término", "Horas", "Custo (R$)", "Atividade", "Nº doc"]];

  for (const m of [...lista].sort((a, b) => a.id - b.id)) {
    const n = nomes(m, c);
    const itens = m.manutencao_items ?? [];
    const servs = m.manutencao_servicos ?? [];
    const cm = custoMateriais(m);
    const cs = custoServicos(m);
    const horas = servs.reduce((s, x) => s + horasServico(x), 0);

    os.push([
      m.id, data(m.dt_programada), data(m.dt_finalizada), n.equipamento, n.codigo, n.localizacao, n.tipo,
      n.prioridade, n.fluxo, n.area, n.outro, m.solicitante ?? "", m.descricao_defeito ?? "", m.infad ?? "",
      m.cod_ficha_producao ?? "", m.recorrente ? "Sim" : "Não", itens.length, arredondar(cm), servs.length,
      arredondar(horas), arredondar(cs), arredondar(cm + cs),
      m.created_at ? `${data(m.created_at.slice(0, 10))} ${m.created_at.slice(11, 16)}` : "",
    ]);

    for (const i of itens) {
      const p = c.produtos.find((x) => x.id === i.manutencao_produto_id);
      materiais.push([
        m.id, n.equipamento, p?.descricao ?? `#${i.manutencao_produto_id}`,
        c.unidades.find((u) => u.id === p?.produto_unidade_medida_id)?.descricao ?? "",
        data(i.dt), i.qtde ?? 0, arredondar(i.preco_unit ?? 0), arredondar((i.qtde ?? 0) * (i.preco_unit ?? 0)), i.nr_doc ?? "",
      ]);
    }

    for (const s of servs) {
      servicos.push([
        m.id, n.equipamento, c.mantenedores.find((x) => x.id === s.manutencao_mantenedor_id)?.nome ?? `#${s.manutencao_mantenedor_id}`,
        data(s.dt_inicio), hora(s.hr_inicio), data(s.dt_termino), hora(s.hr_termino),
        arredondar(horasServico(s)), arredondar(s.vlcusto ?? 0), s.desc_atividade ?? "", s.nr_doc ?? "",
      ]);
    }
  }

  return [
    { nome: "Ordens de Serviço", linhas: os },
    { nome: "Materiais", linhas: materiais },
    { nome: "Serviços", linhas: servicos },
  ];
}

export function exportarXlsx(lista: Manutencao[], c: Catalogos) {
  baixar(gerarXlsx(planilhasDasOS(lista, c)), `ordens-de-servico-${hoje()}.xlsx`);
}

/* ------------------------------------------------------------------------- */
/* PDF (impressão do navegador)                                               */
/* ------------------------------------------------------------------------- */

const esc = (t: unknown) =>
  String(t ?? "").replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);

const moedaBR = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const horasBR = (h: number) => {
  const t = Math.round(h * 60);
  return t % 60 ? `${Math.floor(t / 60)}h${String(t % 60).padStart(2, "0")}` : `${Math.floor(t / 60)}h`;
};

const ESTILO = `
  @page { size: A4; margin: 14mm 12mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font: 11px/1.45 "Inter", system-ui, sans-serif; color: #17181e; }
  header { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding-bottom: 10px; border-bottom: 2px solid #00afef; }
  header img { height: 30px; }
  header .tit { text-align: right; }
  header h1 { margin: 0; font-size: 16px; }
  header p { margin: 2px 0 0; font-size: 10px; color: #6c757d; }
  h2 { margin: 16px 0 6px; font-size: 12px; color: #1c84c6; text-transform: uppercase; letter-spacing: 0.06em; }
  .grade { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px 14px; }
  .campo { border-bottom: 1px solid #e7e9eb; padding-bottom: 4px; }
  .campo.largo { grid-column: 1 / -1; }
  .campo span { display: block; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.06em; color: #8a969c; }
  .campo b { font-weight: 600; white-space: pre-wrap; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 6px; text-align: left; border-bottom: 1px solid #e7e9eb; vertical-align: top; }
  th { background: #1c84c6; color: #fff; font-size: 9px; text-transform: uppercase; letter-spacing: 0.04em; }
  tfoot td { font-weight: 700; border-top: 2px solid #1c84c6; }
  .num { text-align: right; white-space: nowrap; }
  .totais { margin-top: 14px; display: flex; gap: 10px; }
  .total { flex: 1; border: 1px solid #e7e9eb; border-radius: 6px; padding: 8px 10px; }
  .total span { display: block; font-size: 8.5px; text-transform: uppercase; color: #8a969c; }
  .total b { font-size: 13px; }
  .assinaturas { margin-top: 28px; display: flex; gap: 40px; }
  .assinatura { flex: 1; border-top: 1px solid #8a969c; padding-top: 4px; font-size: 9px; color: #6c757d; text-align: center; }
  footer { margin-top: 18px; font-size: 8.5px; color: #8a969c; text-align: center; }
  tr, .campo { break-inside: avoid; }
  thead { display: table-header-group; }
`;

/** Documento completo pronto para impressão (separado para poder ser inspecionado/testado) */
function documento(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>${corpo}</body></html>`;
}

function imprimir(html: string) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  iframe.srcdoc = html;
  iframe.onload = () => {
    const janela = iframe.contentWindow;
    if (!janela) return;
    const encerrar = () => setTimeout(() => iframe.remove(), 500);
    janela.addEventListener("afterprint", encerrar);
    // Espera as imagens (logo) para não imprimir com espaço em branco
    const imgs = [...iframe.contentDocument!.images].filter((i) => !i.complete);
    Promise.all(imgs.map((i) => new Promise((r) => { i.onload = i.onerror = r; })))
      .then(() => {
        janela.focus();
        janela.print();
        setTimeout(encerrar, 60000); // navegadores sem "afterprint"
      });
  };
  document.body.append(iframe);
}

const cabecalho = (titulo: string, subtitulo: string) => `
  <header>
    <img src="/profinancas-logo.png" alt="ProFinanças">
    <div class="tit"><h1>${esc(titulo)}</h1><p>${esc(subtitulo)}</p></div>
  </header>`;

const rodape = () =>
  `<footer>Gerado pelo Sistema O.S. · ProFinanças em ${new Date().toLocaleString("pt-BR")}</footer>`;

const campo = (rotulo: string, valor: unknown, largo = false) =>
  `<div class="campo${largo ? " largo" : ""}"><span>${esc(rotulo)}</span><b>${esc(valor) || "—"}</b></div>`;

/** Ficha completa de uma O.S., com materiais, serviços e assinaturas */
export function htmlDaOS(m: Manutencao, c: Catalogos): string {
  const n = nomes(m, c);
  const itens = m.manutencao_items ?? [];
  const servs = m.manutencao_servicos ?? [];
  const cm = custoMateriais(m);
  const cs = custoServicos(m);
  const horas = servs.reduce((s, x) => s + horasServico(x), 0);

  const tabelaMateriais = itens.length
    ? `<table><thead><tr><th>Material</th><th>Data</th><th class="num">Qtde</th><th class="num">Preço unit.</th><th class="num">Total</th><th>Nº doc</th></tr></thead><tbody>${itens
        .map((i) => {
          const p = c.produtos.find((x) => x.id === i.manutencao_produto_id);
          const un = c.unidades.find((u) => u.id === p?.produto_unidade_medida_id)?.descricao ?? "";
          return `<tr><td>${esc(p?.descricao ?? `#${i.manutencao_produto_id}`)}</td><td>${data(i.dt)}</td><td class="num">${esc(i.qtde)} ${esc(un)}</td><td class="num">${moedaBR(i.preco_unit ?? 0)}</td><td class="num">${moedaBR((i.qtde ?? 0) * (i.preco_unit ?? 0))}</td><td>${esc(i.nr_doc)}</td></tr>`;
        })
        .join("")}</tbody><tfoot><tr><td colspan="4">Total de materiais</td><td class="num">${moedaBR(cm)}</td><td></td></tr></tfoot></table>`
    : `<p>Nenhum material registrado.</p>`;

  const tabelaServicos = servs.length
    ? `<table><thead><tr><th>Mantenedor</th><th>Início</th><th>Término</th><th class="num">Horas</th><th>Atividade</th><th class="num">Custo</th></tr></thead><tbody>${servs
        .map(
          (s) =>
            `<tr><td>${esc(c.mantenedores.find((x) => x.id === s.manutencao_mantenedor_id)?.nome ?? `#${s.manutencao_mantenedor_id}`)}</td><td>${data(s.dt_inicio)} ${hora(s.hr_inicio)}</td><td>${data(s.dt_termino)} ${hora(s.hr_termino)}</td><td class="num">${horasBR(horasServico(s))}</td><td>${esc(s.desc_atividade)}</td><td class="num">${moedaBR(s.vlcusto ?? 0)}</td></tr>`
        )
        .join("")}</tbody><tfoot><tr><td colspan="3">Total de serviços</td><td class="num">${horasBR(horas)}</td><td></td><td class="num">${moedaBR(cs)}</td></tr></tfoot></table>`
    : `<p>Nenhum serviço registrado.</p>`;

  return documento(
    `O.S. ${m.id}`,
    `${cabecalho(`Ordem de Serviço nº ${m.id}`, `${n.equipamento || "Equipamento"} · programada para ${data(m.dt_programada)}`)}
    <h2>Equipamento e classificação</h2>
    <div class="grade">
      ${campo("Equipamento", [n.equipamento, n.codigo].filter(Boolean).join(" · "))}
      ${campo("Localização", n.localizacao)}
      ${campo("Tipo", n.tipo)}
      ${campo("Prioridade", n.prioridade)}
      ${campo("Fluxo", n.fluxo)}
      ${campo("Área", n.area)}
      ${campo("Outro", n.outro)}
      ${campo("Solicitante", m.solicitante)}
      ${campo("Ficha de produção", m.cod_ficha_producao)}
      ${campo("Data programada", data(m.dt_programada))}
      ${campo("Data finalizada", data(m.dt_finalizada))}
      ${campo("Recorrente", m.recorrente ? `Sim — ${m.vezes_recorrente}x a cada ${m.dias_recorrente} dias` : "Não")}
      ${campo("Descrição do defeito", m.descricao_defeito, true)}
      ${campo("Informações adicionais", m.infad, true)}
    </div>
    <h2>Materiais</h2>${tabelaMateriais}
    <h2>Serviços</h2>${tabelaServicos}
    <div class="totais">
      <div class="total"><span>Materiais</span><b>${moedaBR(cm)}</b></div>
      <div class="total"><span>Serviços</span><b>${moedaBR(cs)}</b></div>
      <div class="total"><span>Horas trabalhadas</span><b>${horasBR(horas)}</b></div>
      <div class="total"><span>Custo total</span><b>${moedaBR(cm + cs)}</b></div>
    </div>
    <div class="assinaturas">
      <div class="assinatura">Responsável pela manutenção</div>
      <div class="assinatura">Solicitante</div>
    </div>
    ${rodape()}`
  );
}

/** PDF de uma O.S. */
export const imprimirOS = (m: Manutencao, c: Catalogos) => imprimir(htmlDaOS(m, c));

/** PDF da lista de O.S. (o que estiver filtrado na tela) */
export function htmlDaLista(lista: Manutencao[], c: Catalogos, descricaoFiltro?: string): string {
  const ordenada = [...lista].sort((a, b) => b.id - a.id);
  const totalGeral = ordenada.reduce((s, m) => s + custoMateriais(m) + custoServicos(m), 0);

  const linhas = ordenada
    .map((m) => {
      const n = nomes(m, c);
      const total = custoMateriais(m) + custoServicos(m);
      return `<tr><td class="num">${m.id}</td><td>${data(m.dt_programada)}</td><td>${esc([n.equipamento, n.codigo].filter(Boolean).join(" · "))}</td><td>${esc(n.tipo)}</td><td>${esc(n.prioridade)}</td><td>${esc(n.fluxo)}</td><td>${esc(m.solicitante)}</td><td class="num">${moedaBR(total)}</td></tr>`;
    })
    .join("");

  return documento(
    "Ordens de serviço",
    `${cabecalho("Ordens de Serviço", `${ordenada.length} O.S.${descricaoFiltro ? ` · ${descricaoFiltro}` : ""}`)}
    <h2>Lista</h2>
    ${
      ordenada.length
        ? `<table><thead><tr><th class="num">Nº</th><th>Programada</th><th>Equipamento</th><th>Tipo</th><th>Prioridade</th><th>Fluxo</th><th>Solicitante</th><th class="num">Custo</th></tr></thead><tbody>${linhas}</tbody><tfoot><tr><td colspan="7">Total (${ordenada.length} O.S.)</td><td class="num">${moedaBR(totalGeral)}</td></tr></tfoot></table>`
        : "<p>Nenhuma O.S. para listar.</p>"
    }
    ${rodape()}`
  );
}

/** PDF da lista (o que estiver filtrado na tela) */
export const imprimirLista = (lista: Manutencao[], c: Catalogos, descricaoFiltro?: string) =>
  imprimir(htmlDaLista(lista, c, descricaoFiltro));
