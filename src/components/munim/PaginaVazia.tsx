import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Cabecalho({ titulo, frase }: { titulo: string; frase: string }) {
  return (
    <header className="mb-8">
      <h1 className="text-3xl font-semibold text-foreground md:text-4xl">{titulo}</h1>
      <p className="mt-2 text-muted-foreground">{frase}</p>
    </header>
  );
}

export function EstadoVazio({ icon: Icon, titulo, texto, acao }: { icon: LucideIcon; titulo: string; texto: string; acao?: ReactNode }) {
  return (
    <div className="card-munim flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-full bg-primary-soft text-primary shadow-glow-sm">
        <Icon className="h-6 w-6" />
      </div>
      <p className="font-display text-lg text-foreground">{titulo}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>
      {acao && <div className="mt-5">{acao}</div>}
    </div>
  );
}

export function Pagina({ children, larga }: { children: ReactNode; larga?: boolean }) {
  return <div className={`mx-auto w-full ${larga ? "max-w-7xl" : "max-w-5xl"} px-5 py-8 md:px-10 md:py-12 animate-in fade-in duration-200`}>{children}</div>;
}
