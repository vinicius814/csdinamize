/**
 * Motor de regras do Dinamize CS. Reaproveita a metodologia original (artefato-v1.ts) e aplica
 * as correções documentadas em docs/BUSINESS_RULES.md (seção "Correções em relação ao artefato").
 * Tudo aqui é puro e determinístico: roda igual no navegador, no servidor e nos testes.
 */
import * as A from "./artefato-v1";

export const REGRAS_VERSAO = "v1-artefato+c1";

export type Estado =
  "nao_analisado" | "funcional" | "melhoria" | "nao_funciona" | "nao_impl" | "na";
export type Prioridade = "critica" | "alta" | "media" | "baixa";
type SN = "s" | "n" | "" | undefined;
type Num = number | string | null | undefined;
interface RegraCobertura {
  owner?: Num;
  vmin?: Num;
  vmax?: Num;
  ok: Num;
  atencao: Num;
  pendente: Num;
}
export interface ItemResp {
  s?: Estado;
  obs?: string;
  ev?: string;
  rec?: string;
  prio?: Prioridade;
  auto?: boolean;
  jan?: number | string | null;
  sub?: { impl?: SN; ativa?: SN; func?: SN; rel?: SN; melh?: SN; cont?: SN; [check: string]: SN };
}
export interface Diagnostico {
  items?: Record<string, ItemResp>;
  metrics?: {
    m30?: Record<string, number | string | null>;
    m90?: Record<string, number | string | null>;
    m60?: Record<string, number | string | null>;
  };
  res?: Record<string, unknown> & { unused?: string };
  meta?: { autosActive?: number | string | null; metodologia?: string; migrado_em?: string };
}

/* ---------- Metodologia v2 (18/11/2026, D27) ----------
 * - Matriz de automações sem "relatório de conversão" e sem janela de atribuição.
 * - Entregabilidade com período único de 60 dias (métricas em metrics.m60); m30/m90 antigos ficam preservados e não são convertidos.
 * - Frequência: média de envios (disparos/campanhas) por semana = disparos no período ÷ (60 ÷ 7).
 * Ciclos sem meta.metodologia são v1 e continuam calculados exatamente como antes. */
export const METODOLOGIA_V2 = "v2-2026-11";
export const ehV2 = (d: Diagnostico | undefined) => d?.meta?.metodologia === METODOLOGIA_V2;
/** Indicadores do período de 60 dias e da fotografia atual da conta (v2). */
export const METRICAS_V2: {
  k: string;
  rotulo: string;
  tipo: "n" | "p" | "d" | "dec";
  grupo: "periodo" | "atual";
  principal: boolean;
}[] = [
  { k: "sent", rotulo: "Volume de e-mails enviados", tipo: "n", grupo: "periodo", principal: true },
  {
    k: "deliv",
    rotulo: "Taxa de entregabilidade (%)",
    tipo: "p",
    grupo: "periodo",
    principal: true,
  },
  {
    k: "open",
    rotulo: "Taxa de abertura (%) — auxiliar",
    tipo: "p",
    grupo: "periodo",
    principal: true,
  },
  { k: "click", rotulo: "Taxa de cliques (%)", tipo: "p", grupo: "periodo", principal: true },
  { k: "hard", rotulo: "Hard bounce (%)", tipo: "p", grupo: "periodo", principal: false },
  { k: "soft", rotulo: "Soft bounce (%)", tipo: "p", grupo: "periodo", principal: false },
  { k: "unsub", rotulo: "Descadastros (%)", tipo: "p", grupo: "periodo", principal: false },
  { k: "spam", rotulo: "Denúncias de spam (%)", tipo: "p", grupo: "periodo", principal: false },
  {
    k: "disparos",
    rotulo: "Disparos/campanhas no período",
    tipo: "n",
    grupo: "periodo",
    principal: true,
  },
  {
    k: "freq_sem",
    rotulo: "Frequência média de envios por semana",
    tipo: "dec",
    grupo: "periodo",
    principal: true,
  },
  { k: "base", rotulo: "Tamanho da base", tipo: "n", grupo: "atual", principal: true },
  { k: "engaged", rotulo: "Contatos engajados", tipo: "n", grupo: "atual", principal: false },
  { k: "rest", rotulo: "Base em descanso (%)", tipo: "p", grupo: "atual", principal: false },
  { k: "lastc", rotulo: "Data da última campanha", tipo: "d", grupo: "atual", principal: false },
];
/** Frequência semanal a partir da quantidade de disparos nos 60 dias (nunca a partir do volume de mensagens). */
export function frequenciaSemanal(disparos: unknown): number | null {
  if (disparos === "" || disparos == null) return null;
  const n = Number(disparos);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round((n / (60 / 7)) * 10) / 10;
}
const semRel = (o: ItemResp | undefined): ItemResp | undefined => {
  if (!o) return o;
  const { jan: _jan, ...resto } = o;
  void _jan;
  const sub = o.sub ? { ...o.sub } : undefined;
  if (sub) delete sub.rel;
  return sub ? { ...resto, sub } : resto;
};
/** Visão do diagnóstico no formato do porte original (artefato-v1), conforme a metodologia. */
function paraArtefato(d: Diagnostico): Diagnostico {
  if (!ehV2(d)) return d;
  const items: Record<string, ItemResp> = {};
  for (const [k, o] of Object.entries(d.items ?? {}))
    items[k] = (A.ITEM_BY[k]?.matrix ? semRel(o) : o) as ItemResp;
  const m60 = d.metrics?.m60 ?? {};
  return { ...d, items, metrics: { m30: { ...m60, freq: m60["freq_sem"] ?? null } } };
}
/** Estado da automação pela matriz. v2: Implementada → Ativa → Funcional → Precisa melhorar (sem relatório). */
function estadoAutomacaoV2(o: ItemResp | undefined): Estado | null {
  const f = o?.sub ?? {};
  if (!f.impl && !f.ativa && !f.func && !f.melh) return null;
  if (f.impl === "n") return "nao_impl";
  if (f.impl !== "s") return "nao_analisado";
  if (f.ativa === "n" || f.func === "n") return "nao_funciona";
  if (f.ativa === "s" && f.func === "s") return f.melh === "s" ? "melhoria" : "funcional";
  return "nao_analisado";
}
/**
 * Transição segura de uma análise em andamento para a v2: preserva tudo (inclusive rel/jan e m30/m90),
 * recalcula só o estado das automações cujo estado era o calculado pela matriz (não sobrescreve ajuste manual).
 */
