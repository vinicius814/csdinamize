import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Marca } from "@/components/dcs/Marca";
import { definirSenha } from "@/lib/dcs/acesso.functions";
import { forcaSenha, requisitosSenha, senhaValida } from "@/lib/dcs/senha";

/**
 * Primeiro acesso (D34): troca obrigatória da senha provisória ou definição da senha após o convite por e-mail.
 * Enquanto a troca estiver pendente o banco não libera nenhum dado (dcs_perfil nulo), seja qual for o método de login.
 */
export const Route = createFileRoute("/definir-senha")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configure sua senha — Dinamize CS" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: DefinirSenha,
});

type Situacao = { pendente: boolean; expirada: boolean; expira_em: string | null };
const FORCA = ["Muito fraca", "Fraca", "Razoável", "Boa", "Forte"] as const;
const COR = [
  "bg-red-500",
  "bg-red-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-emerald-600",
] as const;

function DefinirSenha() {
  const { session, carregando, sair } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const salvar = useServerFn(definirSenha);
  const [sit, setSit] = useState<Situacao | null>(null);
  const [senha, setSenha] = useState("");
  const [conf, setConf] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (carregando) return;
    if (!session) {
      void nav({ to: "/auth", search: {}, replace: true });
      return;
    }
    void (async () => {
      const { data, error } = await (
        supabase.rpc as unknown as (f: string) => Promise<{ data: Situacao | null; error: unknown }>
      )("dcs_situacao_senha");
      if (error || !data)
        return setErro("Não foi possível verificar sua conta. Tente entrar novamente.");
      if (!data.pendente) return void nav({ to: "/", replace: true });
      setSit(data);
    })();
  }, [session, carregando]); // eslint-disable-line react-hooks/exhaustive-deps

  const req = requisitosSenha(senha);
  const f = forcaSenha(senha);
  const confere = senha.length > 0 && senha === conf;
  const pode = senhaValida(senha) && confere && !ocupado && !sit?.expirada;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!pode) return;
    setOcupado(true);
    setErro(null);
    try {
      await salvar({ data: { senha } });
      setSenha("");
      setConf("");
      await qc.invalidateQueries();
      void nav({ to: "/dcs", search: { boasvindas: "1" } as never, replace: true });
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível salvar a nova senha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10">
      <div className="w-full max-w-md rounded-xl border bg-card p-8 shadow-[var(--glow)]">
        <Marca semSegmento />
        <h1 className="mt-6 text-xl font-semibold">Configure sua senha de acesso</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Você está utilizando uma senha provisória. Para proteger sua conta, configure uma nova
          senha antes de acessar o Dinamize CS.
        </p>
        {sit?.expirada ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            Sua senha provisória expirou. Peça ao administrador responsável um novo acesso.
          </p>
        ) : (
          <form onSubmit={(e) => void enviar(e)} className="mt-5 space-y-3">
            <label className="block text-sm font-medium">
              Nova senha
              <Input
                type="password"
                autoComplete="new-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="mt-1 h-10"
                aria-describedby="requisitos forca"
              />
            </label>
            <div id="forca" aria-live="polite">
              <div className="flex gap-1" aria-hidden="true">
                {[1, 2, 3, 4].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 flex-1 rounded ${i <= f ? COR[f] : "bg-muted"}`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Segurança: {senha ? FORCA[f] : "—"}
              </p>
            </div>
            <ul id="requisitos" className="grid gap-1 text-xs">
              {req.map((r) => (
                <li
                  key={r.id}
                  className={`flex items-center gap-1.5 ${r.ok ? "text-emerald-700" : "text-muted-foreground"}`}
                >
                  {r.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}{" "}
                  {r.rotulo}
                </li>
              ))}
              <li className="flex items-center gap-1.5 text-muted-foreground">
                <X className="h-3.5 w-3.5 opacity-0" /> Diferente da senha provisória
              </li>
            </ul>
            <label className="block text-sm font-medium">
              Confirme a nova senha
              <Input
                type="password"
                autoComplete="new-password"
                value={conf}
                onChange={(e) => setConf(e.target.value)}
                className="mt-1 h-10"
              />
            </label>
            {conf && !confere && <p className="text-xs text-red-700">As senhas não conferem.</p>}
            <Button type="submit" className="h-10 w-full" disabled={!pode}>
              {ocupado ? "Salvando…" : "Salvar e continuar"}
            </Button>
          </form>
        )}
        {erro && (
          <p role="alert" className="mt-4 rounded-lg border bg-card p-3 text-sm">
            {erro}
          </p>
        )}
        <Button
          variant="ghost"
          className="mt-4 w-full"
          onClick={async () => {
            await sair();
            void nav({ to: "/auth", search: {}, replace: true });
          }}
        >
          Sair
        </Button>
      </div>
    </main>
  );
}
