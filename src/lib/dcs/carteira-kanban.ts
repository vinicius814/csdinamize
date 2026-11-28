/**
 * Agrupamento da Carteira em modo Kanban (D46, 25/11/2026). Função pura: recebe as mesmas linhas
 * já filtradas/ordenadas pela tela e as separa por status de análise — nenhuma consulta nova,
 * nenhuma mudança de permissão. O modo Lista continua sendo o padrão.
 */
import type { LinhaCarteira, StatusAnalise } from "./dados";

export const COLUNAS_KANBAN_CARTEIRA: { id: StatusAnalise; rotulo: string }[] = [
  { id: "aguardando", rotulo: "Aguardando" },
  { id: "em_andamento", rotulo: "Em andamento" },
  { id: "concluido", rotulo: "Concluído" },
  { id: "concluido_pendencias", rotulo: "Concluído com pendências" },
];

export function agruparPorStatus(
  linhas: LinhaCarteira[],
): Record<StatusAnalise, LinhaCarteira[]> {
  const out: Record<StatusAnalise, LinhaCarteira[]> = {
    aguardando: [],
    em_andamento: [],
    concluido: [],
    concluido_pendencias: [],
  };
  for (const l of linhas) out[l.status].push(l);
  return out;
}
