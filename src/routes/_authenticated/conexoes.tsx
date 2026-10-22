import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Brain, Briefcase, CalendarDays, RefreshCw, Send, type LucideIcon } from "lucide-react";
import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { statusConexoes, type StatusConexao } from "@/lib/conexoes.functions";

export const Route = createFileRoute("/_authenticated/conexoes")({
  head: () => ({
    meta: [
      { title: "Conexões — Munim" },
      { name: "description", content: "Os sistemas que o Munim usa para agir por você: IA, CRM, agenda, e-mail e Telegram." },
      { property: "og:title", content: "Conexões — Munim" },
      { property: "og:description", content: "Conecte suas ferramentas ao Munim em poucos cliques." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Conexoes,
});

type Item = { chave: "ia" | "pipedrive" | "google" | "telegram"; nome: string; papel: string; icon: LucideIcon; acao?: { label: string; to?: "/configuracoes" } };

const ITENS: Item[] = [
  { chave: "ia", nome: "Cérebro do Munim", papel: "Raciocínio, memória e decisões.", icon: Brain },
  { chave: "pipedrive", nome: "Pipedrive", papel: "Clientes, negócios e atividades. O Munim cria tarefas e notas após sua aprovação.", icon: Briefcase },
  { chave: "google", nome: "Google Agenda e Gmail", papel: "Compromissos, pautas e rascunhos de e-mail.", icon: CalendarDays, acao: { label: "Ver detalhes", to: "/configuracoes" } },
  { chave: "telegram", nome: "Telegram", papel: "Mande áudios de qualquer lugar e receba alertas.", icon: Send, acao: { label: "Ativar", to: "/configuracoes" } },
];

function Conexoes() {
  const buscar = useServerFn(statusConexoes);
  const { data, isFetching, refetch } = useQuery({ queryKey: ["conexoes"], queryFn: () => buscar() });
  const ativas = data ? Object.values(data).filter((s) => s.ok).length : 0;

  return (
    <Pagina>
      <Cabecalho titulo="Conexões" frase="Os sistemas pelos quais o Munim enxerga e age por você." />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{data ? `${ativas} de ${ITENS.length} sistemas online` : "Verificando sistemas…"}</p>
        <button onClick={() => refetch()} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} /> Testar de novo
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {ITENS.map((it) => {
          const s: StatusConexao | undefined = data?.[it.chave];
          return (
            <section key={it.chave} className="card-munim flex flex-col gap-3 p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary"><it.icon className="h-5 w-5" /></div>
                <h2 className="flex-1 font-display text-lg text-foreground">{it.nome}</h2>
                <span className={`h-2.5 w-2.5 rounded-full ${!s ? "bg-muted-foreground" : s.ok ? "bg-success" : "bg-warning"}`} />
              </div>
              <p className="text-sm text-muted-foreground">{it.papel}</p>
              <p className={`text-sm ${s?.ok ? "text-success" : "text-foreground"}`}>{s?.detalhe ?? "…"}</p>
              {it.acao && !s?.ok && (
                <Link to={it.acao.to!} className="self-start text-sm text-primary hover:underline">{it.acao.label}</Link>
              )}
            </section>
          );
        })}
      </div>
    </Pagina>
  );
}
