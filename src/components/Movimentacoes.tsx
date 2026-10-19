import { useEffect, useMemo, useState } from "react";
import { listarTodasProdutoSaidas, movimento, type Movimento, type ProdutoSaida } from "../api";
import { imprimirSaida } from "../exportar";
import { data, moeda } from "../formato";
import { SelectBusca } from "./SelectBusca";
import {
  rotulo,
  SaidaProdutos,
  situacao,
  SITUACOES,
  totalItens,
  type PropsLista,
} from "./SaidaProdutos";
import { IconeAtualizar, IconeBusca, IconeMais, IconePdf, IconeSetas } from "./Icones";

type Aba = Movimento | "todas";

const ABAS: { id: Aba; rotulo: string; cor: string }[] = [
  { id: "saida", rotulo: "Saídas", cor: "ambar" },
  { id: "entrada", rotulo: "Entradas", cor: "verde" },
  { id: "todas", rotulo: "Todas", cor: "azul" },
];

const PILULA: Record<Movimento, { texto: string; cor: string }> = {
  entrada: { texto: "Entrada", cor: "verde" },
  saida: { texto: "Saída", cor: "ambar" },
};

/** Tela de entradas e saídas (rota produto_saidas), separadas pelo campo "tipo"; a aba define o movimento do novo lançamento */
export function Movimentacoes() {
  return <SaidaProdutos Lista={ListaMovimentos} />;
}

