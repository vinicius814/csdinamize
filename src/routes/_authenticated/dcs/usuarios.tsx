import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Copy, Crown, KeyRound, Lock, LogOut, Search, ShieldCheck, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { mensagemErro, type DcsPreCadastro, type DcsUsuario } from "@/lib/dcs/db";
import {
  useAcaoPreCadastro,
  useAcessoDcs,
  useAnalistas,
  useCarteira,
  useConfigProduto,
  useDefinirStatusUsuario,
  useLogsSeguranca,
  usePreCadastros,
  useResponsaveisPD,
  useSalvarAcesso,
  useTransferirMaster,
  useUsuarios,
  useVinculosPD,
  type FormAcesso,
  type Permissao,
} from "@/lib/dcs/dados";
import { gerarCredencial, revogarSessoes } from "@/lib/dcs/acesso.functions";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { NAV, PERFIL_ROTULO } from "@/components/dcs/navegacao";
import { Dica } from "@/components/dcs/Ajuda";
import {
  cx,
  dataHoraBR,
  dataBR,
  Estado,
  Kpi,
  Selo,
  Tabela,
  Titulo,
  Vazio,
  type Tom,
} from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/usuarios")({ component: Usuarios });

const PERMS: { k: Permissao; rotulo: string; dica: string; admin?: boolean }[] = [
  {
    k: "concluir",
    rotulo: "Concluir diagnósticos",
    dica: "Concluir análises (gera índice, plano e registro no Pipedrive).",
  },
  {
    k: "planos",
    rotulo: "Administrar planos de ação",
    dica: "Criar e atualizar ações, responsáveis, prazos e status.",
  },
  {
    k: "redistribuir",
    rotulo: "Redistribuir análises",
    dica: "Atribuir, assumir e transferir análises de outras pessoas.",
    admin: true,
  },
  {
    k: "usuarios",
    rotulo: "Administrar usuários",
    dica: "Convidar pessoas e alterar perfis/permissões (dentro dos próprios limites).",
    admin: true,
  },
  {
    k: "config",
    rotulo: "Acessar configurações",
    dica: "Alterar regras, critérios e parâmetros (gera nova versão).",
    admin: true,
  },
  {
    k: "integracoes",
    rotulo: "Acessar integrações",
    dica: "Monitorar e reprocessar a integração com o Pipedrive e o n8n.",
    admin: true,
  },
];
const METODO: Record<FormAcesso["metodo"], string> = {
  google: "Conta Google (a pessoa entra com o Google do e-mail convidado)",
  email: "Link seguro por e-mail (a pessoa define a própria senha)",
  senha: "Senha provisória (exibida uma vez; troca obrigatória no primeiro acesso)",
};
const NOVO: FormAcesso = {
  email: "",
  nome: "",
  perfil: "cs",
  financeiro: false,
  editar: true,
  carteiras: [],
  clientes: [],
  modulos: null,
  permissoes: {},
  pipedrive: null,
  metodo: "google",
  validade_dias: 7,
  ativo: true,
};
const ehMaster = (u: DcsUsuario) => u.papel === "superadmin";
function statusUsuario(u: DcsUsuario): [string, Tom] {
  if (ehMaster(u)) return ["Ativo", "ok"];
  if (u.status === "suspenso" || (!u.ativo && u.status === "ativo"))
    return ["Desativado", "neutro"];
  if (u.troca_senha) return ["Aguardando alteração de senha", "aviso"];
  if (u.status === "pendente") return ["Sem autorização", "critico"];
  if (!u.ultimo_acesso) return ["Aguardando primeiro acesso", "info"];
  return ["Ativo", "ok"];
}
function statusConvite(p: DcsPreCadastro, agora = new Date().toISOString()): [string, Tom] {
  if (p.aplicado_em) return ["Aceito", "ok"];
  if (p.revogado_em) return ["Revogado", "neutro"];
  if (p.expira_em && p.expira_em < agora) return ["Expirado", "critico"];
  if (p.convite_enviado_em) return ["Convite enviado", "info"];
  return ["Convite pendente", "aviso"];
}