export function migrarParaV2<
  T extends { itens: Record<string, ItemResp>; meta: Record<string, unknown> },
>(c: T, agora = new Date().toISOString()): T {
  if (c.meta?.["metodologia"] === METODOLOGIA_V2) return c;
  const itens = { ...c.itens };
  for (const [k, o] of Object.entries(itens)) {
    if (!A.ITEM_BY[k]?.matrix || !o) continue;
    const v1 = A.autoState(o) as Estado | null;
    if (v1 && o.s === v1) {
      const v2 = estadoAutomacaoV2(o);
      if (v2) itens[k] = { ...o, s: v2 };
    }
  }
  return { ...c, itens, meta: { ...c.meta, metodologia: METODOLOGIA_V2, migrado_em: agora } };
}
export type Config = ReturnType<typeof A.mergeCfg>;

export const configPadrao = (): Config => A.mergeCfg(null);
export const mesclarConfig = (c: unknown): Config => A.mergeCfg(c);

/* ---------- Índice, faixas e recomendações (comportamento original) ---------- */
export const calcularIndice = (d: Diagnostico, cfg: Config) =>
  A.calcScore(paraArtefato(d).items, cfg);
export const faixa = (sc: ReturnType<typeof calcularIndice>, cfg: Config) => A.bandOfSc(sc, cfg);
export const estadoAutomacao = (o: ItemResp | undefined, v2 = false): Estado | null =>
  v2 ? estadoAutomacaoV2(o) : A.autoState(o);

/**
 * Correção C1 — relatório de conversão só é "validado" com evidência completa.
 * Original: rel/jan ausentes contavam como validado (flag conv = 0). Agora:
 *  1 = problema confirmado (rel = "n" ou janela ≠ 1 dia), 0 = validado (rel = "s" e janela = 1),
 *  null = informação insuficiente.
 */
export function statusConversao(d: Diagnostico): 0 | 1 | null {
  if (ehV2(d)) return null; // v2: relatório de conversão fora da metodologia
  const v = A.AUTO_WIN1.map((k: string) => {
    const o = d.items?.[k];
    if (!o || !["funcional", "melhoria", "nao_funciona"].includes(o.s ?? "")) return null;
    const jan = o.jan === "" || o.jan == null ? null : Number(o.jan);
    if (o.sub?.rel === "n" || (jan != null && jan !== 1)) return 1;
    if (o.sub?.rel === "s" && jan === 1) return 0;
    return null;
  }).filter((x: 0 | 1 | null) => x !== null) as (0 | 1)[];
  if (v.some((x) => x === 1)) return 1;
  const ativos = A.AUTO_WIN1.filter((k: string) =>
    ["funcional", "melhoria", "nao_funciona"].includes(d.items?.[k]?.s ?? ""),
  ).length;
  return ativos > 0 && v.length === ativos ? 0 : null;
}

