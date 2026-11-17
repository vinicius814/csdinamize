import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Crown, Info, Lock, Search, UserCheck, Users } from "lucide-react";
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
  useSalvarPermissoes,
  useUsuarios,
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
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Convites automáticos estão desativados nesta etapa. Novas pessoas entram pela tela de
          login (Google ou e-mail) e aparecem aqui como
          <strong> aguardando aprovação</strong>; em seguida, defina o perfil e as carteiras de cada
          uma. Nenhuma carteira é atribuída automaticamente.
        </p>
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
        <Responsaveis />
      </Estado>
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
  const salvar = useSalvarPermissoes();
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
  });
  const [buscaCli, setBuscaCli] = useState("");
  useEffect(() => {
    if (u)
      setF({
        perfil: u.perfil ?? "cs",
        financeiro: u.financeiro,
        pode_editar: u.pode_editar,
        pode_exportar: u.pode_exportar,
        ativo: !!u.perfil && u.ativo,
        carteiras: u.carteiras,
        clientes: u.clientes,
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
    salvar.mutate(
      { user_id: u.user_id, ...f },
      {
        onSuccess: () => (toast.success("Permissões salvas."), fechar()),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  const conta = async (status: "ativo" | "suspenso") => {
    try {
      await acao({ data: { action: "status", userId: u.user_id, value: status } });
      if (status === "suspenso" && u.perfil && u.ativo)
        await salvar.mutateAsync({ user_id: u.user_id, ...f, ativo: false });
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
