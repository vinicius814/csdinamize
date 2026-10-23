import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { plural, saudacao } from "@/lib/texto";
import ReactMarkdown from "react-markdown";
import { Bell, BookOpen, Briefcase, CheckCircle2, ChevronDown, Lightbulb, MessageSquare, RefreshCw } from "lucide-react";
import { statusConexoes } from "@/lib/conexoes.functions";
import { Button } from "@/components/ui/button";
import { gerarRotina } from "@/lib/briefing.functions";
import { Nucleo } from "@/components/munim/Nucleo";
import { Pagina } from "@/components/munim/PaginaVazia";
import { useAuth } from "@/lib/auth";
import { useCarteira, useLembretesHoje, usePendentes, useRotinas, useRadarIdeias, DIAS_SEM_CONTATO, type Rotina } from "@/lib/dados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Início — Munim" },
      { name: "description", content: "Seu dia, o que pede atenção e sua carteira, num só lugar." },
      { property: "og:title", content: "Início — Munim" },
      { property: "og:description", content: "Seu dia, o que pede atenção e sua carteira, num só lugar." },
    ],
  }),
  component: Inicio,
});

const ABAS: [Rotina, string][] = [["manha", "Manhã"], ["riscos", "Riscos"], ["fechamento", "Fechamento"], ["semana", "Semana"]];
const DESCRICAO: Record<Rotina, string> = {
  manha: "Seu dia, o que pede atenção e as 3 prioridades. Monto sozinho na primeira visita do dia.",
  riscos: "Clientes esfriando, negócios parados, e-mails sem resposta e agenda apertada, com o que fazer.",
  fechamento: "O que andou, o que ficou e como começar amanhã. Monto sozinho a partir das 17h.",
  semana: "Saúde da carteira, grandes ideias para priorizar e direcionamento. Monto sozinho às segundas.",
};

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
  const rotinas = useRotinas();
  const ideias = useRadarIdeias();
  const cart = useCarteira();
  const statusFn=useServerFn(statusConexoes);
  const connections=useQuery({queryKey:["conexoes"],queryFn:()=>statusFn()});
  const connectionAlerts=connections.data ? Object.entries({Pipedrive:connections.data.pipedrive,Gmail:connections.data.servicos.google_mail,Agenda:connections.data.servicos.google_calendar,Drive:connections.data.servicos.google_drive}).filter(([,value])=>!value.ok).map(([name,value])=>({name,detail:value.detalhe})) : [];
  const briefingAlert=rotinas.data?.manha?.conteudo_md.match(/\*\*Pede aten[çc][ãa]o\*\*([\s\S]*?)(?=\*\*|$)/i)?.[1]?.trim();
  const [aberto, setAberto] = useState(false);
  const [aba, setAba] = useState<Rotina>(() => (new Date().getHours() >= 17 ? "fechamento" : "manha"));
  const [gerando, setGerando] = useState<Rotina | null>(null);
  const qc = useQueryClient();
  const gerarFn = useServerFn(gerarRotina);
  const gerar = async (tipo: Rotina) => {
    setGerando(tipo);
    try {
      await gerarFn({ data: { tipo } });
      await qc.invalidateQueries({ queryKey: ["rotinas"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Não consegui montar agora.");
    } finally {
      setGerando(null);
    }
  };
  // Rotinas programadas: rodam sozinhas na primeira visita do período.
  const tentou = useRef(false);
  useEffect(() => {
    if (!rotinas.isSuccess || tentou.current) return;
    tentou.current = true;
    const r = rotinas.data;
    const hoje = new Date().toDateString();
    const ehHoje = (d?: { enviado_em: string }) => !!d && new Date(d.enviado_em).toDateString() === hoje;
    const agora = new Date();
    if (agora.getHours() >= 17 && !ehHoje(r.fechamento)) gerar("fechamento");
    else if (!ehHoje(r.manha)) gerar("manha");
    else if (agora.getDay() === 1 && !ehHoje(r.semana)) gerar("semana");
  }, [rotinas.isSuccess]);
  const atual = rotinas.data?.[aba];

  const primeiroNome = perfil?.nome?.split(" ")[0];
  const hoje = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" });
  const nPend = pend.data?.length ?? 0;
  const nLemb = lemb.data?.length ?? 0;
  const nSem = cart.data?.semContato ?? 0;
  const carregou = pend.isSuccess && lemb.isSuccess && cart.isSuccess;

  const resumo = cart.isError || connections.isError || connectionAlerts.length ? "Algumas fontes precisam de atenção. Não consegui confirmar todos os dados do seu dia." : !carregou
    ? "Organizando seu dia…"
    : nPend + nLemb + nSem === 0
      ? "Nenhuma pendência encontrada nas fontes consultadas. Confira seu briefing."
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
          {connectionAlerts.map(a=><div key={a.name} className="mb-3 text-sm"><p className="text-warning">{a.name} desconectado ou indisponível</p><p className="text-xs text-muted-foreground">{a.detail}</p><Button variant="link" size="sm" asChild><Link to="/conexoes">Conectar</Link></Button></div>)}
          {cart.isError && <p className="mb-3 text-sm text-warning">{cart.error.message}</p>}
          {briefingAlert && <div className="prose-munim mb-3 text-sm"><ReactMarkdown>{briefingAlert}</ReactMarkdown></div>}
          {nPend + nLemb === 0 ? (
            <Vazio texto={connectionAlerts.length || cart.isError ? "Revise os acessos acima para confirmar suas pendências." : "Nenhuma aprovação ou lembrete encontrado para hoje."} />
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

        <Cartao titulo="Rotinas do Munim" icon={BookOpen} className="md:col-span-2">
          <div className="mb-3 flex flex-wrap gap-1" role="tablist">
            {ABAS.map(([k, rotulo]) => (
              <button
                key={k}
                role="tab"
                aria-selected={aba === k}
                onClick={() => { setAba(k); setAberto(false); }}
                className={cn("rounded-full px-3 py-1 text-xs transition-colors", aba === k ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}
              >
                {rotulo}
              </button>
            ))}
          </div>
          {!atual ? (
            <Vazio
              texto={gerando === aba ? "Cruzando agenda, e-mails, carteira e ideias…" : DESCRICAO[aba]}
              acao={gerando !== aba && <button onClick={() => gerar(aba)} className="text-sm text-primary hover:underline">Montar agora</button>}
            />
          ) : (
            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{new Date(atual.enviado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                <button onClick={() => gerar(aba)} disabled={!!gerando} className="flex items-center gap-1 text-primary hover:underline disabled:opacity-60">
                  <RefreshCw className={cn("h-3.5 w-3.5", gerando === aba && "animate-spin")} /> {gerando === aba ? "Atualizando…" : "Atualizar"}
                </button>
              </div>
              <div className={cn("prose-munim relative overflow-hidden text-sm", !aberto && "max-h-64")}>
                <ReactMarkdown>{atual.conteudo_md.replace(/^(Bom dia|Boa tarde|Boa noite)([^\n]*)(\n|$)/i,"Resumo do seu dia$3")}</ReactMarkdown>
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
          {cart.isError ? <Vazio texto={cart.error.message} acao={<Button variant="outline" asChild><Link to="/conexoes">Conectar</Link></Button>}/> : !cart.data || cart.data.pct === null ? (
            <Vazio texto="Ainda não há clientes na sua carteira." acao={<Link to="/carteira" className="text-sm text-primary hover:underline">Ver carteira</Link>} />
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative grid place-items-center">
                <AnelProgresso pct={cart.data.pct} />
                <span className="absolute font-display text-2xl font-semibold text-foreground">{cart.data.pct}%</span>
              </div>
              <div className="text-sm">
                <p className="text-foreground">Cobertura de {cart.data.dias} dias</p>
                <p className="mt-1 text-muted-foreground">
                  {cart.data.total - cart.data.semContato} de {cart.data.total} clientes com contato recente.
                </p>
              </div>
            </div>
          )}
        </Cartao>

        <Cartao titulo="Grandes ideias" icon={Lightbulb} className="md:col-span-2">
          {!ideias.data?.length ? (
            <Vazio
              texto="Solte uma ideia na Conversa, mesmo crua. Eu melhoro, avalio o potencial e guardo aqui."
              acao={<Link to="/conversa" className="text-sm text-primary hover:underline">Contar uma ideia</Link>}
            />
          ) : (
            <ul className="flex flex-col gap-1">
              {ideias.data.slice(0, 5).map((n, i) => (
                <li key={n.id} className="flex items-start gap-3 rounded-lg p-2 hover:bg-accent">
                  <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full font-display text-xs font-semibold", i === 0 ? "bg-ember/20 text-ember" : "bg-secondary text-foreground")}>
                    {n.pontuacao}
                  </span>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="text-foreground">
                      {n.titulo ?? "Sem título"}
                      <span className="ml-2 text-xs text-muted-foreground">{n.subcategoria === "projeto" ? "Projeto" : "Ideia"}{n.status ? ` · ${n.status}` : ""}</span>
                    </p>
                    {n.resumo && <p className="line-clamp-2 text-muted-foreground">{n.resumo}</p>}
                  </div>
                </li>
              ))}
              <li className="pt-2">
                <Link to="/conversa" className="flex items-center gap-1 text-sm text-primary hover:underline">
                  <MessageSquare className="h-4 w-4" /> Pedir ao Munim o que priorizar
                </Link>
              </li>
            </ul>
          )}
        </Cartao>
      </div>
    </Pagina>
  );
}
