import { createFileRoute } from "@tanstack/react-router";
import { UserMenu } from "@/components/UserMenu";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Munim" },
      { name: "description", content: "Munim, seu assistente de Customer Success." },
      { property: "og:title", content: "Início — Munim" },
      { property: "og:description", content: "Munim, seu assistente de Customer Success." },
    ],
  }),
  component: Inicio,
});

function Inicio() {
  const { perfil, carregando } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-display text-2xl text-foreground">Munim</span>
        <UserMenu />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-16">
        <h1 className="font-display text-4xl text-foreground">
          {carregando ? "Carregando…" : `Olá${perfil?.nome ? `, ${perfil.nome.split(" ")[0]}` : ""}.`}
        </h1>
        {!carregando && !perfil && (
          <p className="mt-4 text-muted-foreground">
            Seu perfil ainda não foi encontrado. Atualize a página em instantes.
          </p>
        )}
      </main>
    </div>
  );
}
