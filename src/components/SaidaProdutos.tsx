import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ApiErro,
  carregarCatalogosSaida,
  excluirProdutoSaida,
  lerProdutoSaida,
  listarProdutoSaidas,
  salvarProdutoSaida,
  type CatalogosSaida,
  type ProdutoSaida,
  type ProdutoSaidaPayload,
} from "../api";
import { imprimirSaida } from "../exportar";
import { data, mensagensValidacao, moeda } from "../formato";
import { Secao } from "./Detalhe";
import {
  atualizarProdutos,
  iniciarProdutos,
  useProdutos,
} from "../produtosCache";
import { Pdv, type ItemForm } from "./Pdv";
import { StatusProdutos } from "./Produtos";
import { SelectBusca } from "./SelectBusca";
import {
  IconeAtualizar,
  IconeBusca,
  IconeCaixa,
  IconeCadeado,
  IconeCheck,
  IconeDocumento,
  IconeFabrica,
  IconeLixeira,
  IconeMais,
  IconePdf,
} from "./Icones";

/* ------------------------------------------------------------------------- */
/* Auxiliares                                                                 */
/* ------------------------------------------------------------------------- */

/** Rótulo de um cadastro qualquer da Progete (descricao, nome ou nome_fantasia) */
function rotulo(o: Record<string, any> | null | undefined): string {
  if (!o) return "—";
  return o.descricao || o.nome || o.nome_fantasia || o.placa || `#${o.id}`;
}

const opcoes = (l: Array<Record<string, any> & { id: number }>) =>
  l.map((x) => ({ id: x.id, rotulo: rotulo(x) }));