function ListaMovimentos({ catalogos, onAbrir, onNova }: PropsLista) {
  const [lista, setLista] = useState<ProdutoSaida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<Aba>("saida");
  const [busca, setBusca] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [usuario, setUsuario] = useState("");
  const [tipoId, setTipoId] = useState("");
  const [sit, setSit] = useState("");

  const carregar = () => {
    setErro(null);
    setLista(null);
    listarTodasProdutoSaidas()
      .then(setLista)
      .catch((e) => setErro(`Não foi possível listar os lançamentos (GET produto_saidas): ${e.message}`));
  };
  useEffect(carregar, []);

  // Movimento calculado uma vez por lista
  const comMov = useMemo(
    () => lista?.map((s) => ({ s, mov: movimento(s, catalogos) })) ?? null,
    [lista, catalogos],
  );

  const contagem = useMemo(() => {
    const c = { entrada: 0, saida: 0, todas: comMov?.length ?? 0, semTipo: 0 };
    comMov?.forEach(({ mov }) => (mov ? c[mov]++ : c.semTipo++));
    return c;
  }, [comMov]);

  // Tipos oferecidos no filtro: os que aparecem nos lançamentos da aba
  const tiposAba = useMemo(() => {
    const ids = new Set(
      comMov?.filter(({ mov }) => aba === "todas" || mov === aba).map(({ s }) => s.produto_saida_tipo_id),
    );
    return catalogos.tipos.filter((t) => ids.has(t.id)).map((t) => ({ id: t.id, rotulo: rotulo(t) }));
  }, [comMov, catalogos, aba]);

  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (
      comMov?.filter(
        ({ s, mov }) =>
          (aba === "todas" || mov === aba) &&
          (!empresa || String(s.empresa_id) === empresa) &&
          (!usuario || String(s.empresa_usuario_id) === usuario) &&
          (!tipoId || String(s.produto_saida_tipo_id) === tipoId) &&
          (!sit || situacao(s).texto === sit) &&
          (!t ||
            [
              String(s.id),
              s.empresa_usuario?.nome,
              s.produto_saida_tipo?.descricao,
              s.produto_saida_fluxo?.descricao,
              rotulo(s.equipamento),
              rotulo(s.veiculo),
              s.descprod,
              s.infcpl,
              ...(s.produto_saida_items ?? []).map((i) => i.xprod),
            ].some((v) => v?.toLowerCase().includes(t))),
      ) ?? null
    );
  }, [comMov, aba, busca, empresa, usuario, tipoId, sit]);

  const valorAba = useMemo(
    () => filtrada?.reduce((t, { s }) => t + (Number(s.vprod ?? totalItens(s)) || 0), 0) ?? 0,
    [filtrada],
  );

  const nomeEmpresa = (id: number) => catalogos.empresas.find((e) => e.id === id)?.nome_fantasia || `#${id}`;
  const variasEmpresas = new Set(lista?.map((s) => s.empresa_id)).size > 1;
  const trocarAba = (a: Aba) => {
    setAba(a);
    setTipoId("");
  };
  const rotuloAba = aba === "entrada" ? "entrada" : aba === "saida" ? "saída" : "lançamento";

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeSetas width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Estoque · Progete</p>
            <h1>Entradas e Saídas</h1>
            <p className="desc">Lançamentos em aberto deste mês, separados pelo tipo (0 = Entrada, 1 = Saída).</p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica verde">
            <b>{contagem.entrada}</b>
            <span>Entradas</span>
          </div>
          <div className="estatistica ambar">
            <b>{contagem.saida}</b>
            <span>Saídas</span>
          </div>
          <div className="estatistica azul">
            <b>{moeda(valorAba)}</b>
            <span>Total listado</span>
          </div>
        </div>
      </div>

      <div className="abas" role="tablist">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            role="tab"
            aria-selected={aba === a.id}
            className={`${a.cor}${aba === a.id ? " ativa" : ""}`}
            onClick={() => trocarAba(a.id)}
          >
            <span className="texto-aba">{a.rotulo}</span>
            <span className="contador">{contagem[a.id]}</span>
          </button>
        ))}
      </div>

      {contagem.semTipo > 0 && (
        <p className="muted">
          {contagem.semTipo} lançamento(s) sem o campo "tipo" aparecem só em "Todas".
        </p>
      )}

      <div className="card filtros">
        {catalogos.empresas.length > 1 && (
          <label>
            <span>Empresa</span>
            <SelectBusca
              value={empresa}
              onChange={setEmpresa}
              opcoes={catalogos.empresas.map((e) => ({ id: e.id, rotulo: e.nome_fantasia || `#${e.id}` }))}
              vazio="Todas as empresas"
            />
          </label>
        )}
        <label>
          <span>Usuário</span>
          <SelectBusca
            value={usuario}
            onChange={setUsuario}
            opcoes={catalogos.usuarios.map((u) => ({ id: u.id, rotulo: rotulo(u) }))}
            vazio="Todos os usuários"
          />
        </label>
        <label>
          <span>Tipo</span>
          <SelectBusca value={tipoId} onChange={setTipoId} opcoes={tiposAba} vazio="Todos os tipos" />
        </label>
        <label>
          <span>Situação</span>
          <select value={sit} onChange={(e) => setSit(e.target.value)}>
            <option value="">Todas</option>
            {SITUACOES.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </select>
        </label>
        <div className="filtros-acoes">
          {(empresa || usuario || tipoId || sit) && (
            <button
              type="button"
              onClick={() => {
                setEmpresa("");
                setUsuario("");
                setTipoId("");
                setSit("");
              }}
            >
              Limpar
            </button>
          )}
          <button type="button" onClick={carregar}>
            <IconeAtualizar width={16} height={16} /> Atualizar
          </button>
        </div>
      </div>

      <div className="barra">
        <div className="campo-busca">
          <IconeBusca />
          <input
            placeholder="Buscar por nº, usuário, tipo, equipamento, produto…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <div className="acoes">
          <button className="primario" onClick={() => onNova(aba === "entrada" ? "entrada" : "saida")}>
            <IconeMais width={16} height={16} /> {aba === "entrada" ? "Nova entrada" : "Nova saída"}
          </button>
        </div>
      </div>

      {erro && <div className="erro-caixa">{erro}</div>}
      {!lista && !erro && <p className="muted">Carregando…</p>}
      {filtrada && filtrada.length === 0 && <div className="vazio">Nenhuma {rotuloAba} em aberto encontrada.</div>}

      {filtrada && filtrada.length > 0 && (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Emissão</th>
                {aba === "todas" && <th>Movimento</th>}
                {variasEmpresas && <th>Empresa</th>}
                <th>Usuário</th>
                <th>Tipo</th>
                <th>Destino</th>
                <th>Itens</th>
                <th>Total</th>
                <th>Situação</th>
                <th className="col-acao">PDF</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map(({ s, mov }) => {
                const st = situacao(s);
                const destino = s.equipamento ?? s.veiculo ?? s.lancamento_centro_custo;
                return (
                  <tr key={s.id} onClick={() => onAbrir(s.id)} className="clicavel">
                    <td className="num">#{s.id}</td>
                    <td>{data(s.dhemi)}</td>
                    {aba === "todas" && (
                      <td>
                        {mov ? <span className={`pilula ${PILULA[mov].cor}`}>{PILULA[mov].texto}</span> : "—"}
                      </td>
                    )}
                    {variasEmpresas && <td>{nomeEmpresa(s.empresa_id)}</td>}
                    <td>{s.empresa_usuario?.nome ?? "—"}</td>
                    <td>{s.produto_saida_tipo?.descricao ?? "—"}</td>
                    <td>{destino ? rotulo(destino) : "—"}</td>
                    <td>{s.produto_saida_items?.length ?? 0}</td>
                    <td>{moeda(s.vprod ?? totalItens(s))}</td>
                    <td>
                      <span className={`pilula ${st.cor}`}>{st.texto}</span>
                    </td>
                    <td className="col-acao">
                      <button
                        className="icone pequeno"
                        onClick={(e) => {
                          e.stopPropagation();
                          imprimirSaida(s, catalogos);
                        }}
                        title={`Gerar PDF do lançamento nº ${s.id}`}
                        aria-label={`Gerar PDF do lançamento nº ${s.id}`}
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
    </div>
  );
}
