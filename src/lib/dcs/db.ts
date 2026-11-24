/**
 * Acesso tipado às tabelas e funções dcs_* (o types.ts gerado pelo Lovable ainda não as inclui).
 * Toda escrita passa por RPC SECURITY DEFINER; leitura respeita RLS (carteira, financeiro).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Diagnostico, ItemResp } from "./motor";

type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

export type DcsCliente = {
  key: string;
  org_id: number | null;
  nome: string;
  codigo: string | null;
  deal_id: number;
  deal_ids: number[];
  stage_id: number;
  owner_id: number | null;
  owner_nome: string | null;
  person_id: number | null;
  label_ids: number[];
  segmento: string;
  ativo: boolean;
  inativado_em: string | null;
  atualizado_em: string;
};
/** Negócios do funil Onboarding (pipeline_id=1), sincronizados pelo workflow 13. Ligado a dcs_clientes por org_id. */
export type DcsPipelineOnboarding = {
  key: string;
  org_id: number;
  deal_id: number;
  stage_id: number;
  owner_id: number | null;
  owner_nome: string | null;
  titulo: string | null;
  entrada_etapa_em: string | null;
  ativo: boolean;
  inativado_em: string | null;
  sync_id: string | null;
  atualizado_em: string;
};
/** Atividade aberta do Pipedrive (funil CS) ligada a um cliente. Fonte: workflow n8n #14. */
export type DcsAtividade = {
  id: number;
  cliente_key: string;
  owner_id: number | null;
  owner_nome: string | null;
  data: string | null;
  tipo: string | null;
  assunto: string | null;
  ativo: boolean;
  sync_id: string | null;
  atualizado_em: string;
};
/**
 * Negócio cancelado do funil CS (stage_id=105 "Cancelados", validado via API). Histórico —
 * nunca excluído pelo sync. Fonte: workflow n8n #15. Base da Prioridade 5.
 */
export type DcsCancelamento = {
  deal_id: number;
  key: string;
  org_id: number | null;
  owner_id: number | null;
  owner_nome: string | null;
  nome: string | null;
  codigo: string | null;
  valor: number | null;
  motivo: string | null;
  cancelado_em: string | null;
  sync_id: string | null;
  criado_em: string;
  atualizado_em: string;
};
/** Meta mensal (Prioridade 9) sobre um indicador real já calculado no produto. */
export type DcsMeta = {
  id: number;
  periodo: string;
  indicador: "cobertura_em_dia_pct" | "implementacao_pct" | "onboarding_concluido_pct";
  meta_valor: number;
  definido_por: string | null;
  atualizado_em: string;
};
export type DcsFinanceiro = {
  key: string;
  mrr: number | null;
  origem: string;
  atualizado_em: string;
};
export type RegistroAtividade = {
  id: number;
  date: string;
  type: string;
  subject: string;
  owner: number | null;
};
export type DcsCobertura = {
  key: string;
  data_contato_efetivo: string | null;
  contato_por_atividade: RegistroAtividade | null;
  ultimo_incerto: RegistroAtividade | null;
  ultima_tentativa: RegistroAtividade | null;
  proximo: RegistroAtividade | null;
  atualizado_em: string;
};
export type StatusDiag = "em_analise" | "concluido";
export type DcsDiagnostico = {
  id: string;
  cliente_key: string;
  ciclo: number;
  status: StatusDiag;
  analista_id: string;
  regras_id: string;
  itens: Record<string, ItemResp>;
  metricas: Diagnostico["metrics"] & Record<string, unknown>;
  resultados: Record<string, unknown>;
  meta: Record<string, unknown>;
  derivado: Record<string, unknown> | null;
  resumo: string | null;
  indice: number | null;
  completude: number | null;
  versao: number;
  iniciado_em: string;
  salvo_em: string;
  concluido_em: string | null;
  proxima_revisao: string | null;
};
export type StatusAcao =
  | "aguardando_contato"
  | "aguardando_cliente"
  | "aguardando_aprovacao"
  | "em_implementacao"
  | "aguardando_ativacao"
  | "implementado"
  | "nao_aprovado";
