import { createFileRoute } from "@tanstack/react-router";
import { Crown, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { NAV, PERFIL_ROTULO } from "@/components/dcs/navegacao";
import { Painel, Selo, Titulo } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/minha-conta")({ component: MinhaConta });

function MinhaConta() {
  const { perfil, session } = useAuth();
  const a = useAcessoDcs().data;
  const mods: readonly string[] = a?.perfil ? (a.modulos ?? MODULOS_POR_PERFIL[a.perfil]) : [];
  const google = session?.user.app_metadata?.["provider"] === "google";
  return (
    <>
      <Titulo titulo="Minha conta" sub="Seus dados de acesso e permissões no Dinamize CS." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Painel titulo="Identificação">
          <dl className="grid gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Nome</dt>
              <dd className="font-medium">{perfil?.nome || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd className="font-medium">{session?.user.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Perfil</dt>
              <dd className="mt-0.5">
                {a?.master ? (
                  <Selo tom="marca">
                    <Crown className="mr-1 h-3 w-3" /> Administrador Master
                  </Selo>
                ) : a?.perfil ? (
                  PERFIL_ROTULO[a.perfil]
                ) : (
                  "Sem perfil no Dinamize CS"
                )}
              </dd>
            </div>
            <div className="flex items-start gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted-foreground">
              <KeyRound className="mt-0.5 h-4 w-4 shrink-0" />
              {google
                ? "Você entra com a conta Google; a senha é gerenciada pelo Google."
                : "Para trocar a senha, use “Esqueci minha senha” na tela de login."}
            </div>
          </dl>
        </Painel>
        <Painel titulo="Permissões">
          <ul className="grid gap-2 text-sm">
            {(
              [
                ["financeiro", "Ver valores dos negócios"],
                ["editar", "Editar diagnósticos e planos"],
                ["exportar", "Exportar listas"],
              ] as const
            ).map(([k, r]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                {r} {a?.[k] ? <Selo tom="ok">Sim</Selo> : <Selo>Não</Selo>}
              </li>
            ))}
          </ul>
          <p className="mb-2 mt-4 text-xs font-medium text-muted-foreground">Áreas disponíveis</p>
          <div className="flex flex-wrap gap-1.5">
            {NAV.filter((i) => mods.includes(i.mod)).map((i) => (
              <span key={i.to} className="rounded-full border bg-card px-2.5 py-0.5 text-xs">
                {i.rotulo}
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4" /> As permissões são aplicadas pelo banco de dados em
            cada operação.
          </p>
        </Painel>
      </div>
    </>
  );
}
