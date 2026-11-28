/**
 * Grade do modo Calendário em Atividades e pendências (D50, 25/11/2026). Função pura: comparação
 * de datas só como texto "AAAA-MM-DD" (nunca Date do navegador), para não depender do fuso local
 * de quem está vendo a tela — a mesma disciplina já usada no resto do Dinamize CS (hojeSP()).
 */
export type DiaCalendario<T> = { data: string; noMes: boolean; hoje: boolean; itens: T[] };

const pad2 = (n: number) => String(n).padStart(2, "0");
const paraTexto = (ano: number, mes: number, dia: number) =>
  `${ano}-${pad2(mes + 1)}-${pad2(dia)}`;

/**
 * @param itens Atividades já filtradas (responsável, etc.); as sem `data` são ignoradas aqui —
 *   quem chama decide separadamente o que fazer com elas (ex.: uma lista à parte).
 * @param anoMes "AAAA-MM" do mês a exibir.
 * @param hoje "AAAA-MM-DD" de hoje (fuso America/Sao_Paulo), para marcar o dia atual na grade.
 */
export function gradeCalendario<T extends { data: string | null }>(
  itens: readonly T[],
  anoMes: string,
  hoje: string,
): DiaCalendario<T>[] {
  const [anoStr, mesStr] = anoMes.split("-");
  const ano = Number(anoStr);
  const mes = Number(mesStr) - 1; // 0-indexado
  const primeiroDoMes = new Date(Date.UTC(ano, mes, 1));
  const ultimoDoMes = new Date(Date.UTC(ano, mes + 1, 0));
  const inicio = new Date(primeiroDoMes);
  inicio.setUTCDate(inicio.getUTCDate() - inicio.getUTCDay()); // volta até o domingo
  const fim = new Date(ultimoDoMes);
  fim.setUTCDate(fim.getUTCDate() + (6 - fim.getUTCDay())); // avança até o sábado

  const porDia = new Map<string, T[]>();
  for (const it of itens) {
    if (!it.data) continue;
    const arr = porDia.get(it.data);
    if (arr) arr.push(it);
    else porDia.set(it.data, [it]);
  }

  const dias: DiaCalendario<T>[] = [];
  for (let d = new Date(inicio); d <= fim; d.setUTCDate(d.getUTCDate() + 1)) {
    const txt = paraTexto(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    dias.push({
      data: txt,
      noMes: d.getUTCMonth() === mes,
      hoje: txt === hoje,
      itens: porDia.get(txt) ?? [],
    });
  }
  return dias;
}

export const mesAnterior = (anoMes: string): string => {
  const [a, m] = anoMes.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m! - 2, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
};
export const mesSeguinte = (anoMes: string): string => {
  const [a, m] = anoMes.split("-").map(Number);
  const d = new Date(Date.UTC(a!, m!, 1));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
};
export const NOME_MES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];
