import type { ReactNode } from "react";
import { Dica } from "./Ajuda";
import { DICA_KPI, type Termo } from "@/lib/dcs/ajuda";
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
  icone,
  tom = "neutro",
  dica,
}: {
  dica?: Termo | null;
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  to?: string;
  search?: Record<string, string>;
  icone?: ReactNode;
  tom?: "neutro" | "marca" | "ok" | "aviso" | "critico" | "info";
}) {
  const fundo = {
    neutro: "bg-muted text-muted-foreground",
    marca: "bg-primary-soft text-primary",
    ok: "bg-emerald-50 text-emerald-600",
    aviso: "bg-amber-50 text-amber-600",
    critico: "bg-red-50 text-red-600",
    info: "bg-sky-50 text-sky-600",
  }[tom];
  const corpo = (
    <div className="flex h-full min-h-[116px] flex-col rounded-xl border bg-card p-4 shadow-[var(--glow-sm)] transition-[border-color,box-shadow] hover:border-primary/40 hover:shadow-[var(--glow)]">
      <div className="flex items-start justify-between gap-2">
        <div className="pr-5 text-[13px] font-medium text-muted-foreground">{rotulo}</div>
        {icone && (
          <span
            className={cx(
              "grid h-8 w-8 shrink-0 place-items-center rounded-lg [&_svg]:h-4 [&_svg]:w-4",
              fundo,
            )}
          >
            {icone}
          </span>
        )}
      </div>
      <div className="mt-auto pt-2 text-2xl font-semibold tabular-nums tracking-tight">{valor}</div>
      <div className="mt-0.5 min-h-[16px] text-xs text-muted-foreground">{detalhe}</div>
    </div>
  );
  const termo = dica === null ? undefined : (dica ?? DICA_KPI[rotulo]);
  const cartao = to ? (
    <Link to={to as never} search={search as never} className="block h-full rounded-xl">
      {corpo}
    </Link>
  ) : (
    corpo
  );
  if (!termo) return cartao;
  // A ajuda fica fora do link (não navega ao abrir) e posicionada junto ao rótulo.
  return (
    <div className="relative h-full">
      {cartao}
      <span className={cx("absolute top-3.5", icone ? "right-14" : "right-3")}>
        <Dica termo={termo} rotulo={rotulo} />
      </span>
    </div>
  );
}

export function Painel({
  titulo,
  sub,
  acao,
  children,
  className,
  semPadding,
}: {
  titulo?: ReactNode;
  sub?: ReactNode;
  acao?: ReactNode;
  children: ReactNode;
  className?: string;
  semPadding?: boolean;
}) {
  return (
    <section
      className={cx(
        "flex min-w-0 flex-col rounded-xl border bg-card shadow-[var(--glow-sm)]",
        className,
      )}
    >
      {titulo && (
        <header className="flex flex-wrap items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{titulo}</h2>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          {acao}
        </header>
      )}
      <div className={cx("min-w-0 flex-1", !semPadding && "p-4")}>{children}</div>
    </section>
  );
}

/** Ajuda ao lado do título das páginas cujo conceito central merece explicação. */
const DICA_TITULO: Record<string, Termo> = {
  "Alertas e pendências": "revisaoVencida",
  "Planos de ação": "statusRecomendacao",
  "Cobertura de CS": "contatoEfetivo",
  "Integrações e monitoramento": "sincronizacao",
  "Usuários e permissões": "permissoesAdmin",
  "Minhas análises": "statusDiagnostico",
  "Histórico de diagnósticos": "reaproveitamento",
};
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
      <div className="min-w-0">
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
          {titulo}
          {DICA_TITULO[titulo] && <Dica termo={DICA_TITULO[titulo]} rotulo={titulo} />}
        </h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {acao && <div className="flex flex-wrap items-center gap-2">{acao}</div>}
    </div>
  );
}

/** Barra de progresso com rótulo (valor e %). */
export function Barra({
  v,
  t,
  cor = "bg-primary",
  largura = "w-24",
}: {
  v: number;
  t: number;
  cor?: string;
  largura?: string;
}) {
  const p = t ? Math.round((100 * v) / t) : 0;
  return (
    <span className="inline-flex items-center gap-2" title={`${v} de ${t} (${p}%)`}>
      <span className={cx("h-1.5 overflow-hidden rounded-full bg-muted", largura)}>
        <span className={cx("block h-full rounded-full", cor)} style={{ width: `${p}%` }} />
      </span>
      <span className="text-xs tabular-nums text-muted-foreground">{p}%</span>
    </span>
  );
}

/** Estado vazio elegante (sem dados fictícios). */
export function Vazio({
  titulo,
  texto,
  icone,
}: {
  titulo: string;
  texto?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-8 text-center">
      {icone && <span className="mb-1 text-muted-foreground [&_svg]:h-6 [&_svg]:w-6">{icone}</span>}
      <p className="text-sm font-medium">{titulo}</p>
      {texto && <p className="max-w-sm text-xs text-muted-foreground">{texto}</p>}
    </div>
  );
}

/** Select nativo estilizado (acessível por teclado; usado nos filtros). */
export function Seletor<V extends string>({
  rotulo,
  valor,
  opcoes,
  onChange,
  className,
  todos = "Todos",
}: {
  rotulo: string;
  todos?: string;
  valor: V | "" | undefined;
  opcoes: readonly (readonly [V, string])[];
  onChange: (v: V | "") => void;
  className?: string;
}) {
  return (
    <label
      className={cx(
        "flex min-w-0 flex-col gap-1 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {rotulo}
      <select
        value={valor ?? ""}
        onChange={(e) => onChange(e.target.value as V | "")}
        className="h-9 w-full min-w-0 rounded-lg border bg-card px-2.5 text-sm font-normal text-foreground shadow-[var(--glow-sm)] focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="">{todos}</option>
        {opcoes.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Contêiner de tabela: a rolagem horizontal fica restrita à tabela. */
export function Tabela({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("dcs-tabela rounded-xl border bg-card shadow-[var(--glow-sm)]", className)}>
      <table className="w-full border-collapse text-sm [&_td]:border-t [&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-xs [&_th]:font-semibold [&_th]:text-muted-foreground [&_tbody_tr:hover]:bg-surface-2">
        {children}
      </table>
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
    return (
      <div
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
        aria-busy="true"
        aria-label="Carregando"
      >
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-[116px] animate-pulse rounded-xl border bg-card" />
        ))}
      </div>
    );
  if (erro)
    return (
      <div
        role="alert"
        className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
      >
        Não foi possível carregar: {(erro as Error).message ?? "erro"}
      </div>
    );
  if (vazio)
    return (
      <div className="rounded-xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground">
        {vazio}
      </div>
    );
  return <>{children}</>;
}

export const pipedriveDeal = (id: number) => `https://cs-dinamize.pipedrive.com/deal/${id}`;
export { cx };
