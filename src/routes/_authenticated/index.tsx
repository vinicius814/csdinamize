import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { plural, saudacao } from "@/lib/texto";
import ReactMarkdown from "react-markdown";
import { Bell, BookOpen, Briefcase, CheckCircle2, ChevronDown } from "lucide-react";
import { Nucleo } from "@/components/munim/Nucleo";
import { Pagina } from "@/components/munim/PaginaVazia";
import { useAuth } from "@/lib/auth";
import { useCarteira, useLembretesHoje, usePendentes, useUltimoBriefing, DIAS_SEM_CONTATO } from "@/lib/dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Início — Munim" },
      { name: "description", content: "Seu dia, o que pede atenção e sua carteira, num só lugar." },
      { property: "og:title", content: "Início — Munim" },
      { property: "og:description", content: "Seu dia, o que pede atenção e sua carteira, num só lugar." },
    ],
  }),
  component: Inicio,
});

function Cartao({ titulo, icon: Icon, children, className }: { titulo: string; icon: typeof Bell; children: ReactNode; className?: string }) {
  return (
    <section className={cn("card-munim flex flex-col p-5", className)}>
      <h2 className="mb-4 flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Icon className="h-4 w-4 text-primary" /> {titulo}
      </h2>
      {children}
    </section>
  );
}

function Vazio({ texto, acao }: { texto: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-start justify-center gap-3 py-4 text-sm text-muted-foreground">
      <p>{texto}</p>
      {acao}
    </div>
  );
}

function AnelProgresso({ pct }: { pct: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
      <circle cx="50" cy="50" r={r} className="fill-none stroke-secondary" strokeWidth="8" />
      <circle
        cx="50" cy="50" r={r}
        className="fill-none stroke-primary transition-[stroke-dashoffset] duration-300 drop-shadow-[0_0_6px_var(--color-primary)]"
        strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
      />
    </svg>
  );
}

function Inicio() {
  const { perfil } = useAuth();
  const pend = usePendentes();
  const lemb = useLembretesHoje();
  const brief = useUltimoBriefing();
  const cart = useCarteira();
  const [aberto, setAberto] = useState(false);

  const primeiroNome = perfil?.nome?.split(" ")[0];
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const nPend = pend.data?.length ?? 0;
  const nLemb = lemb.data?.length ?? 0;
  const nSem = cart.data?.semContato ?? 0;
  const carregou = pend.isSuccess && lemb.isSuccess && cart.isSuccess;

  const resumo = !carregou
    ? "Organizando seu dia…"
    : nPend + nLemb + nSem === 0
      ? "Tudo em ordem por aqui. Aproveite o dia."
      : `Você tem ${plural(nPend, "aprovação pendente", "aprovações pendentes")}, ${plural(nLemb, "lembrete", "lembretes")} para hoje e ${plural(nSem, "cliente", "clientes")} sem contato há mais de ${DIAS_SEM_CONTATO} dias.`;

  return (
    <Pagina>
      <div className="flex flex-col items-center gap-6 pb-10 text-center md:flex-row md:text-left">
        <Nucleo tamanho={150} estado={nPend > 0 ? "urgente" : "repouso"} />
        <div>
          <p className="text-sm capitalize text-muted-foreground">{hoje}</p>
          <h1 className="mt-1 text-4xl font-semibold text-foreground md:text-5xl">
            {saudacao()}{primeiroNome ? `, ${primeiroNome}` : ""}.
          </h1>
          <p className="mt-3 max-w-xl text-foreground/80">{resumo}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Cartao titulo="Pede sua atenção" icon={Bell}>
          {nPend + nLemb === 0 ? (
            <Vazio texto="Nada urgente agora. Quando algo precisar de você, aparece aqui." />
          ) : (
            <ul className="flex flex-col gap-2 text-sm">
              {pend.data?.slice(0, 4).map((a) => (
                <li key={a.id}>
                  <Link to="/aprovacoes" className="flex items-start gap-2 rounded-lg p-2 hover:bg-accent">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-ember" />
                    <span className="text-foreground">{a.resumo ?? "Ação aguardando aprovação"}</span>
                  </Link>
                </li>
              ))}
              {lemb.data?.slice(0, 4).map((n) => (
                <li key={n.id} className="flex items-start gap-2 p-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                  <span className="text-foreground">
                    {n.titulo ?? n.resumo ?? "Lembrete"}
                    {n.lembrete_em && (
                      <span className="ml-1 text-muted-foreground">
                        · {new Date(n.lembrete_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Último briefing" icon={BookOpen}>
          {!brief.data ? (
            <Vazio texto="Seu primeiro briefing chega pela manhã, no horário que você escolher." acao={<Link to="/configuracoes" className="text-sm text-primary hover:underline">Ajustar horário</Link>} />
          ) : (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">
                {new Date(brief.data.enviado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
              </p>
              <div className={cn("prose-munim relative overflow-hidden text-sm", !aberto && "max-h-40")}>
                <ReactMarkdown>{brief.data.conteudo_md}</ReactMarkdown>
                {!aberto && <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent" />}
              </div>
              <button onClick={() => setAberto((v) => !v)} className="mt-2 flex items-center gap-1 text-sm text-primary">
                {aberto ? "Recolher" : "Ler tudo"}
                <ChevronDown className={cn("h-4 w-4 transition-transform duration-200", aberto && "rotate-180")} />
              </button>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Carteira" icon={Briefcase}>
          {!cart.data || cart.data.pct === null ? (
            <Vazio texto="Ainda não há clientes na sua carteira." acao={<Link to="/carteira" className="text-sm text-primary hover:underline">Ver carteira</Link>} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative grid place-items-center">
                <AnelProgresso pct={cart.data.pct} />
                <span className="absolute font-display text-2xl font-semibold text-foreground">{cart.data.pct}%</span>
              </div>
              <div className="text-sm">
                <p className="text-foreground">Cobertura de {DIAS_SEM_CONTATO} dias</p>
                <p className="mt-1 text-muted-foreground">
                  {cart.data.total - cart.data.semContato} de {cart.data.total} clientes com contato recente.
                </p>
              </div>
            </div>
          )}
        </Cartao>
      </div>
    </Pagina>
  );
}
