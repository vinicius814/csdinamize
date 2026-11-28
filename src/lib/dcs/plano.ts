/**
 * Agrupamento visual do Plano de ação por causa raiz (D52, Incremento 3 — UX da tela de diagnóstico).
 * Pura e testável; a interface só apresenta. Não altera nenhuma regra do motor: agrupa pelo campo
 * `categoria` que cada ação já carrega desde que foi gerada a partir de uma recomendação do diagnóstico.
 */
import type { DcsAcao } from "./db";

export type GrupoAcoes = { id: string; nome: string | null; itens: DcsAcao[] };

/**
 * Agrupa a lista de ações pela categoria do diagnóstico (ordem das categorias da metodologia).
 * Ações cuja categoria não é reconhecida (ex.: dado legado ou ação manual com categoria vazia) caem em
 * "Outros", sempre por último. Quando `agrupar` é falso, devolve um único grupo sem nome (lista plana),
 * preservando a ordem original.
 */
export function agruparPorCausaRaiz(
  acoes: DcsAcao[],
  cats: { id: string; name: string }[],
  agrupar: boolean,
): GrupoAcoes[] {
  if (!agrupar) return [{ id: "", nome: null, itens: acoes }];
  const nomePorCat = new Map(cats.map((c) => [c.id, c.name]));
  const porCat = new Map<string, DcsAcao[]>();
  for (const a of acoes) {
    const chave = nomePorCat.has(a.categoria) ? a.categoria : "outros";
    porCat.set(chave, [...(porCat.get(chave) ?? []), a]);
  }
  const ordem = [...cats.map((c) => c.id), "outros"];
  return ordem
    .filter((id) => porCat.has(id))
    .map((id) => ({ id, nome: nomePorCat.get(id) ?? "Outros", itens: porCat.get(id)! }));
}
