import { useEffect, useMemo, useState } from "react";
import { carregarCatalogosSaida, listarTodasProdutoSaidas, type CatalogosSaida, type ProdutoSaida } from "../api";
import {
  calcularSaidas,
  FILTRO_SAIDAS_VAZIO,
  situacaoDe,
  valorTotal,
  type FiltroSaidas,
  type Situacao,
} from "../dashboardSaidas";
import { imprimirSaida } from "../exportar";
import { data, moeda } from "../formato";
import { BarrasH, Colunas, Divisao, moedaCurta, num, pct, Tile } from "./Dashboard";
import { Secao } from "./Detalhe";
import { SelectBusca } from "./SelectBusca";
import {
  IconeAlerta,
  IconeAtualizar,
  IconeBarras,
  IconeCaixa,
  IconeCalendario,
  IconeCheck,
  IconeDocumento,
  IconeFabrica,
  IconeGrafico,
  IconeLista,
  IconePdf,
  IconeUsuarios,
} from "./Icones";

const SITUACOES: Situacao[] = ["Pendente", "Finalizada", "Liberada", "Entregue", "Recusada"];
const COR_SITUACAO: Record<Situacao, string> = {
  Pendente: "ambar",
  Finalizada: "violeta",
  Liberada: "azul",
  Entregue: "verde",
  Recusada: "rosa",
};

/** Nome de equipamento/veículo/centro de custo: o aninhado na saída ou o do cadastro */
function nomeDestino(aninhado: unknown, cadastro: Array<Record<string, any>> | undefined, id: number | null): string {
  const o = (aninhado as Record<string, any> | null) ?? cadastro?.find((x) => x.id === id);
  return o ? o.descricao || o.nome || o.placa || `#${o.id}` : `#${id}`;
}

