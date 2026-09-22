import { useEffect, useMemo, useState } from "react";
import { listarManutencoes, type Manutencao } from "../api";
import { data, hoje } from "../formato";
import { IconeAtualizar, IconeBusca, IconeChave, IconeMais } from "./Icones";

export function Lista({
  onAbrir,
  onNova,
}: {
  onAbrir: (id: number) => void;
  onNova: () => void;
}) {
  const [lista, setLista] = useState<Manutencao[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");

  const carregar = () => {
    setErro(null);
    setLista(null);
    listarManutencoes()
      .then((l) => setLista([...l].sort((a, b) => b.id - a.id)))
      .catch((e) => setErro(e.message));
  };

  useEffect(carregar, []);

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
      total: lista?.length ?? 0,
      mes: lista?.filter((m) => m.dt_programada?.startsWith(mes)).length ?? 0,
      hoje: lista?.filter((m) => m.dt_programada === h).length ?? 0,
    };
  }, [lista]);

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
                <th>Equipamento</th>
                <th>Tipo</th>
                <th>Prioridade</th>
                <th>Fluxo</th>
                <th>Solicitante</th>
              </tr>
            </thead>
            <tbody>
              {filtrada.map((m) => (
                <tr key={m.id} onClick={() => onAbrir(m.id)} className="clicavel">
                  <td className="num">#{m.id}</td>
                  <td>{data(m.dt_programada)}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
