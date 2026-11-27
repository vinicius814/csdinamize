import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { Marca } from "@/components/dcs/Marca";
import { destination } from "@/lib/access";
import { aplicarConvite } from "@/lib/dcs/convite";
import { ACESSO_NEGADO, AVISO_LOGIN } from "@/lib/dcs/ajuda";
import { NOME_COMPLETO, VERSAO } from "@/lib/versao";

/**
 * Entrada no Dinamize CS (D33). Não existe cadastro público: contas só são criadas a partir de convite válido
 * (o banco recusa qualquer outra criação, inclusive pelo Google). Mensagens não revelam quais e-mails existem.
 */
export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { erro?: string } =>
    typeof s["erro"] === "string" ? { erro: s["erro"] } : {},
  head: () => ({
    meta: [
      { title: "Entrar — Dinamize CS" },
      { name: "description", content: "Acesso restrito aos colaboradores convidados da Dinamize." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Entrar — Dinamize CS" },
      { property: "og:description", content: "Diagnóstico e inteligência de contas." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Login,
});

/** Traduz erros de autenticação em mensagens que não revelam se o e-mail existe. */
export function mensagemLogin(erro: string | null | undefined): string | null {
  if (!erro) return null;
  if (
    /database error|não autorizado|signup|sign up|not allowed|restrito|saving new user|access_denied/i.test(
      erro,
    )
  )
    return ACESSO_NEGADO;
  if (/invalid login|credenciais|invalid credentials|email not confirmed/i.test(erro))
    return "Não foi possível entrar. Confira o e-mail e a senha ou use “Esqueci minha senha”.";
  if (/rate limit|too many/i.test(erro))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  return ACESSO_NEGADO;
}

function Login() {
  const { erro } = Route.useSearch();
  const { session } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [modo, setModo] = useState<"entrar" | "esqueci">("entrar");
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState<string | null>(mensagemLogin(erro));

  useEffect(() => {
    if (!session) return;
    let vivo = true;
    void (async () => {
      try {
        const a = await aplicarConvite(qc, session.user.id);
        if (vivo)
          void navigate({
            to: destination(a.status, a.accepted, a.onboarded, a.role),
            replace: true,
          });
      } catch {
        if (vivo) setMensagem("Não foi possível verificar sua conta. Tente novamente.");
      }
    })();
    return () => {
      vivo = false;
    };
  }, [session?.user.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function google() {
    setOcupado(true);
    setMensagem(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setMensagem(mensagemLogin(error.message));
      setOcupado(false);
    }
  }
  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const senha = String(f.get("password") ?? "");
    setMensagem(null);
    setOcupado(true);
    try {
      if (modo === "esqueci") {
        await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        // Resposta idêntica com ou sem conta (não revela e-mails cadastrados).
        setMensagem(
          "Se houver uma conta ativa com este e-mail, você receberá um link temporário para redefinir a senha.",
        );
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) setMensagem(mensagemLogin(error.message));
      }
    } catch (err) {
      setMensagem(mensagemLogin(err instanceof Error ? err.message : null));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="grid min-h-dvh bg-background lg:grid-cols-[1fr_minmax(440px,520px)]">
      <section
        className="relative hidden overflow-hidden bg-[var(--brand-black)] p-12 text-white lg:flex lg:flex-col lg:justify-between"
        aria-hidden="true"
      >
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--brand)]" />
        <div className="absolute -bottom-32 -left-20 h-80 w-80 rounded-full bg-[var(--brand)] opacity-20" />
        <span className="relative">
          <Marca escuro />
        </span>
        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Plano de ação e diagnóstico de contas
          </h2>
          <p className="mt-4 text-base text-white/80">
            Carteira, cobertura, diagnósticos e planos de ação da operação de Customer Success,
            sincronizados com o Pipedrive.
          </p>
        </div>
        <p className="relative text-sm text-white/70">Dinamize · Customer Success · {VERSAO}</p>
      </section>
      <section className="flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Marca />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {modo === "esqueci" ? "Redefinir senha" : "Entrar"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {modo === "esqueci"
              ? "Enviaremos um link temporário para o seu e-mail."
              : NOME_COMPLETO}
          </p>
          {modo === "entrar" && (
            <>
              <Button className="mt-6 h-10 w-full" disabled={ocupado} onClick={() => void google()}>
                <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
                  <path
                    fill="currentColor"
                    d="M21.35 11.1H12v2.9h5.35c-.25 1.4-1.6 4.1-5.35 4.1a5.9 5.9 0 0 1 0-11.8c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.7 14.6 2.8 12 2.8a9.2 9.2 0 1 0 0 18.4c5.3 0 8.8-3.7 8.8-9 0-.6-.05-1.05-.15-1.5z"
                  />
                </svg>
                Entrar com Google
              </Button>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou com e-mail
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          )}
          <form
            onSubmit={(e) => void enviar(e)}
            className={`space-y-3 ${modo === "esqueci" ? "mt-6" : ""}`}
          >
            <label className="block text-sm font-medium">
              E-mail
              <Input
                name="email"
                type="email"
                autoComplete="email"
                required
                className="mt-1 h-10"
              />
            </label>
            {modo === "entrar" && (
              <label className="block text-sm font-medium">
                Senha
                <Input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="mt-1 h-10"
                />
              </label>
            )}
            <Button type="submit" variant="outline" className="h-10 w-full" disabled={ocupado}>
              {ocupado ? "Aguarde…" : modo === "esqueci" ? "Enviar link" : "Entrar"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-3 text-sm font-medium text-primary hover:text-primary-hover"
            onClick={() => {
              setModo(modo === "entrar" ? "esqueci" : "entrar");
              setMensagem(null);
            }}
          >
            {modo === "entrar" ? "Esqueci minha senha" : "Voltar para o login"}
          </button>
          {mensagem && (
            <p role="alert" className="mt-4 break-words rounded-lg border bg-card p-3 text-sm">
              {mensagem}
            </p>
          )}
          <p className="mt-8 rounded-lg bg-surface-2 p-3 text-xs leading-relaxed text-muted-foreground">
            {AVISO_LOGIN}
          </p>
          <footer className="mt-6 flex gap-4 text-xs text-muted-foreground">
            <Link to="/termos" className="hover:text-foreground">
              Termos de Uso
            </Link>
            <Link to="/privacidade" className="hover:text-foreground">
              Privacidade
            </Link>
          </footer>
        </div>
      </section>
    </main>
  );
}
