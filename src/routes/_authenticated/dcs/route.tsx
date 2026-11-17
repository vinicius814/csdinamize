import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { NAV } from "@/components/dcs/navegacao";

export const Route = createFileRoute("/_authenticated/dcs")({
  head: () => ({ meta: [{ title: "Dinamize CS — Plano de Ação e Diagnóstico de Contas" }] }),
  component: Layout,
});

/** Gate de módulo (apenas experiência: o banco aplica RLS e permissões em cada consulta e escrita). */
function Layout() {
  const acesso = useAcessoDcs();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const perfil = acesso.data?.perfil ?? null;
  if (acesso.isLoading)
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (!perfil)
    return (
      <Aviso
        titulo="Sem acesso ao Dinamize CS"
        texto="Seu usuário ainda não foi incluído no Dinamize CS. Peça a um administrador para definir seu perfil e as carteiras que você acompanha."
      />
    );
  const mods: readonly string[] = acesso.data?.modulos ?? MODULOS_POR_PERFIL[perfil];
  const item = [...NAV]
    .sort((a, b) => b.to.length - a.to.length)
    .find((i) => (i.exato ? path === i.to || path === i.to + "/" : path.startsWith(i.to)));
  if (item && !mods.includes(item.mod))
    return (
      <Aviso
        titulo="Área restrita"
        texto="Seu perfil não tem acesso a esta área. Se precisar dela, fale com um administrador."
      />
    );
  return <Outlet />;
}

function Aviso({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border bg-card p-8 text-center shadow-sm">
      <ShieldAlert className="mx-auto h-8 w-8 text-primary" />
      <h2 className="mt-3 text-lg font-semibold">{titulo}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{texto}</p>
    </div>
  );
}