function Campo({
  rotulo,
  obrigatorio,
  largo,
  children,
}: {
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

function Select({
  value,
  onChange,
  opcoes,
  obrigatorio,
  vazio = "Selecione…",
}: {
  value: string;
  onChange: (v: string) => void;
  opcoes: { id: number; rotulo: string }[];
  obrigatorio?: boolean;
  vazio?: string;
}) {
  return (
    <SelectBusca
      value={value}
      onChange={onChange}
      opcoes={opcoes}
      obrigatorio={obrigatorio}
      vazio={vazio}
    />
  );
}

/** Situação da saída, na ordem em que ela costuma andar */
export function situacao(s: ProdutoSaida): { texto: string; cor: string } {
  if (s.recusado) return { texto: "Recusada", cor: "rosa" };
  if (s.entregue) return { texto: "Entregue", cor: "verde" };
  if (s.liberado) return { texto: "Liberada", cor: "azul" };
  if (s.finalizado) return { texto: "Finalizada", cor: "violeta" };
  return { texto: "Pendente", cor: "ambar" };
}

const totalItens = (s: ProdutoSaida) =>
  (s.produto_saida_items ?? []).reduce(
    (t, i) => t + (Number(i.qcom) || 0) * (Number(i.vuncom) || 0),
    0,
  );

/* ------------------------------------------------------------------------- */
/* Tela (lista ⇄ formulário)                                                  */
/* ------------------------------------------------------------------------- */

export function SaidaProdutos({ novo }: { novo?: boolean }) {
  const [cadastros, setCatalogos] = useState<CatalogosSaida | null>(null);
  // Produtos vêm do cache compartilhado (carregam em segundo plano no 1º acesso)
  const { lista: produtos } = useProdutos();
  useEffect(iniciarProdutos, []);
  const catalogos = useMemo(
    () => (cadastros ? { ...cadastros, produtos } : null),
    [cadastros, produtos],
  );
  const [erroCat, setErroCat] = useState<string | null>(null);
  const [falhas, setFalhas] = useState<string[]>([]);
  // undefined = lista; null = nova saída; número = edição
  const [editando, setEditando] = useState<number | null | undefined>(
    novo ? null : undefined,
  );

  const carregarCat = () => {
    setErroCat(null);
    carregarCatalogosSaida()
      .then((r) => {
        setCatalogos(r.catalogos);
        setFalhas(r.falhas);
      })
      .catch((e) => setErroCat(e.message));
  };
  useEffect(carregarCat, []);

  if (erroCat) {
    return (
      <div className="erro-caixa">
        Não foi possível carregar os cadastros de saída de produtos: {erroCat}{" "}
        <button onClick={carregarCat}>Tentar de novo</button>
      </div>
    );
  }
  if (!catalogos) return <p className="muted">Carregando cadastros…</p>;

  return (
    <div className="pagina">
      {falhas.length > 0 && (
        <div className="erro-caixa">
          <b>
            A Progete falhou ao devolver alguns cadastros (as opções deles ficam
            vazias):
          </b>
          <ul>
            {falhas.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <button onClick={carregarCat}>Tentar de novo</button>
        </div>
      )}
      {editando === undefined ? (
        <ListaSaidas
          catalogos={catalogos}
          onAbrir={setEditando}
          onNova={() => setEditando(null)}
        />
      ) : (
        <FormSaida
          key={editando ?? "nova"}
          id={editando}
          catalogos={catalogos}
          onFechar={() => setEditando(undefined)}
          onCriado={setEditando}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Lista                                                                      */
/* ------------------------------------------------------------------------- */

const SITUACOES = [
  "Pendente",
  "Finalizada",
  "Liberada",
  "Entregue",
  "Recusada",
];

function ListaSaidas({
  catalogos,
  onAbrir,
  onNova,
}: {
  catalogos: CatalogosSaida;
  onAbrir: (id: number) => void;
  onNova: () => void;
}) {
  const [lista, setLista] = useState<ProdutoSaida[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [usuario, setUsuario] = useState("");
  const [empresa, setEmpresa] = useState("");
  const [sit, setSit] = useState("");

  const carregar = () => {
    setErro(null);
    setLista(null);
    listarProdutoSaidas()
      .then((l) => setLista(Array.isArray(l) ? l : []))
      .catch((e) =>
        setErro(
          `Não foi possível listar as saídas (GET produto_saidas): ${e.message}`,
        ),
      );
  };

  useEffect(carregar, []);

  // A Progete devolve só as não liberadas do mês; os filtros abaixo são locais
  const filtrada = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (
      lista?.filter(
        (s) =>
          (!empresa || String(s.empresa_id) === empresa) &&
          (!usuario || String(s.empresa_usuario_id) === usuario) &&
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
  }, [lista, busca, empresa, usuario, sit]);

  const nomeEmpresa = (id: number) =>
    catalogos.empresas.find((e) => e.id === id)?.nome_fantasia || `#${id}`;
  // Coluna de empresa só quando a lista tem mais de uma
  const variasEmpresas = new Set(lista?.map((s) => s.empresa_id)).size > 1;

  const stats = useMemo(
    () => ({
      total: lista?.length ?? 0,
      pendentes:
        lista?.filter((s) => situacao(s).texto === "Pendente").length ?? 0,
      finalizadas: lista?.filter((s) => s.finalizado).length ?? 0,
    }),
    [lista],
  );

  return (
    <div className="pagina">
      <div className="hero">
        <div className="hero-titulo">
          <div className="hero-icone">
            <IconeCaixa width={28} height={28} />
          </div>
          <div>
            <p className="sobre">Estoque · Progete</p>
            <h1>Saída de Produtos</h1>
            <p className="desc">Saídas ainda não liberadas deste mês.</p>
          </div>
        </div>
        <div className="estatisticas">
          <div className="estatistica azul">
            <b>{stats.total}</b>
            <span>Em aberto</span>
          </div>
          <div className="estatistica ambar">
            <b>{stats.pendentes}</b>
            <span>Pendentes</span>
          </div>
          <div className="estatistica verde">
            <b>{stats.finalizadas}</b>
            <span>Finalizadas</span>
          </div>
        </div>
      </div>

      <div className="card filtros">
        {catalogos.empresas.length > 1 && (
          <label>
            <span>Empresa</span>
            <Select
              value={empresa}
              onChange={setEmpresa}
              opcoes={catalogos.empresas.map((e) => ({
                id: e.id,
                rotulo: e.nome_fantasia || `#${e.id}`,
              }))}
              vazio="Todas as empresas"
            />
          </label>
        )}
        <label>
          <span>Usuário</span>
          <Select
            value={usuario}
            onChange={setUsuario}
            opcoes={opcoes(catalogos.usuarios)}
            vazio="Todos os usuários"
          />
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
          {(empresa || usuario || sit) && (
            <button
              type="button"
              onClick={() => {
                setEmpresa("");
                setUsuario("");
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
          <button className="primario" onClick={onNova}>
            <IconeMais width={16} height={16} /> Nova saída
          </button>
        </div>
      </div>

      {erro && <div className="erro-caixa">{erro}</div>}
      {!lista && !erro && <p className="muted">Carregando…</p>}
      {filtrada && filtrada.length === 0 && (
        <div className="vazio">Nenhuma saída em aberto encontrada.</div>
      )}

      {filtrada && filtrada.length > 0 && (
        <div className="tabela-wrap">
          <table>
            <thead>
              <tr>
                <th>Nº</th>
                <th>Emissão</th>
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
              {filtrada.map((s) => {
                const sit = situacao(s);
                const destino =
                  s.equipamento ?? s.veiculo ?? s.lancamento_centro_custo;
                return (
                  <tr
                    key={s.id}
                    onClick={() => onAbrir(s.id)}
                    className="clicavel"
                  >
                    <td className="num">#{s.id}</td>
                    <td>{data(s.dhemi)}</td>
                    {variasEmpresas && <td>{nomeEmpresa(s.empresa_id)}</td>}
                    <td>{s.empresa_usuario?.nome ?? "—"}</td>
                    <td>{s.produto_saida_tipo?.descricao ?? "—"}</td>
                    <td>{destino ? rotulo(destino) : "—"}</td>
                    <td>{s.produto_saida_items?.length ?? 0}</td>
                    <td>{moeda(s.vprod ?? totalItens(s))}</td>
                    <td>
                      <span className={`pilula ${sit.cor}`}>{sit.texto}</span>
                    </td>
                    <td className="col-acao">
                      <button
                        className="icone pequeno"
                        onClick={(e) => {
                          e.stopPropagation();
                          imprimirSaida(s, catalogos);
                        }}
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
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Formulário                                                                 */
/* ------------------------------------------------------------------------- */

interface Cabecalho {
  empresa: string;
  usuario: string;
  tipo: string;
  fluxo: string;
  equipamento: string;
  veiculo: string;
  centroCusto: string;
  vdesc: string;
  vfrete: string;
  voutro: string;
  vserv: string;
  descprod: string;
  descserv: string;
  infcpl: string;
}

const CAB_VAZIO: Cabecalho = {
  empresa: "",
  usuario: "",
  tipo: "",
  fluxo: "",
  equipamento: "",
  veiculo: "",
  centroCusto: "",
  vdesc: "",
  vfrete: "",
  voutro: "",
  vserv: "",
  descprod: "",
  descserv: "",
  infcpl: "",
};

const idOuNull = (v: string) => (v ? Number(v) : null);
const str = (v: unknown) => (v == null ? "" : String(v));

function FormSaida({
  id,
  catalogos,
  onFechar,
  onCriado,
}: {
  id: number | null;
  catalogos: CatalogosSaida;
  onFechar: () => void;
  onCriado: (id: number) => void;
}) {
  // Uma empresa só → já vem escolhida
  const [cab, setCab] = useState<Cabecalho>(() => ({
    ...CAB_VAZIO,
    empresa:
      catalogos.empresas.length === 1 ? String(catalogos.empresas[0].id) : "",
  }));
  const [itens, setItens] = useState<ItemForm[]>([]);
  const [dhemi, setDhemi] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(id !== null);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<string[]>([]);
  const { carregando: atualizando } = useProdutos();
  // Saída recém-salva: pergunta se quer o PDF antes de seguir
  const [salva, setSalva] = useState<ProdutoSaida | null>(null);
  // Saída já liberada na Progete: só consulta, sem edição nem exclusão
  const [original, setOriginal] = useState<ProdutoSaida | null>(null);
  const bloqueada = !!original?.liberado;

  useEffect(() => {
    if (id === null) return;
    lerProdutoSaida(id)
      .then((s) => {
        setOriginal(s);
        setDhemi(s.dhemi);
        setCab({
          empresa: str(s.empresa_id),
          usuario: str(s.empresa_usuario_id),
          tipo: str(s.produto_saida_tipo_id),
          fluxo: str(s.produto_saida_fluxo_id),
          equipamento: str(s.equipamento_id),
          veiculo: str(s.veiculo_id),
          centroCusto: str(s.lancamento_centro_custo_id),
          vdesc: str(s.vdesc),
          vfrete: str(s.vfrete),
          voutro: str(s.voutro),
          vserv: str(s.vserv),
          descprod: s.descprod ?? "",
          descserv: s.descserv ?? "",
          infcpl: s.infcpl ?? "",
        });
        setItens(
          (s.produto_saida_items ?? []).map((i) => ({
            key: `i${i.id}`,
            id: i.id,
            produtoId: str(i.produto_id),
            xprod: i.xprod ?? "",
            qcom: str(i.qcom),
            vuncom: str(i.vuncom),
          })),
        );
      })
      .catch((e) => setErros([e.message]))
      .finally(() => setCarregando(false));
  }, [id]);

  const set = <K extends keyof Cabecalho>(k: K, v: Cabecalho[K]) =>
    setCab((c) => ({ ...c, [k]: v }));
  const ativos = itens.filter((i) => !i.remover);
  const vprod = ativos.reduce(
    (t, i) => t + (Number(i.qcom) || 0) * (Number(i.vuncom) || 0),
    0,
  );

  // Situação (finalizado/liberado/entregue/recusado) é automática na Progete: não vai no payload
  const montarPayload = (): ProdutoSaidaPayload => ({
    // O create da Progete não preenche mais a empresa logada: vai do formulário
    ...(cab.empresa ? { empresa_id: Number(cab.empresa) } : {}),
    empresa_usuario_id: idOuNull(cab.usuario),
    produto_saida_tipo_id: idOuNull(cab.tipo),
    produto_saida_fluxo_id: idOuNull(cab.fluxo),
    equipamento_id: idOuNull(cab.equipamento),
    veiculo_id: idOuNull(cab.veiculo),
    lancamento_centro_custo_id: idOuNull(cab.centroCusto),
    vprod: Number(vprod.toFixed(2)),
    vserv: Number(cab.vserv) || 0,
    vdesc: Number(cab.vdesc) || 0,
    vfrete: Number(cab.vfrete) || 0,
    voutro: Number(cab.voutro) || 0,
    descprod: cab.descprod,
    descserv: cab.descserv,
    infcpl: cab.infcpl,
    produto_saida_items_attributes: itens.map((i) =>
      i.remover
        ? { id: i.id, _destroy: true }
        : {
            ...(i.id ? { id: i.id } : {}),
            produto_id: Number(i.produtoId),
            xprod: i.xprod,
            qcom: Number(i.qcom) || 0,
            vuncom: Number(i.vuncom) || 0,
          },
    ),
  });

  const salvar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bloqueada) return setErros(["Saída liberada não pode ser editada."]);
    if (!e.currentTarget.reportValidity()) return;
    if (ativos.length === 0) return setErros(["Lance ao menos um produto."]);
    if (ativos.some((i) => !(Number(i.qcom) > 0)))
      return setErros(["Há produto com quantidade zerada."]);
    setErros([]);
    setSalvando(true);
    try {
      setSalva(await salvarProdutoSaida(id, montarPayload()));
    } catch (err) {
      setErros(
        err instanceof ApiErro && err.erros
          ? mensagensValidacao(err.erros)
          : [(err as Error).message],
      );
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async () => {
    if (
      !id ||
      bloqueada ||
      !confirm(`Excluir a saída nº ${id}? Essa ação não pode ser desfeita.`)
    )
      return;
    setSalvando(true);
    try {
      await excluirProdutoSaida(id);
      onFechar();
    } catch (err) {
      setErros([(err as Error).message]);
      setSalvando(false);
    }
  };

  const seguir = (imprimir: boolean) => {
    if (!salva) return;
    if (imprimir) imprimirSaida(salva, catalogos);
    if (id === null) onCriado(salva.id);
    else onFechar();
  };

  if (carregando) return <p className="muted">Carregando…</p>;

  const botoes = bloqueada ? (
    <>
      <button
        type="button"
        onClick={() => original && imprimirSaida(original, catalogos)}
      >
        <IconePdf width={16} height={16} /> PDF
      </button>
      <button type="button" className="primario" onClick={onFechar}>
        Voltar
      </button>
    </>
  ) : (
    <>
      {id && (
        <button
          type="button"
          className="perigo"
          onClick={excluir}
          disabled={salvando}
        >
          <IconeLixeira width={16} height={16} /> Excluir
        </button>
      )}
      <button type="button" onClick={onFechar}>
        Cancelar
      </button>
      <button className="primario" type="submit" disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar saída"}
      </button>
    </>
  );

  return (
    <form onSubmit={salvar} className="pagina">
      <div className="barra">
        <h2>
          {id ? `Saída nº ${id}` : "Nova saída de produtos"}
          <small>
            {dhemi ? `Emitida em ${data(dhemi)} · ` : ""}
            {bloqueada
              ? "Somente consulta."
              : "Os dados vão direto para a Progete ao salvar."}
          </small>
        </h2>
        <div className="acoes">{botoes}</div>
      </div>

      {bloqueada && (
        <div className="aviso-bloqueio" role="status">
          <IconeCadeado width={18} height={18} />
          <span>
            <b>Saída liberada.</b> Depois de liberada, a saída não pode mais ser
            editada nem excluída.
          </span>
        </div>
      )}

      {/* Liberada: todos os campos ficam desabilitados de uma vez */}
      <fieldset className="campos-saida" disabled={bloqueada}>
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

        <Secao
          icone={<IconeDocumento width={18} height={18} />}
          cor="azul"
          titulo="Requisição"
        >
          <div className="campos">
            <Campo rotulo="Empresa" obrigatorio>
              <Select
                value={cab.empresa}
                onChange={(v) => set("empresa", v)}
                opcoes={catalogos.empresas.map((e) => ({
                  id: e.id,
                  rotulo: e.nome_fantasia || `#${e.id}`,
                }))}
                obrigatorio
              />
            </Campo>
            <Campo rotulo="Centro de custo" obrigatorio>
              <Select
                value={cab.centroCusto}
                onChange={(v) => set("centroCusto", v)}
                opcoes={opcoes(catalogos.centro_custos)}
                vazio="Nenhum"
              />
            </Campo>
            <Campo rotulo="Tipo" obrigatorio>
              <Select
                value={cab.tipo}
                onChange={(v) => set("tipo", v)}
                opcoes={opcoes(catalogos.tipos)}
                obrigatorio
              />
            </Campo>
            <Campo rotulo="Fluxo" obrigatorio>
              <Select
                value={cab.fluxo}
                onChange={(v) => set("fluxo", v)}
                opcoes={opcoes(catalogos.fluxos)}
                obrigatorio
              />
            </Campo>
          </div>
        </Secao>

        <Secao
          icone={<IconeFabrica width={18} height={18} />}
          cor="violeta"
          titulo="Destino"
        >
          <div className="campos">
            <Campo rotulo="Usuário" obrigatorio>
              <Select
                value={cab.usuario}
                onChange={(v) => set("usuario", v)}
                opcoes={opcoes(catalogos.usuarios)}
                obrigatorio
              />
            </Campo>
            <Campo rotulo="Equipamento">
              <Select
                value={cab.equipamento}
                onChange={(v) => set("equipamento", v)}
                opcoes={opcoes(catalogos.equipamentos)}
                vazio="Nenhum"
              />
            </Campo>
            <Campo rotulo="Veículo">
              <Select
                value={cab.veiculo}
                onChange={(v) => set("veiculo", v)}
                opcoes={opcoes(catalogos.veiculos)}
                vazio="Nenhum"
              />
            </Campo>
          </div>
        </Secao>

        <Secao
          icone={<IconeCaixa width={18} height={18} />}
          cor="ambar"
          titulo="Produtos"
          acao={
            <div className="produtos-atualizar">
              <small className="muted">
                {catalogos.produtos.length} produtos
              </small>
              <button
                type="button"
                onClick={atualizarProdutos}
                disabled={atualizando}
                title="Buscar a lista de produtos de novo na Progete"
              >
                <IconeAtualizar
                  width={16}
                  height={16}
                  className={atualizando ? "girando" : undefined}
                />
                {atualizando ? "Atualizando…" : "Atualizar produtos"}
              </button>
            </div>
          }
        >
          <StatusProdutos />
          <Pdv
            produtos={catalogos.produtos}
            itens={itens}
            setItens={setItens}
            extras={{
              vserv: cab.vserv,
              vfrete: cab.vfrete,
              voutro: cab.voutro,
              vdesc: cab.vdesc,
            }}
            onExtra={set}
          />
        </Secao>

        <Secao
          icone={<IconeDocumento width={18} height={18} />}
          cor="ambar"
          titulo="Observações"
        >
          <div className="campos">
            <Campo rotulo="Descrição dos produtos" largo>
              <textarea
                rows={2}
                value={cab.descprod}
                onChange={(e) => set("descprod", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Descrição dos serviços" largo>
              <textarea
                rows={2}
                value={cab.descserv}
                onChange={(e) => set("descserv", e.target.value)}
              />
            </Campo>
            <Campo rotulo="Informações complementares" largo>
              <textarea
                rows={2}
                value={cab.infcpl}
                onChange={(e) => set("infcpl", e.target.value)}
              />
            </Campo>
          </div>
        </Secao>
      </fieldset>

      <div className="rodape-form">{botoes}</div>

      {salva && <PerguntaPdf saida={salva} onResposta={seguir} />}
    </form>
  );
}

function PerguntaPdf({
  saida,
  onResposta,
}: {
  saida: ProdutoSaida;
  onResposta: (imprimir: boolean) => void;
}) {
  const botao = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    botao.current?.focus();
    const esc = (e: globalThis.KeyboardEvent) =>
      e.key === "Escape" && onResposta(false);
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onResposta]);

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pergunta-pdf"
    >
      <div className="card">
        <div className="modal-icone">
          <IconeCheck width={26} height={26} />
        </div>
        <h3 id="pergunta-pdf">Saída nº {saida.id} salva</h3>
        <p className="muted">Quer imprimir ou salvar o comprovante em PDF?</p>
        <div className="modal-acoes">
          <button type="button" onClick={() => onResposta(false)}>
            Agora não
          </button>
          <button
            type="button"
            className="primario"
            ref={botao}
            onClick={() => onResposta(true)}
          >
            <IconePdf width={16} height={16} /> Imprimir PDF
          </button>
        </div>
      </div>
    </div>
  );
}
