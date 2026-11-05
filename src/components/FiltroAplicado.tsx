import { useState, type ReactNode } from "react";
import { IconeBusca } from "./Icones";

/**
 * Filtro com rascunho (o que está nos campos) e aplicado (o que vale na tela),
 * como na lista de O.S.: mudar um campo não recarrega nada; só "Aplicar filtros".
 */
export function useFiltroAplicado<T extends object>(padrao: () => T, aoAplicar: () => void) {
  const [filtro, setFiltro] = useState<T>(padrao);
  const [rascunho, setRascunho] = useState<T>(padrao);

  const base = padrao();
  const chaves = Object.keys(base) as Array<keyof T>;
  const alterado = chaves.some((k) => rascunho[k] !== base[k] || filtro[k] !== base[k]);
  const pendente = chaves.some((k) => rascunho[k] !== filtro[k]);

  const set = <K extends keyof T>(k: K, v: T[K]) => setRascunho((f) => ({ ...f, [k]: v }));
  /** muda o campo no rascunho e no aplicado (ex.: ao trocar de aba) */
  const setAmbos = <K extends keyof T>(k: K, v: T[K]) => {
    setRascunho((f) => ({ ...f, [k]: v }));
    setFiltro((f) => ({ ...f, [k]: v }));
  };
  const aplicar = (f: T = rascunho) => {
    setFiltro(f);
    aoAplicar(); // busca de novo mesmo se o filtro não mudou
  };
  const limpar = () => {
    const f = padrao();
    setRascunho(f);
    aplicar(f);
  };

  return { filtro, rascunho, set, setAmbos, aplicar, limpar, alterado, pendente };
}

/** Faixa de ações no rodapé do card de filtros */
export function AcoesFiltro({ alterado, pendente, aviso, carregando, onLimpar, extra }: {
  alterado: boolean;
  pendente: boolean;
  /** erro de validação: bloqueia o Aplicar */
  aviso?: string | null;
  carregando?: boolean;
  onLimpar: () => void;
  /** botões extras à esquerda do Aplicar (ex.: exportar) */
  extra?: ReactNode;
}) {
  return (
    <div className="filtros-os-acoes">
      {aviso ? (
        <span className="filtros-os-aviso">{aviso}</span>
      ) : pendente ? (
        <span className="filtros-os-aviso">Filtros alterados — clique em Aplicar.</span>
      ) : null}
      {alterado && (
        <button type="button" onClick={onLimpar}>
          Limpar
        </button>
      )}
      {extra}
      <button type="submit" className="primario" disabled={!!aviso || carregando}>
        <IconeBusca width={16} height={16} /> {carregando ? "Carregando…" : "Aplicar filtros"}
      </button>
    </div>
  );
}