/** Filtro por destino — com pesquisa, porque as listas podem ser longas */
function FiltroDestino({ rotulo, vazio, valor, opcoes, onChange }: {
  rotulo: string;
  vazio: string;
  valor: string;
  opcoes: { id: number; rotulo: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label>
      <span>{rotulo}</span>
      <SelectBusca value={valor} onChange={onChange} opcoes={opcoes} vazio={opcoes.length ? vazio : "Nenhum nas saídas"} />
    </label>
  );
}

const qtdFmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

export function DashboardSaidas() {
  const [lista, setLista] = useState<ProdutoSaida[] | null>(null);
  const [cad, setCad] = useState<CatalogosSaida | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [filtro, setFiltro] = useState<FiltroSaidas>(FILTRO_SAIDAS_VAZIO);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);

  const carregar = () => {
    setErro(null);
    setCarregando(true);
    Promise.all([
      listarTodasProdutoSaidas(),
      // Cadastros só dão nome a empresa/usuário/destino; falha neles não derruba o painel
      cad ? Promise.resolve({ catalogos: cad }) : carregarCatalogosSaida().catch(() => null),
    ])
      .then(([l, c]) => {
        setLista(l);
        setCad(
          c?.catalogos ??
            ({ empresas: [], tipos: [], fluxos: [], usuarios: [], equipamentos: [], veiculos: [], centro_custos: [], produtos: [] } as CatalogosSaida)
        );
        setAtualizadoEm(new Date());
      })
      .catch((e) => setErro(`Não foi possível carregar as saídas: ${e.message}`))
      .finally(() => setCarregando(false));
  };
  useEffect(carregar, []);

  const ind = useMemo(() => (lista && cad ? calcularSaidas(lista, cad, filtro) : null), [lista, cad, filtro]);

  // Opções dos filtros: só o que aparece nas saídas carregadas
  const opcoes = useMemo(() => {
    const unicos = (pares: Array<[number | null | undefined, string]>) =>
      [...new Map(pares.filter(([id]) => id != null).map(([id, nome]) => [id as number, nome])).entries()]
        .map(([id, rotulo]) => ({ id, rotulo }))
        .sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
    const l = lista ?? [];
    return {
      empresas: unicos(l.map((s) => [s.empresa_id, cad?.empresas.find((e) => e.id === s.empresa_id)?.nome_fantasia || `Empresa #${s.empresa_id}`])),
      usuarios: unicos(l.map((s) => [s.empresa_usuario_id, s.empresa_usuario?.nome ?? `#${s.empresa_usuario_id}`])),
      tipos: unicos(l.map((s) => [s.produto_saida_tipo_id, s.produto_saida_tipo?.descricao ?? `#${s.produto_saida_tipo_id}`])),
      equipamentos: unicos(l.map((s) => [s.equipamento_id, nomeDestino(s.equipamento, cad?.equipamentos, s.equipamento_id)])),
      veiculos: unicos(l.map((s) => [s.veiculo_id, nomeDestino(s.veiculo, cad?.veiculos, s.veiculo_id)])),
      centros: unicos(
        l.map((s) => [s.lancamento_centro_custo_id, nomeDestino(s.lancamento_centro_custo, cad?.centro_custos, s.lancamento_centro_custo_id)])
      ),
    };
  }, [lista, cad]);

  const recentes = useMemo(
    () =>
      [...(lista ?? [])]
        .sort((a, b) => String(b.dhemi).localeCompare(String(a.dhemi)) || b.id - a.id)
        .slice(0, 10),
    [lista]
  );

  if (erro && !lista) {
    return (
      <div className="erro-caixa">
        {erro} <button onClick={carregar}>Tentar de novo</button>
      </div>
    );
  }
  if (!ind || !cad) return <p className="muted">Calculando indicadores das saídas…</p>;

  const filtrado = Object.values(filtro).some(Boolean);
  const set = <K extends keyof FiltroSaidas>(k: K, v: FiltroSaidas[K]) => setFiltro((f) => ({ ...f, [k]: v }));
  const periodo =
    ind.primeira && ind.ultima
      ? ind.primeira === ind.ultima
        ? data(ind.primeira)
        : `${data(ind.primeira)} a ${data(ind.ultima)}`
      : "sem saídas";
  const porQtde = [...ind.produtos].sort((a, b) => b.qtde - a.qtde).map((p) => ({ rotulo: p.nome, valor: p.qtde }));
  const porValor = [...ind.produtos].sort((a, b) => b.valor - a.valor).map((p) => ({ rotulo: p.nome, valor: p.valor }));

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeGrafico width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Estoque · Indicadores</p>
            <h1>Painel de Saídas</h1>
            <p className="desc">
              Saídas não liberadas do mês · {periodo}
              {atualizadoEm && ` · atualizado às ${atualizadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            </p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica azul">
            <b>{num(ind.total)}</b>
            <span>Saídas</span>
          </div>
          <div className="estatistica ambar">
            <b>{moedaCurta(ind.valorTotal)}</b>
            <span>Valor</span>
          </div>
          <div className="estatistica verde">
            <b>{qtdFmt(ind.volumes)}</b>
            <span>Volumes</span>
          </div>
        </div>
      </div>

      <div className="card filtros">
        {opcoes.empresas.length > 1 && (
          <label>
            <span>Empresa</span>
            <select value={filtro.empresaId} onChange={(e) => set("empresaId", e.target.value)}>
              <option value="">Todas as empresas</option>
              {opcoes.empresas.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Usuário</span>
          <select value={filtro.usuarioId} onChange={(e) => set("usuarioId", e.target.value)}>
            <option value="">Todos os usuários</option>
            {opcoes.usuarios.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Tipo</span>
          <select value={filtro.tipoId} onChange={(e) => set("tipoId", e.target.value)}>
            <option value="">Todos os tipos</option>
            {opcoes.tipos.map((o) => (
              <option key={o.id} value={o.id}>
                {o.rotulo}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Situação</span>
          <select value={filtro.situacao} onChange={(e) => set("situacao", e.target.value as FiltroSaidas["situacao"])}>
            <option value="">Todas</option>
            {SITUACOES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <FiltroDestino rotulo="Equipamento" vazio="Todos os equipamentos" valor={filtro.equipamentoId} opcoes={opcoes.equipamentos} onChange={(v) => set("equipamentoId", v)} />
        <FiltroDestino rotulo="Veículo" vazio="Todos os veículos" valor={filtro.veiculoId} opcoes={opcoes.veiculos} onChange={(v) => set("veiculoId", v)} />
        <FiltroDestino rotulo="Centro de custo" vazio="Todos os centros de custo" valor={filtro.centroCustoId} opcoes={opcoes.centros} onChange={(v) => set("centroCustoId", v)} />
        <div className="filtros-acoes">
          {filtrado && (
            <button type="button" onClick={() => setFiltro(FILTRO_SAIDAS_VAZIO)}>
              Limpar
            </button>
          )}
          <button type="button" onClick={carregar} disabled={carregando}>
            <IconeAtualizar width={16} height={16} className={carregando ? "girando" : undefined} />
            {carregando ? "Atualizando…" : "Atualizar"}
          </button>
        </div>
      </div>
      {erro && <div className="erro-caixa">{erro}</div>}

      {/* Números principais */}
      <div className="tiles">
        <Tile
          rotulo="Saídas"
          valor={num(ind.total)}
          detalhe={filtrado ? `de ${num(ind.totalGeral)} carregadas` : `${num(ind.hoje)} hoje · ${num(ind.ultimos7)} nos últimos 7 dias`}
          icone={<IconeLista width={18} height={18} />}
          cor="azul"
        />
        <Tile
          rotulo="Valor total"
          valor={moeda(ind.valorTotal)}
          detalhe={`Produtos ${moedaCurta(ind.valorProdutos)} · Serviços/frete/outros ${moedaCurta(ind.valorExtras)}`}
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Valor médio por saída"
          valor={moeda(ind.ticketMedio)}
          detalhe={ind.descontos ? `${moeda(ind.descontos)} em descontos` : "sem descontos"}
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Itens lançados"
          valor={num(ind.itens)}
          detalhe={`${qtdFmt(ind.volumes)} volumes · ${num(ind.itensPorSaida, 1)} item(ns) por saída`}
          icone={<IconeBarras width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Produtos diferentes"
          valor={num(ind.produtosDistintos)}
          detalhe="retirados nas saídas"
          icone={<IconeBarras width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Pendentes"
          valor={num(ind.pendentes)}
          detalhe={`${pct(ind.pendentes, ind.total)}% · ${num(ind.finalizadas)} finalizada(s) aguardando liberação`}
          icone={<IconeAlerta width={18} height={18} />}
          cor="ambar"
        />
        <Tile
          rotulo="Entregues"
          valor={num(ind.entregues)}
          detalhe={`${num(ind.recusadas)} recusada(s)`}
          icone={<IconeCheck width={18} height={18} />}
          cor="verde"
        />
        <Tile
          rotulo="Sem destino"
          valor={num(ind.semDestino)}
          detalhe="sem equipamento, veículo ou centro de custo"
          icone={<IconeFabrica width={18} height={18} />}
          cor="violeta"
        />
      </div>

      {/* Evolução */}
      <div className="grade-painel duas">
        <Secao icone={<IconeCalendario width={18} height={18} />} cor="azul" titulo="Saídas por dia">
          {ind.porDia.length ? <Colunas dados={ind.porDia} /> : <div className="vazio">Sem saídas.</div>}
        </Secao>
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Valor por dia">
          {ind.valorPorDia.length ? (
            <Colunas dados={ind.valorPorDia} formato={moedaCurta} />
          ) : (
            <div className="vazio">Sem saídas.</div>
          )}
        </Secao>
      </div>

      <div className="grade-painel duas">
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Composição do valor">
          <Divisao
            partes={[
              { rotulo: "Produtos", valor: ind.valorProdutos },
              { rotulo: "Serviços, frete e outros", valor: ind.valorExtras },
            ]}
            formato={moeda}
            sufixo="do valor"
            vazio="Nenhum valor lançado."
          />
        </Secao>
        <Secao icone={<IconeCalendario width={18} height={18} />} cor="violeta" titulo="Saídas por dia da semana">
          <Colunas dados={ind.porDiaSemana} />
        </Secao>
      </div>

      {/* Distribuições */}
      <div className="grade-painel tres">
        <Secao icone={<IconeAlerta width={18} height={18} />} cor="ambar" titulo="Por situação">
          <BarrasH dados={ind.porSituacao} vazio="Sem saídas." />
        </Secao>
        <Secao icone={<IconeDocumento width={18} height={18} />} cor="azul" titulo="Por tipo">
          <BarrasH dados={ind.porTipo} vazio="Sem saídas." />
        </Secao>
        <Secao icone={<IconeAtualizar width={18} height={18} />} cor="verde" titulo="Por fluxo">
          <BarrasH dados={ind.porFluxo} vazio="Sem saídas." />
        </Secao>
        <Secao icone={<IconeUsuarios width={18} height={18} />} cor="azul" titulo="Saídas por usuário">
          <BarrasH dados={ind.porUsuario} vazio="Sem saídas." />
        </Secao>
        <Secao icone={<IconeUsuarios width={18} height={18} />} cor="ambar" titulo="Valor por usuário">
          <BarrasH dados={ind.valorPorUsuario} formato={moeda} vazio="Sem saídas." />
        </Secao>
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="violeta" titulo="Por destino">
          <BarrasH dados={ind.porDestino} vazio="Sem saídas." />
        </Secao>
      </div>

      {/* Destinos */}
      <div className="grade-painel tres">
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="azul" titulo="Equipamentos (valor)">
          <BarrasH dados={ind.equipamentos} formato={moeda} vazio="Nenhuma saída para equipamento." />
        </Secao>
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="verde" titulo="Veículos (valor)">
          <BarrasH dados={ind.veiculos} formato={moeda} vazio="Nenhuma saída para veículo." />
        </Secao>
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="violeta" titulo="Centros de custo (valor)">
          <BarrasH dados={ind.centrosCusto} formato={moeda} vazio="Nenhuma saída para centro de custo." />
        </Secao>
      </div>

      {/* Produtos */}
      <div className="grade-painel duas">
        <Secao icone={<IconeBarras width={18} height={18} />} cor="verde" titulo="Produtos mais retirados (quantidade)">
          <BarrasH dados={porQtde} formato={qtdFmt} limite={10} vazio="Nenhum produto." />
        </Secao>
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Produtos de maior valor">
          <BarrasH dados={porValor} formato={moeda} limite={10} vazio="Nenhum produto." />
        </Secao>
      </div>

      {ind.porEmpresa.length > 1 && (
        <Secao icone={<IconeFabrica width={18} height={18} />} cor="azul" titulo="Por empresa">
          <BarrasH dados={ind.porEmpresa} />
        </Secao>
      )}

      {/* Últimas saídas */}
      <Secao icone={<IconeLista width={18} height={18} />} cor="azul" titulo="Últimas saídas">
        {recentes.length === 0 ? (
          <div className="vazio">Nenhuma saída.</div>
        ) : (
          <div className="tabela-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Emissão</th>
                  <th>Usuário</th>
                  <th>Tipo</th>
                  <th>Itens</th>
                  <th className="num-col">Valor</th>
                  <th>Situação</th>
                  <th className="col-acao">PDF</th>
                </tr>
              </thead>
              <tbody>
                {recentes.map((s) => {
                  const sit = situacaoDe(s);
                  return (
                    <tr key={s.id}>
                      <td className="num">#{s.id}</td>
                      <td>{data(s.dhemi)}</td>
                      <td>{s.empresa_usuario?.nome ?? "—"}</td>
                      <td>{s.produto_saida_tipo?.descricao ?? "—"}</td>
                      <td>{s.produto_saida_items?.length ?? 0}</td>
                      <td className="num-col">{moeda(valorTotal(s))}</td>
                      <td>
                        <span className={`pilula ${COR_SITUACAO[sit]}`}>{sit}</span>
                      </td>
                      <td className="col-acao">
                        <button
                          className="icone pequeno"
                          onClick={() => imprimirSaida(s, cad)}
                          title={`Gerar PDF da saída nº ${s.id}`}
                          aria-label={`Gerar PDF da saída nº ${s.id}`}
                        >
                          <IconePdf width={16} height={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Secao>
    </div>
  );
}
