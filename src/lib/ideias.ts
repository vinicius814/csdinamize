// Pontuação de ideias/projetos a partir das tags "potencial:x", "impacto:n", "esforco:n", "status:x".
// Compartilhado entre o cérebro (servidor) e a tela Início.

export function lerTag(tags: string[] | null | undefined, chave: string) {
  return (tags ?? []).find((t) => t.startsWith(chave + ":"))?.slice(chave.length + 1) ?? null;
}

/** 0 a 100: impacto pesa mais, esforço reduz, potencial dá bônus; descartadas/concluídas zeram. */
export function pontuacao(tags: string[] | null | undefined) {
  const status = lerTag(tags, "status");
  if (status === "descartado" || status === "concluido") return 0;
  const imp = Number(lerTag(tags, "impacto")) || 3;
  const esf = Number(lerTag(tags, "esforco")) || 3;
  const bonus = { alto: 15, medio: 5, baixo: 0 }[lerTag(tags, "potencial") ?? "medio"] ?? 5;
  return Math.max(0, Math.min(100, Math.round(imp * 15 - esf * 5 + bonus + 10)));
}
