import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { traduzirErroLogin, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { erro?: string } =>
    typeof s.erro === "string" ? { erro: s.erro } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Munim" },
      { name: "description", content: "Munim, seu assistente de Customer Success." },
      { property: "og:title", content: "Entrar — Munim" },
      { property: "og:description", content: "Munim, seu assistente de Customer Success." },
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
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) {
      setFalha(traduzirErroLogin(error.message));
      setEnviando(false);
    }
  };

  return (
    <main className="login-bg flex min-h-screen items-center justify-center px-6">
      <div className="w-full max-w-sm text-center animate-in fade-in slide-in-from-bottom-2 duration-700">
        <h1 className="font-display text-7xl tracking-tight text-foreground">Munim</h1>
        <p className="mt-3 text-muted-foreground">Seu assistente de Customer Success</p>
        <Button size="lg" className="mt-10 w-full gap-3" onClick={entrar} disabled={enviando}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
            <path fill="currentColor" d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1-3.22 0-5.85-2.67-5.85-5.96S8.78 6.26 12 6.26c1.83 0 3.06.78 3.76 1.45l2.56-2.47C16.68 3.71 14.54 2.8 12 2.8 6.92 2.8 2.8 6.92 2.8 12s4.12 9.2 9.2 9.2c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51z" />
          </svg>
          {enviando ? "Redirecionando…" : "Entrar com Google"}
        </Button>
        {falha && (
          <p role="alert" className="mt-6 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {falha}
          </p>
        )}
      </div>
    </main>
  );
}
