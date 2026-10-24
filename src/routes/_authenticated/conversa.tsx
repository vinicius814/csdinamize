import { createFileRoute } from "@tanstack/react-router";
import { MessagesSquare, Database, BookOpen, FolderOpen, ArrowUp } from "lucide-react";
import { Pagina } from "@/components/munim/PaginaVazia";

// Chat do CS: nesta fase só a experiência visual. Nenhuma IA, API ou Drive é chamada aqui.
type Busca = { topico?: string | undefined; q?: string | undefined };
export const Route = createFileRoute("/_authenticated/conversa")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    topico: typeof s["topico"] === "string" ? s["topico"] : undefined,
    q: typeof s["q"] === "string" ? s["q"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Chat do CS — Munin" },
      { name: "description", content: "Chat do CS: o futuro assistente de Customer Success da Dinamize. Em breve." },
      { property: "og:title", content: "Chat do CS — Munin" },
      { property: "og:description", content: "Assistente de Customer Success da Dinamize, em breve." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatCS,
});

const FONTES = [
  { icon: Database, titulo: "Dados do Munin e Pipedrive", texto: "Carteira, riscos, atividades e pendências, sempre dentro do seu acesso." },
  { icon: BookOpen, titulo: "Help da Dinamize", texto: "Recursos, configurações, automações, e-mail e WhatsApp Marketing, CRM e integrações." },
  { icon: FolderOpen, titulo: "Drive do CS", texto: "Processos, rotinas, escopo de atendimento e materiais de treinamento autorizados." },
];
const EXEMPLOS = [
  "Resuma os clientes em risco acima de R$ 10 mil de MRR.",
  "Quais clientes da minha carteira estão há mais de 60 dias sem contato?",
  "Quais clientes têm reuniões atrasadas?",
  "Quais são as prioridades de hoje?",
];

function ChatCS() {
  return (
    <Pagina>
      <div className="mx-auto max-w-3xl py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary-soft text-primary"><MessagesSquare className="h-6 w-6" /></span>
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Chat do CS</p>
            <h1 className="font-display text-2xl">Seu assistente de Customer Success</h1>
          </div>
          <span className="ml-auto rounded-full border border-primary/40 px-3 py-1 text-xs text-primary">Em breve</span>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Perguntas em linguagem natural, respondidas com base nas suas permissões e em fontes autorizadas. Ainda não está disponível.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {FONTES.map((f) => (
            <div key={f.titulo} className="card-munim p-4">
              <f.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 text-sm font-medium">{f.titulo}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.texto}</p>
            </div>
          ))}
        </div>
        <h2 className="mt-8 text-sm font-medium">Exemplos do que você poderá perguntar</h2>
        <ul className="mt-3 grid gap-2">
          {EXEMPLOS.map((e) => <li key={e} className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">“{e}”</li>)}
        </ul>
        <div className="mt-8 flex items-center gap-2 rounded-xl border border-border bg-muted/30 p-2 opacity-70" aria-disabled="true">
          <input disabled aria-label="Campo indisponível" placeholder="Indisponível — o Chat do CS chega em breve" className="min-w-0 flex-1 cursor-not-allowed bg-transparent px-2 text-sm outline-none" />
          <button disabled aria-label="Enviar (indisponível)" className="grid h-9 w-9 cursor-not-allowed place-items-center rounded-lg bg-muted text-muted-foreground"><ArrowUp className="h-4 w-4" /></button>
        </div>
      </div>
    </Pagina>
  );
}
