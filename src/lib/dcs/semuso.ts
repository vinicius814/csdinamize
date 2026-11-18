/**
 * Contas sem utilização (D29): regras puras, sem acesso a banco.
 * Três estados independentes: utilização (dcs_utilizacao.status), diagnóstico (dcs_diagnosticos + dispensa)
 * e acompanhamento (derivado aqui, com "revisão vencida" calculada pela data).
 */
import type { DcsDiagnostico, DcsUtilizacao } from "./db";

export const MOTIVOS = [
  "Cliente não utiliza a plataforma",
  "Implementação não concluída",
  "Ausência de equipe responsável",
  "Problemas técnicos",
  "Integração não concluída",
  "Falta de estratégia de CRM",
  "Cliente temporariamente sem operação",
  "Cliente utilizando outra ferramenta",
  "Dificuldade operacional",
  "Aguardando retorno do cliente",
  "Motivo desconhecido",
  "Outros",
] as const;

export type FaixaValor = { min: number | null; max: number | null; dias: number };
export type ConfigSemUso = {
  padrao: number;
  motivos: string[];
  porMotivo: Record<string, number>;
  porCarteira: Record<string, number>;
  porFaixa: FaixaValor[];
  porCriticidade: { critica?: number; alta?: number };
};
export const CONFIG_PADRAO: ConfigSemUso = {
  padrao: 30,
  motivos: [...MOTIVOS],
  porMotivo: {},
  porCarteira: {},
  porFaixa: [],
  porCriticidade: {},
};

const dias = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 && n <= 365 ? Math.round(n) : null;
};
const mapaDias = (o: unknown) => {
  const r: Record<string, number> = {};
  if (o && typeof o === "object")
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      const d = dias(v);
      if (d) r[k] = d;
    }
  return r;
};

/** Lê a seção semUso da configuração publicada (dcs_regras.config), com padrões seguros. */
export function lerConfig(config: unknown): ConfigSemUso {
  const s = (config as { semUso?: Record<string, unknown> } | null)?.semUso;
  if (!s || typeof s !== "object") return structuredClone(CONFIG_PADRAO);
  const motivos = Array.isArray(s["motivos"])
    ? (s["motivos"] as unknown[])
        .map(String)
        .map((x) => x.trim())
        .filter(Boolean)
    : [];
  const crit = (s["porCriticidade"] ?? {}) as Record<string, unknown>;
  return {
    padrao: dias(s["padrao"]) ?? 30,
    motivos: motivos.length ? motivos : [...MOTIVOS],
    porMotivo: mapaDias(s["porMotivo"]),
    porCarteira: mapaDias(s["porCarteira"]),
    porFaixa: Array.isArray(s["porFaixa"])
      ? (s["porFaixa"] as Record<string, unknown>[])
          .map((f) => ({
            min: f["min"] == null || f["min"] === "" ? null : Number(f["min"]),
            max: f["max"] == null || f["max"] === "" ? null : Number(f["max"]),
            dias: dias(f["dias"]) ?? 0,
          }))
          .filter((f) => f.dias > 0)
      : [],
    porCriticidade: {
      ...(dias(crit["critica"]) ? { critica: dias(crit["critica"])! } : {}),
      ...(dias(crit["alta"]) ? { alta: dias(crit["alta"])! } : {}),
    },
  };
}

/**
 * Intervalo de acompanhamento. Precedência (mais específico primeiro): cliente → motivo → criticidade → carteira →
 * faixa de valor → padrão. Faixa de valor só é usada quando o valor é visível ao usuário (RLS financeiro).
 */
