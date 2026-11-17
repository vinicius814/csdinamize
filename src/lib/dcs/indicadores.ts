/**
 * Indicadores do Dinamize CS (puros, sem acesso a dados). Usados pela visão geral e pela inteligência gerencial.
 * Regras: índice, faixas e recomendações vêm do motor (gravadas em `derivado` na conclusão); aqui só se agrega.
 * Adesão usa como denominador apenas clientes com o item efetivamente analisado (N/A e não analisado ficam fora).
 */
import { artefato as A } from "./motor";
import type { Prioridade, StatusCobertura } from "./motor";

export type LinhaInd = {
  key: string;
  nome: string;
  responsavel: string;
  ownerId: number | null;
  mrr: number | null;
  status: "aguardando" | "em_andamento" | "concluido" | "concluido_pendencias";
  cob: StatusCobertura;
  dias: number | null;
  diag: {
    status: "em_analise" | "concluido";
    analista_id: string;
    itens: Record<string, { s?: string; sub?: Record<string, unknown> } | undefined>;
    derivado: Record<string, unknown> | null;
    concluido_em: string | null;
  } | null;
  acoesAbertas: number;
  maxPrioridade: Prioridade | null;
};
export type AcaoInd = {
  cliente_key: string;
  status: string;
  prioridade: Prioridade;
  prazo: string | null;
  ganho_rapido: boolean;
  reincidencias: number;
  obsoleta: boolean;
  categoria: string;
};
export type CicloInd = {
  cliente_key: string;
  ciclo: number;
  status: string;
  analista_id: string;
  indice: number | null;
  iniciado_em: string;
  concluido_em: string | null;
};

const FECHADOS = new Set(["implementado", "nao_aprovado"]);
const analisado = (l: LinhaInd) => l.status === "concluido" || l.status === "concluido_pendencias";
const pct = (v: number, t: number) => (t ? Math.round((100 * v) / t) : 0);
const ITENS = A.ITEMS as unknown as { key: string; cat: string; l: string }[];
const MAINS = A.MAINS as unknown as { key: string; cat: string; l: string }[];
export const CATEGORIAS = (A.CATS as unknown as { id: string; name: string; short: string }[]).map(
  (c) => ({
    id: c.id,
    nome: c.name,
    curto: c.short,
  }),
);
export const rotuloItem = (k: string) => ITENS.find((i) => i.key === k)?.l ?? k;

export function kpis(l: LinhaInd[]) {
  const soma = (f: (x: LinhaInd) => boolean) => l.filter(f).reduce((s, x) => s + (x.mrr ?? 0), 0);
  const concluidas = l.filter(analisado).length;
  return {
    clientes: l.length,
    valor: soma(() => true),
    aguardando: l.filter((x) => x.status === "aguardando").length,
    andamento: l.filter((x) => x.status === "em_andamento").length,
    concluidas,
    pctConclusao: pct(concluidas, l.length),
    valorAnalisado: soma(analisado),
    valorPendente: soma((x) => !analisado(x)),
  };
}

export function cobertura(l: LinhaInd[]) {
  const c = (k: StatusCobertura) => l.filter((x) => x.cob === k).length;
  return {
    ok: c("ok"),
    atencao: c("atencao"),
    pendente: c("pendente"),
    critico: c("critico"),
    sem_registro: c("sem_registro"),
    indisp: c("indisp"),
  };
}

export function porResponsavel(l: LinhaInd[]) {
  const m = new Map<
    string,
    {
      n: number;
      analisados: number;
      andamento: number;
      cobOk: number;
      criticos: number;
      valor: number;
    }
  >();
  for (const x of l) {
    const v = m.get(x.responsavel) ?? {
      n: 0,
      analisados: 0,
      andamento: 0,
      cobOk: 0,
      criticos: 0,
      valor: 0,
    };
    v.n++;
    v.valor += x.mrr ?? 0;
    if (analisado(x)) v.analisados++;
    if (x.status === "em_andamento") v.andamento++;
    if (x.cob === "ok" || x.cob === "atencao") v.cobOk++;
    if (x.cob === "critico" || x.cob === "sem_registro") v.criticos++;
    m.set(x.responsavel, v);
  }
  return [...m.entries()]
    .map(([nome, v]) => ({
      nome,
      ...v,
      pctAnalise: pct(v.analisados, v.n),
      pctCobertura: pct(v.cobOk, v.n),
    }))
    .sort((a, b) => b.n - a.n);
}

