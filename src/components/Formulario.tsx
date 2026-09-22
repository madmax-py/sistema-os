import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ApiErro,
  lerManutencao,
  salvarManutencao,
  type Catalogos,
  type Manutencao,
  type ManutencaoPayload,
} from "../api";
import { hoje, hora, mensagensValidacao } from "../formato";
import { Abas, type AbaOS } from "./Abas";
import { Secao } from "./Detalhe";
import { IconeCaixa, IconeCalendario, IconeChave, IconeDocumento, IconeFabrica, IconeLixeira, IconeMais } from "./Icones";

interface ItemForm {
  key: string;
  id?: number;
  produtoId: string;
  dt: string;
  qtde: string;
  preco: string;
  nrDoc: string;
  remover?: boolean;
}

interface ServicoForm {
  key: string;
  id?: number;
  mantenedorId: string;
  dtInicio: string;
  hrInicio: string;
  dtTermino: string;
  hrTermino: string;
  atividade: string;
  nrDoc: string;
  vlcusto: string;
  remover?: boolean;
}

interface Cabecalho {
  equipamento: string;
  tipo: string;
  prioridade: string;
  fluxo: string;
  area: string;
  outro: string;
  dtProgramada: string;
  dtFinalizada: string;
  solicitante: string;
  defeito: string;
  ficha: string;
  infad: string;
  recorrente: boolean;
  vezes: string;
  dias: string;
}

let seq = 0;
const novaKey = () => `n${++seq}`;

const novoItem = (dt: string): ItemForm => ({ key: novaKey(), produtoId: "", dt, qtde: "1", preco: "", nrDoc: "" });

const novoServico = (dt: string): ServicoForm => ({
  key: novaKey(),
  mantenedorId: "",
  dtInicio: dt,
  hrInicio: "",
  dtTermino: dt,
  hrTermino: "",
  atividade: "",
  nrDoc: "",
  vlcusto: "",
});

/** Horas entre início e término (para sugerir o custo do serviço) */
function horas(s: ServicoForm): number | null {
  if (!s.dtInicio || !s.dtTermino || !s.hrInicio || !s.hrTermino) return null;
  const ms = Date.parse(`${s.dtTermino}T${s.hrTermino}`) - Date.parse(`${s.dtInicio}T${s.hrInicio}`);
  return ms > 0 ? ms / 3_600_000 : null;
}

function Campo({ rotulo, obrigatorio, largo, children }: {
  rotulo: string;
  obrigatorio?: boolean;
  largo?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={largo ? "largo" : undefined}>
      <span>
        {rotulo}
        {obrigatorio && <b className="obrigatorio"> *</b>}
      </span>
      {children}
    </label>
  );
}

function Select({ value, onChange, opcoes, obrigatorio }: {
  value: string;
  onChange: (v: string) => void;
  opcoes: { id: number; rotulo: string }[];
  obrigatorio?: boolean;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required={obrigatorio}>
      <option value="">Selecione…</option>
      {opcoes.map((o) => (
        <option key={o.id} value={o.id}>
          {o.rotulo}
        </option>
      ))}
    </select>
  );
}

