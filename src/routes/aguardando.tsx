import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { accountQueryOptions } from "@/lib/account-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { accountState, acceptTerms } from "@/lib/account.functions";
import { destination } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Marca } from "@/components/dcs/Marca";
import { aplicarConvite } from "@/lib/dcs/convite";
import { ACESSO_NEGADO } from "@/lib/dcs/ajuda";
export const Route = createFileRoute("/aguardando")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { redirect } = await import("@tanstack/react-router");
      throw redirect({ to: "/auth", search: {} });
    }
  },
  head: () => ({
    meta: [
      { title: "Liberação da conta — Dinamize CS" },
      { name: "description", content: "Acompanhe a liberação da sua conta no Dinamize CS." },
      { property: "og:title", content: "Liberação da conta — Dinamize CS" },
      { property: "og:description", content: "Estado do seu acesso ao Dinamize CS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Waiting,
});
function Waiting() {
  const { session, sair } = useAuth(),
    qc = useQueryClient(),
    accept = useServerFn(acceptTerms),
    nav = useNavigate(),
    [checked, setChecked] = useState(false),
    [error, setError] = useState<string | null>(null);
  const q = useQuery({
    ...accountQueryOptions(session?.user.id ?? "signed-out"),
    enabled: !!session,
  });
  const a = q.data;
  useEffect(() => {
    if (!session || a?.status !== "pendente") return;
    void (async () => {
      const n = await aplicarConvite(qc, session.user.id);
      if (n.status === "ativo")
        nav({ to: destination(n.status, n.accepted, n.onboarded, n.role), replace: true });
    })();
  }, [a?.status, session?.user.id]);
  async function verify() {
    try {
      if (a && !a.accepted && a.status === "ativo") {
        if (!checked) return;
        await accept({ data: { accepted: true } });
      }
      if (!session) return;
      await qc.invalidateQueries({ queryKey: ["account-state", session.user.id] });
      const next = await aplicarConvite(qc, session.user.id);
      nav({
        to: destination(next.status, next.accepted, next.onboarded, next.role),
        replace: true,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não consegui verificar.");
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm rounded-xl border bg-card p-8 text-center shadow-[var(--glow)]">
        <div className="flex justify-center">
          <Marca semSegmento />
        </div>
        <h1 className="mt-5 text-xl font-semibold">
          {a && !a.accepted && a.status === "ativo"
            ? "Antes de continuar"
            : "Acesso não autorizado"}
        </h1>
        <p className="my-4 text-sm text-muted-foreground">
          {a && !a.accepted && a.status === "ativo"
            ? "Confirme o aceite dos termos para concluir seu primeiro acesso."
            : ACESSO_NEGADO}
        </p>
        {a && !a.accepted && a.status === "ativo" && (
          <label className="my-4 flex gap-2 text-left text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>
              Aceito os{" "}
              <Link to="/termos" target="_blank" className="text-primary">
                Termos de Uso
              </Link>{" "}
              e a{" "}
              <Link to="/privacidade" target="_blank" className="text-primary">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
        )}
        <Button
          className="w-full"
          onClick={verify}
          disabled={!!a && !a.accepted && a.status === "ativo" && !checked}
        >
          {a && !a.accepted && a.status === "ativo" ? "Aceitar e continuar" : "Tentar novamente"}
        </Button>
        {(error || q.isError) && (
          <p role="alert" className="mt-4 text-destructive">
            {error ?? q.error?.message}
          </p>
        )}
        <Button
          variant="ghost"
          className="mt-4"
          onClick={async () => {
            await sair();
            nav({ to: "/auth", search: {}, replace: true });
          }}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}