/** Itens de automação com janela 1 dia que ainda não têm validação completa do relatório. */
export function conversaoPendente(d: Diagnostico): string[] {
  if (ehV2(d)) return [];
  return A.AUTO_WIN1.filter((k: string) => {
    const o = d.items?.[k];
    if (!o || !["funcional", "melhoria", "nao_funciona"].includes(o.s ?? "")) return false;
    const jan = o.jan === "" || o.jan == null ? null : Number(o.jan);
    return o.sub?.rel == null || o.sub?.rel === "" || jan == null;
  });
}

export function recomendacoes(d: Diagnostico, cfg: Config): Recomendacao[] {
  const recs = (A.genRecs(paraArtefato(d), cfg) as Recomendacao[]).filter(
    (r) => !ehV2(d) || !/^x_(jan|rel)_/.test(r.id),
  );
  // C2: automação de janela 1 dia sem dados do relatório gera tarefa de validação (não presume validado).
  for (const k of conversaoPendente(d)) {
    const it = A.ITEM_BY[k];
    recs.push({
      id: "x_val_" + k,
      cat: "aut",
      ref: k,
      problem: `${it.l}: relatório de conversão e janela de atribuição não validados`,
      action:
        "Validar se o relatório de conversão está configurado com janela de atribuição de 1 dia",
      benefit: "Mensuração confiável da receita da automação",
      priority: "media",
      complexity: "baixa",
      who: "dinamize",
      days: 7,
      quick: true,
      state: "melhoria",
      source: "extra",
    });
  }
  const so = { critica: 0, alta: 1, media: 2, baixa: 3 } as const;
  return recs.sort(
    (a, b) =>
      so[a.priority] - so[b.priority] ||
      Number(b.quick) - Number(a.quick) ||
      a.id.localeCompare(b.id),
  );
}
export interface Recomendacao {
  id: string;
  cat: string;
  ref: string;
  problem: string;
  action: string;
  benefit: string;
  priority: Prioridade;
  complexity: "baixa" | "media" | "alta";
  who: "dinamize" | "cliente" | "ambos";
  days: number;
  quick: boolean;
  state: Estado;
  source: "item" | "extra" | "manual";
}

/** Resumo derivado por cliente (alimenta carteira, visão geral e inteligência). */
export function derivado(d: Diagnostico, cfg: Config) {
  const base = A.buildDerived(paraArtefato(d), cfg);
  const recs = recomendacoes(d, cfg);
  const sc = calcularIndice(d, cfg);
  return {
    ...base,
    band: faixa(sc, cfg)?.l ?? null,
    opp: recs.length,
    crit: recs.filter((r) => r.priority === "critica").length,
    quick: recs.filter((r) => r.quick).length,
    fl: { ...base.fl, conv: statusConversao(d) },
    regras: ehV2(d) ? METODOLOGIA_V2 : REGRAS_VERSAO,
  };
}
export const pendencias = (d: Diagnostico, cfg: Config) => A.pendingInfo(paraArtefato(d), cfg);
export const resumoProfissional = (ctx: Parameters<typeof A.buildSummary>[0]) =>
  A.buildSummary({ ...ctx, diag: paraArtefato(ctx.diag as Diagnostico) } as never);
export const patchEntregabilidade = (d: Diagnostico, cfg: Config) =>
  A.autoEntPatch(paraArtefato(d), cfg);

