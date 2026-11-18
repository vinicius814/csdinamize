/**
 * Central de trabalho do analista (§14, D31): uma fila única, ordenada por urgência, em vez de listas soltas.
 * Pura e testável; a interface só apresenta.
 */
import type { DcsUtilizacao } from "./db";
import type { LinhaCarteira } from "./dados";
import { acompanhamento, diasEntre } from "./semuso";

export type TipoTarefa =
  | "uso_vencido"
  | "analise_parada"
  | "revisao_vencida"
  | "analise_andamento"
  | "uso_proximo"
  | "pendencias"
  | "aguardando";
export const ROTULO_TAREFA: Record<TipoTarefa, string> = {
  uso_vencido: "Revisar conta sem utilização",
  analise_parada: "Retomar análise parada",
  revisao_vencida: "Revisão do diagnóstico vencida",
  analise_andamento: "Continuar análise",
  uso_proximo: "Revisão de conta sem utilização em breve",
  pendencias: "Concluir pendências",
  aguardando: "Iniciar primeira análise",
};
const PESO: Record<TipoTarefa, number> = {
  uso_vencido: 1,
  analise_parada: 2,
  revisao_vencida: 3,
  analise_andamento: 4,
  uso_proximo: 5,
  pendencias: 6,
  aguardando: 7,
};
const br = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";
export type Tarefa = {
  tipo: TipoTarefa;
  key: string;
  nome: string;
  mrr: number | null;
  detalhe: string;
  dias: number | null;
};

export function filaTrabalho(
  linhas: LinhaCarteira[],
  uso: Map<string, DcsUtilizacao>,
  eu: string | null | undefined,
  meuPipedrive: number | null | undefined,
  hoje: string,
  diasParada = 5,
): Tarefa[] {
  const out: Tarefa[] = [];
  for (const l of linhas) {
    if (!l.c.ativo) continue;
    const u = uso.get(l.c.key);
    const d = l.diag;
    const base = { key: l.c.key, nome: l.c.nome, mrr: l.mrr };
    const meu = !!eu && d?.analista_id === eu;
    const minhaCarteira = meuPipedrive != null && l.c.owner_id === meuPipedrive;
    if (
      u?.status === "sem_uso" &&
      (u.responsavel_id === eu || (!u.responsavel_id && minhaCarteira))
    ) {
      const ac = acompanhamento(u, hoje);
      const ate = diasEntre(hoje, u.proxima_revisao ?? hoje);
      if (ac === "revisao_vencida")
        out.push({
          ...base,
          tipo: "uso_vencido",
          detalhe: `Revisão prevista para ${br(u.proxima_revisao)} · ${u.motivo ?? ""}`,
          dias: -(ate ?? 0),
        });
      else if (ate != null && ate <= 7)
        out.push({
          ...base,
          tipo: "uso_proximo",
          detalhe: `Revisão em ${ate} dia(s) · ${u.motivo ?? ""}`,
          dias: ate,
        });
      continue; // diagnóstico dispensado enquanto sem utilização
    }
    if (meu && d?.status === "em_analise") {
      const parada = diasEntre(d.salvo_em ?? d.iniciado_em, hoje) ?? 0;
      out.push({
        ...base,
        tipo: parada >= diasParada ? "analise_parada" : "analise_andamento",
        detalhe: `${d.completude ?? 0}% analisado · último salvamento há ${parada} dia(s)`,
        dias: parada,
      });
      continue;
    }
    if (meu && d?.status === "concluido") {
      if (d.proxima_revisao && d.proxima_revisao < hoje) {
        out.push({
          ...base,
          tipo: "revisao_vencida",
          detalhe: `Revisão prevista para ${br(d.proxima_revisao)}`,
          dias: diasEntre(d.proxima_revisao, hoje),
        });
        continue;
      }
      if (l.status === "concluido_pendencias") {
        out.push({
          ...base,
          tipo: "pendencias",
          detalhe: "Concluída com informações pendentes",
          dias: null,
        });
        continue;
      }
    }
    if (!d && minhaCarteira)
      out.push({ ...base, tipo: "aguardando", detalhe: "Sem diagnóstico", dias: null });
  }
  return out.sort(
    (a, b) =>
      PESO[a.tipo] - PESO[b.tipo] ||
      (b.dias ?? 0) - (a.dias ?? 0) ||
      (b.mrr ?? -1) - (a.mrr ?? -1) ||
      a.nome.localeCompare(b.nome),
  );
}

/** Próximo cliente elegível depois de concluir: mesma carteira, sem diagnóstico, ativo e não marcado sem utilização. */
export function proximoElegivel(
  linhas: LinhaCarteira[],
  uso: Map<string, DcsUtilizacao>,
  atual: string,
  ownerId: number | null,
) {
  return (
    linhas
      .filter(
        (l) =>
          l.c.ativo &&
          l.c.key !== atual &&
          l.status === "aguardando" &&
          uso.get(l.c.key)?.status !== "sem_uso",
      )
      .sort(
        (a, b) =>
          Number(b.c.owner_id === ownerId) - Number(a.c.owner_id === ownerId) ||
          (b.mrr ?? -1) - (a.mrr ?? -1) ||
          a.c.nome.localeCompare(b.c.nome),
      )[0] ?? null
  );
}
