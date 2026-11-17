/** Validação das configurações antes de publicar uma nova versão das regras (dcs_publicar_regras). */
import type { Config } from "./motor";

export function validarConfig(c: Config): string[] {
  const e: string[] = [];
  const w = Object.values(c.weights ?? {}).map(Number);
  if (w.some((x) => !Number.isFinite(x) || x < 0))
    e.push("Pesos devem ser números maiores ou iguais a zero.");
  else if (Math.round(w.reduce((s, x) => s + x, 0)) !== 100)
    e.push("A soma dos pesos das categorias deve ser 100.");
  const bands = [...(c.bands ?? [])].sort(
    (a: { min: number }, b: { min: number }) => a.min - b.min,
  ) as { min: number; max: number; l: string }[];
  if (!bands.length || bands[0]!.min !== 0 || bands[bands.length - 1]!.max !== 100)
    e.push("As faixas devem cobrir de 0 a 100.");
  for (let i = 1; i < bands.length; i++)
    if (bands[i]!.min !== bands[i - 1]!.max + 1)
      e.push(`Faixa “${bands[i]!.l}” deve começar em ${bands[i - 1]!.max + 1}.`);
  if (bands.some((b) => !b.l?.trim() || b.min > b.max))
    e.push("Toda faixa precisa de nome e de mínimo ≤ máximo.");
  const cov = c.cov ?? {};
  if (!(cov.ok > 0 && cov.ok < cov.atencao && cov.atencao < cov.pendente))
    e.push("Metas de cobertura: em dia < atenção < pendente (em dias).");
  for (const [k, rot] of [
    ["reviewDays", "Prazo de revisão"],
    ["staleDays", "Validade do diagnóstico"],
    ["minCompletion", "Completude mínima"],
  ] as const) {
    const v = Number(c[k]);
    if (!Number.isFinite(v) || v <= 0) e.push(`${rot} deve ser maior que zero.`);
  }
  if (Number(c.minCompletion) > 100 || Number(c.topBandMinCompletion) > 100)
    e.push("Percentuais de completude não podem passar de 100.");
  if (!Array.isArray(c.stages) || !c.stages.length) e.push("Informe ao menos uma etapa do funil.");
  for (const [k, v] of Object.entries(c.credit ?? {}))
    if (!(Number(v) >= 0 && Number(v) <= 1)) e.push(`Crédito de “${k}” deve estar entre 0 e 1.`);
  return e;
}