/* ---------- Plano de ação: mesclagem entre ciclos (pura, sem globais) ---------- */
export interface RecPlano extends Recomendacao {
  obsolete?: boolean;
  obsoleteAt?: string;
  manual?: boolean;
  firstCycle: number;
  lastCycle: number;
  recur: number;
  impl: { status: string; owner: string; due: string; notes: string; at: string };
}
const addDias = (iso: string, n: number) => {
  const x = new Date(iso.slice(0, 10) + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};
/**
 * Porte de mergePlan. C3: item obsoleto que reaparece só conta reincidência se tinha sido
 * implementado (no original qualquer reaparecimento somava, inflando reincidências).
 */
export function mesclarPlano(
  antigo: Record<string, RecPlano>,
  recs: Recomendacao[],
  ciclo: number,
  data: string,
  agora = new Date().toISOString(),
): Record<string, RecPlano> {
  const out: Record<string, RecPlano> = { ...antigo };
  const ids = new Set(recs.map((r) => r.id));
  for (const r of recs) {
    const o = out[r.id];
    let impl = o?.impl ?? {
      status: "aguardando_contato",
      owner: "",
      due: addDias(data, r.days),
      notes: "",
      at: agora,
    };
    let recur = o?.recur ?? 0;
    if (o && o.lastCycle < ciclo && o.impl.status === "implementado") {
      recur++;
      impl = {
        ...impl,
        status: "aguardando_contato",
        due: addDias(data, r.days),
        notes: (impl.notes ? impl.notes + "\n" : "") + `Reincidência no ciclo ${ciclo}.`,
        at: agora,
      };
    }
    const novo: RecPlano = {
      ...r,
      obsolete: false,
      firstCycle: o?.firstCycle ?? ciclo,
      lastCycle: ciclo,
      recur,
      impl,
    };
    if (o?.manual) novo.manual = true;
    out[r.id] = novo;
  }
  for (const [id, r] of Object.entries(out)) {
    if (!ids.has(id) && !r.manual && !r.obsolete)
      out[id] = { ...r, obsolete: true, obsoleteAt: data };
  }
  return out;
}

/* ---------- Carteira: identificação de e-commerce e consolidação por cliente ---------- */
export interface DealPD {
  id: number;
  title?: string;
  value?: number | null;
  org_id?: number | { value?: number; id?: number } | null;
  person_id?: number | { value?: number } | null;
  owner_id?: number | { id?: number } | null;
  stage_id: number;
  status?: string;
  is_archived?: boolean;
  label_ids?: number[];
  custom_fields?: Record<string, unknown>;
}
const idDe = (v: unknown): number | null => {
  if (v == null) return null;
  if (typeof v === "object") {
    const o = v as { value?: number; id?: number };
    return o.value ?? o.id ?? null;
  }
  return Number(v);
};

export function ehEcommerce(d: DealPD, cfg: Config): boolean {
  const segs = ((d.custom_fields?.[A.F_SEG] as unknown[]) || []).map((x) =>
    Number(typeof x === "object" && x ? (x as { id?: number }).id : x),
  );
  const labs = (d.label_ids || []).map(Number);
  return (
    (cfg.ecom.segmento && segs.includes(A.SEG_ECOM)) ||
    (cfg.ecom.etiqueta && labs.includes(A.LABEL_ECOM))
  );
}

export interface ClienteCarteira {
  key: string;
  orgId: number | null;
  name: string;
  code: string;
  dealId: number;
  dealIds: number[];
  nDeals: number;
  mrr: number | null;
  stageId: number;
  ownerId: number | null;
  ownerName: string;
  personId: number | null;
  labelIds: number[];
}
/**
 * Consolida negócios do funil por organização (porte de syncPortfolio).
 * C4: valor ausente nunca vira zero (mrr = null se algum negócio não tiver valor).
 */
export function consolidarCarteira(
  deals: DealPD[],
  cfg: Config,
  nomes: Record<string, string> = A.USERS,
) {
  const incl = new Set(cfg.stages.map(Number));
  const grupos: Record<string, DealPD[]> = {};
  for (const d of deals) {
    if (
      d.is_archived ||
      (d.status && d.status !== "open") ||
      !incl.has(Number(d.stage_id)) ||
      !ehEcommerce(d, cfg)
    )
      continue;
    const org = idDe(d.org_id);
    const key = org ? String(org) : "d" + d.id;
    (grupos[key] ??= []).push(d);
  }
  const out: Record<string, ClienteCarteira> = {};
  for (const [key, ds] of Object.entries(grupos)) {
    ds.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0) || a.id - b.id);
    const p = ds[0]!;
    const title = String(p.title || "").trim();
    const m = title.match(/^\s*(\d+)\s*[-–]\s*(.*)$/);
    let oid = idDe(p.owner_id);
    let oname = oid != null ? (nomes[String(oid)] ?? "Usuário " + oid) : "—";
    if (cfg.ownerSource === "gerente") {
      const g = p.custom_fields?.[A.F_GER] as { id?: number; label?: string } | null;
      oid = g?.id ?? null;
      oname = g?.label || "(sem gerente de contas)";
    }
    const semValor = ds.some((x) => x.value == null || isNaN(Number(x.value)));
    out[key] = {
      key,
      orgId: idDe(p.org_id),
      name: m?.[2] ?? title,
      code: m?.[1] ?? "",
      dealId: p.id,
      dealIds: ds.map((x) => x.id),
      nDeals: ds.length,
      mrr: semValor ? null : Math.round(ds.reduce((a, x) => a + Number(x.value), 0) * 100) / 100,
      stageId: Number(p.stage_id),
      ownerId: oid,
      ownerName: oname,
      personId: idDe(p.person_id),
      labelIds: p.label_ids || [],
    };
  }
  return out;
}

