import {PersonalHome} from "@/components/munim/PersonalHome";
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
import { Skeleton } from "@/components/ui/skeleton";
import {useConnectionPresence} from "@/lib/connection-presence";
import { RefreshIntegrations } from "@/components/munim/RefreshIntegrations";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Início — Munim" },
      { name: "description", content: "Seu dia, suas ideias e o que pede atenção, num só lugar." },
      { property: "og:title", content: "Início — Munim" },
      { property: "og:description", content: "Seu dia, suas ideias e o que pede atenção, num só lugar." },
    ],
  }),
  component: Inicio,
});

const ABAS: [Rotina, string][] = [["manha", "Manhã"], ["riscos", "Riscos"], ["fechamento", "Fechamento"], ["semana", "Semana"]];
const DESCRICAO: Record<Rotina, string> = {
  manha: "Seu dia, o que pede atenção e as 3 prioridades. Monto sozinho na primeira visita do dia.",
  riscos: "Prazos, pendências e riscos que merecem atenção.",
  fechamento: "O que andou, o que ficou e como começar amanhã. Monto sozinho a partir das 17h.",
  semana: "Grandes ideias para priorizar e direcionamento pessoal. Monto sozinho às segundas.",
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

function Inicio() { return <PersonalHome/>; }