export function Formulario({
  id,
  catalogos,
  solicitantePadrao,
  onSalvo,
  onCancelar,
}: {
  id: number | null;
  catalogos: Catalogos;
  solicitantePadrao: string;
  onSalvo: (id: number) => void;
  onCancelar: () => void;
}) {
  const [cab, setCab] = useState<Cabecalho>({
    equipamento: "",
    tipo: "",
    prioridade: "",
    fluxo: "",
    area: "",
    outro: "",
    dtProgramada: hoje(),
    dtFinalizada: hoje(),
    solicitante: solicitantePadrao,
    defeito: "",
    ficha: "",
    infad: "",
    recorrente: false,
    vezes: "0",
    dias: "0",
  });
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [servicos, setServicos] = useState<ServicoForm[]>([]);
  const [carregando, setCarregando] = useState(id !== null);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const [aba, setAba] = useState<AbaOS>("dados");
  const topo = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Edição: carrega a O.S. existente
  useEffect(() => {
    if (id === null) return;
    lerManutencao(id)
      .then((m: Manutencao) => {
        setCab({
          equipamento: String(m.manutencao_equipamento_id ?? ""),
          tipo: String(m.manutencao_tipo_id ?? ""),
          prioridade: String(m.manutencao_prioridade_id ?? ""),
          fluxo: String(m.manutencao_fluxo_id ?? ""),
          area: String(m.manutencao_area_id ?? ""),
          outro: String(m.manutencao_outro_id ?? ""),
          dtProgramada: m.dt_programada ?? "",
          dtFinalizada: m.dt_finalizada ?? "",
          solicitante: m.solicitante ?? "",
          defeito: m.descricao_defeito ?? "",
          ficha: m.cod_ficha_producao ?? "",
          infad: m.infad ?? "",
          recorrente: !!m.recorrente,
          vezes: String(m.vezes_recorrente ?? 0),
          dias: String(m.dias_recorrente ?? 0),
        });
        setItens(
          (m.manutencao_items ?? []).map((i) => ({
            key: `i${i.id}`,
            id: i.id,
            produtoId: String(i.manutencao_produto_id),
            dt: i.dt,
            qtde: String(i.qtde),
            preco: String(i.preco_unit ?? ""),
            nrDoc: i.nr_doc ?? "",
          }))
        );
        setServicos(
          (m.manutencao_servicos ?? []).map((s) => ({
            key: `s${s.id}`,
            id: s.id,
            mantenedorId: String(s.manutencao_mantenedor_id),
            dtInicio: s.dt_inicio,
            hrInicio: hora(s.hr_inicio),
            dtTermino: s.dt_termino,
            hrTermino: hora(s.hr_termino),
            atividade: s.desc_atividade ?? "",
            nrDoc: s.nr_doc ?? "",
            vlcusto: String(s.vlcusto ?? ""),
          }))
        );
      })
      .catch((e) => setErros([e.message]))
      .finally(() => setCarregando(false));
  }, [id]);

  const set = <K extends keyof Cabecalho>(k: K, v: Cabecalho[K]) => setCab((c) => ({ ...c, [k]: v }));

  const setItem = (key: string, patch: Partial<ItemForm>) =>
    setItens((l) => l.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const setServico = (key: string, patch: Partial<ServicoForm>) =>
    setServicos((l) =>
      l.map((s) => {
        if (s.key !== key) return s;
        const novo = { ...s, ...patch };
        // Sugere o custo: custo/hora do mantenedor × horas trabalhadas
        if (!("vlcusto" in patch)) {
          const custoHora = catalogos.mantenedores.find((m) => String(m.id) === novo.mantenedorId)?.custo_hora;
          const h = horas(novo);
          if (custoHora != null && h != null) novo.vlcusto = (custoHora * h).toFixed(2);
        }
        return novo;
      })
    );

  // Remover: registro novo sai da lista; existente é marcado para _destroy
  const removerItem = (i: ItemForm) =>
    i.id ? setItem(i.key, { remover: !i.remover }) : setItens((l) => l.filter((x) => x.key !== i.key));
  const removerServico = (s: ServicoForm) =>
    s.id ? setServico(s.key, { remover: !s.remover, vlcusto: s.vlcusto }) : setServicos((l) => l.filter((x) => x.key !== s.key));

  const montarPayload = (): ManutencaoPayload => ({
    manutencao_equipamento_id: Number(cab.equipamento),
    manutencao_outro_id: Number(cab.outro),
    manutencao_tipo_id: Number(cab.tipo),
    manutencao_prioridade_id: Number(cab.prioridade),
    manutencao_fluxo_id: Number(cab.fluxo),
    manutencao_area_id: Number(cab.area),
    dt_programada: cab.dtProgramada,
    dt_finalizada: cab.dtFinalizada,
    solicitante: cab.solicitante.trim(),
    descricao_defeito: cab.defeito,
    cod_ficha_producao: cab.ficha,
    infad: cab.infad,
    recorrente: cab.recorrente,
    vezes_recorrente: cab.recorrente ? Number(cab.vezes) || 0 : 0,
    dias_recorrente: cab.recorrente ? Number(cab.dias) || 0 : 0,
    manutencao_items_attributes: itens.map((i) =>
      i.remover
        ? { id: i.id, _destroy: true }
        : {
            ...(i.id ? { id: i.id } : {}),
            manutencao_produto_id: Number(i.produtoId),
            dt: i.dt,
            qtde: Number(i.qtde) || 0,
            preco_unit: Number(i.preco) || 0,
            nr_doc: i.nrDoc,
          }
    ),
    manutencao_servicos_attributes: servicos.map((s) =>
      s.remover
        ? { id: s.id, _destroy: true }
        : {
            ...(s.id ? { id: s.id } : {}),
            manutencao_mantenedor_id: Number(s.mantenedorId),
            dt_inicio: s.dtInicio,
            hr_inicio: s.hrInicio,
            dt_termino: s.dtTermino,
            hr_termino: s.hrTermino,
            desc_atividade: s.atividade,
            nr_doc: s.nrDoc,
            vlcusto: Number(s.vlcusto) || 0,
          }
    ),
  });

  const salvar = async (e: FormEvent) => {
    e.preventDefault();

    // Campos obrigatórios podem estar numa aba escondida: abre a aba do
    // primeiro campo inválido e só então mostra o aviso do navegador
    const invalido = formRef.current?.querySelector<HTMLElement>(":invalid:not(form)");
    if (invalido) {
      const abaDoCampo = invalido.closest<HTMLElement>("[data-aba]")?.dataset.aba as AbaOS | undefined;
      if (abaDoCampo) setAba(abaDoCampo);
      setTimeout(() => (invalido as HTMLInputElement).reportValidity?.(), 0);
      return;
    }

    setErros([]);
    setSalvando(true);
    try {
      const salvo = await salvarManutencao(id, montarPayload());
      onSalvo(salvo.id);
    } catch (err) {
      setErros(err instanceof ApiErro && err.erros ? mensagensValidacao(err.erros) : [(err as Error).message]);
      topo.current?.scrollIntoView({ behavior: "smooth" });
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) return <p className="muted">Carregando…</p>;

  const opc = (l: { id: number; descricao: string }[]) => l.map((x) => ({ id: x.id, rotulo: x.descricao }));
  const unidade = (pid: string) => {
    const uid = catalogos.produtos.find((p) => String(p.id) === pid)?.produto_unidade_medida_id;
    return catalogos.unidades.find((u) => u.id === uid)?.descricao ?? "";
  };

  return (
    <form onSubmit={salvar} noValidate ref={formRef} className="pagina">
      <div className="barra" ref={topo}>
        <h2>
          {id ? `Editar O.S. nº ${id}` : "Nova O.S."}
          <small>Os dados vão direto para a Progete ao salvar.</small>
        </h2>
        <div className="acoes">
          <button type="button" onClick={onCancelar}>
            Cancelar
          </button>
          <button className="primario" type="submit" disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar O.S."}
          </button>
        </div>
      </div>

      {erros.length > 0 && (
        <div className="erro-caixa">
          <b>Não foi possível salvar:</b>
          <ul>
            {erros.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <Abas
        ativa={aba}
        onChange={setAba}
        materiais={itens.filter((i) => !i.remover).length}
        servicos={servicos.filter((x) => !x.remover).length}
      />

      {/* ── Dados gerais ── */}
      <div data-aba="dados" hidden={aba !== "dados"} className="pagina">
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="azul" titulo="Equipamento e classificação">
          <div className="campos">
            <Campo rotulo="Equipamento" obrigatorio largo>
              <Select
                value={cab.equipamento}
                onChange={(v) => set("equipamento", v)}
                obrigatorio
                opcoes={catalogos.equipamentos
                  .filter((e) => e.ativo !== false || String(e.id) === cab.equipamento)
                  .map((e) => ({
                    id: e.id,
                    rotulo: `${e.descricao} · ${e.codigo}${e.localizacao ? ` (${e.localizacao})` : ""}`,
                  }))}
              />
            </Campo>
            <Campo rotulo="Tipo" obrigatorio>
              <Select value={cab.tipo} onChange={(v) => set("tipo", v)} opcoes={opc(catalogos.tipos)} obrigatorio />
            </Campo>
            <Campo rotulo="Prioridade" obrigatorio>
              <Select value={cab.prioridade} onChange={(v) => set("prioridade", v)} opcoes={opc(catalogos.prioridades)} obrigatorio />
            </Campo>
            <Campo rotulo="Fluxo" obrigatorio>
              <Select value={cab.fluxo} onChange={(v) => set("fluxo", v)} opcoes={opc(catalogos.fluxos)} obrigatorio />
            </Campo>
            <Campo rotulo="Área" obrigatorio>
              <Select value={cab.area} onChange={(v) => set("area", v)} opcoes={opc(catalogos.areas)} obrigatorio />
            </Campo>
            <Campo rotulo="Outro" obrigatorio>
              <Select value={cab.outro} onChange={(v) => set("outro", v)} opcoes={opc(catalogos.outros)} obrigatorio />
            </Campo>
          </div>
        </Secao>

        <Secao icone={<IconeCalendario width={18} height={18} />} cor="violeta" titulo="Solicitação e datas">
          <div className="campos">
            <Campo rotulo="Solicitante" obrigatorio>
              <input value={cab.solicitante} onChange={(e) => set("solicitante", e.target.value)} required />
            </Campo>
            <Campo rotulo="Data programada" obrigatorio>
              <input type="date" value={cab.dtProgramada} onChange={(e) => set("dtProgramada", e.target.value)} required />
            </Campo>
            <Campo rotulo="Data finalizada" obrigatorio>
              <input type="date" value={cab.dtFinalizada} onChange={(e) => set("dtFinalizada", e.target.value)} required />
            </Campo>
            <Campo rotulo="Código da ficha de produção">
              <input value={cab.ficha} onChange={(e) => set("ficha", e.target.value)} />
            </Campo>
            <label className="checkbox largo">
              <input type="checkbox" checked={cab.recorrente} onChange={(e) => set("recorrente", e.target.checked)} />
              <span>Manutenção recorrente</span>
            </label>
            {cab.recorrente && (
              <>
                <Campo rotulo="Quantas vezes">
                  <input type="number" min={0} value={cab.vezes} onChange={(e) => set("vezes", e.target.value)} />
                </Campo>
                <Campo rotulo="A cada quantos dias">
                  <input type="number" min={0} value={cab.dias} onChange={(e) => set("dias", e.target.value)} />
                </Campo>
              </>
            )}
          </div>
        </Secao>

        <Secao icone={<IconeDocumento width={18} height={18} />} cor="ambar" titulo="Descrições">
          <div className="campos">
            <Campo rotulo="Descrição do defeito" largo>
              <textarea rows={3} placeholder="O que está acontecendo com o equipamento…" value={cab.defeito} onChange={(e) => set("defeito", e.target.value)} />
            </Campo>
            <Campo rotulo="Informações adicionais" largo>
              <textarea rows={3} placeholder="Observações extras (opcional)…" value={cab.infad} onChange={(e) => set("infad", e.target.value)} />
            </Campo>
          </div>
        </Secao>
      </div>

      {/* ── Materiais ── */}
      <div data-aba="materiais" hidden={aba !== "materiais"}>
        <Secao
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
          titulo="Materiais utilizados"
          acao={
            <button type="button" onClick={() => setItens((l) => [...l, novoItem(cab.dtFinalizada || hoje())])}>
              <IconeMais width={16} height={16} /> Material
            </button>
          }
        >
          {itens.length === 0 && <div className="vazio">Nenhum material. Use “+ Material” para adicionar.</div>}
          {itens.map((i) => (
            <div key={i.key} className={`item-form linha${i.remover ? " removido" : ""}`}>
              <Campo rotulo="Material" obrigatorio largo>
                <Select
                  value={i.produtoId}
                  obrigatorio={!i.remover}
                  onChange={(v) => {
                    const custo = catalogos.produtos.find((p) => String(p.id) === v)?.custo;
                    setItem(i.key, { produtoId: v, ...(custo != null ? { preco: String(custo) } : {}) });
                  }}
                  opcoes={catalogos.produtos.map((p) => ({ id: p.id, rotulo: p.descricao }))}
                />
              </Campo>
              <Campo rotulo="Data" obrigatorio>
                <input type="date" value={i.dt} onChange={(e) => setItem(i.key, { dt: e.target.value })} required={!i.remover} />
              </Campo>
              <Campo rotulo={`Qtde ${unidade(i.produtoId)}`.trim()}>
                <input type="number" step="any" min={0} value={i.qtde} onChange={(e) => setItem(i.key, { qtde: e.target.value })} />
              </Campo>
              <Campo rotulo="Preço unitário">
                <input type="number" step="0.01" min={0} value={i.preco} onChange={(e) => setItem(i.key, { preco: e.target.value })} />
              </Campo>
              <Campo rotulo="Nº documento">
                <input value={i.nrDoc} onChange={(e) => setItem(i.key, { nrDoc: e.target.value })} />
              </Campo>
              <button type="button" className="remover perigo" onClick={() => removerItem(i)}>
                <IconeLixeira width={16} height={16} /> {i.remover ? "Desfazer" : "Remover"}
              </button>
            </div>
          ))}
        </Secao>
      </div>

      {/* ── Serviços ── */}
      <div data-aba="servicos" hidden={aba !== "servicos"}>
        <Secao
          icone={<IconeChave width={18} height={18} />}
          cor="verde"
          titulo="Serviços executados"
          acao={
            <button type="button" onClick={() => setServicos((l) => [...l, novoServico(cab.dtProgramada || hoje())])}>
              <IconeMais width={16} height={16} /> Serviço
            </button>
          }
        >
          {servicos.length === 0 && <div className="vazio">Nenhum serviço. Use “+ Serviço” para adicionar.</div>}
          {servicos.map((s) => (
            <div key={s.key} className={`item-form linha${s.remover ? " removido" : ""}`}>
              <Campo rotulo="Mantenedor" obrigatorio largo>
                <Select
                  value={s.mantenedorId}
                  obrigatorio={!s.remover}
                  onChange={(v) => setServico(s.key, { mantenedorId: v })}
                  opcoes={catalogos.mantenedores.map((m) => ({
                    id: m.id,
                    rotulo: m.cargo ? `${m.nome} — ${m.cargo}` : m.nome,
                  }))}
                />
              </Campo>
              <Campo rotulo="Data início" obrigatorio>
                <input type="date" value={s.dtInicio} onChange={(e) => setServico(s.key, { dtInicio: e.target.value })} required={!s.remover} />
              </Campo>
              <Campo rotulo="Hora início">
                <input type="time" value={s.hrInicio} onChange={(e) => setServico(s.key, { hrInicio: e.target.value })} />
              </Campo>
              <Campo rotulo="Data término" obrigatorio>
                <input type="date" value={s.dtTermino} onChange={(e) => setServico(s.key, { dtTermino: e.target.value })} required={!s.remover} />
              </Campo>
              <Campo rotulo="Hora término">
                <input type="time" value={s.hrTermino} onChange={(e) => setServico(s.key, { hrTermino: e.target.value })} />
              </Campo>
              <Campo rotulo="Atividade" largo>
                <textarea rows={2} placeholder="O que foi feito…" value={s.atividade} onChange={(e) => setServico(s.key, { atividade: e.target.value })} />
              </Campo>
              <Campo rotulo="Custo (R$)">
                <input type="number" step="0.01" min={0} value={s.vlcusto} onChange={(e) => setServico(s.key, { vlcusto: e.target.value })} />
              </Campo>
              <Campo rotulo="Nº documento">
                <input value={s.nrDoc} onChange={(e) => setServico(s.key, { nrDoc: e.target.value })} />
              </Campo>
              <button type="button" className="remover perigo" onClick={() => removerServico(s)}>
                <IconeLixeira width={16} height={16} /> {s.remover ? "Desfazer" : "Remover"}
              </button>
            </div>
          ))}
        </Secao>
      </div>

      <div className="rodape-form">
        <button type="button" onClick={onCancelar}>
          Cancelar
        </button>
        <button className="primario" type="submit" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar O.S."}
        </button>
      </div>
    </form>
  );
}
