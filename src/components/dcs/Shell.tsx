import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  RefreshCw,
  Settings2,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth";
import { dcs, mensagemErro } from "@/lib/dcs/db";
import {
  hojeSP,
  useAcessoDcs,
  useAlertas,
  useSolicitarSync,
  useStatusSync,
  type EstadoSync,
} from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { CargasAutomaticas } from "@/components/munim/CargasAutomaticas";
import { Marca } from "./Marca";
import { NAV, PERFIL_ROTULO, tituloDaRota, type ItemNav } from "./navegacao";
import { cx, dataHoraBR } from "./ui";

const CHAVE_RECOLHIDO = "dcs:menu-recolhido";

/** Contadores do menu (somente leitura, respeitando a RLS de cada usuário). */
function useContadores(ativo: boolean) {
  const { session } = useAuth();
  const alertas = useAlertas();
  const extra = useQuery({
    queryKey: ["dcs", "contadores", session?.user.id],
    enabled: ativo && !!session,
    queryFn: async () => {
      const [an, at] = await Promise.all([
        dcs
          .from("dcs_diagnosticos")
          .select("id", { count: "exact", head: true })
          .eq("status", "em_analise")
          .eq("analista_id", session!.user.id),
        dcs
          .from("dcs_acoes")
          .select("id", { count: "exact", head: true })
          .eq("obsoleta", false)
          .lt("prazo", hojeSP())
          .not("status", "in", "(implementado,nao_aprovado)"),
      ]);
      return { analises: an.count ?? 0, atrasadas: at.count ?? 0 };
    },
    staleTime: 60_000,
  });
  return {
    alertas: alertas.data?.length ?? 0,
    analises: extra.data?.analises ?? 0,
    atrasadas: extra.data?.atrasadas ?? 0,
  };
}