export type DcsAcao = {
  id: string;
  cliente_key: string;
  rec_id: string;
  categoria: string;
  problema: string;
  acao: string;
  beneficio: string | null;
  prioridade: "critica" | "alta" | "media" | "baixa";
  complexidade: "baixa" | "media" | "alta" | null;
  quem: "dinamize" | "cliente" | "ambos" | null;
  ganho_rapido: boolean;
  status: StatusAcao;
  responsavel: string | null;
  prazo: string | null;
  observacoes: string | null;
  manual: boolean;
  obsoleta: boolean;
  obsoleta_em: string | null;
  reincidencias: number;
  primeiro_ciclo: number;
  ultimo_ciclo: number;
  versao: number;
  atualizado_em: string;
};
export type DcsSync = {
  id: string;
  tipo: "carteira" | "responsaveis" | "cobertura" | "onboarding" | "atividades" | "cancelamentos";
  modo: string;
  status: "executando" | "sucesso" | "falha" | "parcial";
  iniciado_em: string;
  concluido_em: string | null;
  lidos: number | null;
  criados: number | null;
  alterados: number | null;
  inativados: number | null;
  completo: boolean | null;
  detalhes: Json;
  erro: string | null;
};
export type DcsAlerta = {
  id: number;
  tipo:
    | "revisao_vencida"
    | "acao_atrasada"
    | "cobertura_critica"
    | "oportunidade_critica"
    | "utilizacao_revisao"
    | "cancelamento_recente";
  cliente_key: string;
  referencia: string | null;
  detalhe: Record<string, unknown> | null;
  gerado_em: string;
};
export type DcsJob = {
  id: string;
  tipo: string;
  chave: string;
  status: string;
  tentativas: number;
  erro: string | null;
  resultado: Json;
  criado_em: string;
  atualizado_em: string;
};
export type DcsLog = {
  id: number;
  em: string;
  origem: string;
  nivel: "info" | "aviso" | "erro";
  mensagem: string;
};
export type DcsMembro = {
  user_id: string;
  perfil: "admin" | "cs" | "contas";
  financeiro: boolean;
  ativo: boolean;
  carteiras: number[];
  clientes: string[];
  modulos: string[] | null;
  pipedrive_user_id: number | null;
};
export type DcsSolicitacao = {
  id: string;
  tipo: "carteira" | "cobertura" | "responsaveis";
  status: "pendente" | "em_execucao" | "concluida" | "falha";
  solicitado_por: string | null;
  solicitado_em: string;
  atendido_em: string | null;
  erro: string | null;
};
export type DcsUsuario = {
  user_id: string;
  nome: string | null;
  email: string | null;
  status: string;
  papel: "user" | "admin" | "superadmin";
  ultimo_acesso: string | null;
  perfil: "admin" | "cs" | "contas" | null;
  financeiro: boolean;
  pode_editar: boolean;
  pode_exportar: boolean;
  ativo: boolean;
  carteiras: number[];
  clientes: string[];
  modulos: string[] | null;
  pipedrive_user_id: number | null;
  master_principal: boolean;
  permissoes?: Record<string, boolean>;
  troca_senha?: boolean;
  provisoria_expira_em?: string | null;
  convidado_por?: string | null;
  criado_em?: string | null;
};
export type DcsPreCadastro = {
  email: string;
  nome: string | null;
  perfil: "admin" | "cs" | "contas";
  financeiro: boolean;
  pode_editar: boolean;
  pode_exportar: boolean;
  ativo: boolean;
  carteiras: number[];
  clientes: string[];
  pipedrive_user_id: number | null;
  criado_por: string | null;
  criado_em: string;
  atualizado_em: string;
  convite_enviado_em: string | null;
  aplicado_em: string | null;
  aplicado_user: string | null;
  revogado_em: string | null;
  permissoes?: Record<string, boolean>;
  modulos?: string[] | null;
  expira_em?: string | null;
  metodo?: "google" | "email" | "senha";
  revogado_por?: string | null;
};
export type StatusUtilizacao = "nao_verificado" | "em_uso" | "sem_uso";
export type Acompanhamento = "aguardando" | "em_dia" | "retomada_em_andamento" | "retomada";
export type DcsUtilizacao = {
  cliente_key: string;
  status: StatusUtilizacao;
  acompanhamento: Acompanhamento | null;
  sem_uso_desde: string | null;
  ultima_utilizacao: string | null;
  ultima_desconhecida: boolean;
  motivo: string | null;
  observacoes: string | null;
  evidencias: string | null;
  acao_retomada: string | null;
  responsavel_id: string | null;
  proxima_revisao: string | null;
  intervalo_dias: number | null;
  ultimo_acompanhamento: string | null;
  recuperado_em: string | null;
  atualizado_em: string;
  atualizado_por: string | null;
  versao: number;
};
export type DcsUtilizacaoEvento = {
  id: number;
  cliente_key: string;
  em: string;
  ator: string | null;
  tipo: "marcar" | "revisar" | "em_uso" | "editar";
  resultado: "continua" | "parcial" | "retomou" | "nao_validado" | null;
  dados: Json;
};
export type StatusRegistro = {
  status:
    | "sem_registro"
    | "aguardando_autorizacao"
    | "pendente"
    | "processando"
    | "concluido"
    | "falha"
    | "ambiguo";
  tentativas?: number;
  erro?: string | null;
  atualizado_em?: string;
  activity_id?: number | null;
  deal_id?: number | null;
  escrita_ativa?: boolean;
};
export type MeuAcesso = {
  perfil: "admin" | "cs" | "contas" | null;
  master: boolean;
  financeiro: boolean;
  editar: boolean;
  exportar: boolean;
  modulos: string[] | null;
  pipedrive?: number | null;
  troca_senha?: boolean;
  beta?: boolean;
  permissoes?: Record<string, boolean>;
};

