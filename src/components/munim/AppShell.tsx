import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { telegramStatus } from "@/lib/telegram.functions";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronsLeft, Home, LogOut, Menu, MessageCircle, Mic, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { usePendentes } from "@/lib/dados";
import { navVisivel } from "./nav";
import { useConnectionPresence } from "@/lib/connection-presence";
import { MunimLogo, RavenMark } from "./RavenMark";
import { PaletaComandos } from "./PaletaComandos";

const PAPEL: Record<string, string> = { user: "Pessoal", admin: "Admin", superadmin: "Superadmin" };

function Contador({ n }: { n: number }) {
  if (!n) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-ember px-1.5 text-center text-[11px] font-semibold leading-5 text-ember-foreground">
      {n}
    </span>
  );
}

function MenuUsuario({ compacto }: { compacto?: boolean }) {
  const { perfil, role, session, sair } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const nome = perfil?.nome ?? session?.user.email ?? "";
  const handleSair = async () => {
    await qc.cancelQueries();
    qc.clear();
    await sair();
    navigate({ to: "/auth", search: {}, replace: true });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 hover:bg-accent"
        aria-label="Menu do usuário"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary">
          {nome.charAt(0).toUpperCase() || "?"}
        </span>
        {!compacto && (
          <span className="min-w-0">
            <span className="block truncate text-sm text-foreground">{nome}</span>
            {perfil && <span className="block text-xs text-muted-foreground">{PAPEL[role ?? "user"]}</span>}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        <DropdownMenuLabel className="truncate">{session?.user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleSair}>
          <LogOut className="mr-2 h-4 w-4" /> Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ListaNav({ recolhida, aoNavegar }: { recolhida?: boolean; aoNavegar?: () => void }) {
  const connections = useConnectionPresence();
  const { role } = useAuth();
  const { data: pendentes } = usePendentes();
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {navVisivel(role ?? undefined,connections.data?.pipedrive).map((i) => {
        const ativo = i.to === "/" ? path === "/" : path.startsWith(i.to);
        return (
          <Link
            key={i.to}
            to={i.to}
            onClick={aoNavegar}
            title={recolhida ? i.label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
              ativo
                ? "bg-primary-soft text-primary shadow-glow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <i.icon className="h-[18px] w-[18px] shrink-0" />
            {!recolhida && <span>{i.label}</span>}
            {!recolhida && i.to === "/aprovacoes" && <Contador n={pendentes?.length ?? 0} />}
            {recolhida && i.to === "/aprovacoes" && !!pendentes?.length && (
              <span className="absolute ml-4 -mt-4 h-2 w-2 rounded-full bg-ember" />
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [recolhida, setRecolhida] = useState(false);
  const [paleta, setPaleta] = useState(false);
  const [mais, setMais] = useState(false);
  const { data: pendentes } = usePendentes();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaleta((v) => !v);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* lateral (desktop) */}
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar p-3 transition-[width] duration-200 md:flex",
          recolhida ? "w-[68px]" : "w-60",
        )}
      >
        <div className="mb-6 flex items-center justify-between px-1 pt-1">
          {recolhida ? <RavenMark className="mx-auto h-8 w-8" /> : <MunimLogo />}
        </div>
        <button
          onClick={() => setPaleta(true)}
          className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:border-primary/50 hover:text-foreground"
        >
          <Search className="h-4 w-4 shrink-0" />
          {!recolhida && (
            <>
              <span>Pergunte ao Munim</span>
              <kbd className="ml-auto rounded border border-border px-1.5 text-[10px]">Ctrl K</kbd>
            </>
          )}
        </button>
        <ListaNav recolhida={recolhida} />
        <div className="mt-auto flex flex-col gap-2">
          <button
            onClick={() => setRecolhida((v) => !v)}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label={recolhida ? "Expandir barra" : "Recolher barra"}
          >
            <ChevronsLeft className={cn("h-4 w-4 transition-transform duration-200", recolhida && "rotate-180")} />
            {!recolhida && "Recolher"}
          </button>
          <MenuUsuario compacto={recolhida} />
        </div>
      </aside>

      <main className="min-w-0 flex-1 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>

      {/* barra inferior (celular) */}
      <nav className="glass fixed inset-x-0 bottom-0 z-40 flex items-end justify-around border-t border-border px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 md:hidden">
        {(
          [
            { to: "/", label: "Início", icon: Home },
            { to: "/conversa", label: "Conversa", icon: MessageCircle },
          ] as const
        ).map((i) => (
          <Link
            key={i.to}
            to={i.to}
            className={cn(
              "flex w-16 flex-col items-center gap-1 text-[11px]",
              (i.to === "/" ? path === "/" : path.startsWith(i.to)) ? "text-primary" : "text-muted-foreground",
            )}
          >
            <i.icon className="h-5 w-5" />
            {i.label}
          </Link>
        ))}
        <TelegramMic />
        <Link
          to="/aprovacoes"
          className={cn(
            "relative flex w-16 flex-col items-center gap-1 text-[11px]",
            path.startsWith("/aprovacoes") ? "text-primary" : "text-muted-foreground",
          )}
        >
          <CheckCircle2 className="h-5 w-5" />
          Aprovações
          {!!pendentes?.length && (
            <span className="absolute right-3 top-0 h-2 w-2 rounded-full bg-ember" />
          )}
        </Link>
        <button onClick={() => setMais(true)} className="flex w-16 flex-col items-center gap-1 text-[11px] text-muted-foreground">
          <Menu className="h-5 w-5" />
          Mais
        </button>
      </nav>

      <Sheet open={mais} onOpenChange={setMais}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetTitle className="sr-only">Mais opções</SheetTitle>
          <div className="flex flex-col gap-4 pt-2">
            <ListaNav aoNavegar={() => setMais(false)} />
            <MenuUsuario />
          </div>
        </SheetContent>
      </Sheet>

      <PaletaComandos aberta={paleta} setAberta={setPaleta} />
    </div>
  );
}

function TelegramMic() {
  const { session } = useAuth();
  const read = useServerFn(telegramStatus);
  const q = useQuery({ queryKey: ["telegram-status", session?.user.id], queryFn: () => read(), staleTime: 300_000, enabled: !!session });
  const bot = q.data?.connected ? q.data.bot : null;
  return (
    <a
      href={bot ? `https://t.me/${bot}` : "/conexoes#telegram"}
      target={bot ? "_blank" : undefined}
      rel="noreferrer"
      className="-mt-6 flex w-20 flex-col items-center gap-1 text-center text-[10px] leading-tight text-muted-foreground"
      aria-label="Áudio e arquivos pelo Telegram"
    >
      <span className="grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow"><Mic className="h-6 w-6" /></span>
      Áudio e arquivos pelo Telegram
    </a>
  );
}