export function intervalo(
  cfg: ConfigSemUso,
  x: {
    intervaloCliente?: number | null;
    motivo?: string | null;
    ownerId?: number | null;
    mrr?: number | null;
    criticidade?: "critica" | "alta" | null;
  },
): {
  dias: number;
  origem: "cliente" | "motivo" | "criticidade" | "carteira" | "faixa" | "padrao";
} {
  const c = dias(x.intervaloCliente);
  if (c) return { dias: c, origem: "cliente" };
  if (x.motivo && cfg.porMotivo[x.motivo])
    return { dias: cfg.porMotivo[x.motivo]!, origem: "motivo" };
  if (x.criticidade && cfg.porCriticidade[x.criticidade])
    return { dias: cfg.porCriticidade[x.criticidade]!, origem: "criticidade" };
  if (x.ownerId != null && cfg.porCarteira[String(x.ownerId)])
    return { dias: cfg.porCarteira[String(x.ownerId)]!, origem: "carteira" };
  if (x.mrr != null) {
    const f = cfg.porFaixa.find(
      (f) => (f.min == null || x.mrr! >= f.min) && (f.max == null || x.mrr! < f.max),
    );
    if (f) return { dias: f.dias, origem: "faixa" };
  }
  return { dias: cfg.padrao, origem: "padrao" };
}

export const somarDias = (iso: string, n: number) => {
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const diasEntre = (de: string | null | undefined, ate: string) =>
  de
    ? Math.round(
        (Date.parse(ate.slice(0, 10) + "T12:00:00Z") - Date.parse(de.slice(0, 10) + "T12:00:00Z")) /
          86_400_000,
      )
    : null;

export type StatusAcomp =
  "em_dia" | "aguardando" | "revisao_vencida" | "retomada_em_andamento" | "retomada" | null;
export const ROTULO_ACOMP: Record<Exclude<StatusAcomp, null>, string> = {
  em_dia: "Em dia",
  aguardando: "Aguardando acompanhamento",
  revisao_vencida: "Revisão vencida",
  retomada_em_andamento: "Retomada em andamento",
  retomada: "Utilização retomada",
};
export const ROTULO_UTIL = {
  nao_verificado: "Não verificado",
  em_uso: "Em utilização",
  sem_uso: "Sem utilização",
} as const;
export const ROTULO_RESULTADO = {
  continua: "Continua sem utilização",
  parcial: "Retomou parcialmente",
  retomou: "Retomou a utilização",
  nao_validado: "Não foi possível validar",
} as const;

/** Status de acompanhamento: "revisão vencida" vem da data, nunca é gravado. */
export function acompanhamento(u: DcsUtilizacao | null | undefined, hoje: string): StatusAcomp {
  if (!u) return null;
  if (u.status === "sem_uso") {
    if (u.proxima_revisao && u.proxima_revisao < hoje) return "revisao_vencida";
    return u.acompanhamento === "retomada_em_andamento"
      ? "retomada_em_andamento"
      : u.acompanhamento === "em_dia"
        ? "em_dia"
        : "aguardando";
  }
  return u.acompanhamento === "retomada" ? "retomada" : null;
}

export type StatusDiag = "aguardando" | "em_andamento" | "concluido" | "dispensado";
/** Diagnóstico dispensado temporariamente enquanto a conta está sem utilização (análise já aberta continua visível). */
export function statusDiagnostico(
  d: DcsDiagnostico | null | undefined,
  u: DcsUtilizacao | null | undefined,
): StatusDiag {
  if (d?.status === "em_analise") return "em_andamento";
  if (u?.status === "sem_uso") return "dispensado";
  return d?.status === "concluido" ? "concluido" : "aguardando";
}

/** Índice exibido: indisponível enquanto sem utilização, preservando o último índice com data (nunca zera). */
export function indiceExibido(
  d: DcsDiagnostico | null | undefined,
  u: DcsUtilizacao | null | undefined,
) {
  const ultimo =
    d?.status === "concluido" && d.indice != null
      ? { valor: d.indice, data: d.concluido_em?.slice(0, 10) ?? null }
      : null;
  return u?.status === "sem_uso"
    ? { disponivel: false as const, ultimo }
    : { disponivel: true as const, ultimo };
}

export type LinhaSemUso = {
  key: string;
  ownerId: number | null;
  ownerNome: string | null;
  mrr: number | null;
  u: DcsUtilizacao | null;
  diag: DcsDiagnostico | null;
};
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null);

