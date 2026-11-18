import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Copy, Crown, Lock, Search, UserCheck, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { adminAction } from "@/lib/admin.functions";
import { mensagemErro, type DcsUsuario } from "@/lib/dcs/db";
import {
  useAcessoDcs,
  useAnalistas,
  useAuditoria,
  useCarteira,
  useResponsaveisPD,
  useUsuarios,
  usePreCadastros,
  useAcaoPreCadastro,
  useSalvarUsuario,
  useTransferirMaster,
  type NovoUsuario,
} from "@/lib/dcs/dados";
import { PERFIL_ROTULO } from "@/components/dcs/navegacao";
import { cx, dataHoraBR, Estado, Kpi, Selo, Seletor, Tabela, Titulo } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/usuarios")({ component: Usuarios });

const STATUS_CONTA: Record<string, [string, "ok" | "aviso" | "critico" | "neutro"]> = {
  ativo: ["Conta ativa", "ok"],
  pendente: ["Aguardando aprovação", "aviso"],
  suspenso: ["Suspensa", "critico"],
};
const ehMaster = (u: DcsUsuario) => u.papel === "superadmin";
const rotuloPerfil = (u: DcsUsuario) =>
  ehMaster(u)
    ? "Administrador Master"
    : u.perfil && u.ativo
      ? PERFIL_ROTULO[u.perfil]
      : "Sem acesso ao Dinamize CS";

function Usuarios() {
  const acesso = useAcessoDcs();
  const admin = acesso.data?.perfil === "admin";
  const q = useUsuarios(admin);
  const resp = useResponsaveisPD(admin);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"" | "pendente" | "sem" | "ativos">("");
  const [sel, setSel] = useState<DcsUsuario | null>(null);
  const [novo, setNovo] = useState(false);
  const nomeResp = useMemo(
    () => new Map((resp.data ?? []).map((r) => [r.pipedrive_user_id, r.nome])),
    [resp.data],
  );
  const lista = useMemo(() => {
    const t = busca.toLowerCase().trim();
    return (q.data ?? []).filter(
      (u) =>
        (!t || `${u.nome ?? ""} ${u.email ?? ""}`.toLowerCase().includes(t)) &&
        (!filtro ||
          (filtro === "pendente" && u.status === "pendente") ||
          (filtro === "sem" && !(u.perfil && u.ativo) && !ehMaster(u)) ||
          (filtro === "ativos" && !!u.perfil && u.ativo)),
    );
  }, [q.data, busca, filtro]);
  const tot = q.data ?? [];
  return (
    <>
      <Titulo
        titulo="Usuários e permissões"
        sub="Perfis, carteiras e permissões do Dinamize CS. Todas as regras são aplicadas também no banco de dados."
      />
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4 text-sm">
        <p className="max-w-3xl text-muted-foreground">
          Cadastre a pessoa com antecedência: ao entrar pela primeira vez (Google ou e-mail
          verificado) com o e-mail autorizado, ela recebe automaticamente o perfil, as carteiras e
          as permissões definidas aqui. Quem entrar sem cadastro prévio aparece como{" "}
          <strong>aguardando aprovação</strong>.
        </p>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
        >
          <UserPlus className="h-4 w-4" /> Novo usuário
        </button>
      </div>
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Kpi rotulo="Usuários" valor={tot.length} icone={<Users />} tom="marca" />
          <Kpi
            rotulo="Com acesso ao Dinamize CS"
            valor={tot.filter((u) => u.perfil && u.ativo).length}
            icone={<UserCheck />}
            tom="ok"
          />
          <Kpi
            rotulo="Aguardando aprovação"
            valor={tot.filter((u) => u.status === "pendente").length}
            tom="aviso"
          />
          <Kpi
            rotulo="Sem perfil definido"
            valor={tot.filter((u) => !(u.perfil && u.ativo) && !ehMaster(u)).length}
          />
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] sm:grid-cols-[1fr_220px]">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Nome ou e-mail
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
              <input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar"
                className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </span>
          </label>
          <Seletor
            rotulo="Situação"
            valor={filtro}
            opcoes={
              [
                ["pendente", "Aguardando aprovação"],
                ["sem", "Sem perfil"],
                ["ativos", "Com acesso"],
              ] as const
            }
            onChange={(v) => setFiltro(v)}
          />
        </div>
        <Tabela>
          <thead className="bg-surface-2">
            <tr>
              <th>Usuário</th>
              <th>Perfil</th>
              <th>Conta</th>
              <th>Carteiras</th>
              <th className="text-center">Financeiro</th>
              <th className="text-center">Edição</th>
              <th className="text-center">Exportação</th>
              <th>Último acesso</th>
              <th>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => {
              const [st, tom] = STATUS_CONTA[u.status] ?? [u.status, "neutro" as const];
              const admin = ehMaster(u) || u.perfil === "admin";
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
                        {u.master_principal ? " · principal" : ""}
                      </Selo>
                    ) : (
                      <span className={cx(!(u.perfil && u.ativo) && "text-muted-foreground")}>
                        {rotuloPerfil(u)}
                      </span>
                    )}
                  </td>
                  <td>
                    <Selo tom={tom}>{st}</Selo>
                  </td>
                  <td className="max-w-[240px] text-xs">
                    {admin ? (
                      <span className="text-muted-foreground">Todas</span>
                    ) : u.carteiras.length || u.clientes.length ? (
                      <>
                        {u.carteiras.map((c) => nomeResp.get(c) ?? `#${c}`).join(", ")}
                        {u.clientes.length
                          ? `${u.carteiras.length ? " + " : ""}${u.clientes.length} cliente(s)`
                          : ""}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Nenhuma</span>
                    )}
                  </td>
                  <td className="text-center">{u.financeiro ? "Sim" : "—"}</td>
                  <td className="text-center">{admin || u.pode_editar ? "Sim" : "—"}</td>
                  <td className="text-center">{u.pode_exportar ? "Sim" : "—"}</td>
                  <td className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">
                    {dataHoraBR(u.ultimo_acesso)}
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
        <PreCadastros nomeResp={nomeResp} />
        <Responsaveis />
      </Estado>
      <FormUsuario aberto={novo} fechar={() => setNovo(false)} master={!!acesso.data?.master} />
      <Editor
        usuario={sel}
        fechar={() => setSel(null)}
        master={!!acesso.data?.master}
        nomeResp={nomeResp}
      />
    </>
  );
}

