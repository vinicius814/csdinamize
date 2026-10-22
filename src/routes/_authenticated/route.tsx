import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

function erroOAuthNaUrl(): string | undefined {
  const busca = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    busca.get("error_description") ?? hash.get("error_description") ?? undefined
  )?.replace(/\+/g, " ");
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const erro = erroOAuthNaUrl();
    if (erro) throw redirect({ to: "/auth", search: { erro } });
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: {} });
  },
  component: () => <Outlet />,
});
