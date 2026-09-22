import { useEffect, useMemo, useState, type ReactNode } from "react";
import { listarManutencoes, type Catalogos, type Manutencao } from "../api";
import { calcular, type Contagem, type Filtro, type Mes, type Periodo } from "../dashboard";
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

/** Colunas empilhadas: materiais (série 1) + serviços (série 2), com legenda. */
function CustoMensal({ meses }: { meses: Mes[] }) {
  const max = Math.max(...meses.map((m) => m.custoMateriais + m.custoServicos), 0) || 1;
  const rotularTodas = meses.length <= 12;
  const passo = Math.ceil(meses.length / 12);
  return (
    <>
      <div className="legenda">
        <span><i className="amostra s1" /> Materiais</span>
        <span><i className="amostra s2" /> Serviços</span>
      </div>
      <div className="colunas">
        {meses.map((m, i) => {
          const total = m.custoMateriais + m.custoServicos;
          return (
            <div
              key={m.chave}
              className={`coluna dica${ponta(i, meses.length)}`}
              tabIndex={0}
              data-dica={`${m.rotulo} — Materiais ${moeda(m.custoMateriais)} · Serviços ${moeda(m.custoServicos)} · Total ${moeda(total)}`}
            >
              <span className="coluna-valor">{rotularTodas && total > 0 ? moedaCurta(total) : ""}</span>
              <span className="coluna-trilho">
                <span className="coluna-pilha" style={{ height: `${total ? Math.max((total / max) * 100, 2) : 0}%` }}>
                  {m.custoServicos > 0 && <span className="seg s2" style={{ flexGrow: m.custoServicos }} />}
                  {m.custoMateriais > 0 && <span className="seg s1" style={{ flexGrow: m.custoMateriais }} />}
                </span>
              </span>
              <span className="coluna-rotulo">{i % passo === 0 ? m.rotulo : ""}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** Barra 100% com a divisão do custo */
function Divisao({ materiais, servicos }: { materiais: number; servicos: number }) {
  const total = materiais + servicos;
  if (!total) return <div className="vazio">Nenhum custo lançado no período.</div>;
  return (
    <div className="divisao">
      <div className="divisao-barra">
        {materiais > 0 && (
          <span className="seg s1 dica" tabIndex={0} style={{ flexGrow: materiais }} data-dica={`Materiais: ${moeda(materiais)}`} />
        )}
        {servicos > 0 && (
          <span className="seg s2 dica" tabIndex={0} style={{ flexGrow: servicos }} data-dica={`Serviços: ${moeda(servicos)}`} />
        )}
      </div>
      <div className="divisao-legenda">
        <div>
          <span><i className="amostra s1" /> Materiais</span>
          <b>{moeda(materiais)}</b>
          <small>{pct(materiais, total)}% do custo</small>
        </div>
        <div>
          <span><i className="amostra s2" /> Serviços</span>
          <b>{moeda(servicos)}</b>
          <small>{pct(servicos, total)}% do custo</small>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */

export function Dashboard({ catalogos, onAbrir }: { catalogos: Catalogos; onAbrir: (id: number) => void }) {
  const [lista, setLista] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>({ periodo: "todos", tipoId: "", equipamentoId: "" });
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

  const ind = useMemo(() => (lista ? calcular(lista, catalogos, filtro) : null), [lista, catalogos, filtro]);

  if (erro) return <div className="erro-caixa">{erro}</div>;
  if (!ind) return <p className="muted">Calculando indicadores…</p>;

  const filtrado = filtro.periodo !== "todos" || filtro.tipoId || filtro.equipamentoId;
  const variacao = ind.mesAtual - ind.mesAnterior;
  const problemas = ind.qualidade.reduce((s, q) => s + q.valor, 0);
  const maxHorasMant = Math.max(...ind.mantenedores.map((m) => m.horas), 0) || 1;
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
        <div className="filtros-acoes">
          {filtrado && (
            <button type="button" onClick={() => setFiltro({ periodo: "todos", tipoId: "", equipamentoId: "" })}>
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
          detalhe={`Materiais ${moedaCurta(ind.custoMateriais)} · Serviços ${moedaCurta(ind.custoServicos)}`}
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
          detalhe={`${num(ind.qtdServicos)} serviço(s) · média ${horasFmt(ind.horasMediasPorOS)} por O.S.`}
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
          valor={num(ind.mantenedoresEnvolvidos)}
          detalhe={`de ${num(catalogos.mantenedores.length)} cadastrados`}
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
          <CustoMensal meses={ind.meses} />
        </Secao>
      </div>

      <div className="grade-painel duas">
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Divisão do custo">
          <Divisao materiais={ind.custoMateriais} servicos={ind.custoServicos} />
        </Secao>
        <Secao icone={<IconeCalendario width={18} height={18} />} cor="violeta" titulo="O.S. por dia da semana">
          <Colunas dados={ind.porDiaSemana} />
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

      {/* Mantenedores */}
      <Secao icone={<IconeUsuarios width={18} height={18} />} cor="verde" titulo="Mantenedores">
        {ind.mantenedores.length === 0 ? (
          <div className="vazio">Nenhum serviço lançado no período.</div>
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
