import { useCallback, useEffect, useState } from "react";
import {
  carregarCatalogos,
  carregarDominioFixo,
  getDominio,
  getSessao,
  onSessaoExpirada,
  sair,
  type Catalogos,
  type Sessao,
} from "./api";
import { Conexao } from "./components/Conexao";
import { Dashboard } from "./components/Dashboard";
import { Detalhe } from "./components/Detalhe";
import { Formulario } from "./components/Formulario";
import { Layout, type Pagina } from "./components/Layout";
import { Lista } from "./components/Lista";
import { Login } from "./components/Login";

type Tela =
  | { nome: "lista" }
  | { nome: "painel" }
  | { nome: "detalhe"; id: number }
  | { nome: "form"; id: number | null };

export function App() {
  const [dominio, setDominio] = useState<string | null>(getDominio);
  // undefined = ainda consultando o servidor; null = sem domínio fixo
  const [dominioFixo, setDominioFixo] = useState<string | null | undefined>(undefined);
  // Sem domínio fixo, a conexão é verificada a cada acesso (antes de cada login)
  const [conectado, setConectado] = useState(() => getSessao() !== null);
  const [sessao, setSessao] = useState<Sessao | null>(getSessao);
  const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
  const [erroCatalogos, setErroCatalogos] = useState<string | null>(null);
  const [tela, setTela] = useState<Tela>({ nome: "lista" });

  const deslogar = useCallback(() => {
    sair();
    setSessao(null);
    setConectado(false);
    setCatalogos(null);
    setTela({ nome: "lista" });
  }, []);

  useEffect(() => onSessaoExpirada(deslogar), [deslogar]);

  // PROGETE_URL definida no servidor → domínio fixo, sem tela de conexão
  useEffect(() => {
    carregarDominioFixo().then((fixo) => {
      setDominioFixo(fixo);
      if (fixo) {
        setDominio(fixo);
        setSessao(getSessao()); // sessão de outro domínio deixa de valer
      }
    });
  }, []);

  useEffect(() => {
    if (!sessao) return;
    setErroCatalogos(null);
    carregarCatalogos()
      .then(setCatalogos)
      .catch((e) => setErroCatalogos(e.message));
  }, [sessao]);

  // Volta à etapa de conexão (já preenchida com o domínio atual)
  const trocarDominio = deslogar;

  if (dominioFixo === undefined) return <div className="aurora" aria-hidden />;

  // Etapa 1 (só sem domínio fixo): domínio da API verificado · Etapa 2: login na Progete
  if (!dominio || (!dominioFixo && !conectado)) {
    return (
      <Conexao
        onConectado={(origem) => {
          setDominio(origem);
          setConectado(true);
        }}
      />
    );
  }
  if (!sessao) {
    return <Login dominio={dominio} onEntrar={setSessao} onTrocarDominio={dominioFixo ? undefined : trocarDominio} />;
  }

  const pagina: Pagina | null =
    tela.nome === "lista" || tela.nome === "painel"
      ? tela.nome
      : tela.nome === "form" && tela.id === null
      ? "nova"
      : null;

  return (
    <Layout
      sessao={sessao}
      pagina={pagina}
      onPagina={(p) => setTela(p === "nova" ? { nome: "form", id: null } : { nome: p })}
      onSair={deslogar}
    >
      {erroCatalogos && (
        <div className="erro-caixa">
          Não foi possível carregar os cadastros da Progete: {erroCatalogos}{" "}
          <button onClick={() => setSessao({ ...sessao })}>Tentar de novo</button>
        </div>
      )}
      {!catalogos && !erroCatalogos && <p className="muted">Carregando cadastros…</p>}

      {catalogos && (
        <div key={"id" in tela ? `${tela.nome}-${tela.id}` : tela.nome} className="fade-up">
          {tela.nome === "painel" && (
            <Dashboard catalogos={catalogos} onAbrir={(id) => setTela({ nome: "detalhe", id })} />
          )}
          {tela.nome === "lista" && (
            <Lista onAbrir={(id) => setTela({ nome: "detalhe", id })} onNova={() => setTela({ nome: "form", id: null })} />
          )}
          {tela.nome === "detalhe" && (
            <Detalhe
              id={tela.id}
              catalogos={catalogos}
              onVoltar={() => setTela({ nome: "lista" })}
              onEditar={() => setTela({ nome: "form", id: tela.id })}
            />
          )}
          {tela.nome === "form" && (
            <Formulario
              id={tela.id}
              catalogos={catalogos}
              solicitantePadrao={sessao.nome}
              onSalvo={(id) => setTela({ nome: "detalhe", id })}
              onCancelar={() => setTela(tela.id ? { nome: "detalhe", id: tela.id } : { nome: "lista" })}
            />
          )}
        </div>
      )}
    </Layout>
  );
}
