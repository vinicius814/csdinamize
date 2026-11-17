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
  tipo: "carteira" | "responsaveis" | "cobertura";
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
  tipo: "revisao_vencida" | "acao_atrasada" | "cobertura_critica" | "oportunidade_critica";
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

type T<R> = { Row: R; Insert: Partial<R>; Update: Partial<R>; Relationships: [] };
export type DcsDatabase = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      dcs_clientes: T<DcsCliente>;
      dcs_clientes_financeiro: T<DcsFinanceiro>;
      dcs_cobertura: T<DcsCobertura>;
      dcs_diagnosticos: T<DcsDiagnostico>;
      dcs_acoes: T<DcsAcao>;
      dcs_sync_execucoes: T<DcsSync>;
      dcs_alertas: T<DcsAlerta>;
      dcs_jobs: T<DcsJob>;
      dcs_integracao_logs: T<DcsLog>;
      dcs_membros: T<DcsMembro>;
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
