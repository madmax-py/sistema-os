// Seletor em cartões (no estilo do "Nível de Prioridade" do VIBRACOMOS).
// As opções vêm dos catálogos da Progete, então ícone, cor e descrição de
// cada cartão são deduzidos do nome da opção.
import type { ReactNode } from "react";
import type { Opcao } from "../api";
import {
  IconeAlerta,
  IconeChama,
  IconeCheck,
  IconeChave,
  IconeFolha,
  IconeRaio,
  IconeRelogio,
  IconeSeta,
  IconeX,
} from "./Icones";

export type TipoCartao = "prioridade" | "fluxo";

interface Estilo {
  cor: "rosa" | "ambar" | "verde" | "azul" | "neutro";
  icone: ReactNode;
  desc?: string;
}

const tam = { width: 18, height: 18 };

const REGRAS: Record<TipoCartao, Array<[RegExp, Estilo]>> = {
  prioridade: [
    [/urg|cr[ií]t|emerg|alt[ao]?\b|m[aá]xim/i, { cor: "rosa", icone: <IconeChama {...tam} />, desc: "Máquina parada / risco iminente" }],
    [/m[eé]di|normal|moder/i, { cor: "ambar", icone: <IconeRaio {...tam} />, desc: "Impacta produção parcialmente" }],
    [/baix|leve|m[ií]nim/i, { cor: "verde", icone: <IconeFolha {...tam} />, desc: "Sem impacto imediato" }],
  ],
  fluxo: [
    [/cancel/i, { cor: "rosa", icone: <IconeX {...tam} />, desc: "Serviço cancelado" }],
    [/conclu|finaliz|fechad|encerr|resolv|entreg/i, { cor: "verde", icone: <IconeCheck {...tam} />, desc: "Serviço finalizado" }],
    [/andamento|execu|atend|progress|iniciad/i, { cor: "azul", icone: <IconeChave {...tam} />, desc: "Em execução" }],
    [/abert|novo|pend|aguard|fila|solicit|agend/i, { cor: "ambar", icone: <IconeRelogio {...tam} />, desc: "Aguardando atendimento" }],
  ],
};

const PADRAO: Record<TipoCartao, Estilo> = {
  prioridade: { cor: "neutro", icone: <IconeAlerta {...tam} /> },
  fluxo: { cor: "neutro", icone: <IconeSeta {...tam} /> },
};

export function estiloDaOpcao(tipo: TipoCartao, descricao: string): Estilo {
  return REGRAS[tipo].find(([re]) => re.test(descricao))?.[1] ?? PADRAO[tipo];
}

export function Cartoes({
  tipo,
  opcoes,
  valor,
  onChange,
  obrigatorio,
  rotulo,
}: {
  tipo: TipoCartao;
  opcoes: Opcao[];
  valor: string;
  onChange: (v: string) => void;
  obrigatorio?: boolean;
  rotulo: string;
}) {
  if (!opcoes.length) return <div className="vazio">Nenhuma opção cadastrada na Progete.</div>;
  return (
    <div className="cartoes" role="radiogroup" aria-label={rotulo}>
      {opcoes.map((o) => {
        const e = estiloDaOpcao(tipo, o.descricao);
        const ativo = valor === String(o.id);
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={ativo}
            className={`cartao ${e.cor}${ativo ? " ativo" : ""}`}
            onClick={() => onChange(String(o.id))}
          >
            <span className="cartao-topo">
              <span className="cartao-icone">{e.icone}</span>
              <span className="cartao-nome">{o.descricao}</span>
              {ativo && (
                <span className="cartao-check">
                  <IconeCheck width={12} height={12} strokeWidth={3} />
                </span>
              )}
            </span>
            {e.desc && <span className="cartao-desc">{e.desc}</span>}
          </button>
        );
      })}
      {/* Mantém a validação nativa de obrigatório (o formulário abre a aba e mostra o aviso aqui) */}
      <input
        className="validacao-oculta"
        tabIndex={-1}
        aria-hidden
        required={obrigatorio}
        value={valor}
        onChange={() => {}}
      />
    </div>
  );
}