/** Itens com menor adesão (ausente ou com falha) entre os diagnósticos concluídos. */
export function adesao(l: LinhaInd[], cat?: string) {
  const m = new Map<string, { aus: number; falha: number; base: number; clientes: string[] }>();
  for (const x of l) {
    if (x.diag?.status !== "concluido") continue;
    for (const it of MAINS) {
      if (cat && it.cat !== cat) continue;
      const s = x.diag.itens[it.key]?.s;
      if (!s || s === "nao_analisado" || s === "na") continue;
      const v = m.get(it.key) ?? { aus: 0, falha: 0, base: 0, clientes: [] };
      v.base++;
      if (s === "nao_impl") {
        v.aus++;
        v.clientes.push(x.key);
      }
      if (s === "nao_funciona") {
        v.falha++;
        v.clientes.push(x.key);
      }
      m.set(it.key, v);
    }
  }
  return [...m.entries()]
    .map(([k, v]) => ({
      k,
      rotulo: rotuloItem(k),
      cat: MAINS.find((i) => i.key === k)?.cat ?? "",
      ...v,
      pct: pct(v.aus + v.falha, v.base),
    }))
    .filter((x) => x.aus + x.falha > 0)
    .sort((a, b) => b.pct - a.pct || b.aus + b.falha - (a.aus + a.falha));
}

/** Automações (categoria "aut"): ausentes, com problema técnico e com melhoria indicada. */
export function automacoes(l: LinhaInd[]) {
  const base = adesao(l, "aut");
  const melhoria = new Map<string, number>();
  for (const x of l) {
    if (x.diag?.status !== "concluido") continue;
    for (const it of MAINS)
      if (it.cat === "aut" && x.diag.itens[it.key]?.s === "melhoria")
        melhoria.set(it.key, (melhoria.get(it.key) ?? 0) + 1);
  }
  return base.map((b) => ({ ...b, melhoria: melhoria.get(b.k) ?? 0 }));
}

/** Aproveitamento médio (índice) geral e por categoria, só de diagnósticos concluídos com índice disponível. */
export function aproveitamento(l: LinhaInd[]) {
  const concl = l.filter((x) => x.diag?.status === "concluido");
  const indices = concl
    .map((x) => x.diag!.derivado?.["score"])
    .filter((v): v is number => typeof v === "number");
  const media = (a: number[]) =>
    a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : null;
  const porCat = CATEGORIAS.map((c) => {
    const v = concl
      .map((x) => (x.diag!.derivado?.["cats"] as Record<string, number | null> | undefined)?.[c.id])
      .filter((n): n is number => typeof n === "number");
    return { ...c, media: media(v), n: v.length };
  });
  return { media: media(indices), n: indices.length, porCat };
}

export function oportunidades(l: LinhaInd[]) {
  let total = 0,
    criticas = 0,
    rapidos = 0;
  for (const x of l) {
    const d = x.diag?.status === "concluido" ? x.diag.derivado : null;
    if (!d) continue;
    total += Number(d["opp"] ?? 0);
    criticas += Number(d["crit"] ?? 0);
    rapidos += Number(d["quick"] ?? 0);
  }
  return { total, criticas, rapidos };
}

/** Clientes críticos: índice abaixo de 40, ação crítica em aberto ou cobertura crítica com valor relevante. */
export function clientesCriticos(l: LinhaInd[]) {
  return l
    .map((x) => {
      const indice =
        x.diag?.status === "concluido"
          ? ((x.diag.derivado?.["score"] as number | null | undefined) ?? null)
          : null;
      const motivos: string[] = [];
      if (indice != null && indice < 40) motivos.push(`Índice ${indice}`);
      if (x.maxPrioridade === "critica") motivos.push("Ação crítica em aberto");
      if (x.cob === "critico" || x.cob === "sem_registro")
        motivos.push(x.dias != null ? `${x.dias} dias sem contato` : "Sem contato registrado");
      return { ...x, indice, motivos };
    })
    .filter((x) => x.motivos.length >= 2 || (x.indice != null && x.indice < 40))
    .sort((a, b) => b.motivos.length - a.motivos.length || (b.mrr ?? 0) - (a.mrr ?? 0));
}