/**
 * C5: inativação só após leitura completa. O original parava em 80 páginas e inativava
 * todos os clientes não lidos. Retorna as chaves a inativar ou lança erro se incompleto.
 */
export function chavesParaInativar(
  ativosAtuais: string[],
  novos: Record<string, unknown>,
  leituraCompleta: boolean,
) {
  if (!leituraCompleta)
    throw new Error("Leitura incompleta do Pipedrive: nenhum cliente será inativado.");
  return ativosAtuais.filter((k) => !(k in novos));
}

/* ---------- Cobertura de CS ---------- */
export interface AtividadePD {
  id: number;
  type?: string;
  subject?: string;
  note?: string;
  done?: boolean;
  is_deleted?: boolean;
  marked_as_done_time?: string;
  due_date?: string;
  add_time?: string;
  deal_id?: number | null;
  org_id?: number | null;
  person_id?: number | null;
  owner_id?: number | null;
}
const temPalavra = (txt: string, lista: string[]) => {
  const t = txt.toLowerCase();
  return (lista || []).some((k) => k && t.includes(String(k).toLowerCase()));
};
const semHtml = (h?: string) =>
  String(h || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ");
/** "efetivo" | "incerto" | "ignorar". Atividades geradas pelo próprio sistema nunca contam. */
export function classificarAtividade(
  a: AtividadePD,
  cov: Config["cov"],
): "efetivo" | "incerto" | "ignorar" {
  if (!a || !a.done || a.is_deleted) return "ignorar";
  const subj = String(a.subject || "");
  if (
    subj.startsWith("CS | Diagnóstico de utilização") ||
    /DZCS-\S+-C\d+/.test(String(a.note || ""))
  )
    return "ignorar";
  const mode = (cov.modes as Record<string, string>)?.[a.type || ""] || "nao";
  if (mode === "nao") return "ignorar";
  if (mode === "forte") return "efetivo";
  // "tentativa": o tipo registra tentativa de contato (não conta como contato efetivo).
  if (mode === "tentativa") return "ignorar";
  const txt = subj + " " + semHtml(a.note);
  if (temPalavra(txt, cov.kwNeg)) return "ignorar";
  if (mode === "sim") return "efetivo";
  return temPalavra(txt, cov.kwPos) ? "efetivo" : "incerto";
}
export const dataAtividade = (a: AtividadePD) =>
  String(a.marked_as_done_time || a.due_date || a.add_time || "").slice(0, 10);

export function limitesCobertura(
  c: { ownerId: number | null; mrr: number | null },
  cov: Config["cov"],
) {
  for (const r of (cov.rules || []) as RegraCobertura[]) {
    if (r.owner && String(r.owner) !== String(c.ownerId)) continue;
    if (r.vmin !== "" && r.vmin != null && (c.mrr || 0) < Number(r.vmin)) continue;
    if (r.vmax !== "" && r.vmax != null && (c.mrr || 0) > Number(r.vmax)) continue;
    return { ok: Number(r.ok), atencao: Number(r.atencao), pendente: Number(r.pendente) };
  }
  return { ok: Number(cov.ok), atencao: Number(cov.atencao), pendente: Number(cov.pendente) };
}
export type StatusCobertura = "ok" | "atencao" | "pendente" | "critico" | "sem_registro" | "indisp";
export const ROTULO_COBERTURA: Record<StatusCobertura, string> = {
  ok: "Em dia",
  atencao: "Atenção",
  pendente: "Pendente",
  critico: "Crítico",
  sem_registro: "Sem registro",
  indisp: "Dados indisponíveis",
};
export function statusCobertura(
  ultimoEfetivo: string | null | undefined,
  limites: ReturnType<typeof limitesCobertura>,
  hoje: string,
  sincronizado: boolean,
): { k: StatusCobertura; dias: number | null } {
  if (!sincronizado) return { k: "indisp", dias: null };
  if (!ultimoEfetivo) return { k: "sem_registro", dias: null };
  const dias = Math.floor(
    (Date.parse(hoje.slice(0, 10) + "T12:00:00Z") -
      Date.parse(ultimoEfetivo.slice(0, 10) + "T12:00:00Z")) /
      864e5,
  );
  const k: StatusCobertura =
    dias <= limites.ok
      ? "ok"
      : dias <= limites.atencao
        ? "atencao"
        : dias <= limites.pendente
          ? "pendente"
          : "critico";
  return { k, dias };
}

/* ---------- Mensagens (templates determinísticos; IA opcional via n8n) ---------- */
const lc = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
export function fatosMensagem(nomeCliente: string | undefined, d: Diagnostico, cfg: Config) {
  const recs = recomendacoes(d, cfg);
  const pos = (A.MAINS as unknown as { key: string; cat: string; l: string; e: number }[])
    .filter((i) => d.items?.[i.key]?.s === "funcional")
    .sort((a, b) => b.e - a.e)
    .slice(0, 4)
    .map((i) => (i.cat === "aut" ? `automação de ${lc(i.l)}` : lc(i.l)));
  const opp = recs
    .filter((r) => r.source !== "extra" || r.priority !== "baixa")
    .slice(0, 5)
    .map((r) => {
      const it = A.ITEM_BY[r.ref];
      return {
        titulo: it ? it.l : r.problem,
        acao: r.action,
        beneficio: r.benefit,
        dinamize_prepara: r.who !== "cliente",
      };
    });
  return { cliente: nomeCliente, positivos: pos as string[], oportunidades: opp };
}
export function mensagemTemplate(f: ReturnType<typeof fatosMensagem>, variacao = 0) {
  const v = ((variacao % 3) + 3) % 3;
  const o = f.oportunidades;
  const bl = o.map((x) => "• " + x.acao).join("\n");
  const pos = f.positivos.length
    ? [
        `Já vimos coisas boas por aí, como ${f.positivos.slice(0, 2).join(" e ")}.`,
        `Um ponto legal: ${f.positivos[0]} já está funcionando bem.`,
        `Dá pra ver que ${f.positivos.slice(0, 2).join(" e ")} estão no caminho certo.`,
      ][v]
    : "";
  const open = [
    "Oi, tudo bem?",
    "Oi, tudo bem? Passando pra compartilhar uma novidade.",
    "Oi, tudo bem? Espero que a semana esteja corrida no bom sentido.",
  ][v];
  const help = [
    "Se fizer sentido, nossa equipe pode deixar parte disso preparado na conta (pop-ups, segmentações ou automações) para vocês só revisarem e ativarem.",
    "A gente pode ajudar na prática: preparamos pop-ups, segmentações e automações direto na conta e vocês revisam e ativam quando quiserem.",
    "Podemos adiantar o trabalho: deixamos pop-ups, segmentações e automações prontos na conta para a revisão de vocês.",
  ][v];
  const close = [
    "O que acham de avançarmos com isso?",
    "Quer que a gente comece por algum desses pontos?",
    "Me diz por onde prefere começar que a gente organiza os próximos passos.",
  ][v];
  const whatsapp = `${open}\n\nFizemos uma análise da utilização da conta de vocês na Dinamize.${pos ? " " + pos : ""} Também encontramos algumas oportunidades para fortalecer as ações de CRM:\n\n${bl}\n\n${help}\n\n${close}`;
  const email = `${open}\n\nA equipe de Customer Success da Dinamize fez uma análise da utilização da conta${f.cliente ? " da " + f.cliente : ""} e preparamos um resumo com o que observamos. ${pos}\n\nAs oportunidades que mais chamaram a atenção foram:\n\n${o.map((x) => `• ${x.titulo}: ${lc(x.acao)}. ${x.beneficio}.`).join("\n")}\n\n${help}\n\nSe quiser, podemos marcar uma conversa rápida para apresentar o diagnóstico completo e combinar a ordem de implementação.\n\n${close}\n\nUm abraço,\nEquipe de Customer Success Dinamize`;
  return { whatsapp, assunto: "Análise da sua conta na Dinamize: oportunidades para o CRM", email };
}

/* ---------- Permissões (espelham o artefato; a autorização real está na RLS) ---------- */
export type Perfil = "admin" | "cs" | "contas";
export const MODULOS_POR_PERFIL: Record<Perfil, string[]> = {
  admin: [
    "visao-geral",
    "carteira",
    "minhas-analises",
    "planos",
    "cobertura",
    "onboarding",
    "equipe",
    "atividades",
    "inteligencia",
    "historico",
    "usuarios",
    "configuracoes",
  ],
  cs: [
    "visao-geral",
    "carteira",
    "minhas-analises",
    "planos",
    "cobertura",
    "onboarding",
    "equipe",
    "atividades",
    "inteligencia",
    "historico",
  ],
  contas: ["carteira", "minhas-analises", "planos", "historico"],
};
export function podeVerCliente(
  p: { perfil: Perfil | null; carteiras: (string | number)[]; clientes: string[] },
  c: { key: string; ownerId: number | null },
) {
  if (p.perfil === "admin") return true;
  if (!p.perfil) return false;
  return p.carteiras.map(String).includes(String(c.ownerId)) || p.clientes.includes(c.key);
}

/** Chave de idempotência da atividade no Pipedrive (mesma marca usada pelo artefato). */
export const chaveAtividade = (clienteKey: string, ciclo: number) => `DZCS-${clienteKey}-C${ciclo}`;
export { A as artefato };

/* ---------- Contato efetivo: campo do Pipedrive (D5, confirmado em 17/11/2026) ---------- */
/** Campo de negócio "Data do último contato efetivo" no Pipedrive. */
export const CAMPO_CONTATO_EFETIVO = "58cd094a23bd14b9275f4c006f1b19457b3c1d63";
const DATA_ISO = /^\d{4}-\d{2}-\d{2}/;
/** Maior data válida do campo entre os negócios do cliente; null se nenhum negócio tiver o campo preenchido. */
export function dataContatoEfetivo(deals: Pick<DealPD, "custom_fields">[]): string | null {
  let max: string | null = null;
  for (const d of deals) {
    const v = d.custom_fields?.[CAMPO_CONTATO_EFETIVO];
    if (typeof v !== "string" || !DATA_ISO.test(v)) continue;
    const dia = v.slice(0, 10);
    if (!max || dia > max) max = dia;
  }
  return max;
}
/**
 * Compara a fonte oficial (campo) com a classificação de atividades (referência).
 * "sem_campo": há contato por atividade mas o campo está vazio; "atividade_mais_recente": atividade
 * efetiva mais nova que o campo além da tolerância (campo possivelmente desatualizado).
 */
export function divergenciaContato(
  campo: string | null,
  porAtividade: string | null,
  toleranciaDias = 7,
): "sem_campo" | "atividade_mais_recente" | null {
  if (!porAtividade) return null;
  if (!campo) return "sem_campo";
  const dias = (Date.parse(porAtividade.slice(0, 10)) - Date.parse(campo.slice(0, 10))) / 864e5;
  return dias > toleranciaDias ? "atividade_mais_recente" : null;
}

/* ---------- Relatório do diagnóstico (atividade "Análise" no Pipedrive) ----------
 * Só usa o que foi registrado; nada é inventado; não contém valores financeiros. */
export interface CtxRelatorio {
  cliente: string;
  responsavel: string | null;
  analista: string | null;
  data: string; // AAAA-MM-DD
  ciclo: number;
  diag: Diagnostico;
  cfg: Config;
  proximaRevisao: string | null;
  plano: {
    acao: string;
    prioridade: Prioridade;
    responsavel: string | null;
    prazo: string | null;
    status: string;
  }[];
}
const dataBRr = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—";
const PRIO_ROT: Record<Prioridade, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};
export function relatorioDiagnostico(ctx: CtxRelatorio): {
  texto: string;
  secoes: { titulo: string; linhas: string[] }[];
} {
  const d = ctx.diag;
  const sc = calcularIndice(d, ctx.cfg);
  const fx = faixa(sc, ctx.cfg);
  const base = A.buildSummary({
    client: { name: ctx.cliente },
    ownerName: ctx.responsavel,
    analystName: ctx.analista,
    date: ctx.data,
    diag: paraArtefato(d),
    cfg: ctx.cfg,
    nextReview: ctx.proximaRevisao,
  } as never) as { text: string; pos: string[]; probs: string[]; opps: string[] };
  const recs = recomendacoes(d, ctx.cfg);
  const pi = pendencias(d, ctx.cfg);
  const idx =
    sc.score == null
      ? "indisponível (poucos itens analisados)"
      : `${sc.score}/100${fx ? ` — ${fx.l}` : ""}${sc.preliminary ? " (preliminar)" : ""}`;
  const cenario = (base.text.split("RESUMO DO CENÁRIO ATUAL\n")[1] ?? "").split("\n")[0] ?? "";
  // Indicadores: apenas os efetivamente preenchidos, no período da metodologia do ciclo.
  const indicadores: string[] = [];
  if (ehV2(d)) {
    const m = d.metrics?.m60 ?? {};
    for (const x of METRICAS_V2) {
      const v = m[x.k];
      if (v === "" || v == null) continue;
      const fmt =
        x.tipo === "d"
          ? dataBRr(String(v))
          : x.tipo === "p"
            ? `${String(v).replace(".", ",")}%`
            : String(v).replace(".", ",");
      indicadores.push(
        `${x.rotulo.replace(" (%)", "")}${x.grupo === "periodo" ? " (últimos 60 dias)" : " (situação atual)"}: ${fmt}`,
      );
    }
  } else {
    const m = d.metrics?.m30 ?? {};
    for (const [k, rot, tipo] of A.METRICS as [string, string, string][]) {
      const v = m[k];
      if (v === "" || v == null) continue;
      indicadores.push(
        `${rot.replace(" (%)", "")} (30 dias): ${tipo === "p" ? `${v}%` : tipo === "d" ? dataBRr(String(v)) : v}`,
      );
    }
  }
  const porPrio = (["critica", "alta", "media", "baixa"] as Prioridade[]).flatMap((p) =>
    recs
      .filter((r) => r.priority === p)
      .slice(0, p === "baixa" ? 2 : 5)
      .map((r) => `[${PRIO_ROT[p]}] ${r.action}`),
  );
  const plano = ctx.plano
    .filter((a) => !["implementado", "nao_aprovado"].includes(a.status))
    .slice(0, 10)
    .map(
      (a) =>
        `[${PRIO_ROT[a.prioridade]}] ${a.acao} — responsável: ${a.responsavel || "a definir"}; prazo: ${a.prazo ? dataBRr(a.prazo) : "a definir"}`,
    );
  const pend = [
    ...pi.names.slice(0, 12),
    ...(pi.names.length > 12 ? [`e mais ${pi.names.length - 12} item(ns)`] : []),
    ...(pi.miss as string[]).map((m) => "Indicador não preenchido: " + m),
  ];
  const proximos = [
    "Apresentar o diagnóstico ao cliente e alinhar as prioridades.",
    "Acompanhar a implementação das ações do plano.",
    pi.n ? "Complementar as informações pendentes na próxima revisão." : "",
    ctx.proximaRevisao ? `Próxima revisão prevista para ${dataBRr(ctx.proximaRevisao)}.` : "",
  ].filter(Boolean);
  const secoes = [
    {
      titulo: "IDENTIFICAÇÃO",
      linhas: [
        `Cliente: ${ctx.cliente}`,
        `Responsável de CS: ${ctx.responsavel || "—"}`,
        `Analista responsável: ${ctx.analista || "—"}`,
        `Data da análise: ${dataBRr(ctx.data)}`,
        `Ciclo do diagnóstico: ${ctx.ciclo}`,
        `Índice de aproveitamento: ${idx}`,
        `Percentual analisado: ${sc.completion}%`,
      ],
    },
    { titulo: "RESUMO DO CENÁRIO ATUAL", linhas: [cenario || "—"] },
    { titulo: "PONTOS POSITIVOS", linhas: base.pos },
    { titulo: "PROBLEMAS IDENTIFICADOS", linhas: base.probs },
    { titulo: "OPORTUNIDADES DE MELHORIA", linhas: base.opps },
    { titulo: "INDICADORES DE DESEMPENHO", linhas: indicadores },
    { titulo: "RECOMENDAÇÕES PRIORITÁRIAS", linhas: porPrio },
    { titulo: "PLANO DE AÇÃO", linhas: plano },
    { titulo: "INFORMAÇÕES PENDENTES", linhas: pend },
    { titulo: "PRÓXIMOS PASSOS", linhas: proximos },
  ];
  const texto = secoes
    .map((s, i) =>
      [
        s.titulo,
        ...(s.linhas.length
          ? s.linhas.map((l) => (i === 0 || s.titulo === "RESUMO DO CENÁRIO ATUAL" ? l : "• " + l))
          : ["• Nenhum item registrado nesta análise."]),
      ].join("\n"),
    )
    .join("\n\n");
  return { texto, secoes };
}