function ListaNav({ recolhido, aoNavegar }: { recolhido?: boolean; aoNavegar?: () => void }) {
  const acesso = useAcessoDcs();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const perfil = acesso.data?.perfil ?? null;
  const mods: readonly string[] = perfil
    ? (acesso.data?.modulos ?? MODULOS_POR_PERFIL[perfil])
    : [];
  const itens = NAV.filter((i) => mods.includes(i.mod));
  const cont = useContadores(!!perfil);
  if (acesso.isLoading)
    return (
      <div className="space-y-2 px-3 py-2" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Navegação principal">
      {itens.map((i: ItemNav, n) => {
        const ativo = i.exato
          ? path === i.to || path === i.to + "/"
          : path.startsWith(i.to) || (i.to === "/dcs/carteira" && path.startsWith("/dcs/cliente/"));
        const novoGrupo = n === 0 || itens[n - 1]!.grupo !== i.grupo;
        const qtd = i.contador ? cont[i.contador] : 0;
        const Icone = i.icone;
        return (
          <div key={i.to}>
            {novoGrupo &&
              (recolhido ? (
                n > 0 && <div className="mx-3 my-2 border-t" />
              ) : (
                <p className="px-3 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80">
                  {i.grupo}
                </p>
              ))}
            <Link
              to={i.to}
              onClick={aoNavegar}
              aria-current={ativo ? "page" : undefined}
              title={recolhido ? i.rotulo : undefined}
              className={cx(
                "group relative flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                ativo
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-foreground/80 hover:bg-muted hover:text-foreground",
                recolhido && "justify-center px-0",
              )}
            >
              <Icone
                className={cx(
                  "h-[18px] w-[18px] shrink-0",
                  ativo ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                )}
              />
              {!recolhido && <span className="min-w-0 flex-1 truncate">{i.rotulo}</span>}
              {qtd > 0 &&
                (recolhido ? (
                  <span
                    className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary"
                    aria-label={`${qtd} pendentes`}
                  />
                ) : (
                  <span
                    className={cx(
                      "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                      ativo
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {qtd > 99 ? "99+" : qtd}
                  </span>
                ))}
            </Link>
          </div>
        );
      })}
    </nav>
  );
}

function RodapeUsuario({ recolhido }: { recolhido?: boolean }) {
  const { perfil: p, session, sair } = useAuth();
  const acesso = useAcessoDcs();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const nome = p?.nome || session?.user.email || "";
  const papel = acesso.data?.master
    ? "Administrador Master"
    : acesso.data?.perfil
      ? PERFIL_ROTULO[acesso.data.perfil]
      : "Sem perfil no Dinamize CS";
  const handleSair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await sair();
    navigate({ to: "/auth", search: {}, replace: true });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cx(
          "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted",
          recolhido && "justify-center",
        )}
        aria-label="Menu da conta"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary">
          {nome.charAt(0).toUpperCase() || "?"}
        </span>
        {!recolhido && (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{nome}</span>
            <span className="block truncate text-xs text-muted-foreground">{papel}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">{nome}</span>
          <span className="block truncate text-xs text-muted-foreground">
            {session?.user.email}
          </span>
          <span className="block text-xs text-muted-foreground">{papel}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate({ to: "/dcs/minha-conta" })}>
          <UserRound className="mr-2 h-4 w-4" /> Minha conta
        </DropdownMenuItem>
        {acesso.data?.perfil === "admin" && (
          <DropdownMenuItem onClick={() => navigate({ to: "/dcs/configuracoes" })}>
            <Settings2 className="mr-2 h-4 w-4" /> Configurações
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSair}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const ESTADO: Record<EstadoSync, { rotulo: string; cor: string }> = {
  sincronizado: { rotulo: "Sincronizado", cor: "bg-emerald-500" },
  sincronizando: { rotulo: "Sincronizando", cor: "bg-sky-500 animate-pulse" },
  pendente: { rotulo: "Atualização pendente", cor: "bg-amber-500" },
  falha: { rotulo: "Falha", cor: "bg-red-500" },
  indisponivel: { rotulo: "Indisponível", cor: "bg-gray-400" },
};

function StatusIntegracoes() {
  const st = useStatusSync();
  const acesso = useAcessoDcs();
  const solicitar = useSolicitarSync();
  if (!acesso.data?.perfil) return null;
  const d = st.data;
  const pd = d?.carteira.estado ?? "indisponivel";
  const geral = d?.geral ?? "indisponivel";
  const ultimaPD = d?.carteira.sucesso?.concluido_em ?? null;
  const ultimaCob = d?.cobertura.sucesso?.concluido_em ?? null;
  const ocupado =
    solicitar.isPending || geral === "sincronizando" || d?.carteira.pedido?.status === "pendente";
  return (
    <div className="flex items-center gap-2">
      <Link
        to={acesso.data.perfil === "admin" ? "/dcs/integracoes" : "/dcs"}
        className="hidden items-center gap-3 rounded-lg border bg-card px-3 py-1.5 text-xs lg:flex"
        title={`Pipedrive (carteira): ${ESTADO[pd].rotulo}${ultimaPD ? ` · ${dataHoraBR(ultimaPD)}` : ""}\nn8n (cobertura): ${ESTADO[d?.cobertura.estado ?? "indisponivel"].rotulo}${ultimaCob ? ` · ${dataHoraBR(ultimaCob)}` : ""}`}
      >
        <span className="flex items-center gap-1.5">
          <span className={cx("h-2 w-2 rounded-full", ESTADO[pd].cor)} />
          <span className="font-medium">Pipedrive</span>
          <span className="text-muted-foreground">{ESTADO[pd].rotulo}</span>
        </span>
        <span className="h-3 w-px bg-border" />
        <span className="flex items-center gap-1.5">
          <span
            className={cx(
              "h-2 w-2 rounded-full",
              ESTADO[d?.cobertura.estado ?? "indisponivel"].cor,
            )}
          />
          <span className="font-medium">n8n</span>
          <span className="text-muted-foreground">
            {ultimaCob
              ? dataHoraBR(ultimaCob)
              : ESTADO[d?.cobertura.estado ?? "indisponivel"].rotulo}
          </span>
        </span>
      </Link>
      <span
        className={cx("h-2.5 w-2.5 rounded-full lg:hidden", ESTADO[geral].cor)}
        title={ESTADO[geral].rotulo}
        aria-label={`Integrações: ${ESTADO[geral].rotulo}`}
      />
      {acesso.data.perfil === "admin" && (
        <button
          type="button"
          disabled={ocupado}
          onClick={() =>
            solicitar.mutate(undefined, {
              onSuccess: () =>
                toast.success(
                  "Atualização solicitada. A carteira e a cobertura serão atualizadas em instantes.",
                ),
              onError: (e) => toast.error(mensagemErro(e)),
            })
          }
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={cx("h-4 w-4", ocupado && "animate-spin")} />
          <span className="hidden sm:inline">
            {ocupado ? "Atualizando…" : "Atualizar carteira"}
          </span>
        </button>
      )}
    </div>
  );
}

const ROTULO_ALERTA: Record<string, string> = {
  revisao_vencida: "Revisões vencidas",
  acao_atrasada: "Ações atrasadas",
  cobertura_critica: "Cobertura crítica",
  oportunidade_critica: "Oportunidades críticas",
  utilizacao_revisao: "Contas sem utilização para revisar",
};
function Notificacoes() {
  const alertas = useAlertas();
  const lista = alertas.data ?? [];
  const porTipo = Object.entries(
    lista.reduce<Record<string, number>>((m, a) => ((m[a.tipo] = (m[a.tipo] ?? 0) + 1), m), {}),
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="relative grid h-9 w-9 place-items-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Notificações: ${lista.length}`}
      >
        <Bell className="h-4 w-4" />
        {lista.length > 0 && (
          <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground">
            {lista.length > 99 ? "99+" : lista.length}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Alertas e pendências</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {porTipo.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Nenhuma pendência no momento.</p>
        ) : (
          porTipo.map(([tipo, n]) => (
            <DropdownMenuItem key={tipo} asChild>
              <Link to="/dcs/alertas" search={{ tipo } as never} className="flex justify-between">
                <span>{ROTULO_ALERTA[tipo] ?? tipo}</span>
                <span className="font-semibold tabular-nums">{n}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [recolhido, setRecolhido] = useState(false);
  const [aberto, setAberto] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  const titulo = tituloDaRota(path);
  useEffect(() => {
    try {
      setRecolhido(localStorage.getItem(CHAVE_RECOLHIDO) === "1");
    } catch {
      /* sem armazenamento */
    }
  }, []);
  useEffect(() => {
    document.title = `${titulo} · Dinamize CS`;
  }, [titulo]);
  const alternar = () => {
    setRecolhido((r) => {
      try {
        localStorage.setItem(CHAVE_RECOLHIDO, r ? "0" : "1");
      } catch {
        /* sem armazenamento */
      }
      return !r;
    });
  };
  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow"
      >
        Pular para o conteúdo
      </a>
      <aside
        className={cx(
          "sticky top-0 hidden h-dvh shrink-0 flex-col border-r bg-sidebar transition-[width] duration-200 md:flex",
          recolhido ? "w-[68px]" : "w-[260px]",
        )}
      >
        <div
          className={cx("flex h-16 items-center border-b px-4", recolhido && "justify-center px-0")}
        >
          <Link to="/dcs" aria-label="Dinamize CS — visão geral">
            <Marca compacta={recolhido} />
          </Link>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
          <ListaNav recolhido={recolhido} />
        </div>
        <div className="border-t p-3">
          <RodapeUsuario recolhido={recolhido} />
          <button
            type="button"
            onClick={alternar}
            className={cx(
              "mt-1 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground",
              recolhido && "justify-center",
            )}
            aria-label={recolhido ? "Expandir menu" : "Recolher menu"}
          >
            {recolhido ? (
              <ChevronsRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronsLeft className="h-4 w-4" /> Recolher menu
              </>
            )}
          </button>
        </div>
      </aside>

      <Sheet open={aberto} onOpenChange={setAberto}>
        <SheetContent side="left" className="flex w-[280px] flex-col bg-sidebar p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex h-16 items-center border-b px-4">
            <Marca />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
            <ListaNav aoNavegar={() => setAberto(false)} />
          </div>
          <div className="border-t p-3">
            <RodapeUsuario />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-card/95 px-4 backdrop-blur md:px-6">
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border md:hidden"
            aria-label="Abrir menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div
            className="min-w-0 flex-1 truncate text-sm font-semibold md:text-base"
            aria-live="polite"
          >
            {titulo}
          </div>
          <StatusIntegracoes />
          <Notificacoes />
        </header>
        <main id="conteudo" className="min-w-0 flex-1 px-4 py-6 md:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1480px]">{children}</div>
        </main>
      </div>
      <CargasAutomaticas />
    </div>
  );
}
