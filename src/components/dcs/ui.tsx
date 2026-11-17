import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type * as M from "@/lib/dcs/motor";
import type { StatusAnalise } from "@/lib/dcs/dados";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const moeda = (v: number | null | undefined) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
export const dataBR = (d: string | null | undefined) =>
  d ? new Date(d.length <= 10 ? d + "T12:00:00" : d).toLocaleDateString("pt-BR") : "—";
export const dataHoraBR = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

const TOM = {
  neutro: "bg-muted text-muted-foreground",
  ok: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  aviso: "bg-amber-50 text-amber-800 ring-amber-200",
  alerta: "bg-orange-50 text-orange-800 ring-orange-200",
  critico: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-700 ring-sky-200",
  marca: "bg-accent text-accent-foreground ring-red-200",
} as const;
export type Tom = keyof typeof TOM;
export function Selo({
  tom = "neutro",
  children,
  title,
}: {
  tom?: Tom;
  children: ReactNode;
  title?: string | undefined;
}) {
  return (
    <span
      title={title}
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent",
        TOM[tom],
      )}
    >
      {children}
    </span>
  );
}

const COB: Record<M.StatusCobertura, [string, Tom]> = {
  ok: ["Em dia", "ok"],
  atencao: ["Atenção", "aviso"],
  pendente: ["Pendente", "alerta"],
  critico: ["Crítico", "critico"],
  sem_registro: ["Sem registro", "neutro"],
  indisp: ["Dados indisponíveis", "neutro"],
};
export const SeloCobertura = ({ k, dias }: { k: M.StatusCobertura; dias?: number | null }) => (
  <Selo tom={COB[k][1]} title={dias != null ? `${dias} dias sem contato efetivo` : undefined}>
    {COB[k][0]}
    {dias != null ? ` · ${dias}d` : ""}
  </Selo>
);
const ANL: Record<StatusAnalise, [string, Tom]> = {
  aguardando: ["Aguardando", "neutro"],
  em_andamento: ["Em andamento", "info"],
  concluido: ["Concluído", "ok"],
  concluido_pendencias: ["Concluído com pendências", "aviso"],
};
export const SeloAnalise = ({ s }: { s: StatusAnalise }) => (
  <Selo tom={ANL[s][1]}>{ANL[s][0]}</Selo>
);
const PRI: Record<M.Prioridade, [string, Tom]> = {
  critica: ["Crítica", "critico"],
  alta: ["Alta", "alerta"],
  media: ["Média", "aviso"],
  baixa: ["Baixa", "neutro"],
};
export const SeloPrioridade = ({ p }: { p: M.Prioridade | null }) =>
  p ? <Selo tom={PRI[p][1]}>{PRI[p][0]}</Selo> : <span className="text-muted-foreground">—</span>;

export function Indice({
  valor,
  faixa,
  preliminar,
  indisponivel,
}: {
  valor: number | null;
  faixa?: string | null;
  preliminar?: boolean;
  indisponivel?: boolean;
}) {
  if (indisponivel || valor == null)
    return (
      <span className="text-sm text-muted-foreground" title="Menos de 40% dos itens analisados">
        Indisponível
      </span>
    );
  const tom: Tom = valor >= 80 ? "ok" : valor >= 60 ? "aviso" : valor >= 40 ? "alerta" : "critico";
  return (
    <span className="inline-flex items-center gap-1.5">
      <Selo tom={tom}>{valor}</Selo>
      {faixa && <span className="text-xs text-muted-foreground">{faixa}</span>}
      {preliminar && (
        <span
          className="text-[11px] uppercase tracking-wide text-muted-foreground"
          title="Diagnóstico ainda não cobre todos os itens"
        >
          preliminar
        </span>
      )}
    </span>
  );
}

export function Kpi({
  rotulo,
  valor,
  detalhe,
  to,
  search,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  to?: string;
  search?: Record<string, string>;
}) {
  const corpo = (
    <div className="rounded-lg border bg-card p-4 transition-colors hover:border-primary/40">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {rotulo}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{valor}</div>
      {detalhe && <div className="mt-1 text-xs text-muted-foreground">{detalhe}</div>}
    </div>
  );
  return to ? (
    <Link to={to as never} search={search as never} className="block">
      {corpo}
    </Link>
  ) : (
    corpo
  );
}

export function Painel({
  titulo,
  acao,
  children,
  className,
}: {
  titulo?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx("rounded-lg border bg-card", className)}>
      {titulo && (
        <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{titulo}</h2>
          {acao}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Titulo({
  titulo,
  sub,
  acao,
}: {
  titulo: string;
  sub?: ReactNode;
  acao?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {acao}
    </div>
  );
}

export function Estado({
  carregando,
  erro,
  vazio,
  children,
}: {
  carregando?: boolean;
  erro?: unknown;
  vazio?: string | false;
  children: ReactNode;
}) {
  if (carregando)
    return <div className="py-16 text-center text-sm text-muted-foreground">Carregando…</div>;
  if (erro)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        Não foi possível carregar: {(erro as Error).message ?? "erro"}
      </div>
    );
  if (vazio)
    return (
      <div className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
        {vazio}
      </div>
    );
  return <>{children}</>;
}

export const pipedriveDeal = (id: number) => `https://cs-dinamize.pipedrive.com/deal/${id}`;
export { cx };
