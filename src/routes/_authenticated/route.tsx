import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { aplicarConvite } from "@/lib/dcs/convite";
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
    const access = await aplicarConvite(context.queryClient, data.session.user.id);
    // Troca de senha obrigatória (senha provisória ou convite por e-mail): o banco já bloqueia os dados; aqui só direcionamos.
    // O builder do PostgREST é "thenable", mas não tem .catch: envolve em Promise real.
    const seg = await Promise.resolve(
      (
        supabase.rpc as unknown as (
          f: string,
        ) => PromiseLike<{ data: { pendente?: boolean } | null }>
      )("dcs_situacao_senha"),
    ).catch(() => ({ data: null }));
    if (seg.data?.pendente) throw redirect({ to: "/definir-senha" as never });
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
