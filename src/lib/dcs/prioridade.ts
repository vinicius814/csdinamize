/**
 * Prioridade operacional (D38) — "por que este cliente precisa de atenção agora".
 *
 * Regras:
 * - É separada do índice de aproveitamento (que mede uso da plataforma, não risco nem cancelamento).
 * - Cada ponto vem de um motivo explícito e verificável; não há pontuação opaca.
 * - Valor comercial NUNCA entra nos pontos nem nos motivos. Só pode desempatar, e apenas quando o usuário já
 *   enxerga o valor (a RLS devolve mrr nulo para quem não tem permissão financeira), então a ordem não revela valores.
 * - Pesos configuráveis em Configurações (cfg.prioridade); ausentes → padrão abaixo.
 */
import type { DcsUtilizacao } from "./db";
import type { LinhaCarteira } from "./dados";
import { acompanhamento, diasEntre } from "./semuso";

export type CodigoMotivo =
  | "uso_vencido"
  | "acao_critica"
  | "acao_atrasada"
  | "contato_critico"
  | "contato_pendente"
  | "revisao_vencida"
  | "analise_parada"
  | "ganho_rapido"
  | "sem_diagnostico"
  | "sem_registro_contato";

export const PESOS_PADRAO: Record<CodigoMotivo, number> = {
  uso_vencido: 30,
  acao_critica: 25,
  contato_critico: 20,
  acao_atrasada: 15,
  revisao_vencida: 15,
  analise_parada: 10,
  contato_pendente: 10,
  sem_registro_contato: 8,
  ganho_rapido: 5,
  sem_diagnostico: 5,
};
export const ROTULO_MOTIVO: Record<CodigoMotivo, string> = {
  uso_vencido: "Conta sem utilização com revisão vencida",
  acao_critica: "Ações críticas aguardando implementação",
  acao_atrasada: "Ações do plano com prazo vencido",
  contato_critico: "Sem contato efetivo além do limite",
  contato_pendente: "Contato efetivo perto do limite",
  revisao_vencida: "Revisão do diagnóstico vencida",
  analise_parada: "Análise parada",
  ganho_rapido: "Oportunidades de baixa complexidade em aberto",
  sem_diagnostico: "Cliente ainda não analisado",
  sem_registro_contato: "Nenhum contato efetivo registrado",
};
/** Próxima ação sugerida para o motivo principal (o analista decide). */
export const PROXIMA_ACAO: Record<CodigoMotivo, string> = {
  uso_vencido: "Revisar a utilização e registrar a tentativa de retomada",
  acao_critica: "Tratar as ações críticas do plano",
  acao_atrasada: "Atualizar prazos ou status das ações atrasadas",
  contato_critico: "Fazer contato efetivo com o cliente",
  contato_pendente: "Agendar contato efetivo",
  revisao_vencida: "Iniciar a revisão do diagnóstico",
  analise_parada: "Retomar a análise",
  ganho_rapido: "Propor os ganhos rápidos ao cliente",
  sem_diagnostico: "Iniciar o primeiro diagnóstico",
  sem_registro_contato: "Registrar o primeiro contato efetivo",
};
/** Aba/visão que resolve o motivo. */
export const DESTINO: Record<CodigoMotivo, "diagnostico" | "plano" | "cobertura" | "utilizacao"> = {
  uso_vencido: "utilizacao",
  acao_critica: "plano",
  acao_atrasada: "plano",
  contato_critico: "cobertura",
  contato_pendente: "cobertura",
  sem_registro_contato: "cobertura",
  revisao_vencida: "diagnostico",
  analise_parada: "diagnostico",
  ganho_rapido: "plano",
  sem_diagnostico: "diagnostico",
};

export type Motivo = { codigo: CodigoMotivo; texto: string; peso: number };
export type Prioridade = {
  pontos: number;
  nivel: "alta" | "media" | "baixa" | "nenhuma";
  motivos: Motivo[];
  proxima: { texto: string; destino: (typeof DESTINO)[CodigoMotivo] } | null;
};

const br = (iso: string | null | undefined) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "—";

export function prioridadeCliente(
  l: LinhaCarteira,
  uso: DcsUtilizacao | undefined,
  hoje: string,
  pesos: Partial<Record<CodigoMotivo, number>> = {},
  diasParada = 5,
): Prioridade {
  const P = { ...PESOS_PADRAO, ...pesos };
  const m: Motivo[] = [];
  const add = (codigo: CodigoMotivo, texto: string) => {
    if ((P[codigo] ?? 0) > 0) m.push({ codigo, texto, peso: P[codigo] });
  };
  const semUso = uso?.status === "sem_uso";
  if (semUso) {
    if (acompanhamento(uso, hoje) === "revisao_vencida")
      add(
        "uso_vencido",
        `Revisão prevista para ${br(uso.proxima_revisao)}${uso.motivo ? ` · ${uso.motivo}` : ""}`,
      );
  } else {
    const d = l.diag;
    if (!d) add("sem_diagnostico", "Nenhum diagnóstico registrado");
    else if (d.status === "em_analise") {
      const parada = diasEntre(d.salvo_em ?? d.iniciado_em, hoje) ?? 0;
      if (parada >= diasParada) add("analise_parada", `Último salvamento há ${parada} dias`);
    } else if (d.proxima_revisao && d.proxima_revisao < hoje)
      add("revisao_vencida", `Prevista para ${br(d.proxima_revisao)}`);
  }
  if (l.acoesCriticas > 0) add("acao_critica", `${l.acoesCriticas} ação(ões) crítica(s) em aberto`);
  if (l.acoesAtrasadas > 0) add("acao_atrasada", `${l.acoesAtrasadas} ação(ões) com prazo vencido`);
  if (l.ganhosRapidos > 0 && !semUso)
    add("ganho_rapido", `${l.ganhosRapidos} ganho(s) rápido(s) em aberto`);
  const cb = l.cobStatus;
  if (cb.k === "critico") add("contato_critico", `Último contato efetivo há ${cb.dias} dias`);
  else if (cb.k === "pendente")
    add("contato_pendente", `Último contato efetivo há ${cb.dias} dias`);
  else if (cb.k === "sem_registro")
    add("sem_registro_contato", "Campo de contato efetivo vazio no Pipedrive");
  // "indisp" (cobertura sem sincronização recente) não gera motivo: falta de dado não é falta de contato.

  m.sort((a, b) => b.peso - a.peso);
  const pontos = m.reduce((s, x) => s + x.peso, 0);
  const nivel = pontos >= 40 ? "alta" : pontos >= 20 ? "media" : pontos > 0 ? "baixa" : "nenhuma";
  const topo = m[0];
  return {
    pontos,
    nivel,
    motivos: m,
    proxima: topo ? { texto: PROXIMA_ACAO[topo.codigo], destino: DESTINO[topo.codigo] } : null,
  };
}

/**
 * Ordena por pontos; desempate por valor apenas se visível ao usuário (mrr nulo para quem não tem permissão),
 * depois por nome. Assim a ordem não permite inferir valores comerciais.
 */
export function ordenarPorPrioridade<T extends { pri: Prioridade; l: LinhaCarteira }>(
  xs: T[],
): T[] {
  return [...xs].sort(
    (a, b) =>
      b.pri.pontos - a.pri.pontos ||
      (b.l.mrr ?? -1) - (a.l.mrr ?? -1) ||
      a.l.c.nome.localeCompare(b.l.c.nome),
  );
}
