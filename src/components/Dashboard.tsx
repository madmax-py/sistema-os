import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listarManutencoes, type Catalogos, type Manutencao } from "../api";
import {
  calcular,
  FILTRO_VAZIO,
  SEM_USUARIO,
  usuariosDasOS,
  type Contagem,
  type Filtro,
  type Periodo,
} from "../dashboard";
import { data, moeda } from "../formato";
import { Secao } from "./Detalhe";
import {
  IconeAtualizar,
  IconeCaixa,
  IconeCalendario,
  IconeChave,
  IconeDocumento,
  IconeFabrica,
  IconeLista,
  IconeGrafico,
  IconeAlerta,
  IconeUsuarios,
} from "./Icones";

/* ------------------------------------------------------------------------- */
/* Formatação                                                                 */
/* ------------------------------------------------------------------------- */

const num = (v: number, casas = 0) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
const horasFmt = (h: number) => {
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return mm ? `${hh}h${String(mm).padStart(2, "0")}` : `${hh}h`;
};
const moedaCurta = (v: number) =>
  v >= 1000 ? `R$ ${num(v / 1000, 1)} mil` : moeda(v);
const pct = (parte: number, todo: number) => (todo ? Math.round((parte / todo) * 100) : 0);

const PERIODOS: { id: Periodo; rotulo: string }[] = [
  { id: "todos", rotulo: "Todo o período" },
  { id: "30d", rotulo: "Últimos 30 dias" },
  { id: "90d", rotulo: "Últimos 90 dias" },
  { id: "12m", rotulo: "Últimos 12 meses" },
  { id: "ano", rotulo: "Este ano" },
];

/* ------------------------------------------------------------------------- */
/* Peças                                                                      */
/* ------------------------------------------------------------------------- */

function Tile({ rotulo, valor, detalhe, icone, cor }: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  icone: ReactNode;
  cor: string;
}) {
  return (
    <div className="card tile">
      <div className="tile-topo">
        <span className="tile-rotulo">{rotulo}</span>
        <span className={`chip ${cor}`}>{icone}</span>
      </div>
      <div className="tile-valor">{valor}</div>
      {detalhe && <div className="tile-detalhe">{detalhe}</div>}
    </div>
  );
}

/** Barras horizontais de uma série (ranking). Valor na ponta; dica ao passar o mouse. */
function BarrasH({ dados, formato = (v) => num(v), limite = 8, vazio = "Sem dados no período." }: {
  dados: Contagem[];
  formato?: (v: number) => string;
  limite?: number;
  vazio?: string;
}) {
  if (!dados.length) return <div className="vazio">{vazio}</div>;
  const visiveis = dados.slice(0, limite);
  const resto = dados.slice(limite);
  const linhas = resto.length
    ? [...visiveis, { rotulo: `Outros (${resto.length})`, valor: resto.reduce((s, x) => s + x.valor, 0) }]
    : visiveis;
  const max = Math.max(...linhas.map((x) => x.valor), 0) || 1;
  const total = dados.reduce((s, x) => s + x.valor, 0);
  return (
    <div className="barras-h" role="list">
      {linhas.map((x) => (
        <div
          key={x.rotulo}
          className="barra-h dica"
          role="listitem"
          tabIndex={0}
          data-dica={`${x.rotulo}: ${formato(x.valor)} (${pct(x.valor, total)}%)`}
        >
          <span className="barra-h-rotulo" title={x.rotulo}>
            {x.rotulo}
          </span>
          <span className="barra-h-trilho">
            <span className="barra-h-marca" style={{ width: `${Math.max((x.valor / max) * 100, 1.5)}%` }} />
          </span>
          <span className="barra-h-valor">{formato(x.valor)}</span>
        </div>
      ))}
    </div>
  );
}

/** Classe para alinhar a dica das colunas das pontas para dentro */
const ponta = (i: number, n: number) => (n > 3 && i < 2 ? " ini" : n > 3 && i >= n - 2 ? " fim" : "");