export function planos(acoes: AcaoInd[], hoje: string) {
  const vivas = acoes.filter((a) => !a.obsoleta);
  const abertas = vivas.filter((a) => !FECHADOS.has(a.status));
  return {
    abertas: abertas.length,
    criticas: abertas.filter((a) => a.prioridade === "critica").length,
    concluidas: vivas.filter((a) => a.status === "implementado").length,
    atrasadas: abertas.filter((a) => a.prazo != null && a.prazo < hoje).length,
    rapidos: abertas.filter((a) => a.ganho_rapido).length,
    aguardandoCliente: abertas.filter(
      (a) => a.status === "aguardando_cliente" || a.status === "aguardando_ativacao",
    ).length,
    reincidentes: abertas.filter((a) => a.reincidencias > 0).length,
    taxaImplementacao: pct(
      vivas.filter((a) => a.status === "implementado").length,
      vivas.filter((a) => a.status !== "nao_aprovado").length,
    ),
  };
}

/** Semana (segunda-feira, AAAA-MM-DD) de uma data ISO. */
export function semana(iso: string) {
  const d = new Date(iso.slice(0, 10) + "T12:00:00Z");
  const dia = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}
/** Série semanal de análises iniciadas e concluídas (últimas `n` semanas até `hoje`). */
export function serieAnalises(ciclos: CicloInd[], hoje: string, n = 12) {
  const fim = semana(hoje);
  const semanas: string[] = [];
  const d = new Date(fim + "T12:00:00Z");
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() - 7 * i);
    semanas.push(x.toISOString().slice(0, 10));
  }
  return semanas.map((s) => ({
    semana: s,
    iniciadas: ciclos.filter((c) => semana(c.iniciado_em) === s).length,
    concluidas: ciclos.filter((c) => c.concluido_em && semana(c.concluido_em) === s).length,
  }));
}

/** Produtividade por analista no período [desde, hoje]. */
export function produtividade(ciclos: CicloInd[], nomes: Map<string, string>, desde: string) {
  const m = new Map<string, { concluidas: number; andamento: number; indices: number[] }>();
  for (const c of ciclos) {
    const v = m.get(c.analista_id) ?? { concluidas: 0, andamento: 0, indices: [] };
    if (c.status === "concluido" && c.concluido_em && c.concluido_em.slice(0, 10) >= desde) {
      v.concluidas++;
      if (c.indice != null) v.indices.push(c.indice);
    }
    if (c.status === "em_analise") v.andamento++;
    m.set(c.analista_id, v);
  }
  return [...m.entries()]
    .map(([id, v]) => ({
      id,
      nome: nomes.get(id) ?? "Usuário sem nome",
      concluidas: v.concluidas,
      andamento: v.andamento,
      indiceMedio: v.indices.length
        ? Math.round(v.indices.reduce((s, x) => s + x, 0) / v.indices.length)
        : null,
    }))
    .filter((x) => x.concluidas + x.andamento > 0)
    .sort((a, b) => b.concluidas - a.concluidas);
}

/** Evolução do índice entre ciclos concluídos de um mesmo cliente (último vs. anterior). */
export function evolucaoIndices(ciclos: CicloInd[]) {
  const por = new Map<string, CicloInd[]>();
  for (const c of ciclos)
    if (c.status === "concluido" && c.indice != null)
      por.set(c.cliente_key, [...(por.get(c.cliente_key) ?? []), c]);
  const r: { key: string; anterior: number; atual: number; delta: number }[] = [];
  for (const [key, lst] of por) {
    if (lst.length < 2) continue;
    const ord = [...lst].sort((a, b) => b.ciclo - a.ciclo);
    r.push({
      key,
      anterior: ord[1]!.indice!,
      atual: ord[0]!.indice!,
      delta: ord[0]!.indice! - ord[1]!.indice!,
    });
  }
  return r;
}
