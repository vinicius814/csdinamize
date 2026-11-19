import { createFileRoute } from "@tanstack/react-router";
import { Crown, KeyRound, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useAcessoDcs } from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { NAV, PERFIL_ROTULO } from "@/components/dcs/navegacao";
import { dataBR, Painel, Selo, Titulo } from "@/components/dcs/ui";
import { SeloBeta, SeloEcommerce } from "@/components/dcs/Ajuda";
import { MinhaConexaoPipedrive } from "@/components/dcs/Conexao";
import { BUILD_ID, COMMIT, DATA_VERSAO, NOME_COMPLETO, VERSAO } from "@/lib/versao";

export const Route = createFileRoute("/_authenticated/dcs/minha-conta")({ component: MinhaConta });

function MinhaConta() {
  const { perfil, session } = useAuth();
  const a = useAcessoDcs().data;
  const mods: readonly string[] = a?.perfil ? (a.modulos ?? MODULOS_POR_PERFIL[a.perfil]) : [];
  const google = session?.user.app_metadata?.["provider"] === "google";
  return (
    <>
      <Titulo
        titulo="Minha conta e sobre o sistema"
        sub="Seus dados de acesso, permissões e a versão do Dinamize CS."
      />
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
                ["editar", "Editar diagnósticos"],
              ] as const
            ).map(([k, r]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                {r} {a?.[k] ? <Selo tom="ok">Sim</Selo> : <Selo>Não</Selo>}
              </li>
            ))}
            {(
              [
                ["concluir", "Concluir diagnósticos"],
                ["planos", "Administrar planos de ação"],
                ["redistribuir", "Redistribuir análises"],
                ["usuarios", "Administrar usuários"],
                ["config", "Acessar configurações"],
                ["integracoes", "Acessar integrações"],
              ] as const
            ).map(([k, r]) => (
              <li key={k} className="flex items-center justify-between rounded-lg border px-3 py-2">
                {r} {a?.permissoes[k] ? <Selo tom="ok">Sim</Selo> : <Selo>Não</Selo>}
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
            cada operação. Exportação de dados não existe no Dinamize CS.
          </p>
        </Painel>
        <div className="lg:col-span-2">
          <MinhaConexaoPipedrive />
        </div>
        <Painel titulo="Sobre o sistema" className="lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4" id="sobre">
            {(
              [
                ["Produto", NOME_COMPLETO],
                ["Versão", VERSAO],
                ["Status", a?.beta === false ? "Versão estável" : "Beta — em evolução contínua"],
                ["Segmento atendido", "E-commerce (exclusivo)"],
                ["Data da versão", dataBR(DATA_VERSAO)],
                ["Identificador do build", BUILD_ID],
                ["Commit", COMMIT],
              ] as const
            ).map(([r, v]) => (
              <div key={r}>
                <dt className="text-xs text-muted-foreground">{r}</dt>
                <dd className="break-all font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <SeloBeta /> <SeloEcommerce />
          </div>
        </Painel>
      </div>
    </>
  );
}
