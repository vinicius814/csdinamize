import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { traduzirErroLogin, useAuth } from "@/lib/auth";
import { Nucleo } from "@/components/munim/Nucleo";
import { Particulas } from "@/components/munim/Particulas";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { erro?: string } =>
    typeof s["erro"] === "string" ? { erro: s["erro"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Munim" },
      { name: "description", content: "Munim, seu segundo cérebro. Sempre um passo à frente." },
      { property: "og:title", content: "Entrar — Munim" },
      { property: "og:description", content: "Munim, seu segundo cérebro. Sempre um passo à frente." },
    ],
  }),
  component: Login,
});

function Login() {
  const { erro } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [falha, setFalha] = useState<string | null>(traduzirErroLogin(erro));
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (session) navigate({ to: "/", replace: true });
  }, [session, navigate]);

  const entrar = async () => {
    setFalha(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setFalha(traduzirErroLogin(error.message));
      setEnviando(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-6">
      <Particulas />
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center animate-in fade-in duration-300">
        <Nucleo tamanho={180} estado={enviando ? "pensando" : "repouso"} />
        <h1 className="mt-8 font-display text-5xl font-semibold text-foreground">Munim</h1>
        <p className="mt-1 text-xs text-muted-foreground">por Wojtec</p>
        <p className="mt-6 text-balance text-lg text-foreground/90">
          Seu segundo cérebro. Sempre um passo à frente.
        </p>
        <Button size="lg" className="mt-10 w-full gap-3 shadow-glow" onClick={entrar} disabled={enviando}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.71 14.54 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
          </svg>
          {enviando ? "Abrindo o Google…" : "Entrar com Google"}
        </Button>
        {falha && (
          <p role="alert" className="mt-6 rounded-lg border border-ember/40 bg-ember-soft px-4 py-3 text-sm text-foreground">
            {falha}
          </p>
        )}
      </div>
    </main>
  );
}