type T<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };
export type DcsDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      dcs_clientes: T<DcsCliente>;
      dcs_pipeline_onboarding: T<DcsPipelineOnboarding>;
      dcs_atividades: T<DcsAtividade>;
      dcs_cancelamentos: T<DcsCancelamento>;
      dcs_metas: T<DcsMeta>;
      dcs_clientes_financeiro: T<DcsFinanceiro>;
      dcs_cobertura: T<DcsCobertura>;
      dcs_diagnosticos: T<DcsDiagnostico>;
      dcs_acoes: T<DcsAcao>;
      dcs_sync_execucoes: T<DcsSync>;
      dcs_alertas: T<DcsAlerta>;
      dcs_jobs: T<DcsJob>;
      dcs_integracao_logs: T<DcsLog>;
      dcs_membros: T<DcsMembro>;
      dcs_solicitacoes_sync: T<DcsSolicitacao>;
      dcs_tipos_atividade: T<{
        chave: string;
        nome: string | null;
        ocorrencias: number;
        visto_em: string;
      }>;
      dcs_acoes_eventos: T<{
        id: number;
        acao_id: string;
        em: string;
        ator: string | null;
        tipo: string;
        dados: Json;
      }>;
      dcs_auditoria: T<{
        id: number;
        em: string;
        ator: string | null;
        entidade: string;
        entidade_id: string | null;
        acao: string;
        dados: Json;
      }>;
      dcs_responsaveis: T<{
        pipedrive_user_id: number;
        nome: string;
        ativo: boolean;
        visto_em: string;
      }>;
      dcs_regras: T<{
        id: string;
        versao: string;
        config: Json;
        metodologia: string;
        ativa: boolean;
        criado_por: string | null;
        criado_em: string;
      }>;
      dcs_mensagens: T<{
        id: string;
        diagnostico_id: string;
        canal: "whatsapp" | "email";
        assunto: string | null;
        texto: string;
        origem: "template" | "ia" | "editado";
        criado_em: string;
      }>;
      dcs_pre_cadastros: T<DcsPreCadastro>;
      dcs_utilizacao: T<DcsUtilizacao>;
      dcs_utilizacao_eventos: T<DcsUtilizacaoEvento>;
      dcs_diagnosticos_eventos: T<{
        id: number;
        diagnostico_id: string;
        em: string;
        ator: string | null;
        tipo: string;
        dados: Json;
      }>;
    };
    Views: Record<string, never>;
    Functions: {
      dcs_perfil: { Args: Record<string, never>; Returns: string | null };
      dcs_ve_financeiro: { Args: Record<string, never>; Returns: boolean };
      dcs_meu_acesso: { Args: Record<string, never>; Returns: MeuAcesso };
      dcs_analistas: { Args: Record<string, never>; Returns: { user_id: string; nome: string }[] };
      dcs_listar_usuarios: { Args: Record<string, never>; Returns: DcsUsuario[] };
      dcs_salvar_permissoes: {
        Args: {
          p_user: string;
          p_perfil: string;
          p_financeiro: boolean;
          p_editar: boolean;
          p_exportar: boolean;
          p_ativo: boolean;
          p_carteiras: number[];
          p_clientes: string[];
          p_modulos: string[] | null;
        };
        Returns: undefined;
      };
      dcs_solicitar_sync: { Args: { p_tipo: string }; Returns: string };
      dcs_salvar_usuario: {
        Args: {
          p_email: string;
          p_nome: string | null;
          p_perfil: string;
          p_financeiro: boolean;
          p_editar: boolean;
          p_exportar: boolean;
          p_ativo: boolean;
          p_carteiras: number[];
          p_clientes: string[];
          p_pipedrive: number | null;
        };
        Returns: { modo: "aplicado" | "pre_cadastro"; user_id?: string; email?: string };
      };
      dcs_revogar_pre_cadastro: { Args: { p_email: string }; Returns: undefined };
      dcs_registrar_convite: { Args: { p_email: string }; Returns: undefined };
      dcs_reivindicar_acesso: { Args: Record<string, never>; Returns: boolean };
      dcs_transferir_master: { Args: { p_novo: string }; Returns: undefined };
      dcs_status_registro: { Args: { p_diag: string }; Returns: StatusRegistro | null };
      dcs_reprocessar_registro: { Args: { p_diag: string }; Returns: string };
      dcs_definir_escrita_pipedrive: { Args: { p_ativa: boolean }; Returns: undefined };
      dcs_marcar_sem_utilizacao: {
        Args: {
          p_key: string;
          p_ultima: string | null;
          p_desconhecida: boolean;
          p_motivo: string;
          p_obs: string | null;
          p_evidencias: string | null;
          p_responsavel: string | null;
          p_proxima: string;
          p_acao: string | null;
          p_intervalo: number | null;
        };
        Returns: undefined;
      };
      dcs_revisar_utilizacao: {
        Args: {
          p_key: string;
          p_resultado: string;
          p_ultima: string | null;
          p_obs: string | null;
          p_proxima: string | null;
        };
        Returns: undefined;
      };
      dcs_confirmar_utilizacao: {
        Args: { p_key: string; p_obs: string | null };
        Returns: undefined;
      };
      dcs_atribuir_analise: { Args: { p_key: string; p_para: string }; Returns: DcsDiagnostico };
      dcs_transferir_analise: {
        Args: { p_id: string; p_para: string; p_motivo: string };
        Returns: undefined;
      };
      dcs_criar_acao: {
        Args: {
          p_key: string;
          p_categoria: string;
          p_problema: string;
          p_acao: string;
          p_prioridade: string;
          p_complexidade: string | null;
          p_responsavel: string | null;
          p_prazo: string | null;
          p_ganho_rapido: boolean;
        };
        Returns: string;
      };
      dcs_publicar_regras: { Args: { p_config: Json; p_metodologia: string }; Returns: string };
      dcs_responsaveis_admin: {
        Args: Record<string, never>;
        Returns: {
          pipedrive_user_id: number;
          nome: string;
          email: string | null;
          ativo: boolean;
          visto_em: string;
        }[];
      };
      dcs_iniciar_analise: { Args: { p_key: string }; Returns: DcsDiagnostico };
      dcs_salvar_diagnostico: {
        Args: {
          p_id: string;
          p_versao: number;
          p_itens: Json;
          p_metricas: Json;
          p_resultados: Json;
          p_meta: Json;
          p_derivado: Json;
        };
        Returns: number;
      };
      dcs_concluir_analise: {
        Args: {
          p_id: string;
          p_versao: number;
          p_resumo: string;
          p_derivado: Json;
          p_acoes: Json;
          p_proxima_revisao: string;
          p_registrar_pipedrive: boolean;
        };
        Returns: string | null;
      };
      dcs_reabrir_analise: { Args: { p_id: string; p_motivo: string }; Returns: undefined };
      dcs_atualizar_acao: {
        Args: { p_id: string; p_versao: number; p_campos: Json };
        Returns: number;
      };
      dcs_definir_meta: {
        Args: { p_periodo: string; p_indicador: string; p_valor: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Cliente com os tipos do Dinamize CS; mesma sessão/autenticação do app. */
export const dcs = supabase as unknown as SupabaseClient<DcsDatabase>;

/** Converte erros do PostgREST/RPC em mensagens para a interface. */
export function mensagemErro(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === "40001")
    return "Outra pessoa salvou esta análise antes. Recarregue para ver a versão mais recente.";
  if (err?.code === "42501") return "Você não tem permissão para esta operação.";
  return err?.message || "Erro inesperado.";
}
export const ehConflito = (e: unknown) => (e as { code?: string } | null)?.code === "40001";