/** Colunas de uma série ao longo do tempo/categorias. */
function Colunas({ dados, formato = (v) => num(v) }: { dados: Contagem[]; formato?: (v: number) => string }) {
  const max = Math.max(...dados.map((x) => x.valor), 0) || 1;
  const rotularTodas = dados.length <= 12;
  const iMax = dados.findIndex((x) => x.valor === max);
  const passo = Math.ceil(dados.length / 12);
  return (
    <div className="colunas">
      {dados.map((x, i) => (
        <div
          key={x.rotulo}
          className={`coluna dica${ponta(i, dados.length)}`}
          tabIndex={0}
          data-dica={`${x.rotulo}: ${formato(x.valor)}`}
        >
          <span className="coluna-valor">{(rotularTodas || i === iMax) && x.valor > 0 ? formato(x.valor) : ""}</span>
          <span className="coluna-trilho">
            <span className="coluna-marca" style={{ height: `${x.valor ? Math.max((x.valor / max) * 100, 2) : 0}%` }} />
          </span>
          <span className="coluna-rotulo">{i % passo === 0 ? x.rotulo : ""}</span>
        </div>
      ))}
    </div>
  );
}

interface Serie {
  rotulo: string;
  /** valor de cada ponto (mesma ordem de `pontos`) */
  valores: number[];
}