/** Indicadores gerenciais (§11), sempre com numerador e denominador explícitos. */
export function indicadores(linhas: LinhaSemUso[], hoje: string, janelaRecuperacao = 90) {
  const total = linhas.length;
  const sem = linhas.filter((l) => l.u?.status === "sem_uso");
  const vencidas = sem.filter((l) => acompanhamento(l.u, hoje) === "revisao_vencida");
  const retomando = sem.filter((l) => l.u?.acompanhamento === "retomada_em_andamento");
  const recuperadas = linhas.filter(
    (l) => l.u?.recuperado_em && (diasEntre(l.u.recuperado_em, hoje) ?? 9999) <= janelaRecuperacao,
  );
  const comValor = sem.filter((l) => l.mrr != null);
  const tempos = sem
    .map((l) => diasEntre(l.u?.ultima_utilizacao, hoje))
    .filter((x): x is number => x != null && x >= 0);
  const motivos = new Map<string, number>();
  const porResp = new Map<string, number>();
  for (const l of sem) {
    const m = l.u?.motivo || "Não informado";
    motivos.set(m, (motivos.get(m) ?? 0) + 1);
    const r = l.ownerNome || "Sem responsável";
    porResp.set(r, (porResp.get(r) ?? 0) + 1);
  }
  const elegiveis = linhas.filter((l) => l.u?.status !== "sem_uso");
  const elegDiag = elegiveis.filter(
    (l) => l.diag?.status === "concluido" || !!l.diag?.concluido_em,
  );
  const identificadas = linhas.filter(
    (l) =>
      (l.u && l.u.status !== "nao_verificado") ||
      l.diag?.status === "concluido" ||
      !!l.diag?.concluido_em,
  );
  const noPrazo = sem.filter((l) => acompanhamento(l.u, hoje) !== "revisao_vencida");
  const ord = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total,
    semUso: { n: sem.length, de: total, pct: pct(sem.length, total) },
    valor: comValor.length ? comValor.reduce((s, l) => s + (l.mrr ?? 0), 0) : null,
    valorParcial: comValor.length > 0 && comValor.length < sem.length,
    vencidas: vencidas.length,
    retomando: retomando.length,
    recuperadas: recuperadas.length,
    tempoMedio:
      tempos.length >= 3 ? Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length) : null,
    tempoMedioBase: tempos.length,
    motivos: ord(motivos),
    porResponsavel: ord(porResp),
    elegivelDiagnosticada: {
      n: elegDiag.length,
      de: elegiveis.length,
      pct: pct(elegDiag.length, elegiveis.length),
    },
    situacaoIdentificada: {
      n: identificadas.length,
      de: total,
      pct: pct(identificadas.length, total),
    },
    acompanhadasNoPrazo: {
      n: noPrazo.length,
      de: sem.length,
      pct: pct(noPrazo.length, sem.length),
    },
  };
}

/** Evolução mensal das recuperações (últimos n meses), a partir dos eventos de revisão com resultado "retomou". */
export function evolucaoRecuperacoes(
  eventos: { em: string; resultado: string | null }[],
  hoje: string,
  meses = 6,
) {
  const out: { mes: string; n: number }[] = [];
  const base = new Date(hoje.slice(0, 7) + "-01T12:00:00Z");
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(base);
    d.setUTCMonth(d.getUTCMonth() - i);
    out.push({ mes: d.toISOString().slice(0, 7), n: 0 });
  }
  for (const e of eventos)
    if (e.resultado === "retomou") {
      const m = out.find((o) => o.mes === e.em.slice(0, 7));
      if (m) m.n++;
    }
  return out;
}

/**
 * Produtividade de acompanhamento (§11): separada do diagnóstico completo. Marcar "sem utilização" não conta como
 * diagnóstico; revisões contam como acompanhamento; "retomou" conta como recuperação.
 */
export function produtividadeUso(
  eventos: { ator: string | null; tipo: string; resultado: string | null; em: string }[],
  desde: string,
) {
  const m = new Map<string, { marcacoes: number; acompanhamentos: number; retomadas: number }>();
  for (const e of eventos) {
    if (!e.ator || e.em.slice(0, 10) < desde) continue;
    const v = m.get(e.ator) ?? { marcacoes: 0, acompanhamentos: 0, retomadas: 0 };
    if (e.tipo === "marcar") v.marcacoes++;
    if (e.tipo === "revisar") {
      v.acompanhamentos++;
      if (e.resultado === "retomou") v.retomadas++;
    }
    m.set(e.ator, v);
  }
  return m;
}
