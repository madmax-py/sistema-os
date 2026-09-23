import { useEffect, useState, type ReactNode } from "react";
import { lerManutencao, type Catalogos, type Manutencao } from "../api";
import { imprimirOS } from "../exportar";
import { data, hora, moeda } from "../formato";
import { Abas, type AbaOS } from "./Abas";
import { IconeCaixa, IconeCalendario, IconeChave, IconeDocumento, IconeEditar, IconeFabrica, IconePdf, IconeVoltar } from "./Icones";

function Info({ rotulo, valor, largo }: { rotulo: string; valor: ReactNode; largo?: boolean }) {
  return (
    <div className={`info${largo ? " largo" : ""}`}>
      <span className="rotulo">{rotulo}</span>
      <span className={`valor${largo ? " texto" : ""}`}>{valor || "—"}</span>
    </div>
  );
}

export function Secao({ icone, cor, titulo, acao, children }: {
  icone: ReactNode;
  cor: string;
  titulo: string;
  acao?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="card">
      <div className="secao-titulo">
        <span className={`chip ${cor}`}>{icone}</span>
        <h3>{titulo}</h3>
        {acao && <div className="secao-acao">{acao}</div>}
      </div>
      {children}
    </div>
  );
}

export function Detalhe({
  id,
  catalogos,
  onVoltar,
  onEditar,
}: {
  id: number;
  catalogos: Catalogos;
  onVoltar: () => void;
  onEditar: () => void;
}) {
  const [m, setM] = useState<Manutencao | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aba, setAba] = useState<AbaOS>("dados");

  useEffect(() => {
    lerManutencao(id).then(setM).catch((e) => setErro(e.message));
  }, [id]);

  const produto = (pid: number) => catalogos.produtos.find((p) => p.id === pid);
  const unidade = (uid: number | null) => catalogos.unidades.find((u) => u.id === uid)?.descricao ?? "";
  const mantenedor = (mid: number) => catalogos.mantenedores.find((x) => x.id === mid)?.nome ?? `#${mid}`;

  if (erro) return <div className="erro-caixa">{erro}</div>;
  if (!m) return <p className="muted">Carregando…</p>;

  const itens = m.manutencao_items ?? [];
  const servicos = m.manutencao_servicos ?? [];
  const totalMateriais = itens.reduce((s, i) => s + i.qtde * i.preco_unit, 0);
  const totalServicos = servicos.reduce((s, x) => s + (x.vlcusto ?? 0), 0);

  return (
    <div className="pagina">
      <div className="barra">
        <h2>
          O.S. nº {m.id}
          <small>
            {m.manutencao_equipamento?.descricao ?? "Equipamento"} · programada para {data(m.dt_programada)}
          </small>
        </h2>
        <div className="acoes">
          <button onClick={onVoltar}>
            <IconeVoltar width={16} height={16} /> Voltar
          </button>
          <button onClick={() => imprimirOS(m, catalogos)} title="Gerar PDF desta O.S.">
            <IconePdf width={16} height={16} /> PDF
          </button>
          <button className="primario" onClick={onEditar}>
            <IconeEditar width={16} height={16} /> Editar
          </button>
        </div>
      </div>

      <Abas ativa={aba} onChange={setAba} materiais={itens.length} servicos={servicos.length} />

      {aba === "dados" && (
        <>
          <Secao icone={<IconeFabrica width={18} height={18} />} cor="azul" titulo="Equipamento e classificação">
            <div className="grade">
              <Info
                rotulo="Equipamento"
                valor={m.manutencao_equipamento && `${m.manutencao_equipamento.descricao} · ${m.manutencao_equipamento.codigo}`}
              />
              <Info rotulo="Localização" valor={m.manutencao_equipamento?.localizacao} />
              <Info rotulo="Tipo" valor={m.manutencao_tipo?.descricao} />
              <Info rotulo="Prioridade" valor={m.manutencao_prioridade?.descricao} />
              <Info rotulo="Fluxo" valor={m.manutencao_fluxo?.descricao} />
              <Info rotulo="Área" valor={m.manutencao_area?.descricao} />
              <Info rotulo="Outro" valor={m.manutencao_outro?.descricao} />
            </div>
          </Secao>
          <Secao icone={<IconeCalendario width={18} height={18} />} cor="violeta" titulo="Solicitação e datas">
            <div className="grade">
              <Info rotulo="Solicitante" valor={m.solicitante} />
              <Info rotulo="Programada" valor={data(m.dt_programada)} />
              <Info rotulo="Finalizada" valor={data(m.dt_finalizada)} />
              <Info rotulo="Ficha de produção" valor={m.cod_ficha_producao} />
              <Info
                rotulo="Recorrente"
                valor={m.recorrente ? `Sim — ${m.vezes_recorrente}x a cada ${m.dias_recorrente} dias` : "Não"}
              />
            </div>
          </Secao>
          <Secao icone={<IconeDocumento width={18} height={18} />} cor="ambar" titulo="Descrições">
            <div className="grade">
              <Info rotulo="Descrição do defeito" valor={m.descricao_defeito} largo />
              <Info rotulo="Informações adicionais" valor={m.infad} largo />
            </div>
          </Secao>
        </>
      )}

      {aba === "materiais" && (
        <Secao icone={<IconeCaixa width={18} height={18} />} cor="ambar" titulo="Materiais utilizados">
          {itens.length === 0 ? (
            <div className="vazio">Nenhum material nesta O.S.</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Material</th>
                    <th>Data</th>
                    <th>Qtde</th>
                    <th>Preço unit.</th>
                    <th>Total</th>
                    <th>Nº doc</th>
                  </tr>
                </thead>
                <tbody>
                  {itens.map((i) => {
                    const p = produto(i.manutencao_produto_id);
                    return (
                      <tr key={i.id}>
                        <td>{p?.descricao ?? `#${i.manutencao_produto_id}`}</td>
                        <td>{data(i.dt)}</td>
                        <td>
                          {i.qtde} {unidade(p?.produto_unidade_medida_id ?? null)}
                        </td>
                        <td>{moeda(i.preco_unit)}</td>
                        <td>{moeda(i.qtde * i.preco_unit)}</td>
                        <td>{i.nr_doc || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total de materiais</td>
                    <td colSpan={2}>{moeda(totalMateriais)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Secao>
      )}

      {aba === "servicos" && (
        <Secao icone={<IconeChave width={18} height={18} />} cor="verde" titulo="Serviços executados">
          {servicos.length === 0 ? (
            <div className="vazio">Nenhum serviço nesta O.S.</div>
          ) : (
            <div className="tabela-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mantenedor</th>
                    <th>Início</th>
                    <th>Término</th>
                    <th>Atividade</th>
                    <th>Custo</th>
                    <th>Nº doc</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((s) => (
                    <tr key={s.id}>
                      <td>{mantenedor(s.manutencao_mantenedor_id)}</td>
                      <td>
                        {data(s.dt_inicio)} {hora(s.hr_inicio)}
                      </td>
                      <td>
                        {data(s.dt_termino)} {hora(s.hr_termino)}
                      </td>
                      <td>{s.desc_atividade || "—"}</td>
                      <td>{moeda(s.vlcusto)}</td>
                      <td>{s.nr_doc || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>Total de serviços</td>
                    <td colSpan={2}>{moeda(totalServicos)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Secao>
      )}
    </div>
  );
}