function Usuarios() {
  const acesso = useAcessoDcs();
  const pode = !!acesso.data?.permissoes.usuarios;
  const q = useUsuarios(pode);
  const pre = usePreCadastros(pode);
  const vinc = useVinculosPD(pode);
  const resp = useResponsaveisPD(pode);
  const nomes = useAnalistas();
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<DcsUsuario | null>(null);
  const [convite, setConvite] = useState<FormAcesso | null>(null);
  const nomeResp = useMemo(
    () => new Map((resp.data ?? []).map((r) => [r.pipedrive_user_id, r.nome])),
    [resp.data],
  );
  const t = busca.toLowerCase().trim();
  const lista = (q.data ?? []).filter(
    (u) => !t || `${u.nome ?? ""} ${u.email ?? ""}`.toLowerCase().includes(t),
  );
  const convites = (pre.data ?? []).filter((p) => !p.aplicado_em);
  const tot = q.data ?? [];
  if (acesso.data && !pode)
    return (
      <Vazio
        titulo="Sem permissão"
        texto="Seu perfil não administra usuários. Fale com o Administrador Master."
        icone={<Lock />}
      />
    );
  return (
    <>
      <Titulo
        titulo="Usuários e permissões"
        sub="Acesso exclusivo por convite. Permissões definidas antes do convite e validadas no banco de dados."
        acao={
          <button
            type="button"
            data-tour="convidar"
            onClick={() => setConvite({ ...NOVO })}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
          >
            <UserPlus className="h-4 w-4" /> Convidar usuário
          </button>
        }
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi
            rotulo="Usuários ativos"
            valor={tot.filter((u) => statusUsuario(u)[0] === "Ativo").length}
            tom="ok"
          />
          <Kpi
            rotulo="Convites em aberto"
            valor={
              convites.filter(
                (p) => !p.revogado_em && !(p.expira_em && p.expira_em < new Date().toISOString()),
              ).length
            }
            tom="info"
          />
          <Kpi
            rotulo="Aguardando troca de senha"
            valor={tot.filter((u) => u.troca_senha).length}
            tom="aviso"
          />
          <Kpi
            rotulo="Desativados"
            valor={tot.filter((u) => statusUsuario(u)[0] === "Desativado").length}
          />
        </div>
        <label className="mb-3 flex max-w-md flex-col gap-1 text-xs font-medium text-muted-foreground">
          Nome ou e-mail
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar"
              className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground"
            />
          </span>
        </label>
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Pipedrive</th>
              <th>Carteiras</th>
              <th>Convidado por</th>
              <th>Último acesso</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const [st, tom] = statusUsuario(u);
              const adm = ehMaster(u) || u.perfil === "admin";
              return (
                <tr key={u.user_id}>
                  <td>
                    <span className="font-medium">{u.nome || "Sem nome"}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </td>
                  <td className="whitespace-nowrap">
                    {ehMaster(u) ? (
                      <Selo tom="marca">
                        <Crown className="mr-1 h-3 w-3" /> Administrador Master
                      </Selo>
                    ) : u.perfil ? (
                      PERFIL_ROTULO[u.perfil]
                    ) : (
                      <span className="text-muted-foreground">Sem perfil</span>
                    )}
                  </td>
                  <td className="text-xs">
                    <VinculoCelula v={vinc.data?.get(u.user_id)} />
                  </td>
                  <td className="max-w-[220px] text-xs">
                    {adm
                      ? "Todas"
                      : u.carteiras.map((c) => nomeResp.get(c) ?? `#${c}`).join(", ") ||
                        (u.clientes.length ? `${u.clientes.length} cliente(s)` : "Nenhuma")}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {u.convidado_por ? (nomes.data?.get(u.convidado_por) ?? "Administrador") : "—"}
                  </td>
                  <td className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {dataHoraBR(u.ultimo_acesso)}
                  </td>
                  <td>
                    <Selo tom={tom}>{st}</Selo>
                  </td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => setSel(u)}
                      className="rounded-md border px-2 py-1 text-xs font-medium hover:border-primary hover:text-primary"
                    >
                      {ehMaster(u) ? "Ver" : "Gerenciar"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
        <Convites lista={convites} nomeResp={nomeResp} editar={(f) => setConvite(f)} />
        <LogsSeguranca />
      </Estado>
      {convite && <AssistenteConvite inicial={convite} fechar={() => setConvite(null)} />}
      <Gerenciar usuario={sel} fechar={() => setSel(null)} nomeResp={nomeResp} />
    </>
  );
}

/* ---------------- Assistente de convite (5 etapas) ---------------- */
const ETAPAS = ["Identificação", "Perfil", "Permissões", "Conferência", "Convite"] as const;
function AssistenteConvite({ inicial, fechar }: { inicial: FormAcesso; fechar: () => void }) {
  const acesso = useAcessoDcs();
  const conf = useConfigProduto(true);
  const salvar = useSalvarAcesso();
  const credencial = useServerFn(gerarCredencial);
  const [f, setF] = useState<FormAcesso>(inicial);
  const [etapa, setEtapa] = useState(0);
  const [resultado, setResultado] = useState<{ senha: string | null; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    const d = conf.data?.acesso?.validade_convite_dias;
    if (d && inicial === NOVO) setF((v) => ({ ...v, validade_dias: d }));
  }, [conf.data, inicial]);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());
  const ok = [emailOk && f.nome.trim().length >= 2, true, true, true, true];
  const concluir = async () => {
    setOcupado(true);
    try {
      const r = await salvar.mutateAsync({ ...f, email: f.email.trim().toLowerCase() });
      if (r.modo === "aplicado") {
        setResultado({
          senha: null,
          texto: "Esta pessoa já tinha conta: as permissões foram atualizadas.",
        });
      } else if (f.metodo === "google") {
        setResultado({
          senha: null,
          texto: `Convite registrado até ${dataBR(r.expira_em)}. A pessoa deve entrar em ${window.location.origin}/auth com “Entrar com Google” usando ${f.email.trim().toLowerCase()}.`,
        });
      } else {
        const c = await credencial({
          data: {
            email: f.email.trim().toLowerCase(),
            metodo: f.metodo,
            origem: window.location.origin,
          },
        });
        setResultado(
          c.metodo === "senha"
            ? {
                senha: c.senha,
                texto: `Senha provisória válida até ${dataHoraBR(c.expira_em)}. Ela não será exibida novamente.`,
              }
            : {
                senha: null,
                texto: "Link de configuração enviado por e-mail. Ele é individual e temporário.",
              },
        );
      }
      setEtapa(4);
    } catch (e) {
      toast.error(mensagemErro(e));
    } finally {
      setOcupado(false);
    }
  };
  const permsDoPerfil = PERMS.filter((p) => (f.perfil === "admin" ? true : !p.admin));
  const meus = acesso.data?.permissoes ?? {};
  return (
    <Dialog open onOpenChange={(o) => !o && !ocupado && fechar()}>
      <DialogContent className="max-h-[92dvh] max-w-2xl overflow-y-auto">
        <DialogTitle>Convidar usuário</DialogTitle>
        <DialogDescription className="sr-only">
          Assistente em cinco etapas para convidar um colaborador.
        </DialogDescription>
        <ol className="mb-2 flex flex-wrap gap-1 text-xs" aria-label="Etapas">
          {ETAPAS.map((e, i) => (
            <li
              key={e}
              aria-current={i === etapa ? "step" : undefined}
              className={cx(
                "rounded-full px-2.5 py-1",
                i === etapa
                  ? "bg-primary text-primary-foreground"
                  : i < etapa
                    ? "bg-primary-soft text-primary"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {i + 1}. {e}
            </li>
          ))}
        </ol>
        {etapa === 0 && (
          <div className="space-y-3">
            <Campo rotulo="Nome completo *">
              <input
                className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
                value={f.nome}
                onChange={(e) => setF({ ...f, nome: e.target.value })}
              />
            </Campo>
            <Campo rotulo="E-mail corporativo *">
              <input
                type="email"
                disabled={inicial.email !== ""}
                className="h-9 w-full rounded-lg border bg-card px-2 text-sm disabled:opacity-60"
                value={f.email}
                onChange={(e) => setF({ ...f, email: e.target.value })}
              />
            </Campo>
            <ResponsavelPD
              valor={f.pipedrive}
              email={f.email}
              onChange={(v) => setF({ ...f, pipedrive: v })}
            />
          </div>
        )}
        {etapa === 1 && (
          <div className="space-y-2">
            {(
              ["cs", "contas", ...(acesso.data?.master ? ["admin"] : [])] as FormAcesso["perfil"][]
            ).map((p) => (
              <label
                key={p}
                className={cx(
                  "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                  f.perfil === p && "border-primary bg-primary-soft/40",
                )}
              >
                <input
                  type="radio"
                  name="perfil"
                  className="mt-1 accent-[var(--primary)]"
                  checked={f.perfil === p}
                  onChange={() => setF({ ...f, perfil: p, permissoes: {} })}
                />
                <span>
                  <span className="block text-sm font-medium">{PERFIL_ROTULO[p]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {p === "admin"
                      ? "Todas as carteiras; recursos administrativos somente com as permissões marcadas."
                      : p === "cs"
                        ? "Diagnósticos, planos de ação, cobertura e acompanhamento das carteiras autorizadas."
                        : "Consulta e acompanhamento das contas autorizadas."}
                  </span>
                </span>
              </label>
            ))}
            <p className="text-xs text-muted-foreground">
              Privilégios de Administrador Master só por transferência protegida (Gerenciar →
              Master).
            </p>
          </div>
        )}
        {etapa === 2 && (
          <div className="space-y-4">
            {f.perfil !== "admin" && (
              <Carteiras valor={f.carteiras} onChange={(v) => setF({ ...f, carteiras: v })} />
            )}
            {f.perfil !== "admin" && (
              <Clientes valor={f.clientes} onChange={(v) => setF({ ...f, clientes: v })} />
            )}
            <Modulos
              perfil={f.perfil}
              valor={f.modulos}
              onChange={(v) => setF({ ...f, modulos: v })}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <Chave
                rotulo="Editar diagnósticos"
                dica="Preencher e salvar análises."
                valor={f.editar}
                onChange={(v) => setF({ ...f, editar: v })}
              />
              <Chave
                rotulo="Ver indicadores financeiros"
                dica="Valores comerciais do Pipedrive."
                valor={f.financeiro}
                bloqueado={!acesso.data?.financeiro}
                onChange={(v) => setF({ ...f, financeiro: v })}
              />
              {permsDoPerfil.map((p) => (
                <Chave
                  key={p.k}
                  rotulo={p.rotulo}
                  dica={p.dica}
                  valor={!!f.permissoes[p.k]}
                  bloqueado={!meus[p.k]}
                  onChange={(v) => setF({ ...f, permissoes: { ...f.permissoes, [p.k]: v } })}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Menor privilégio: nada vem marcado. Permissões que você não possui aparecem
              bloqueadas. Exportação de dados não existe no Dinamize CS.
            </p>
          </div>
        )}
        {etapa === 3 && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[150px_1fr] gap-x-3 gap-y-1.5 rounded-lg bg-surface-2 p-3">
              <dt className="text-muted-foreground">Nome</dt>
              <dd>{f.nome}</dd>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd>{f.email.trim().toLowerCase()}</dd>
              <dt className="text-muted-foreground">Perfil</dt>
              <dd>{PERFIL_ROTULO[f.perfil]}</dd>
              <dt className="text-muted-foreground">Carteiras</dt>
              <dd>
                {f.perfil === "admin"
                  ? "Todas"
                  : f.carteiras.length
                    ? `${f.carteiras.length} carteira(s)`
                    : "Nenhuma"}
              </dd>
              <dt className="text-muted-foreground">Clientes autorizados</dt>
              <dd>{f.clientes.length || "—"}</dd>
              <dt className="text-muted-foreground">Permissões</dt>
              <dd>
                {[
                  f.editar && "Editar",
                  f.financeiro && "Financeiro",
                  ...PERMS.filter((p) => f.permissoes[p.k]).map((p) => p.rotulo),
                ]
                  .filter(Boolean)
                  .join(" · ") || "Somente consulta"}
              </dd>
              <dt className="text-muted-foreground">Módulos</dt>
              <dd>{f.modulos ? `${f.modulos.length} selecionado(s)` : "Padrão do perfil"}</dd>
            </dl>
            <Campo rotulo="Método de acesso">
              <select
                className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
                value={f.metodo}
                onChange={(e) => setF({ ...f, metodo: e.target.value as FormAcesso["metodo"] })}
              >
                {(Object.keys(METODO) as FormAcesso["metodo"][]).map((m) => (
                  <option key={m} value={m}>
                    {METODO[m]}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo rotulo="Validade do convite (dias)">
              <input
                type="number"
                min={1}
                max={30}
                className="h-9 w-32 rounded-lg border bg-card px-2 text-sm"
                value={f.validade_dias}
                onChange={(e) =>
                  setF({
                    ...f,
                    validade_dias: Math.min(30, Math.max(1, Number(e.target.value) || 1)),
                  })
                }
              />
            </Campo>
            {f.metodo === "senha" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                A senha provisória será exibida uma única vez nesta tela, expira em{" "}
                {conf.data?.acesso?.senha_provisoria_horas ?? 48} horas e deve ser compartilhada por
                um canal seguro.
              </p>
            )}
          </div>
        )}
        {etapa === 4 && resultado && (
          <ResultadoConvite senha={resultado.senha} texto={resultado.texto} />
        )}
        <div className="mt-4 flex justify-between gap-2">
          {etapa < 4 ? (
            <>
              <button
                type="button"
                disabled={etapa === 0 || ocupado}
                onClick={() => setEtapa(etapa - 1)}
                className="h-9 rounded-lg border px-4 text-sm disabled:opacity-50"
              >
                Voltar
              </button>
              {etapa < 3 ? (
                <button
                  type="button"
                  disabled={!ok[etapa]}
                  onClick={() => setEtapa(etapa + 1)}
                  className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  Continuar
                </button>
              ) : (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => void concluir()}
                  className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
                >
                  {ocupado ? "Registrando…" : "Confirmar convite"}
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={fechar}
              className="ml-auto h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Concluir
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Exibe a senha provisória uma única vez (somente em memória; some ao fechar). */
function ResultadoConvite({ senha, texto }: { senha: string | null; texto: string }) {
  const [visivel, setVisivel] = useState(false);
  return (
    <div className="space-y-3">
      <p className="text-sm">{texto}</p>
      {senha && (
        <div className="rounded-lg border bg-surface-2 p-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Senha provisória</p>
          <div className="flex items-center gap-2">
            <code
              className="flex-1 select-all break-all rounded bg-card px-2 py-1.5 font-mono text-sm"
              translate="no"
            >
              {visivel ? senha : "•".repeat(senha.length)}
            </code>
            <button
              type="button"
              onClick={() => setVisivel(!visivel)}
              className="h-8 rounded-md border px-2 text-xs"
            >
              {visivel ? "Ocultar" : "Mostrar"}
            </button>
            <button
              type="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(senha)
                  .then(() => toast.success("Senha copiada."))
              }
              className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Compartilhe por um canal seguro. Não envie por e-mail ou WhatsApp junto com o endereço
            de acesso. Se perder, gere uma nova senha (a anterior deixa de valer).
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- Convites em aberto ---------------- */
function Convites({
  lista,
  nomeResp,
  editar,
}: {
  lista: DcsPreCadastro[];
  nomeResp: Map<number, string>;
  editar: (f: FormAcesso) => void;
}) {
  const acao = useAcaoPreCadastro();
  const credencial = useServerFn(gerarCredencial);
  const nomes = useAnalistas();
  const [senha, setSenha] = useState<{ senha: string; texto: string } | null>(null);
  const gerar = async (email: string, metodo: "senha" | "email") => {
    try {
      const c = await credencial({ data: { email, metodo, origem: window.location.origin } });
      if (c.metodo === "senha" && c.senha)
        setSenha({
          senha: c.senha,
          texto: `Senha provisória para ${email}, válida até ${dataHoraBR(c.expira_em)}.`,
        });
      else toast.success("Link enviado por e-mail.");
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };
  return (
    <section className="mt-8">
      <h2 className="mb-1 flex items-center gap-1 text-base font-semibold">
        Convites <Dica termo="convites" rotulo="Convites" />
      </h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Convites ainda não aceitos. Expirados e revogados não permitem acesso.
      </p>
      {!lista.length ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          Nenhum convite pendente.
        </p>
      ) : (
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Convidado</th>
              <th>Perfil</th>
              <th>Carteiras</th>
              <th>Convidado por</th>
              <th>Data</th>
              <th>Validade</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => {
              const [st, tom] = statusConvite(p);
              const aberto = !p.revogado_em && st !== "Expirado";
              const form: FormAcesso = {
                email: p.email,
                nome: p.nome ?? "",
                perfil: p.perfil,
                financeiro: p.financeiro,
                editar: p.pode_editar,
                carteiras: p.carteiras,
                clientes: p.clientes,
                modulos: p.modulos ?? null,
                permissoes: (p.permissoes ?? {}) as FormAcesso["permissoes"],
                pipedrive: p.pipedrive_user_id,
                metodo: p.metodo ?? "google",
                validade_dias: 7,
                ativo: true,
              };
              return (
                <tr key={p.email}>
                  <td>
                    <span className="font-medium">{p.nome || p.email}</span>
                    <span className="block text-xs text-muted-foreground">{p.email}</span>
                  </td>
                  <td>{PERFIL_ROTULO[p.perfil]}</td>
                  <td className="text-xs">
                    {p.perfil === "admin"
                      ? "Todas"
                      : p.carteiras.map((c) => nomeResp.get(c) ?? `#${c}`).join(", ") || "Nenhuma"}
                  </td>
                  <td className="text-xs text-muted-foreground">
                    {p.criado_por ? (nomes.data?.get(p.criado_por) ?? "Administrador") : "—"}
                  </td>
                  <td className="whitespace-nowrap text-xs">{dataHoraBR(p.criado_em)}</td>
                  <td className="whitespace-nowrap text-xs">{dataHoraBR(p.expira_em)}</td>
                  <td>
                    <Selo tom={tom}>{st}</Selo>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {aberto && p.metodo === "senha" && (
                      <button
                        type="button"
                        onClick={() => void gerar(p.email, "senha")}
                        className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                      >
                        <KeyRound className="mr-1 inline h-3 w-3" /> Gerar senha provisória
                      </button>
                    )}
                    {aberto && p.metodo === "email" && (
                      <button
                        type="button"
                        onClick={() => void gerar(p.email, "email")}
                        className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                      >
                        Reenviar convite
                      </button>
                    )}
                    {aberto && p.metodo === "google" && (
                      <button
                        type="button"
                        onClick={() =>
                          void navigator.clipboard
                            .writeText(
                              `Seu acesso ao Dinamize CS foi liberado. Entre em ${window.location.origin}/auth com “Entrar com Google” usando ${p.email}.`,
                            )
                            .then(
                              () => (
                                acao.mutate({ email: p.email, acao: "convite" }),
                                toast.success("Instruções copiadas.")
                              ),
                            )
                        }
                        className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                      >
                        <Copy className="mr-1 inline h-3 w-3" /> Copiar instruções
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => editar(form)}
                      className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                    >
                      {aberto ? "Editar" : "Convidar novamente"}
                    </button>
                    {aberto && (
                      <button
                        type="button"
                        onClick={() =>
                          acao.mutate(
                            { email: p.email, acao: "revogar" },
                            {
                              onSuccess: () => toast.success("Convite revogado."),
                              onError: (e) => toast.error(mensagemErro(e)),
                            },
                          )
                        }
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Revogar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Tabela>
      )}
      {senha && (
        <Dialog open onOpenChange={(o) => !o && setSenha(null)}>
          <DialogContent className="max-w-lg">
            <DialogTitle>Senha provisória gerada</DialogTitle>
            <DialogDescription className="sr-only">
              A senha é exibida uma única vez.
            </DialogDescription>
            <ResultadoConvite senha={senha.senha} texto={senha.texto} />
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

/* ---------------- Gerenciar usuário existente ---------------- */
function Gerenciar({
  usuario: u,
  fechar,
  nomeResp,
}: {
  usuario: DcsUsuario | null;
  fechar: () => void;
  nomeResp: Map<number, string>;
}) {
  const { session } = useAuth();
  const acesso = useAcessoDcs();
  const master = !!acesso.data?.master;
  const salvar = useSalvarAcesso();
  const status = useDefinirStatusUsuario();
  const transferir = useTransferirMaster();
  const credencial = useServerFn(gerarCredencial);
  const sessoes = useServerFn(revogarSessoes);
  const logs = useLogsSeguranca(!!u);
  const [f, setF] = useState<FormAcesso>(NOVO);
  const [senha, setSenha] = useState<{ senha: string; texto: string } | null>(null);
  const [confirmaMaster, setConfirmaMaster] = useState(false);
  useEffect(() => {
    setConfirmaMaster(false);
    setSenha(null);
    if (u)
      setF({
        ...NOVO,
        email: u.email ?? "",
        nome: u.nome ?? "",
        perfil: u.perfil ?? "cs",
        financeiro: u.financeiro,
        editar: u.pode_editar,
        carteiras: u.carteiras,
        clientes: u.clientes,
        modulos: u.modulos,
        permissoes: (u.permissoes ?? {}) as FormAcesso["permissoes"],
        pipedrive: u.pipedrive_user_id,
        ativo: true,
      });
  }, [u]);
  if (!u) return <Sheet open={false} />;
  const proprio = u.user_id === session?.user.id;
  const adm = u.perfil === "admin" || u.papel === "admin";
  const bloqueado = ehMaster(u) || proprio || (adm && !master);
  const motivo = ehMaster(u)
    ? "O Administrador Master está protegido: não pode ser desativado, rebaixado ou ter permissões removidas por esta tela."
    : proprio
      ? "Por segurança, ninguém altera o próprio acesso."
      : adm && !master
        ? "Somente o Administrador Master altera administradores."
        : null;
  const [st] = statusUsuario(u);
  const meus = acesso.data?.permissoes ?? {};
  const executar = async (fn: () => Promise<unknown>, msg: string) => {
    try {
      await fn();
      toast.success(msg);
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };
  const eventos = (logs.data ?? []).filter(
    (e) => e.entidade_id === u.user_id || e.entidade_id === (u.email ?? "").toLowerCase(),
  );
  return (
    <Sheet open={!!u} onOpenChange={(o) => !o && fechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetTitle className="pr-6 text-base">{u.nome || u.email}</SheetTitle>
        <p className="text-sm text-muted-foreground">
          {u.email} · {st}
        </p>
        {motivo && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> {motivo}
          </p>
        )}
        <fieldset disabled={bloqueado} className="mt-5 space-y-4">
          <Campo rotulo="Perfil">
            <select
              value={f.perfil}
              onChange={(e) =>
                setF({ ...f, perfil: e.target.value as FormAcesso["perfil"], permissoes: {} })
              }
              className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
            >
              <option value="cs">Analista de CS</option>
              <option value="contas">Analista de contas</option>
              {master && <option value="admin">Administrador</option>}
            </select>
          </Campo>
          <ResponsavelPD
            valor={f.pipedrive}
            email={u.email ?? ""}
            onChange={(v) => setF({ ...f, pipedrive: v })}
          />
          {f.perfil !== "admin" && (
            <Carteiras valor={f.carteiras} onChange={(v) => setF({ ...f, carteiras: v })} />
          )}
          {f.perfil !== "admin" && (
            <Clientes valor={f.clientes} onChange={(v) => setF({ ...f, clientes: v })} />
          )}
          <Modulos
            perfil={f.perfil}
            valor={f.modulos}
            onChange={(v) => setF({ ...f, modulos: v })}
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Chave
              rotulo="Editar diagnósticos"
              dica="Preencher e salvar análises."
              valor={f.editar}
              onChange={(v) => setF({ ...f, editar: v })}
            />
            <Chave
              rotulo="Ver indicadores financeiros"
              dica="Valores comerciais do Pipedrive."
              valor={f.financeiro}
              bloqueado={!acesso.data?.financeiro}
              onChange={(v) => setF({ ...f, financeiro: v })}
            />
            {PERMS.filter((p) => (f.perfil === "admin" ? true : !p.admin)).map((p) => (
              <Chave
                key={p.k}
                rotulo={p.rotulo}
                dica={p.dica}
                valor={!!f.permissoes[p.k]}
                bloqueado={!meus[p.k]}
                onChange={(v) => setF({ ...f, permissoes: { ...f.permissoes, [p.k]: v } })}
              />
            ))}
          </div>
          {!bloqueado && (
            <button
              type="button"
              disabled={salvar.isPending}
              onClick={() =>
                salvar.mutate(f, {
                  onSuccess: () => (toast.success("Permissões salvas."), fechar()),
                  onError: (e) => toast.error(mensagemErro(e)),
                })
              }
              className="h-9 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {salvar.isPending ? "Salvando…" : "Salvar permissões"}
            </button>
          )}
        </fieldset>
        {!bloqueado && (
          <div className="mt-6 space-y-2 rounded-lg border p-3">
            <p className="flex items-center gap-1 text-sm font-semibold">
              <ShieldCheck className="h-4 w-4" /> Redefinir acesso{" "}
              <Dica termo="senhaProvisoria" rotulo="Senha provisória" />
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void executar(async () => {
                    const c = await credencial({
                      data: {
                        email: u.email ?? "",
                        metodo: "senha",
                        origem: window.location.origin,
                      },
                    });
                    if (c.senha)
                      setSenha({
                        senha: c.senha,
                        texto: `Nova senha provisória válida até ${dataHoraBR(c.expira_em)}. A anterior e as sessões ativas foram invalidadas.`,
                      });
                  }, "Senha provisória gerada.")
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs hover:border-primary"
              >
                <KeyRound className="h-3.5 w-3.5" /> Gerar senha provisória
              </button>
              <button
                type="button"
                onClick={() =>
                  void executar(
                    () =>
                      credencial({
                        data: {
                          email: u.email ?? "",
                          metodo: "email",
                          origem: window.location.origin,
                        },
                      }),
                    "Link de redefinição enviado por e-mail.",
                  )
                }
                className="h-8 rounded-lg border px-3 text-xs hover:border-primary"
              >
                Enviar link por e-mail
              </button>
              <button
                type="button"
                onClick={() =>
                  void executar(
                    () => sessoes({ data: { email: u.email ?? "" } }),
                    "Sessões encerradas.",
                  )
                }
                className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs hover:border-primary"
              >
                <LogOut className="h-3.5 w-3.5" /> Encerrar sessões
              </button>
              {st === "Desativado" ? (
                <button
                  type="button"
                  onClick={() =>
                    status.mutate(
                      { user: u.user_id, ativo: true },
                      {
                        onSuccess: () => (toast.success("Usuário reativado."), fechar()),
                        onError: (e) => toast.error(mensagemErro(e)),
                      },
                    )
                  }
                  className="h-8 rounded-lg border px-3 text-xs hover:border-primary"
                >
                  Reativar usuário
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    status.mutate(
                      { user: u.user_id, ativo: false },
                      {
                        onSuccess: () => (
                          toast.success("Usuário desativado e sessões encerradas."),
                          fechar()
                        ),
                        onError: (e) => toast.error(mensagemErro(e)),
                      },
                    )
                  }
                  className="h-8 rounded-lg border border-red-200 px-3 text-xs text-red-700 hover:bg-red-50"
                >
                  Desativar usuário
                </button>
              )}
            </div>
            {senha && <ResultadoConvite senha={senha.senha} texto={senha.texto} />}
          </div>
        )}
        {master && !proprio && !ehMaster(u) && st === "Ativo" && adm && (
          <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
            <p className="font-medium">Transferir o Administrador Master</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {u.nome || u.email} passa a ser o Master principal. Sua conta continua como
              Administrador. O banco exige conta ativa, e-mail verificado e login Google, e registra
              a troca.
            </p>
            {!confirmaMaster ? (
              <button
                type="button"
                onClick={() => setConfirmaMaster(true)}
                className="mt-2 h-8 rounded-lg border bg-card px-3 text-xs font-medium hover:border-primary"
              >
                <Crown className="mr-1 inline h-3.5 w-3.5" /> Tornar Master principal…
              </button>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={transferir.isPending}
                  onClick={() =>
                    transferir.mutate(u.user_id, {
                      onSuccess: () => (
                        toast.success("Administrador Master transferido."),
                        fechar()
                      ),
                      onError: (e) => toast.error(mensagemErro(e)),
                    })
                  }
                  className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground disabled:opacity-60"
                >
                  {transferir.isPending ? "Transferindo…" : `Confirmar: ${u.email} será o Master`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmaMaster(false)}
                  className="h-8 rounded-lg border px-3 text-xs"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
        <div className="mt-6">
          <h3 className="mb-2 text-sm font-semibold">Histórico de acesso</h3>
          {eventos.length ? (
            <ol className="space-y-1.5 border-l pl-3 text-xs">
              {eventos.map((e, i) => (
                <li key={i}>
                  <span className="text-muted-foreground">{dataHoraBR(e.em)}</span> ·{" "}
                  {ROTULO_LOG[e.acao] ?? e.acao}
                  {typeof e.dados?.["perfil"] === "string"
                    ? ` · ${PERFIL_ROTULO[e.dados["perfil"] as keyof typeof PERFIL_ROTULO] ?? ""}`
                    : ""}
                  {Array.isArray(e.dados?.["carteiras"]) &&
                  (e.dados["carteiras"] as number[]).length
                    ? ` · carteiras: ${(e.dados["carteiras"] as number[]).map((c) => nomeResp.get(c) ?? c).join(", ")}`
                    : ""}
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhum registro.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

const ROTULO_LOG: Record<string, string> = {
  criar: "Convite criado",
  enviar: "Convite enviado",
  aceitar: "Convite aceito (primeiro acesso)",
  revogar: "Convite revogado",
  permissoes: "Permissões alteradas",
  senha_provisoria: "Senha provisória gerada",
  convite_email: "Link de acesso enviado por e-mail",
  senha_definida: "Senha definitiva configurada",
  revogar_sessoes: "Sessões encerradas",
  desativar: "Usuário desativado",
  reativar: "Usuário reativado",
  transferir: "Administrador Master transferido",
  alterar: "Configuração alterada",
  salvar: "Pré-cadastro salvo",
  aplicado: "Pré-cadastro aplicado",
  convite: "Convite copiado",
  reprocessar: "Registro reprocessado",
  liberar: "Registro liberado",
  ativar: "Gravação no Pipedrive ativada",
  desativar_escrita: "Gravação no Pipedrive desativada",
  publicar: "Regras publicadas",
};

function LogsSeguranca() {
  const q = useLogsSeguranca(true);
  const nomes = useAnalistas();
  const [n, setN] = useState(30);
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-base font-semibold">Logs de segurança</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Convites, credenciais, permissões, desativações e configurações. Nunca contém senhas, links
        ou tokens.
      </p>
      {!q.data?.length ? (
        <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          {q.isLoading ? "Carregando…" : "Nenhum registro."}
        </p>
      ) : (
        <>
          <Tabela>
            <thead className="bg-surface-2">
              <tr>
                <th>Quando</th>
                <th>Quem</th>
                <th>Operação</th>
                <th>Alvo</th>
              </tr>
            </thead>
            <tbody>
              {q.data.slice(0, n).map((e, i) => (
                <tr key={i}>
                  <td className="whitespace-nowrap text-xs">{dataHoraBR(e.em)}</td>
                  <td className="text-xs">
                    {e.ator ? (nomes.data?.get(e.ator) ?? "Usuário") : "Sistema"}
                  </td>
                  <td className="text-xs">{ROTULO_LOG[e.acao] ?? e.acao}</td>
                  <td className="max-w-[260px] truncate text-xs text-muted-foreground">
                    {e.entidade === "acesso"
                      ? (nomes.data?.get(e.entidade_id ?? "") ?? "usuário")
                      : e.entidade_id}
                  </td>
                </tr>
              ))}
            </tbody>
          </Tabela>
          {q.data.length > n && (
            <button
              type="button"
              onClick={() => setN(n + 50)}
              className="mt-2 h-8 w-full rounded-lg border text-xs"
            >
              Mostrar mais
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ---------------- Campos reutilizáveis ---------------- */
function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {rotulo}
      {children}
    </label>
  );
}
function Chave({
  rotulo,
  dica,
  valor,
  onChange,
  bloqueado,
}: {
  rotulo: string;
  dica: string;
  valor: boolean;
  onChange: (v: boolean) => void;
  bloqueado?: boolean;
}) {
  return (
    <label
      className={cx(
        "flex items-start justify-between gap-3 rounded-lg border p-3",
        bloqueado && "opacity-60",
      )}
    >
      <span>
        <span className="block text-sm font-medium">{rotulo}</span>
        <span className="block text-xs text-muted-foreground">
          {bloqueado ? "Você não possui esta permissão." : dica}
        </span>
      </span>
      <input
        type="checkbox"
        disabled={bloqueado}
        className="mt-1 h-4 w-4 accent-[var(--primary)]"
        checked={valor}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
function ResponsavelPD({
  valor,
  email,
  onChange,
}: {
  valor: number | null;
  email: string;
  onChange: (v: number | null) => void;
}) {
  const resp = useResponsaveisPD(true);
  useEffect(() => {
    if (valor || !email) return;
    const r = (resp.data ?? []).find(
      (x) => (x.email ?? "").toLowerCase() === email.trim().toLowerCase(),
    );
    if (r) onChange(r.pipedrive_user_id);
  }, [email, resp.data]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Campo rotulo="Responsável correspondente no Pipedrive (quando aplicável)">
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="h-9 w-full rounded-lg border bg-card px-2 text-sm text-foreground"
      >
        <option value="">Sem vínculo</option>
        {(resp.data ?? [])
          .filter((r) => r.ativo || r.pipedrive_user_id === valor)
          .map((r) => (
            <option key={r.pipedrive_user_id} value={r.pipedrive_user_id}>
              {r.nome} · {r.email ?? `#${r.pipedrive_user_id}`}
            </option>
          ))}
      </select>
    </Campo>
  );
}
function Carteiras({ valor, onChange }: { valor: number[]; onChange: (v: number[]) => void }) {
  const resp = useResponsaveisPD(true);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Carteiras autorizadas (responsáveis do Pipedrive)
      </p>
      <div className="flex flex-wrap gap-1.5">
        {(resp.data ?? [])
          .filter((r) => r.ativo || valor.includes(r.pipedrive_user_id))
          .map((r) => {
            const on = valor.includes(r.pipedrive_user_id);
            return (
              <button
                key={r.pipedrive_user_id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange(
                    on
                      ? valor.filter((x) => x !== r.pipedrive_user_id)
                      : [...valor, r.pipedrive_user_id],
                  )
                }
                className={cx(
                  "rounded-full border px-3 py-1 text-sm",
                  on
                    ? "border-primary bg-primary-soft text-primary"
                    : "bg-card hover:border-primary/40",
                )}
              >
                {r.nome}
              </button>
            );
          })}
      </div>
    </div>
  );
}
function Clientes({ valor, onChange }: { valor: string[]; onChange: (v: string[]) => void }) {
  const carteira = useCarteira();
  const [b, setB] = useState("");
  const nomes = new Map((carteira.data ?? []).map((l) => [l.c.key, l.c.nome]));
  const cand =
    b.trim().length >= 2
      ? (carteira.data ?? [])
          .filter((l) => l.c.nome.toLowerCase().includes(b.toLowerCase()))
          .slice(0, 8)
      : [];
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Clientes específicos (além das carteiras)
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {valor.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => onChange(valor.filter((x) => x !== k))}
            className="rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs text-primary"
            aria-label={`Remover ${nomes.get(k) ?? k}`}
          >
            {nomes.get(k) ?? k} ×
          </button>
        ))}
      </div>
      <input
        value={b}
        onChange={(e) => setB(e.target.value)}
        placeholder="Buscar cliente para adicionar"
        className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
      />
      {cand.length > 0 && (
        <ul className="mt-1 rounded-lg border bg-card text-sm">
          {cand.map((l) => (
            <li key={l.c.key}>
              <button
                type="button"
                disabled={valor.includes(l.c.key)}
                onClick={() => (onChange([...valor, l.c.key]), setB(""))}
                className="block w-full px-3 py-1.5 text-left hover:bg-surface-2 disabled:opacity-50"
              >
                {l.c.nome}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
function Modulos({
  perfil,
  valor,
  onChange,
}: {
  perfil: FormAcesso["perfil"];
  valor: string[] | null;
  onChange: (v: string[] | null) => void;
}) {
  const padrao = MODULOS_POR_PERFIL[perfil];
  const itens = NAV.filter(
    (i) => padrao.includes(i.mod) && !["usuarios", "configuracoes"].includes(i.mod),
  );
  const atual = valor ?? padrao;
  return (
    <div>
      <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
        Módulos disponíveis
        {valor && (
          <button type="button" className="text-primary" onClick={() => onChange(null)}>
            usar padrão do perfil
          </button>
        )}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {itens.map((i) => {
          const on = atual.includes(i.mod);
          return (
            <button
              key={i.mod}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? atual.filter((m) => m !== i.mod) : [...atual, i.mod])}
              className={cx(
                "rounded-full border px-3 py-1 text-xs",
                on ? "border-primary bg-primary-soft text-primary" : "bg-card",
              )}
            >
              {i.rotulo}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        Usuários, Configurações e Integrações dependem das permissões administrativas, não desta
        lista.
      </p>
    </div>
  );
}

/** Qualidade do vínculo com o usuário do Pipedrive (D40): confirmado por e-mail, manual, compartilhado ou ausente. */
function VinculoCelula({ v }: { v: import("@/lib/dcs/dados").VinculoPD | undefined }) {
  if (!v) return <span className="text-muted-foreground">—</span>;
  if (v.metodo === "sem_vinculo") return <Selo tom="aviso">Sem vínculo</Selo>;
  const rot =
    v.metodo === "email"
      ? "E-mail confere"
      : v.metodo === "email_dominio"
        ? "E-mail (outro domínio)"
        : "Manual";
  return (
    <span className="flex flex-col gap-0.5">
      <span className="truncate">{v.nome_pipedrive ?? `#${v.pipedrive_user_id}`}</span>
      <span className="flex flex-wrap gap-1">
        <Selo tom={v.metodo === "manual" ? "aviso" : "ok"}>{rot}</Selo>
        {v.compartilhado && <Selo tom="critico">Compartilhado</Selo>}
        {v.ativo_no_pipedrive === false && <Selo tom="critico">Inativo no Pipedrive</Selo>}
      </span>
    </span>
  );
}
