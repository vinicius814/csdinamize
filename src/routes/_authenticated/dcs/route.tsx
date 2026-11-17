import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";

export const Route = createFileRoute("/_authenticated/dcs")({
  head: () => ({ meta: [{ title: "Dinamize CS — Plano de Ação e Diagnóstico de Contas" }] }),
  component: Layout,
});

const ABAS = [
  { to: "/dcs", rotulo: "Visão geral", mod: "visao-geral", exato: true },
  { to: "/dcs/carteira", rotulo: "Carteira", mod: "carteira" },
  { to: "/dcs/analises", rotulo: "Minhas análises", mod: "minhas-analises" },
  { to: "/dcs/planos", rotulo: "Planos de ação", mod: "planos" },
  { to: "/dcs/cobertura", rotulo: "Cobertura de CS", mod: "cobertura" },
  { to: "/dcs/alertas", rotulo: "Alertas", mod: "visao-geral" },
  { to: "/dcs/integracoes", rotulo: "Integrações", mod: "configuracoes" },
] as const;

function Layout() {
  const acesso = useAcessoDcs();
  const perfil = acesso.data?.perfil ?? null;
  const mods: readonly string[] = perfil ? MODULOS_POR_PERFIL[perfil] : [];
  return (
    <div className="dcs -m-4 min-h-screen md:-m-8">
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 pt-4 md:px-8">
          <div className="flex items-center gap-2 pb-3">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
              D
            </span>
            <span className="font-semibold">Dinamize CS</span>
          </div>
          <nav className="flex flex-wrap gap-1 text-sm">
            {ABAS.filter((a) => mods.includes(a.mod)).map((a) => (
              <Link
                key={a.to}
                to={a.to}
                activeOptions={{ exact: "exato" in a }}
                className="rounded-t-md border-b-2 border-transparent px-3 pb-3 pt-1 text-muted-foreground hover:text-foreground"
                activeProps={{ className: "!border-primary !text-foreground font-medium" }}
              >
                {a.rotulo}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      <main className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        {acesso.isLoading ? (
          <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>
        ) : !perfil ? (
          <div className="mx-auto max-w-lg rounded-lg border bg-card p-8 text-center">
            <h1 className="text-lg font-semibold">Sem acesso ao Dinamize CS</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Peça a um administrador para incluir seu usuário e as carteiras que você acompanha.
            </p>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
    </div>
  );
}