function Responsaveis() {
  const r = useResponsaveisPD(true);
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-base font-semibold">Responsáveis do Pipedrive</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Cadastrados automaticamente pela sincronização (proprietários dos negócios). Usados para
        associar carteiras aos usuários.
      </p>
      <div className="flex flex-wrap gap-2">
        {(r.data ?? []).map((x) => (
          <span
            key={x.pipedrive_user_id}
            className={cx(
              "rounded-lg border bg-card px-3 py-1.5 text-sm",
              !x.ativo && "text-muted-foreground line-through",
            )}
          >
            {x.nome} <span className="text-xs text-muted-foreground">#{x.pipedrive_user_id}</span>
          </span>
        ))}
        {!r.isLoading && !r.data?.length && (
          <p className="text-sm text-muted-foreground">Nenhum responsável sincronizado ainda.</p>
        )}
      </div>
    </section>
  );
}

function Editor({
  usuario: u,
  fechar,
  master,
  nomeResp,
}: {
  usuario: DcsUsuario | null;
  fechar: () => void;
  master: boolean;
  nomeResp: Map<number, string>;
}) {
  const { session } = useAuth();
  const qc = useQueryClient();
  const salvarU = useSalvarUsuario();
  const transferir = useTransferirMaster();
  const [confirmaMaster, setConfirmaMaster] = useState(false);
  const salvar = {
    isPending: salvarU.isPending,
    mutate: (x: Omit<NovoUsuario, "email" | "nome">, o: Parameters<typeof salvarU.mutate>[1]) =>
      salvarU.mutate({ ...x, email: u?.email ?? "", nome: "" }, o),
    mutateAsync: (x: Omit<NovoUsuario, "email" | "nome">) =>
      salvarU.mutateAsync({ ...x, email: u?.email ?? "", nome: "" }),
  };
  const acao = useServerFn(adminAction);
  const carteira = useCarteira();
  const resp = useResponsaveisPD(!!u);
  const hist = useAuditoria("membro", !!u);
  const analistas = useAnalistas();
  const [f, setF] = useState({
    perfil: "cs" as "admin" | "cs" | "contas",
    financeiro: false,
    pode_editar: true,
    pode_exportar: false,
    ativo: true,
    carteiras: [] as number[],
    clientes: [] as string[],
    pipedrive_user_id: null as number | null,
  });
  const [buscaCli, setBuscaCli] = useState("");
  useEffect(() => {
    setConfirmaMaster(false);
    if (u)
      setF({
        perfil: u.perfil ?? "cs",
        financeiro: u.financeiro,
        pode_editar: u.pode_editar,
        pode_exportar: u.pode_exportar,
        ativo: !!u.perfil && u.ativo,
        carteiras: u.carteiras,
        clientes: u.clientes,
        pipedrive_user_id: u.pipedrive_user_id,
      });
    setBuscaCli("");
  }, [u]);
  if (!u) return <Sheet open={false} />;
  const proprio = u.user_id === session?.user.id;
  const bloqueado =
    ehMaster(u) ||
    proprio ||
    ((u.perfil === "admin" || u.papel === "admin" || f.perfil === "admin") && !master);
  const motivo = ehMaster(u)
    ? "O Administrador Master tem acesso total e não pode ser alterado por esta tela."
    : proprio
      ? "Por segurança, ninguém altera o próprio acesso."
      : !master && (u.perfil === "admin" || u.papel === "admin")
        ? "Somente o Administrador Master altera administradores."
        : null;
  const nomesCli = new Map((carteira.data ?? []).map((l) => [l.c.key, l.c.nome]));
  const candidatos =
    buscaCli.trim().length >= 2
      ? (carteira.data ?? [])
          .filter((l) => l.c.nome.toLowerCase().includes(buscaCli.toLowerCase()))
          .slice(0, 8)
      : [];
  const enviar = () =>
    salvar.mutate(f, {
      onSuccess: () => (toast.success("Permissões salvas."), fechar()),
      onError: (e) => toast.error(mensagemErro(e)),
    });
  const conta = async (status: "ativo" | "suspenso") => {
    try {
      await acao({ data: { action: "status", userId: u.user_id, value: status } });
      if (status === "suspenso" && u.perfil && u.ativo)
        await salvar.mutateAsync({ ...f, ativo: false });
      toast.success(status === "ativo" ? "Conta aprovada." : "Acesso revogado.");
      void qc.invalidateQueries({ queryKey: ["dcs", "usuarios"] });
      fechar();
    } catch (e) {
      toast.error(mensagemErro(e));
    }
  };
  const eventos = (hist.data ?? []).filter((e) => e.entidade_id === u.user_id);
  const toggle = (
    k: "financeiro" | "pode_editar" | "pode_exportar" | "ativo",
    rot: string,
    dica: string,
  ) => (
    <label className="flex items-start justify-between gap-3 rounded-lg border p-3">
      <span>
        <span className="block text-sm font-medium">{rot}</span>
        <span className="block text-xs text-muted-foreground">{dica}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[var(--primary)]"
        checked={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.checked })}
      />
    </label>
  );
  return (
    <Sheet open={!!u} onOpenChange={(o) => !o && fechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        <SheetTitle className="pr-6 text-base">{u.nome || u.email}</SheetTitle>
        <p className="text-sm text-muted-foreground">
          {u.email} · {rotuloPerfil(u)}
        </p>
        {u.status === "pendente" && !ehMaster(u) && (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Conta aguardando aprovação.
            <button
              type="button"
              onClick={() => void conta("ativo")}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
            >
              Aprovar conta
            </button>
          </div>
        )}
        {motivo && (
          <p className="mt-4 flex items-center gap-2 rounded-lg bg-surface-2 p-3 text-sm text-muted-foreground">
            <Lock className="h-4 w-4 shrink-0" /> {motivo}
          </p>
        )}
        <fieldset disabled={bloqueado} className="mt-5 space-y-4">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">Perfil no Dinamize CS</span>
            <select
              value={f.perfil}
              onChange={(e) => setF({ ...f, perfil: e.target.value as typeof f.perfil })}
              className="h-9 rounded-lg border bg-card px-2"
            >
              <option value="cs">Analista de CS</option>
              <option value="contas">Analista de contas</option>
              {master && <option value="admin">Administrador</option>}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-medium text-muted-foreground">
              Usuário no Pipedrive (vincula as atividades registradas automaticamente)
            </span>
            <select
              value={f.pipedrive_user_id ?? ""}
              onChange={(e) =>
                setF({ ...f, pipedrive_user_id: e.target.value ? Number(e.target.value) : null })
              }
              className="h-9 rounded-lg border bg-card px-2"
            >
              <option value="">Sem vínculo</option>
              {(resp.data ?? [])
                .filter((r) => r.ativo || r.pipedrive_user_id === f.pipedrive_user_id)
                .map((r) => (
                  <option key={r.pipedrive_user_id} value={r.pipedrive_user_id}>
                    {r.nome} · {r.email ?? `#${r.pipedrive_user_id}`}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {toggle("ativo", "Acesso ativo", "Desmarque para desativar sem excluir.")}
            {toggle("financeiro", "Ver valores", "Valores dos negócios (Pipedrive).")}
            {toggle("pode_editar", "Editar", "Diagnósticos e planos de ação.")}
            {toggle("pode_exportar", "Exportar", "Exportar listas da carteira.")}
          </div>
          {f.perfil !== "admin" && (
            <>
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Carteiras (responsáveis do Pipedrive)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(resp.data ?? [])
                    .filter((r) => r.ativo || f.carteiras.includes(r.pipedrive_user_id))
                    .map((r) => {
                      const on = f.carteiras.includes(r.pipedrive_user_id);
                      return (
                        <button
                          key={r.pipedrive_user_id}
                          type="button"
                          aria-pressed={on}
                          onClick={() =>
                            setF({
                              ...f,
                              carteiras: on
                                ? f.carteiras.filter((x) => x !== r.pipedrive_user_id)
                                : [...f.carteiras, r.pipedrive_user_id],
                            })
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
              <div>
                <p className="mb-1 text-xs font-medium text-muted-foreground">
                  Clientes específicos (além das carteiras)
                </p>
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {f.clientes.map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setF({ ...f, clientes: f.clientes.filter((x) => x !== k) })}
                      className="rounded-full border border-primary bg-primary-soft px-3 py-1 text-xs text-primary"
                      aria-label={`Remover ${nomesCli.get(k) ?? k}`}
                    >
                      {nomesCli.get(k) ?? k} ×
                    </button>
                  ))}
                </div>
                <input
                  value={buscaCli}
                  onChange={(e) => setBuscaCli(e.target.value)}
                  placeholder="Buscar cliente para adicionar"
                  className="h-9 w-full rounded-lg border bg-card px-2 text-sm"
                />
                {candidatos.length > 0 && (
                  <ul className="mt-1 rounded-lg border bg-card text-sm">
                    {candidatos.map((l) => (
                      <li key={l.c.key}>
                        <button
                          type="button"
                          disabled={f.clientes.includes(l.c.key)}
                          onClick={() => (
                            setF({ ...f, clientes: [...f.clientes, l.c.key] }),
                            setBuscaCli("")
                          )}
                          className="block w-full px-3 py-1.5 text-left hover:bg-surface-2 disabled:opacity-50"
                        >
                          {l.c.nome}{" "}
                          <span className="text-xs text-muted-foreground">{l.c.owner_nome}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
          {!bloqueado && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enviar}
                disabled={salvar.isPending}
                className="h-9 flex-1 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
              >
                {salvar.isPending ? "Salvando…" : "Salvar permissões"}
              </button>
              {u.status === "ativo" && u.papel === "user" && (
                <button
                  type="button"
                  onClick={() => void conta("suspenso")}
                  className="h-9 rounded-lg border border-red-200 px-4 text-sm font-medium text-red-700 hover:bg-red-50"
                >
                  Revogar acesso
                </button>
              )}
              {u.status === "suspenso" && (
                <button
                  type="button"
                  onClick={() => void conta("ativo")}
                  className="h-9 rounded-lg border px-4 text-sm font-medium hover:border-primary"
                >
                  Reativar conta
                </button>
              )}
            </div>
          )}
        </fieldset>
        {master &&
          !proprio &&
          !ehMaster(u) &&
          u.status === "ativo" &&
          (u.papel === "admin" || u.perfil === "admin") && (
            <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <p className="font-medium">Transferir o Administrador Master</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {u.nome || u.email} passa a ser o Master principal. Sua conta continua como
                Administrador (não é excluída). O banco só aceita se a conta estiver ativa, com
                e-mail verificado e login Google, e registra a troca na auditoria.
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
                    className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
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
          <h3 className="mb-2 text-sm font-semibold">Histórico de permissões</h3>
          {eventos.length ? (
            <ol className="space-y-2 border-l pl-3 text-xs">
              {eventos.map((e) => {
                const d = (e.dados ?? {}) as {
                  perfil?: string;
                  ativo?: boolean;
                  financeiro?: boolean;
                  carteiras?: number[];
                };
                return (
                  <li key={e.id}>
                    <span className="text-muted-foreground">
                      {dataHoraBR(e.em)} ·{" "}
                      {e.ator ? (analistas.data?.get(e.ator) ?? "Administrador") : "Sistema"}
                    </span>
                    <div>
                      {d.perfil ? PERFIL_ROTULO[d.perfil as keyof typeof PERFIL_ROTULO] : e.acao}
                      {d.ativo === false ? " · desativado" : ""}
                      {d.financeiro ? " · financeiro" : ""}
                      {d.carteiras?.length
                        ? ` · carteiras: ${d.carteiras.map((c) => nomeResp.get(c) ?? c).join(", ")}`
                        : ""}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma alteração registrada.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Novo usuário (pré-cadastro) ---------------- */
const VAZIO: NovoUsuario = {
  email: "",
  nome: "",
  perfil: "cs",
  financeiro: false,
  pode_editar: true,
  pode_exportar: false,
  ativo: true,
  carteiras: [],
  clientes: [],
  pipedrive_user_id: null,
};
function FormUsuario({
  aberto,
  fechar,
  master,
  inicial,
}: {
  aberto: boolean;
  fechar: () => void;
  master: boolean;
  inicial?: NovoUsuario | null;
}) {
  const salvar = useSalvarUsuario();
  const resp = useResponsaveisPD(aberto);
  const [f, setF] = useState<NovoUsuario>(VAZIO);
  useEffect(() => {
    if (aberto) setF(inicial ?? VAZIO);
  }, [aberto, inicial]);
  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email.trim());
  // Sugere o vínculo do Pipedrive pelo e-mail (mesmo endereço); nunca só pelo nome.
  useEffect(() => {
    if (!emailOk || f.pipedrive_user_id) return;
    const r = (resp.data ?? []).find(
      (x) => (x.email ?? "").toLowerCase() === f.email.trim().toLowerCase(),
    );
    if (r)
      setF((v) => ({
        ...v,
        pipedrive_user_id: r.pipedrive_user_id,
        carteiras: v.carteiras.length ? v.carteiras : [r.pipedrive_user_id],
      }));
  }, [emailOk, f.email, f.pipedrive_user_id, resp.data]);
  const enviar = () =>
    salvar.mutate(
      { ...f, email: f.email.trim().toLowerCase() },
      {
        onSuccess: (r) => {
          toast.success(
            r.modo === "aplicado"
              ? "A pessoa já tinha conta: permissões aplicadas."
              : "Pré-cadastro salvo. As permissões serão aplicadas no primeiro login com este e-mail.",
          );
          fechar();
        },
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  const ck = (k: "financeiro" | "pode_editar" | "pode_exportar" | "ativo", rot: string) => (
    <label className="flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm">
      {rot}
      <input
        type="checkbox"
        className="h-4 w-4 accent-[var(--primary)]"
        checked={f[k]}
        onChange={(e) => setF({ ...f, [k]: e.target.checked })}
      />
    </label>
  );
  return (
    <Sheet open={aberto} onOpenChange={(o) => !o && fechar()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="pr-6 text-base">
          {inicial ? "Editar pré-cadastro" : "Novo usuário"}
        </SheetTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          A identidade é confirmada pelo login (Google ou e-mail verificado). Nada é enviado
          automaticamente: use “Copiar convite” para mandar o link de acesso.
        </p>
        <div className="mt-5 space-y-3">
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            E-mail *
            <input
              type="email"
              disabled={!!inicial}
              value={f.email}
              onChange={(e) => setF({ ...f, email: e.target.value, pipedrive_user_id: null })}
              className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground disabled:opacity-60"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Nome
            <input
              value={f.nome}
              onChange={(e) => setF({ ...f, nome: e.target.value })}
              className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Perfil
            <select
              value={f.perfil}
              onChange={(e) => setF({ ...f, perfil: e.target.value as NovoUsuario["perfil"] })}
              className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
            >
              <option value="cs">Analista de CS</option>
              <option value="contas">Analista de contas</option>
              {master && <option value="admin">Administrador</option>}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Usuário no Pipedrive
            <select
              value={f.pipedrive_user_id ?? ""}
              onChange={(e) =>
                setF({ ...f, pipedrive_user_id: e.target.value ? Number(e.target.value) : null })
              }
              className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
            >
              <option value="">Sem vínculo</option>
              {(resp.data ?? [])
                .filter((r) => r.ativo)
                .map((r) => (
                  <option key={r.pipedrive_user_id} value={r.pipedrive_user_id}>
                    {r.nome} · {r.email ?? `#${r.pipedrive_user_id}`}
                  </option>
                ))}
            </select>
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {ck("ativo", "Acesso ativo")}
            {ck("financeiro", "Ver valores")}
            {ck("pode_editar", "Editar")}
            {ck("pode_exportar", "Exportar")}
          </div>
          {f.perfil !== "admin" && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Carteiras</p>
              <div className="flex flex-wrap gap-1.5">
                {(resp.data ?? [])
                  .filter((r) => r.ativo)
                  .map((r) => {
                    const on = f.carteiras.includes(r.pipedrive_user_id);
                    return (
                      <button
                        key={r.pipedrive_user_id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setF({
                            ...f,
                            carteiras: on
                              ? f.carteiras.filter((x) => x !== r.pipedrive_user_id)
                              : [...f.carteiras, r.pipedrive_user_id],
                          })
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
          )}
          <button
            type="button"
            disabled={!emailOk || salvar.isPending}
            onClick={enviar}
            className="h-9 w-full rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {salvar.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PreCadastros({ nomeResp }: { nomeResp: Map<number, string> }) {
  const acesso = useAcessoDcs();
  const q = usePreCadastros(acesso.data?.perfil === "admin");
  const acao = useAcaoPreCadastro();
  const [editar, setEditar] = useState<NovoUsuario | null>(null);
  const lista = q.data ?? [];
  if (!lista.length) return null;
  const copiar = async (email: string) => {
    const link = `${window.location.origin}/auth`;
    const texto = `Olá! Seu acesso ao Dinamize CS está liberado. Entre em ${link} com o e-mail ${email} (Google ou e-mail e senha).`;
    try {
      await navigator.clipboard.writeText(texto);
      acao.mutate({ email, acao: "convite" });
      toast.success("Convite copiado. Envie para a pessoa pelo seu canal habitual.");
    } catch {
      toast.error("Não foi possível copiar. Link de acesso: " + link);
    }
  };
  return (
    <section className="mt-8">
      <h2 className="mb-1 text-base font-semibold">Pré-cadastros</h2>
      <p className="mb-3 text-sm text-muted-foreground">
        Pessoas autorizadas que ainda não entraram, e o histórico dos pré-cadastros aplicados ou
        revogados.
      </p>
      <Tabela>
        <thead className="bg-surface-2">
          <tr>
            <th>E-mail</th>
            <th>Perfil</th>
            <th>Carteiras</th>
            <th>Situação</th>
            <th>Convite</th>
            <th>
              <span className="sr-only">Ações</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {lista.map((p) => {
            const situacao = p.aplicado_em
              ? (["Aplicado no login", "ok"] as const)
              : p.revogado_em
                ? (["Revogado", "neutro"] as const)
                : (["Aguardando primeiro login", "aviso"] as const);
            const aberto = !p.aplicado_em && !p.revogado_em;
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
                <td>
                  <Selo tom={situacao[1]}>{situacao[0]}</Selo>
                  <span className="block text-xs text-muted-foreground">
                    {dataHoraBR(p.aplicado_em ?? p.revogado_em ?? p.criado_em)}
                  </span>
                </td>
                <td className="text-xs text-muted-foreground">
                  {p.convite_enviado_em ? `Copiado em ${dataHoraBR(p.convite_enviado_em)}` : "—"}
                </td>
                <td className="whitespace-nowrap text-right">
                  {aberto && (
                    <>
                      <button
                        type="button"
                        onClick={() => void copiar(p.email)}
                        className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                      >
                        <Copy className="mr-1 inline h-3 w-3" />
                        {p.convite_enviado_em ? "Reenviar convite" : "Copiar convite"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditar({
                            email: p.email,
                            nome: p.nome ?? "",
                            perfil: p.perfil,
                            financeiro: p.financeiro,
                            pode_editar: p.pode_editar,
                            pode_exportar: p.pode_exportar,
                            ativo: p.ativo,
                            carteiras: p.carteiras,
                            clientes: p.clientes,
                            pipedrive_user_id: p.pipedrive_user_id,
                          })
                        }
                        className="mr-1 rounded-md border px-2 py-1 text-xs hover:border-primary"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          acao.mutate(
                            { email: p.email, acao: "revogar" },
                            {
                              onSuccess: () => toast.success("Pré-cadastro revogado."),
                              onError: (e) => toast.error(mensagemErro(e)),
                            },
                          )
                        }
                        className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50"
                      >
                        Revogar
                      </button>
                    </>
                  )}
                  {p.revogado_em && !p.aplicado_em && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditar({
                          email: p.email,
                          nome: p.nome ?? "",
                          perfil: p.perfil,
                          financeiro: p.financeiro,
                          pode_editar: p.pode_editar,
                          pode_exportar: p.pode_exportar,
                          ativo: true,
                          carteiras: p.carteiras,
                          clientes: p.clientes,
                          pipedrive_user_id: p.pipedrive_user_id,
                        })
                      }
                      className="rounded-md border px-2 py-1 text-xs hover:border-primary"
                    >
                      Reativar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Tabela>
      <FormUsuario
        aberto={!!editar}
        fechar={() => setEditar(null)}
        master={!!acesso.data?.master}
        inicial={editar}
      />
    </section>
  );
}
