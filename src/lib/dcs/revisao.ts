/**
 * Diagnóstico incremental (§13, D30): o novo ciclo herda as respostas do anterior; o analista confirma, altera,
 * revalida ou marca "não se aplica mais" cada item herdado, com data e usuário (guardado em meta.revisao).
 */
import type { ItemResp } from "./motor";

export type AcaoRevisao = "igual" | "revalidar" | "nao_aplica" | "alterado";
export type MarcaRevisao = { acao: AcaoRevisao; em: string; por: string | null };
export type Revisao = Record<string, MarcaRevisao>;

export const lerRevisao = (meta: Record<string, unknown> | null | undefined): Revisao =>
  (meta?.["revisao"] && typeof meta["revisao"] === "object" ? (meta["revisao"] as Revisao) : {}) ??
  {};

/** Item herdado = existia resposta no ciclo anterior. */
export const herdado = (k: string, antes: Record<string, ItemResp> | undefined) => !!antes?.[k]?.s;

/**
 * Precisa de atenção neste ciclo: ainda não analisado, marcado para revalidar, ou herdado sem confirmação nem
 * alteração. Itens já confirmados/alterados saem da lista, mesmo que tenham problema (o problema vai para o plano).
 */
export function precisaAtencao(
  k: string,
  itens: Record<string, ItemResp>,
  antes: Record<string, ItemResp> | undefined,
  rev: Revisao,
) {
  const st = itens[k]?.s ?? "nao_analisado";
  const m = rev[k];
  if (st === "nao_analisado") return true;
  if (m?.acao === "revalidar") return true;
  if (herdado(k, antes) && !m && st === antes![k]!.s) return true;
  return false;
}

export function marcar(
  rev: Revisao,
  k: string,
  acao: AcaoRevisao,
  por: string | null,
  agora = new Date().toISOString(),
): Revisao {
  return { ...rev, [k]: { acao, em: agora, por } };
}

/** Ao alterar o estado de um item herdado, registra "alterado" automaticamente (exceto se voltou ao anterior). */
export function aoAlterar(
  rev: Revisao,
  k: string,
  novo: string | undefined,
  antes: Record<string, ItemResp> | undefined,
  por: string | null,
  agora = new Date().toISOString(),
): Revisao {
  if (!herdado(k, antes)) return rev;
  if (novo && novo !== antes![k]!.s) return marcar(rev, k, "alterado", por, agora);
  if (rev[k]?.acao === "alterado") {
    const r = { ...rev };
    delete r[k];
    return r;
  }
  return rev;
}

export function resumo(
  keys: string[],
  itens: Record<string, ItemResp>,
  antes: Record<string, ItemResp> | undefined,
  rev: Revisao,
) {
  let herdados = 0,
    confirmados = 0,
    alterados = 0,
    revalidar = 0,
    atencao = 0;
  for (const k of keys) {
    if (herdado(k, antes)) herdados++;
    const a = rev[k]?.acao;
    if (a === "igual") confirmados++;
    if (a === "alterado" || a === "nao_aplica") alterados++;
    if (a === "revalidar") revalidar++;
    if (precisaAtencao(k, itens, antes, rev)) atencao++;
  }
  return { herdados, confirmados, alterados, revalidar, atencao };
}
