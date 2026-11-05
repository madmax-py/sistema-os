import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Catalogos, Manutencao } from "../api";
import { exportarXlsx } from "../exportar";
import { exportarModeloAtividades } from "../exportarModelo";
import { IconePlanilha } from "./Icones";

type Formato = "padrao" | "atividades";

const EMPRESA_KEY = "progete_os_empresa_relatorio";
const FORMATO_KEY = "progete_os_formato_excel";

const ler = (k: string) => {
  try {
    return localStorage.getItem(k) ?? "";
  } catch {
    return "";
  }
};
const gravar = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* sem armazenamento: só não lembra a escolha */
  }
};

const FORMATOS: { id: Formato; titulo: string; desc: string }[] = [
  {
    id: "padrao",
    titulo: "Padrão",
    desc: "Todas as colunas da O.S., com abas de materiais e serviços de terceiros.",
  },
  {
    id: "atividades",
    titulo: "Relatório de atividades",
    desc: "Resumo geral por setor (manutenções, tipos, horas e categorias) e detalhamento por setor.",
  },
];

/** Escolha do formato da planilha antes de baixar */
export function ExportarExcel({
  lista,
  catalogos,
  dataInicio,
  dataFim,
  onFechar,
}: {
  lista: Manutencao[];
  catalogos: Catalogos;
  dataInicio: string;
  dataFim: string;
  onFechar: () => void;
}) {
  const [formato, setFormato] = useState<Formato>(() => (ler(FORMATO_KEY) === "atividades" ? "atividades" : "padrao"));
  const [empresa, setEmpresa] = useState(() => ler(EMPRESA_KEY));
  const botao = useRef<HTMLButtonElement>(null);
  const fechar = useRef(onFechar);
  fechar.current = onFechar;

  useEffect(() => {
    botao.current?.focus();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && fechar.current();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, []);

  const baixar = () => {
    gravar(FORMATO_KEY, formato);
    if (formato === "padrao") exportarXlsx(lista, catalogos);
    else {
      gravar(EMPRESA_KEY, empresa.trim());
      exportarModeloAtividades(lista, catalogos, { empresa: empresa.trim(), dataInicio, dataFim });
    }
    onFechar();
  };

  // No <body>: a lista tem animação com transform, que prenderia o "fixed" a ela
  return createPortal(
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="titulo-excel" onClick={onFechar}>
      <div className="card painel-excel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icone">
          <IconePlanilha width={26} height={26} />
        </div>
        <h3 id="titulo-excel">Exportar Excel</h3>
        <p className="muted">{lista.length} O.S. da lista atual. Escolha o modelo da planilha:</p>

        <div className="opcoes-excel" role="radiogroup" aria-label="Modelo da planilha">
          {FORMATOS.map((f) => (
            <label key={f.id} className={`opcao-excel${formato === f.id ? " ativa" : ""}`}>
              <input
                type="radio"
                name="formato-excel"
                value={f.id}
                checked={formato === f.id}
                onChange={() => setFormato(f.id)}
              />
              <span>
                <b>{f.titulo}</b>
                <small>{f.desc}</small>
              </span>
            </label>
          ))}
        </div>

        {formato === "atividades" && (
          <label className="campo-empresa">
            <span>Empresa no cabeçalho</span>
            <input
              value={empresa}
              onChange={(e) => setEmpresa(e.target.value)}
              placeholder="Ex.: nome da empresa"
              onKeyDown={(e) => e.key === "Enter" && baixar()}
            />
          </label>
        )}

        <div className="modal-acoes">
          <button type="button" onClick={onFechar}>
            Cancelar
          </button>
          <button type="button" className="primario" ref={botao} onClick={baixar}>
            <IconePlanilha width={16} height={16} /> Baixar
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
