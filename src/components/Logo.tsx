/** Logo ProFinanças: versão ciano no tema claro, branca no escuro (troca via CSS). */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <>
      <img src="/profinancas-logo.png" alt="ProFinanças" className={`logo claro ${className}`} draggable={false} />
      <img src="/profinancas-logo-branco.png" alt="ProFinanças" className={`logo escuro ${className}`} draggable={false} />
    </>
  );
}
