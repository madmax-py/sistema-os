import { useEffect, useMemo, useState } from "react";
import { listarManutencoes, nomeUsuario, type Catalogos, type FiltroManutencoes, type Manutencao, type Opcao } from "../api";
import { imprimirLista, imprimirOS } from "../exportar";
import { ExportarExcel } from "./ExportarExcel";
import { data, hoje } from "../formato";
import { IconeAtualizar, IconeBusca, IconeChave, IconeMais, IconePdf, IconePlanilha } from "./Icones";
import { SelectBusca } from "./SelectBusca";

const iso = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

/** Mesmo padrão do servidor: do início do mês anterior ao fim do mês atual */
function filtroPadrao(): Required<FiltroManutencoes> {
  const d = new Date();
  return {
    dataInicio: iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)),
    dataFim: iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    usuarioId: "",
    outroId: "",
    tipoId: "",
    equipamentoId: "",
    fluxoId: "",
    prioridadeId: "",
  };
}

function SelectFiltro({
  rotulo,
  value,
  onChange,
  opcoes,
  vazio,
}: {
  rotulo: string;
  value: string;
  onChange: (v: string) => void;
  opcoes: Opcao[];
  vazio: string;
}) {
  return (
    <label>
      <span>{rotulo}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{vazio}</option>
        {opcoes.map((o) => (
          <option key={o.id} value={o.id}>
            {o.descricao}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Lista({
  catalogos,
  onAbrir,
  onNova,
}: {
  catalogos: Catalogos;
  onAbrir: (id: number) => void;
  onNova: () => void;
}) {
  const [lista, setLista] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [escolherExcel, setEscolherExcel] = useState(false);
  /** filtro aplicado (o que foi buscado) e rascunho (o que está nos campos) */
  const [filtro, setFiltro] = useState(filtroPadrao);
  const [rascunho, setRascunho] = useState(filtroPadrao);
  const [recarga, setRecarga] = useState(0);

  const set = (campo: keyof FiltroManutencoes, v: string) => setRascunho((f) => ({ ...f, [campo]: v }));
  const periodoInvalido = !rascunho.dataInicio || !rascunho.dataFim || rascunho.dataInicio > rascunho.dataFim;
  const padrao = filtroPadrao();
  const chaves = Object.keys(padrao) as Array<keyof FiltroManutencoes>;
  const alterado = chaves.some((k) => rascunho[k] !== padrao[k] || filtro[k] !== padrao[k]);
  const pendente = chaves.some((k) => rascunho[k] !== filtro[k]);

  const carregar = () => setRecarga((n) => n + 1);

  const aplicar = (f: Required<FiltroManutencoes>) => {
    setFiltro(f);
    carregar(); // busca de novo mesmo se o filtro não mudou
  };

  const limpar = () => {
    const f = filtroPadrao();
    setRascunho(f);
    aplicar(f);
  };

  useEffect(() => {
    let ativo = true;
    setErro(null);
    setLista(null);
    listarManutencoes(filtro)
      .then((l) => ativo && setLista([...l].sort((a, b) => b.id - a.id)))
      .catch((e) => ativo && setErro(e.message));
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, recarga]);

  const equipamentos = useMemo(
    () =>
      catalogos.equipamentos.map((e) => ({
        id: e.id,
        rotulo: e.codigo ? `${e.descricao} · ${e.codigo}` : e.descricao,
      })),
    [catalogos.equipamentos]
  );

  const usuarios = useMemo(
    () =>
      catalogos.usuarios
        .map((u) => ({ id: u.id, rotulo: nomeUsuario(u, u.id) }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR")),
    [catalogos.usuarios]
  );

  const descricaoFiltro = useMemo(() => {
    const nome = (l: Opcao[], id: string) => l.find((o) => String(o.id) === id)?.descricao;
    const partes = [
      `${data(filtro.dataInicio)} a ${data(filtro.dataFim)}`,
      filtro.equipamentoId && `equipamento: ${equipamentos.find((e) => String(e.id) === filtro.equipamentoId)?.rotulo}`,
      filtro.usuarioId && `mantenedor interno: ${usuarios.find((u) => String(u.id) === filtro.usuarioId)?.rotulo}`,
      filtro.tipoId && `tipo: ${nome(catalogos.tipos, filtro.tipoId)}`,
      filtro.prioridadeId && `prioridade: ${nome(catalogos.prioridades, filtro.prioridadeId)}`,
      filtro.fluxoId && `fluxo: ${nome(catalogos.fluxos, filtro.fluxoId)}`,
      filtro.outroId && `outro: ${nome(catalogos.outros, filtro.outroId)}`,
      busca.trim() && `busca: "${busca.trim()}"`,
    ];
    return partes.filter(Boolean).join(" · ");
  }, [filtro, busca, catalogos, equipamentos, usuarios]);

  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!lista || !t) return lista;
    return lista.filter((m) =>
      [
        String(m.id),
        m.solicitante,
        m.descricao_defeito,
        m.manutencao_equipamento?.descricao,
        m.manutencao_equipamento?.codigo,
        m.manutencao_tipo?.descricao,
        m.manutencao_fluxo?.descricao,
      ].some((v) => v?.toLowerCase().includes(t))
    );
  }, [lista, busca]);

  const stats = useMemo(() => {
    const h = hoje();
    const mes = h.slice(0, 7);
    return {
      total: filtrada?.length ?? 0,
      mes: filtrada?.filter((m) => m.dt_programada?.startsWith(mes)).length ?? 0,
      hoje: filtrada?.filter((m) => m.dt_programada === h).length ?? 0,
    };
  }, [filtrada]);

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeChave width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Manutenção · Progete</p>
            <h1>Ordens de Serviço</h1>
            <p className="desc">Abertura, acompanhamento e edição das O.S.</p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica azul">
            <b>{stats.total}</b>
            <span>Total</span>
          </div>
          <div className="estatistica ambar">
            <b>{stats.mes}</b>
            <span>Este mês</span>
          </div>
          <div className="estatistica verde">
            <b>{stats.hoje}</b>
            <span>Hoje</span>
          </div>
        </div>
      </div>

      <form
        className="card filtros-os"
        onSubmit={(e) => {
          e.preventDefault();
          if (!periodoInvalido) aplicar(rascunho);
        }}
      >
        <label>
          <span>Programada de</span>
          <input type="date" value={rascunho.dataInicio} max={rascunho.dataFim || undefined} onChange={(e) => set("dataInicio", e.target.value)} />
        </label>
        <label>
          <span>Até</span>
          <input type="date" value={rascunho.dataFim} min={rascunho.dataInicio || undefined} onChange={(e) => set("dataFim", e.target.value)} />
        </label>
        <label>
          <span>Equipamento</span>
          <SelectBusca
            value={rascunho.equipamentoId}
            onChange={(v) => set("equipamentoId", v)}
            opcoes={equipamentos}
            vazio="Todos os equipamentos"
          />
        </label>
        <label>
          <span>Mantenedor interno</span>
          <SelectBusca
            value={rascunho.usuarioId}
            onChange={(v) => set("usuarioId", v)}
            opcoes={usuarios}
            vazio={usuarios.length ? "Todos os mantenedores" : "Nenhum cadastrado"}
          />
        </label>
        <SelectFiltro rotulo="Tipo" value={rascunho.tipoId} onChange={(v) => set("tipoId", v)} opcoes={catalogos.tipos} vazio="Todos os tipos" />
        <SelectFiltro
          rotulo="Prioridade"
          value={rascunho.prioridadeId}
          onChange={(v) => set("prioridadeId", v)}
          opcoes={catalogos.prioridades}
          vazio="Todas as prioridades"
        />
        <SelectFiltro rotulo="Fluxo" value={rascunho.fluxoId} onChange={(v) => set("fluxoId", v)} opcoes={catalogos.fluxos} vazio="Todos os fluxos" />
        <SelectFiltro rotulo="Outro" value={rascunho.outroId} onChange={(v) => set("outroId", v)} opcoes={catalogos.outros} vazio="Todos" />
        <div className="filtros-os-acoes">
          {periodoInvalido && <span className="filtros-os-aviso">A data inicial não pode ser maior que a final.</span>}
          {!periodoInvalido && pendente && <span className="filtros-os-aviso">Filtros alterados — clique em Aplicar.</span>}
          {alterado && (
            <button type="button" onClick={limpar}>
              Limpar
            </button>
          )}
          <button type="submit" className="primario" disabled={periodoInvalido}>
            <IconeBusca width={16} height={16} /> Aplicar filtros
          </button>
        </div>
      </form>

      <div className="barra">
        <div className="campo-busca">
          <IconeBusca />
          <input
            placeholder="Buscar por nº, equipamento, solicitante, tipo…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="acoes">
          <button onClick={carregar}>
            <IconeAtualizar width={16} height={16} /> Atualizar
          </button>
          <button
            onClick={() => filtrada && imprimirLista(filtrada, catalogos, descricaoFiltro)}
            disabled={!filtrada?.length}
            title="Gerar PDF da lista (imprimir ou salvar como PDF)"
          >
            <IconePdf width={16} height={16} /> PDF
          </button>
          <button
            onClick={() => setEscolherExcel(true)}
            disabled={!filtrada?.length}
            title="Baixar planilha .xlsx (padrão ou relatório de atividades)"
          >
            <IconePlanilha width={16} height={16} /> Excel
          </button>
          <button className="primario" onClick={onNova}>
            <IconeMais width={16} height={16} /> Nova O.S.
          </button>
        </div>
      </div>

      {erro && <div className="erro-caixa">{erro}</div>}
      {!lista && !erro && <p className="muted">Carregando…</p>}
      {filtrada && filtrada.length === 0 && <div className="vazio">Nenhuma O.S. encontrada.</div>}

      {filtrada && filtrada.length > 0 && (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Programada</th>
                <th>Situação</th>
                <th>Equipamento</th>
                <th>Tipo</th>
                <th>Prioridade</th>
                <th>Fluxo</th>
                <th>Solicitante</th>
                <th className="col-acao">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((m) => (
                <tr key={m.id} onClick={() => onAbrir(m.id)} className="clicavel">
                  <td className="num">#{m.id}</td>
                  <td>{data(m.dt_programada)}</td>
                  <td>
                    {m.finalizado ? (
                      <span className="pilula verde" title="O.S. liberada: edição bloqueada">Liberada</span>
                    ) : (
                      <span className="pilula ambar">Em aberto</span>
                    )}
                  </td>
                  <td>
                    {m.manutencao_equipamento?.descricao ?? "—"}
                    {m.manutencao_equipamento?.codigo && (
                      <span className="muted"> · {m.manutencao_equipamento.codigo}</span>
                    )}
                  </td>
                  <td>{m.manutencao_tipo?.descricao ?? "—"}</td>
                  <td>
                    {m.manutencao_prioridade ? <span className="pilula">{m.manutencao_prioridade.descricao}</span> : "—"}
                  </td>
                  <td>{m.manutencao_fluxo?.descricao ?? "—"}</td>
                  <td>{m.solicitante}</td>
                  <td className="col-acao">
                    <button
                      className="icone pequeno"
                      onClick={(e) => {
                        e.stopPropagation();
                        imprimirOS(m, catalogos);
                      }}
                      title={`Gerar PDF da O.S. nº ${m.id}`}
                      aria-label={`Gerar PDF da O.S. nº ${m.id}`}
                    >
                      <IconePdf width={16} height={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {escolherExcel && filtrada && (
        <ExportarExcel
          lista={filtrada}
          catalogos={catalogos}
          dataInicio={filtro.dataInicio}
          dataFim={filtro.dataFim}
          onFechar={() => setEscolherExcel(false)}
        />
      )}
    </div>
  );
}
