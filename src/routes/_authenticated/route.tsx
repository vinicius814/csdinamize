import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { accountQueryOptions } from "@/lib/account-query";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { destination } from "@/lib/access";
import { destinoLegado } from "@/lib/legado";
import { Shell } from "@/components/dcs/Shell";

function erroOAuthNaUrl(): string | undefined {
  const busca = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (busca.get("error_description") ?? hash.get("error_description") ?? undefined)?.replace(
    /\+/g,
    " ",
  );
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingMs: 0,
  pendingMinMs: 0,
  pendingComponent: PageSkeleton,
  beforeLoad: async ({ location, context }) => {
    const erro = erroOAuthNaUrl();
    if (erro) throw redirect({ to: "/auth", search: { erro } });
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: {} });
    let access = await context.queryClient.ensureQueryData(
      accountQueryOptions(data.session.user.id),
    );
    if (access.status === "pendente") {
      // Pré-cadastro do Dinamize CS: o banco compara o e-mail verificado do login e aplica as permissões definidas.
      const r = await (supabase.rpc as unknown as (f: string) => Promise<{ data: unknown }>)(
        "dcs_reivindicar_acesso",
      ).catch(() => ({ data: false }));
      if (r.data === true)
        access = await context.queryClient.fetchQuery({
          ...accountQueryOptions(data.session.user.id),
          staleTime: 0,
        });
    }
    const to = destination(access.status, access.accepted, access.onboarded, access.role);
    if (to !== "/" && location.pathname !== to && location.pathname !== "/admin")
      throw redirect({ to });
    if (to === "/aguardando") throw redirect({ to });
    const legado = destinoLegado(location.pathname, access.role);
    if (legado) throw redirect({ to: legado as never, replace: true });
  },
  component: () => (
    <Shell>
      <Outlet />
    </Shell>
  ),
});
