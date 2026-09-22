import type { ReactNode } from "react";
import { IconeCaixa, IconeChave, IconeDocumento } from "./Icones";

export type AbaOS = "dados" | "materiais" | "servicos";

/** Abas em pílula, no estilo das abas do VIBRACOMOS (cada uma com sua cor) */
export function Abas({
  ativa,
  onChange,
  materiais,
  servicos,
}: {
  ativa: AbaOS;
  onChange: (aba: AbaOS) => void;
  materiais: number;
  servicos: number;
}) {
  const abas: { id: AbaOS; rotulo: string; cor: string; icone: ReactNode; contador?: number }[] = [
    { id: "dados", rotulo: "Dados gerais", cor: "azul", icone: <IconeDocumento width={16} height={16} /> },
    { id: "materiais", rotulo: "Materiais", cor: "ambar", icone: <IconeCaixa width={16} height={16} />, contador: materiais },
    { id: "servicos", rotulo: "Serviços", cor: "verde", icone: <IconeChave width={16} height={16} />, contador: servicos },
  ];
  return (
    <div className="abas" role="tablist">
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={ativa === a.id}
          aria-label={a.rotulo}
          className={`${a.cor}${ativa === a.id ? " ativa" : ""}`}
          onClick={() => onChange(a.id)}
        >
          {a.icone}
          <span className="texto-aba">{a.rotulo}</span>
          {a.contador !== undefined && <span className="contador">{a.contador}</span>}
        </button>
      ))}
    </div>
  );
}
