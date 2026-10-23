import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { accountQueryOptions } from "@/lib/account-query";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { destination } from "@/lib/access";
import { AppShell } from "@/components/munim/AppShell";

function erroOAuthNaUrl(): string | undefined {
  const busca = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    busca.get("error_description") ?? hash.get("error_description") ?? undefined
  )?.replace(/\+/g, " ");
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
    const access = await context.queryClient.ensureQueryData(accountQueryOptions(data.session.user.id));
    const to = destination(access.status, access.accepted, access.onboarded, access.role);
    if (to !== "/" && location.pathname !== to && location.pathname !== "/admin") throw redirect({ to });
    if (to === "/aguardando") throw redirect({ to });
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