/** Colunas empilhadas de duas séries (s1 embaixo, s2 em cima), com legenda. */
function Empilhado({ pontos, s1, s2, formato, formatoCurto = formato }: {
  pontos: { chave: string; rotulo: string }[];
  s1: Serie;
  s2: Serie;
  formato: (v: number) => string;
  formatoCurto?: (v: number) => string;
}) {
  const totais = pontos.map((_, i) => s1.valores[i] + s2.valores[i]);
  const max = Math.max(...totais, 0) || 1;
  const rotularTodas = pontos.length <= 12;
  const passo = Math.ceil(pontos.length / 12);
  return (
    <>
      <div className="legenda">
        <span><i className="amostra s1" /> {s1.rotulo}</span>
        <span><i className="amostra s2" /> {s2.rotulo}</span>
      </div>
      <div className="colunas">
        {pontos.map((p, i) => {
          const a = s1.valores[i];
          const b = s2.valores[i];
          const total = totais[i];
          return (
            <div
              key={p.chave}
              className={`coluna dica${ponta(i, pontos.length)}`}
              tabIndex={0}
              data-dica={`${p.rotulo} — ${s1.rotulo} ${formato(a)} · ${s2.rotulo} ${formato(b)} · Total ${formato(total)}`}
            >
              <span className="coluna-valor">{rotularTodas && total > 0 ? formatoCurto(total) : ""}</span>
              <span className="coluna-trilho">
                <span className="coluna-pilha" style={{ height: `${total ? Math.max((total / max) * 100, 2) : 0}%` }}>
                  {b > 0 && <span className="seg s2" style={{ flexGrow: b }} />}
                  {a > 0 && <span className="seg s1" style={{ flexGrow: a }} />}
                </span>
              </span>
              <span className="coluna-rotulo">{i % passo === 0 ? p.rotulo : ""}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Barra 100% dividida entre duas partes */
function Divisao({ partes, formato, sufixo, vazio }: {
  partes: [{ rotulo: string; valor: number }, { rotulo: string; valor: number }];
  formato: (v: number) => string;
  sufixo: string;
  vazio: string;
}) {
  const total = partes[0].valor + partes[1].valor;
  if (!total) return <div className="vazio">{vazio}</div>;
  return (
    <div className="divisao">
      <div className="divisao-barra">
        {partes.map(
          (p, i) =>
            p.valor > 0 && (
              <span
                key={p.rotulo}
                className={`seg s${i + 1} dica`}
                tabIndex={0}
                style={{ flexGrow: p.valor }}
                data-dica={`${p.rotulo}: ${formato(p.valor)}`}
              />
            )
        )}
      </div>
      <div className="divisao-legenda">
        {partes.map((p, i) => (
          <div key={p.rotulo}>
            <span><i className={`amostra s${i + 1}`} /> {p.rotulo}</span>
            <b>{formato(p.valor)}</b>
            <small>{pct(p.valor, total)}% {sufixo}</small>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function Dashboard({ catalogos, onAbrir }: { catalogos: Catalogos; onAbrir: (id: number) => void }) {
  const [lista, setLista] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(FILTRO_VAZIO);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = () => {
    setErro(null);
    listarManutencoes()
      .then((l) => {
        setLista(l);
        setAtualizadoEm(new Date());
      })
      .catch((e) => setErro(e.message));
  };
  useEffect(carregar, []);

  const usuarios = useMemo(() => usuariosDasOS(lista ?? [], catalogos), [lista, catalogos]);
  const ind = useMemo(() => (lista ? calcular(lista, catalogos, filtro) : null), [lista, catalogos, filtro]);

  if (erro) return <div className="erro-caixa">{erro}</div>;
  if (!ind) return <p className="muted">Calculando indicadores…</p>;

  const filtrado = filtro.periodo !== "todos" || filtro.tipoId || filtro.equipamentoId || filtro.usuarioId;
  const variacao = ind.mesAtual - ind.mesAnterior;
  const problemas = ind.qualidade.reduce((s, q) => s + q.valor, 0);
  const maxHorasMant = Math.max(...ind.mantenedores.map((m) => m.horas), 0) || 1;
  const maxHorasLocal = Math.max(...ind.mantenedoresLocais.map((m) => m.horas), 0) || 1;
  const maxCustoMat = Math.max(...ind.materiais.map((m) => m.custo), 0) || 1;

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeGrafico width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Manutenção · Indicadores</p>
            <h1>Painel de Indicadores</h1>
            <p className="desc">
              {PERIODOS.find((p) => p.id === filtro.periodo)?.rotulo}
              {atualizadoEm && ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica azul">
            <b>{ind.total}</b>
            <span>O.S.</span>
          </div>
          <div className="estatistica ambar">
            <b>{moedaCurta(ind.custoTotal)}</b>
            <span>Custo</span>
          </div>
          <div className="estatistica verde">
            <b>{horasFmt(ind.horas)}</b>
            <span>Horas</span>
          </div>
        </div>
      </div>

      {/* Filtros — uma linha acima de tudo */}
      <div className="card filtros">
        <label>
          <span>Período</span>
          <select value={filtro.periodo} onChange={(e) => setFiltro({ ...filtro, periodo: e.target.value as Periodo })}>
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={filtro.tipoId} onChange={(e) => setFiltro({ ...filtro, tipoId: e.target.value })}>
            <option value="">Todos os tipos</option>
            {catalogos.tipos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.descricao}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Equipamento</span>
          <select value={filtro.equipamentoId} onChange={(e) => setFiltro({ ...filtro, equipamentoId: e.target.value })}>
            <option value="">Todos os equipamentos</option>
            {catalogos.equipamentos.map((e) => (
              <option key={e.id} value={e.id}>
                {e.descricao} · {e.codigo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Mantenedor interno</span>
          <select value={filtro.usuarioId} onChange={(e) => setFiltro({ ...filtro, usuarioId: e.target.value })}>
            <option value="">Todos os mantenedores</option>
            <option value={SEM_USUARIO}>Sem mantenedor interno</option>
            {usuarios.map((u) => (
              <option key={u.id} value={u.id}>
                {u.rotulo}
              </option>
            ))}
          </select>
        </label>
        <div className="filtros-acoes">
          {filtrado && (
            <button type="button" onClick={() => setFiltro(FILTRO_VAZIO)}>
              Limpar
            </button>
          )}
          <button type="button" onClick={carregar}>
            <IconeAtualizar width={16} height={16} /> Atualizar
          </button>
        </div>
      </div>

      {/* Números principais */}
      <div className="tiles">
        <Tile
          rotulo="Ordens de serviço"
          valor={num(ind.total)}
          detalhe={filtrado ? `de ${num(ind.totalGeral)} no total` : `${num(ind.hoje)} programada(s) para hoje`}
          icone={<IconeLista width={18} height={18} />}
          cor="azul"
        />
        <Tile
          rotulo="Este mês"
          valor={num(ind.mesAtual)}
          detalhe={
            <span className={variacao > 0 ? "sobe" : variacao < 0 ? "desce" : undefined}>
              {variacao === 0 ? "igual ao" : `${variacao > 0 ? "▲" : "▼"} ${num(Math.abs(variacao))} vs.`} mês anterior ({num(ind.mesAnterior)})
            </span>
          }
          icone={<IconeCalendario width={18} height={18} />}
          cor="violeta"
        />
        <Tile
          rotulo="Custo total"
          valor={moeda(ind.custoTotal)}
          detalhe={`Materiais ${moedaCurta(ind.custoMateriais)} · Terceiros ${moedaCurta(ind.custoServicos)}`}
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Custo médio por O.S."
          valor={moeda(ind.custoMedio)}
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Horas trabalhadas"
          valor={horasFmt(ind.horas)}
          detalhe={`Locais ${horasFmt(ind.horasLocais)} · Terceiros ${horasFmt(ind.horasTerceiros)} · média ${horasFmt(ind.horasMediasPorOS)} por O.S.`}
          icone={<IconeChave width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Horas locais"
          valor={horasFmt(ind.horasLocais)}
          detalhe={`${num(ind.osComExecucao)} O.S. com execução interna (${pct(ind.horasLocais, ind.horas)}% das horas)`}
          icone={<IconeUsuarios width={18} height={18} />}
          cor="azul"
        />
        <Tile
          rotulo="Horas de terceiros"
          valor={horasFmt(ind.horasTerceiros)}
          detalhe={`${num(ind.qtdServicos)} serviço(s) · ${moedaCurta(ind.custoServicos)} (${pct(ind.horasTerceiros, ind.horas)}% das horas)`}
          icone={<IconeChave width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Prazo médio"
          valor={ind.diasMedios === null ? "—" : `${num(ind.diasMedios, 1)} dia(s)`}
          detalhe="da data programada à finalizada"
          icone={<IconeCalendario width={18} height={18} />}
          cor="violeta"
        />
        <Tile
          rotulo="Equipamentos atendidos"
          valor={num(ind.equipamentosAtendidos)}
          detalhe={`de ${num(ind.equipamentosCadastrados)} cadastrados (${pct(ind.equipamentosAtendidos, ind.equipamentosCadastrados)}%)`}
          icone={<IconeFabrica width={18} height={18} />}
          cor="azul"
        />
        <Tile
          rotulo="Mantenedores envolvidos"
          valor={num(ind.mantenedoresLocaisEnvolvidos + ind.mantenedoresEnvolvidos)}
          detalhe={`${num(ind.mantenedoresLocaisEnvolvidos)} locais · ${num(ind.mantenedoresEnvolvidos)} terceiros`}
          icone={<IconeUsuarios width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Materiais"
          valor={num(ind.materiaisDistintos)}
          detalhe={`tipos diferentes em ${num(ind.qtdItens)} lançamento(s)`}
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Recorrentes"
          valor={num(ind.recorrentes)}
          detalhe={`${pct(ind.recorrentes, ind.total)}% das O.S. do período`}
          icone={<IconeAtualizar width={18} height={18} />}
          cor="violeta"
        />
      </div>

      {/* Evolução */}
      <div className="grade-painel duas">
        <Secao icone={<IconeGrafico width={18} height={18} />} cor="azul" titulo="O.S. por mês">
          <Colunas dados={ind.meses.map((m) => ({ rotulo: m.rotulo, valor: m.os }))} />
        </Secao>
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Custo por mês">
          <Empilhado
            pontos={ind.meses}
            s1={{ rotulo: "Materiais", valores: ind.meses.map((m) => m.custoMateriais) }}
            s2={{ rotulo: "Terceiros", valores: ind.meses.map((m) => m.custoServicos) }}
            formato={moeda}
            formatoCurto={moedaCurta}
          />
        </Secao>
      </div>

      <div className="grade-painel duas">
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Divisão do custo">
          <Divisao
            partes={[
              { rotulo: "Materiais", valor: ind.custoMateriais },
              { rotulo: "Serviços de terceiros", valor: ind.custoServicos },
            ]}
            formato={moeda}
            sufixo="do custo"
            vazio="Nenhum custo lançado no período."
          />
        </Secao>
        <Secao icone={<IconeCalendario width={18} height={18} />} cor="violeta" titulo="O.S. por dia da semana">
          <Colunas dados={ind.porDiaSemana} />
        </Secao>
      </div>

      <div className="grade-painel duas">
        <Secao icone={<IconeChave width={18} height={18} />} cor="verde" titulo="Horas por mês">
          <Empilhado
            pontos={ind.meses}
            s1={{ rotulo: "Locais", valores: ind.meses.map((m) => m.horasLocais) }}
            s2={{ rotulo: "Terceiros", valores: ind.meses.map((m) => m.horasTerceiros) }}
            formato={horasFmt}
          />
        </Secao>
        <Secao icone={<IconeUsuarios width={18} height={18} />} cor="verde" titulo="Divisão das horas">
          <Divisao
            partes={[
              { rotulo: "Locais", valor: ind.horasLocais },
              { rotulo: "Terceiros", valor: ind.horasTerceiros },
            ]}
            formato={horasFmt}
            sufixo="das horas"
            vazio="Nenhuma hora lançada no período."
          />
        </Secao>
      </div>

      {/* Distribuições */}
      <div className="grade-painel tres">
        <Secao icone={<IconeDocumento width={18} height={18} />} cor="azul" titulo="Por tipo">
          <BarrasH dados={ind.porTipo} />
        </Secao>
        <Secao icone={<IconeAlerta width={18} height={18} />} cor="ambar" titulo="Por prioridade">
          <BarrasH dados={ind.porPrioridade} />
        </Secao>
        <Secao icone={<IconeAtualizar width={18} height={18} />} cor="verde" titulo="Por fluxo">
          <BarrasH dados={ind.porFluxo} />
        </Secao>
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="violeta" titulo="Por área">
          <BarrasH dados={ind.porArea} />
        </Secao>
        <Secao icone={<IconeDocumento width={18} height={18} />} cor="azul" titulo="Por “outro”">
          <BarrasH dados={ind.porOutro} />
        </Secao>
        <Secao icone={<IconeUsuarios width={18} height={18} />} cor="verde" titulo="Por solicitante">
          <BarrasH dados={ind.porSolicitante} />
        </Secao>
      </div>

      {/* Equipamentos */}
      <div className="grade-painel duas">
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="azul" titulo="Equipamentos com mais O.S.">
          <BarrasH dados={ind.equipamentosPorOS} />
        </Secao>
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="ambar" titulo="Equipamentos com maior custo">
          <BarrasH dados={ind.equipamentosPorCusto} formato={moeda} vazio="Nenhum custo lançado no período." />
        </Secao>
      </div>

      {/* Mantenedores locais */}
      <Secao icone={<IconeUsuarios width={18} height={18} />} cor="azul" titulo="Mantenedores locais">
        {ind.mantenedoresLocais.length === 0 ? (
          <div className="vazio">Nenhuma O.S. com mantenedor interno no período.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mantenedor</th>
                  <th>Horas</th>
                  <th className="col-barra" aria-hidden />
                  <th>O.S.</th>
                  <th>Média por O.S.</th>
                  <th>% das horas locais</th>
                </tr>
              </thead>
              <tbody>
                {ind.mantenedoresLocais.map((m) => (
                  <tr key={m.nome}>
                    <td>{m.nome}</td>
                    <td>{horasFmt(m.horas)}</td>
                    <td className="col-barra">
                      <span className="mini-trilho">
                        <span className="mini-marca" style={{ width: `${m.horas > 0 ? Math.max((m.horas / maxHorasLocal) * 100, 1) : 0}%` }} />
                      </span>
                    </td>
                    <td>{num(m.os)}</td>
                    <td>{horasFmt(m.os ? m.horas / m.os : 0)}</td>
                    <td>{pct(m.horas, ind.horasLocais)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {/* Mantenedores terceiros */}
      <Secao icone={<IconeChave width={18} height={18} />} cor="verde" titulo="Mantenedores terceiros">
        {ind.mantenedores.length === 0 ? (
          <div className="vazio">Nenhum serviço de terceiros lançado no período.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mantenedor</th>
                  <th>Horas</th>
                  <th className="col-barra" aria-hidden />
                  <th>Serviços</th>
                  <th>O.S.</th>
                  <th>Custo</th>
                  <th>Custo/hora</th>
                </tr>
              </thead>
              <tbody>
                {ind.mantenedores.map((m) => (
                  <tr key={m.nome}>
                    <td>{m.nome}</td>
                    <td>{horasFmt(m.horas)}</td>
                    <td className="col-barra">
                      <span className="mini-trilho">
                        <span className="mini-marca" style={{ width: `${m.horas > 0 ? Math.max((m.horas / maxHorasMant) * 100, 1) : 0}%` }} />
                      </span>
                    </td>
                    <td>{num(m.servicos)}</td>
                    <td>{num(m.os)}</td>
                    <td>{moeda(m.custo)}</td>
                    <td>{m.horas > 0 ? moeda(m.custo / m.horas) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      {/* Materiais */}
      <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Materiais mais usados">
        {ind.materiais.length === 0 ? (
          <div className="vazio">Nenhum material lançado no período.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Custo</th>
                  <th className="col-barra" aria-hidden />
                  <th>Quantidade</th>
                  <th>O.S.</th>
                  <th>% do custo de materiais</th>
                </tr>
              </thead>
              <tbody>
                {ind.materiais.map((m) => (
                  <tr key={m.nome}>
                    <td>{m.nome}</td>
                    <td>{moeda(m.custo)}</td>
                    <td className="col-barra">
                      <span className="mini-trilho">
                        <span className="mini-marca" style={{ width: `${m.custo > 0 ? Math.max((m.custo / maxCustoMat) * 100, 1) : 0}%` }} />
                      </span>
                    </td>
                    <td>
                      {num(m.qtde, m.qtde % 1 ? 2 : 0)} {m.unidade}
                    </td>
                    <td>{num(m.os)}</td>
                    <td>{pct(m.custo, ind.custoMateriais)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Secao>

      <div className="grade-painel duas">
        {/* Qualidade dos dados */}
        <Secao
          icone={<IconeAlerta width={18} height={18} />}
          cor={problemas ? "ambar" : "verde"}
          titulo="Qualidade dos dados"
        >
          <ul className="qualidade">
            {ind.qualidade.map((q) => (
              <li key={q.rotulo} className={q.valor ? "atencao" : "ok"}>
                <span className="status">{q.valor ? "⚠ Atenção" : "✓ OK"}</span>
                <span className="q-rotulo">{q.rotulo}</span>
                <b>{num(q.valor)}</b>
              </li>
            ))}
          </ul>
        </Secao>

        {/* Últimas O.S. */}
        <Secao icone={<IconeLista width={18} height={18} />} cor="azul" titulo="Últimas O.S. registradas">
          {ind.recentes.length === 0 ? (
            <div className="vazio">Nenhuma O.S. no período.</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Programada</th>
                    <th>Equipamento</th>
                    <th>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {ind.recentes.map((m) => {
                    const custo =
                      (m.manutencao_items ?? []).reduce((s, i) => s + i.qtde * i.preco_unit, 0) +
                      (m.manutencao_servicos ?? []).reduce((s, x) => s + (x.vlcusto ?? 0), 0);
                    return (
                      <tr key={m.id} className="clicavel" onClick={() => onAbrir(m.id)}>
                        <td className="num">#{m.id}</td>
                        <td>{data(m.dt_programada)}</td>
                        <td>{m.manutencao_equipamento?.descricao ?? "—"}</td>
                        <td>{moeda(custo)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Secao>
      </div>
    </div>
  );
}
