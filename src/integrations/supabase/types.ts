export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_access: {
        Row: {
          atualizado_em: string
          created_at: string
          last_access_at: string | null
          status: string
          terms_accepted_at: string | null
          terms_version: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          last_access_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          last_access_at?: string | null
          status?: string
          terms_accepted_at?: string | null
          terms_version?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      acoes: {
        Row: {
          created_at: string
          decidido_em: string | null
          id: string
          parametros: Json
          resultado: Json | null
          resumo: string | null
          status: Database["public"]["Enums"]["status_acao"]
          telegram_message_id: number | null
          tipo: Database["public"]["Enums"]["tipo_acao"]
          user_id: string
        }
        Insert: {
          created_at?: string
          decidido_em?: string | null
          id?: string
          parametros?: Json
          resultado?: Json | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["status_acao"]
          telegram_message_id?: number | null
          tipo: Database["public"]["Enums"]["tipo_acao"]
          user_id: string
        }
        Update: {
          created_at?: string
          decidido_em?: string | null
          id?: string
          parametros?: Json
          resultado?: Json | null
          resumo?: string | null
          status?: Database["public"]["Enums"]["status_acao"]
          telegram_message_id?: number | null
          tipo?: Database["public"]["Enums"]["tipo_acao"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "acoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_settings: {
        Row: {
          atualizado_em: string
          created_at: string
          id: boolean
          manual_approval: boolean
          updated_at: string
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          id?: boolean
          manual_approval?: boolean
          updated_at?: string
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          id?: boolean
          manual_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_user_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          atualizado_em: string
          cor: string
          created_at: string
          icone: string
          id: string
          nome: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          cor?: string
          created_at?: string
          icone?: string
          id?: string
          nome?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string
          atualizado_em: string
          created_at: string
          details: Json
          id: string
          target_id: string | null
          updated_at: string
        }
        Insert: {
          action: string
          actor_id: string
          atualizado_em?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          updated_at?: string
        }
        Update: {
          action?: string
          actor_id?: string
          atualizado_em?: string
          created_at?: string
          details?: Json
          id?: string
          target_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      briefings: {
        Row: {
          conteudo_md: string
          enviado_em: string
          id: string
          tipo: Database["public"]["Enums"]["tipo_briefing"]
          user_id: string
        }
        Insert: {
          conteudo_md?: string
          enviado_em?: string
          id?: string
          tipo: Database["public"]["Enums"]["tipo_briefing"]
          user_id: string
        }
        Update: {
          conteudo_md?: string
          enviado_em?: string
          id?: string
          tipo?: Database["public"]["Enums"]["tipo_briefing"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "briefings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clientes: {
        Row: {
          atividades_pendentes: number | null
          atualizado_em: string | null
          contato_emails: string[] | null
          contato_nome: string | null
          dominios: string[] | null
          etapa: string | null
          nome_curto: string | null
          owner_pipedrive_id: number | null
          pipedrive_deal_id: number
          pipeline_id: number | null
          proxima_atividade: string | null
          proxima_atividade_assunto: string | null
          stage_id: number | null
          status: string | null
          titulo: string | null
          ultimo_contato_efetivo: string | null
          ultimo_email_enviado: string | null
          ultimo_email_recebido: string | null
        }
        Insert: {
          atividades_pendentes?: number | null
          atualizado_em?: string | null
          contato_emails?: string[] | null
          contato_nome?: string | null
          dominios?: string[] | null
          etapa?: string | null
          nome_curto?: string | null
          owner_pipedrive_id?: number | null
          pipedrive_deal_id: number
          pipeline_id?: number | null
          proxima_atividade?: string | null
          proxima_atividade_assunto?: string | null
          stage_id?: number | null
          status?: string | null
          titulo?: string | null
          ultimo_contato_efetivo?: string | null
          ultimo_email_enviado?: string | null
          ultimo_email_recebido?: string | null
        }
        Update: {
          atividades_pendentes?: number | null
          atualizado_em?: string | null
          contato_emails?: string[] | null
          contato_nome?: string | null
          dominios?: string[] | null
          etapa?: string | null
          nome_curto?: string | null
          owner_pipedrive_id?: number | null
          pipedrive_deal_id?: number
          pipeline_id?: number | null
          proxima_atividade?: string | null
          proxima_atividade_assunto?: string | null
          stage_id?: number | null
          status?: string | null
          titulo?: string | null
          ultimo_contato_efetivo?: string | null
          ultimo_email_enviado?: string | null
          ultimo_email_recebido?: string | null
        }
        Relationships: []
      }
      cobertura_historico: {
        Row: {
          acima_120_dias: number
          cobertos: number
          cs_nome: string | null
          data: string
          id: number
          owner_pipedrive_id: number | null
          sem_uso: number
          total: number
        }
        Insert: {
          acima_120_dias?: number
          cobertos: number
          cs_nome?: string | null
          data: string
          id?: number
          owner_pipedrive_id?: number | null
          sem_uso?: number
          total: number
        }
        Update: {
          acima_120_dias?: number
          cobertos?: number
          cs_nome?: string | null
          data?: string
          id?: number
          owner_pipedrive_id?: number | null
          sem_uso?: number
          total?: number
        }
        Relationships: []
      }
      conexoes_pipedrive: {
        Row: {
          atualizado_em: string
          criado_em: string
          dominio: string
          pipedrive_user_id: number | null
          token_cifrado: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dominio: string
          pipedrive_user_id?: number | null
          token_cifrado: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dominio?: string
          pipedrive_user_id?: number | null
          token_cifrado?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conexoes_pipedrive_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      config_usuario: {
        Row: {
          atualizado_em: string
          campo_ultimo_contato: string | null
          criado_em: string
          dias_alerta: number
          limite_custo_usd: number
          onboarding_concluido: boolean
          pasta_drive_id: string | null
          pipeline_id: number | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          campo_ultimo_contato?: string | null
          criado_em?: string
          dias_alerta?: number
          limite_custo_usd?: number
          onboarding_concluido?: boolean
          pasta_drive_id?: string | null
          pipeline_id?: number | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          campo_ultimo_contato?: string | null
          criado_em?: string
          dias_alerta?: number
          limite_custo_usd?: number
          onboarding_concluido?: boolean
          pasta_drive_id?: string | null
          pipeline_id?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "config_usuario_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          area_id: string | null
          arquivada: boolean
          atualizado_em: string
          created_at: string
          fixada: boolean
          id: string
          resumo: string
          titulo: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          arquivada?: boolean
          atualizado_em?: string
          created_at?: string
          fixada?: boolean
          id?: string
          resumo?: string
          titulo?: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          arquivada?: boolean
          atualizado_em?: string
          created_at?: string
          fixada?: boolean
          id?: string
          resumo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversas_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      convites: {
        Row: {
          codigo: string
          criado_em: string
          criado_por: string | null
          email: string | null
          expira_em: string
          id: string
          usado_em: string | null
          usado_por: string | null
        }
        Insert: {
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          expira_em?: string
          id?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Update: {
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          email?: string | null
          expira_em?: string
          id?: string
          usado_em?: string | null
          usado_por?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "convites_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convites_usado_por_fkey"
            columns: ["usado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_atividades_cache: {
        Row: {
          activity_id: number
          assunto: string
          atualizado_em: string
          concluida: boolean
          created_at: string
          data_conclusao: string | null
          deal_id: number
          dia: string | null
          fim: string | null
          inicio: string | null
          owner_id: number
          pipeline_id: number
          sync_id: string
          tipo: string
        }
        Insert: {
          activity_id: number
          assunto: string
          atualizado_em?: string
          concluida: boolean
          created_at?: string
          data_conclusao?: string | null
          deal_id: number
          dia?: string | null
          fim?: string | null
          inicio?: string | null
          owner_id: number
          pipeline_id: number
          sync_id: string
          tipo: string
        }
        Update: {
          activity_id?: number
          assunto?: string
          atualizado_em?: string
          concluida?: boolean
          created_at?: string
          data_conclusao?: string | null
          deal_id?: number
          dia?: string | null
          fim?: string | null
          inicio?: string | null
          owner_id?: number
          pipeline_id?: number
          sync_id?: string
          tipo?: string
        }
        Relationships: []
      }
      cs_auditoria_eventos: {
        Row: {
          activity_id: number | null
          atualizado_em: string
          cliente: string
          created_at: string
          deal_id: number
          dia: string
          estado: string
          evento_id: string
          fonte: string
          motivo: string
          mrr_anterior: number | null
          mrr_perdido: number | null
          mrr_posterior: number | null
          negocio: string
          ocorrido_em: string
          org_id: number | null
          owner_id: number
          owner_nome: string | null
          pipeline_id: number
          status: string | null
          tipo: string
          valor_anterior: number | null
          valor_posterior: number | null
        }
        Insert: {
          activity_id?: number | null
          atualizado_em?: string
          cliente: string
          created_at?: string
          deal_id: number
          dia: string
          estado: string
          evento_id: string
          fonte: string
          motivo: string
          mrr_anterior?: number | null
          mrr_perdido?: number | null
          mrr_posterior?: number | null
          negocio: string
          ocorrido_em: string
          org_id?: number | null
          owner_id: number
          owner_nome?: string | null
          pipeline_id: number
          status?: string | null
          tipo: string
          valor_anterior?: number | null
          valor_posterior?: number | null
        }
        Update: {
          activity_id?: number | null
          atualizado_em?: string
          cliente?: string
          created_at?: string
          deal_id?: number
          dia?: string
          estado?: string
          evento_id?: string
          fonte?: string
          motivo?: string
          mrr_anterior?: number | null
          mrr_perdido?: number | null
          mrr_posterior?: number | null
          negocio?: string
          ocorrido_em?: string
          org_id?: number | null
          owner_id?: number
          owner_nome?: string | null
          pipeline_id?: number
          status?: string | null
          tipo?: string
          valor_anterior?: number | null
          valor_posterior?: number | null
        }
        Relationships: []
      }
      cs_auditoria_progresso: {
        Row: {
          ate: string
          created_at: string
          deal_id: number
          desde: string
          updated_at: string
          verificado_em: string
        }
        Insert: {
          ate: string
          created_at?: string
          deal_id: number
          desde: string
          updated_at?: string
          verificado_em?: string
        }
        Update: {
          ate?: string
          created_at?: string
          deal_id?: number
          desde?: string
          updated_at?: string
          verificado_em?: string
        }
        Relationships: []
      }
      cs_base_diaria: {
        Row: {
          atualizado_em: string
          cliente: string
          created_at: string
          dia: string
          mrr: number | null
          owner_id: number
          pipeline_id: number
        }
        Insert: {
          atualizado_em?: string
          cliente: string
          created_at?: string
          dia: string
          mrr?: number | null
          owner_id: number
          pipeline_id: number
        }
        Update: {
          atualizado_em?: string
          cliente?: string
          created_at?: string
          dia?: string
          mrr?: number | null
          owner_id?: number
          pipeline_id?: number
        }
        Relationships: []
      }
      cs_cancelamentos: {
        Row: {
          consultado_em: string
          data_origem: string | null
          deal_id: number
          dia: string
          moeda: string | null
          motivo: string | null
          org_id: number | null
          origem: string
          owner_atual: number | null
          owner_id: number
          owner_nome: string | null
          perdido_em: string | null
          pipeline_id: number
          revertido: boolean
          stage_id: number
          valor: number | null
        }
        Insert: {
          consultado_em?: string
          data_origem?: string | null
          deal_id: number
          dia: string
          moeda?: string | null
          motivo?: string | null
          org_id?: number | null
          origem?: string
          owner_atual?: number | null
          owner_id: number
          owner_nome?: string | null
          perdido_em?: string | null
          pipeline_id: number
          revertido?: boolean
          stage_id: number
          valor?: number | null
        }
        Update: {
          consultado_em?: string
          data_origem?: string | null
          deal_id?: number
          dia?: string
          moeda?: string | null
          motivo?: string | null
          org_id?: number | null
          origem?: string
          owner_atual?: number | null
          owner_id?: number
          owner_nome?: string | null
          perdido_em?: string | null
          pipeline_id?: number
          revertido?: boolean
          stage_id?: number
          valor?: number | null
        }
        Relationships: []
      }
      cs_eventos_onboarding: {
        Row: {
          atualizado_em: string
          created_at: string
          deal_id: number
          entrada_origem: string | null
          entrou_em: string | null
          etapa_saida: number | null
          org_id: number | null
          owner_id: number
          pipeline_id: number
          saiu_em: string | null
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          deal_id: number
          entrada_origem?: string | null
          entrou_em?: string | null
          etapa_saida?: number | null
          org_id?: number | null
          owner_id: number
          pipeline_id?: number
          saiu_em?: string | null
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          deal_id?: number
          entrada_origem?: string | null
          entrou_em?: string | null
          etapa_saida?: number | null
          org_id?: number | null
          owner_id?: number
          pipeline_id?: number
          saiu_em?: string | null
        }
        Relationships: []
      }
      cs_eventos_valor: {
        Row: {
          atualizado_em: string
          created_at: string
          deal_id: number
          dia: string
          origem: string
          owner_id: number
          pipeline_id: number
          valor_anterior: number
          valor_novo: number
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          deal_id: number
          dia: string
          origem?: string
          owner_id: number
          pipeline_id: number
          valor_anterior: number
          valor_novo: number
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          deal_id?: number
          dia?: string
          origem?: string
          owner_id?: number
          pipeline_id?: number
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: []
      }
      cs_historico_execucoes: {
        Row: {
          actor: string | null
          ate: string | null
          concluido_em: string | null
          consultas: number
          cursor: string | null
          desde: string | null
          erro: string | null
          id: string
          iniciado_em: string
          registros: number
          status: string
          tipo: string
        }
        Insert: {
          actor?: string | null
          ate?: string | null
          concluido_em?: string | null
          consultas?: number
          cursor?: string | null
          desde?: string | null
          erro?: string | null
          id?: string
          iniciado_em?: string
          registros?: number
          status?: string
          tipo: string
        }
        Update: {
          actor?: string | null
          ate?: string | null
          concluido_em?: string | null
          consultas?: number
          cursor?: string | null
          desde?: string | null
          erro?: string | null
          id?: string
          iniciado_em?: string
          registros?: number
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      cs_metricas_diarias: {
        Row: {
          atividades_vencidas: number
          cancelados_dia: number
          clientes_ativos: number
          cobertos_60: number | null
          cobertura_30: number | null
          cobertura_60: number | null
          cobertura_90: number | null
          created_at: string
          dia: string
          mrr: number | null
          mrr_cancelado_dia: number | null
          owner_id: number
          pipeline_id: number
          sem_contato_60: number
          sem_dados_contato: number
          updated_at: string
        }
        Insert: {
          atividades_vencidas: number
          cancelados_dia: number
          clientes_ativos: number
          cobertos_60?: number | null
          cobertura_30?: number | null
          cobertura_60?: number | null
          cobertura_90?: number | null
          created_at?: string
          dia: string
          mrr?: number | null
          mrr_cancelado_dia?: number | null
          owner_id: number
          pipeline_id: number
          sem_contato_60: number
          sem_dados_contato?: number
          updated_at?: string
        }
        Update: {
          atividades_vencidas?: number
          cancelados_dia?: number
          clientes_ativos?: number
          cobertos_60?: number | null
          cobertura_30?: number | null
          cobertura_60?: number | null
          cobertura_90?: number | null
          created_at?: string
          dia?: string
          mrr?: number | null
          mrr_cancelado_dia?: number | null
          owner_id?: number
          pipeline_id?: number
          sem_contato_60?: number
          sem_dados_contato?: number
          updated_at?: string
        }
        Relationships: []
      }
      cs_regras_risco: {
        Row: {
          analista_aguardando_dias: number
          atualizado_em: string
          atualizado_por: string | null
          considerar_sem_uso_como_risco: boolean
          created_at: string
          dias_atencao: number
          dias_risco: number
          id: boolean
          prazo_onboarding_dias: number
          prazo_por_etapa_dias: number
          retorno_pendente_dias: number
          sem_proxima_atividade_e_atencao: boolean
          vencidas_atencao: number
          vencidas_risco: number
        }
        Insert: {
          analista_aguardando_dias?: number
          atualizado_em?: string
          atualizado_por?: string | null
          considerar_sem_uso_como_risco?: boolean
          created_at?: string
          dias_atencao?: number
          dias_risco?: number
          id?: boolean
          prazo_onboarding_dias?: number
          prazo_por_etapa_dias?: number
          retorno_pendente_dias?: number
          sem_proxima_atividade_e_atencao?: boolean
          vencidas_atencao?: number
          vencidas_risco?: number
        }
        Update: {
          analista_aguardando_dias?: number
          atualizado_em?: string
          atualizado_por?: string | null
          considerar_sem_uso_como_risco?: boolean
          created_at?: string
          dias_atencao?: number
          dias_risco?: number
          id?: boolean
          prazo_onboarding_dias?: number
          prazo_por_etapa_dias?: number
          retorno_pendente_dias?: number
          sem_proxima_atividade_e_atencao?: boolean
          vencidas_atencao?: number
          vencidas_risco?: number
        }
        Relationships: []
      }
      cs_snapshot: {
        Row: {
          add_time: string | null
          atividades_abertas: number
          atividades_vencidas: number
          atualizado_em: string
          contato_dominios: string[]
          contato_efetivo: string | null
          created_at: string
          data_contratacao: string | null
          deal_id: number
          etiquetas: number[]
          org_id: number | null
          org_nome: string | null
          origem_contato: string | null
          owner_id: number
          owner_nome: string | null
          perfil_conta: string | null
          pipeline_id: number
          proxima_atividade_data: string | null
          stage_change_time: string | null
          stage_id: number
          status: string
          sync_id: string
          titulo: string
          ultima_atividade_concluida: string | null
          ultima_reuniao_cs: string | null
          ultimo_contato_efetivo: string | null
          ultimo_email_enviado: string | null
          ultimo_email_recebido: string | null
          updated_at: string
          valor: number | null
        }
        Insert: {
          add_time?: string | null
          atividades_abertas?: number
          atividades_vencidas?: number
          atualizado_em?: string
          contato_dominios?: string[]
          contato_efetivo?: string | null
          created_at?: string
          data_contratacao?: string | null
          deal_id: number
          etiquetas?: number[]
          org_id?: number | null
          org_nome?: string | null
          origem_contato?: string | null
          owner_id: number
          owner_nome?: string | null
          perfil_conta?: string | null
          pipeline_id: number
          proxima_atividade_data?: string | null
          stage_change_time?: string | null
          stage_id: number
          status: string
          sync_id: string
          titulo: string
          ultima_atividade_concluida?: string | null
          ultima_reuniao_cs?: string | null
          ultimo_contato_efetivo?: string | null
          ultimo_email_enviado?: string | null
          ultimo_email_recebido?: string | null
          updated_at?: string
          valor?: number | null
        }
        Update: {
          add_time?: string | null
          atividades_abertas?: number
          atividades_vencidas?: number
          atualizado_em?: string
          contato_dominios?: string[]
          contato_efetivo?: string | null
          created_at?: string
          data_contratacao?: string | null
          deal_id?: number
          etiquetas?: number[]
          org_id?: number | null
          org_nome?: string | null
          origem_contato?: string | null
          owner_id?: number
          owner_nome?: string | null
          perfil_conta?: string | null
          pipeline_id?: number
          proxima_atividade_data?: string | null
          stage_change_time?: string | null
          stage_id?: number
          status?: string
          sync_id?: string
          titulo?: string
          ultima_atividade_concluida?: string | null
          ultima_reuniao_cs?: string | null
          ultimo_contato_efetivo?: string | null
          ultimo_email_enviado?: string | null
          ultimo_email_recebido?: string | null
          updated_at?: string
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_snapshot_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "cs_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_sync_runs: {
        Row: {
          concluido_em: string | null
          created_at: string
          erro: string | null
          fases: Json | null
          id: string
          iniciado_em: string
          iniciado_por: string | null
          janela: string | null
          modo: string | null
          negocios_lidos: number
          origem: string
          status: string
          updated_at: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          fases?: Json | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          janela?: string | null
          modo?: string | null
          negocios_lidos?: number
          origem: string
          status: string
          updated_at?: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          fases?: Json | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          janela?: string | null
          modo?: string | null
          negocios_lidos?: number
          origem?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      cs_upgrade_fonte: {
        Row: {
          consultado_em: string
          deal_id: number
        }
        Insert: {
          consultado_em?: string
          deal_id: number
        }
        Update: {
          consultado_em?: string
          deal_id?: number
        }
        Relationships: []
      }
      dcs_acoes: {
        Row: {
          acao: string
          atualizado_em: string
          beneficio: string | null
          categoria: string
          cliente_key: string
          complexidade: string | null
          ganho_rapido: boolean
          id: string
          manual: boolean
          observacoes: string | null
          obsoleta: boolean
          obsoleta_em: string | null
          prazo: string | null
          primeiro_ciclo: number
          prioridade: string
          problema: string
          quem: string | null
          rec_id: string
          reincidencias: number
          responsavel: string | null
          status: string
          ultimo_ciclo: number
          versao: number
        }
        Insert: {
          acao: string
          atualizado_em?: string
          beneficio?: string | null
          categoria: string
          cliente_key: string
          complexidade?: string | null
          ganho_rapido?: boolean
          id?: string
          manual?: boolean
          observacoes?: string | null
          obsoleta?: boolean
          obsoleta_em?: string | null
          prazo?: string | null
          primeiro_ciclo: number
          prioridade: string
          problema: string
          quem?: string | null
          rec_id: string
          reincidencias?: number
          responsavel?: string | null
          status?: string
          ultimo_ciclo: number
          versao?: number
        }
        Update: {
          acao?: string
          atualizado_em?: string
          beneficio?: string | null
          categoria?: string
          cliente_key?: string
          complexidade?: string | null
          ganho_rapido?: boolean
          id?: string
          manual?: boolean
          observacoes?: string | null
          obsoleta?: boolean
          obsoleta_em?: string | null
          prazo?: string | null
          primeiro_ciclo?: number
          prioridade?: string
          problema?: string
          quem?: string | null
          rec_id?: string
          reincidencias?: number
          responsavel?: string | null
          status?: string
          ultimo_ciclo?: number
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "dcs_acoes_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: false
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      dcs_acoes_eventos: {
        Row: {
          acao_id: string
          ator: string | null
          dados: Json | null
          em: string
          id: number
          tipo: string
        }
        Insert: {
          acao_id: string
          ator?: string | null
          dados?: Json | null
          em?: string
          id?: never
          tipo: string
        }
        Update: {
          acao_id?: string
          ator?: string | null
          dados?: Json | null
          em?: string
          id?: never
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_acoes_eventos_acao_id_fkey"
            columns: ["acao_id"]
            isOneToOne: false
            referencedRelation: "dcs_acoes"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_alertas: {
        Row: {
          cliente_key: string
          detalhe: Json | null
          gerado_em: string
          id: number
          referencia: string | null
          tipo: string
        }
        Insert: {
          cliente_key: string
          detalhe?: Json | null
          gerado_em?: string
          id?: never
          referencia?: string | null
          tipo: string
        }
        Update: {
          cliente_key?: string
          detalhe?: Json | null
          gerado_em?: string
          id?: never
          referencia?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_alertas_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: false
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      dcs_atividades: {
        Row: {
          assunto: string | null
          ativo: boolean
          atualizado_em: string
          cliente_key: string
          data: string | null
          id: number
          owner_id: number | null
          owner_nome: string | null
          sync_id: string | null
          tipo: string | null
        }
        Insert: {
          assunto?: string | null
          ativo?: boolean
          atualizado_em?: string
          cliente_key: string
          data?: string | null
          id: number
          owner_id?: number | null
          owner_nome?: string | null
          sync_id?: string | null
          tipo?: string | null
        }
        Update: {
          assunto?: string | null
          ativo?: boolean
          atualizado_em?: string
          cliente_key?: string
          data?: string | null
          id?: number
          owner_id?: number | null
          owner_nome?: string | null
          sync_id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
      dcs_auditoria: {
        Row: {
          acao: string
          ator: string | null
          dados: Json | null
          em: string
          entidade: string
          entidade_id: string
          id: number
        }
        Insert: {
          acao: string
          ator?: string | null
          dados?: Json | null
          em?: string
          entidade: string
          entidade_id: string
          id?: never
        }
        Update: {
          acao?: string
          ator?: string | null
          dados?: Json | null
          em?: string
          entidade?: string
          entidade_id?: string
          id?: never
        }
        Relationships: []
      }
      dcs_cancelamentos: {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          codigo: string | null
          criado_em: string
          deal_id: number
          key: string
          motivo: string | null
          nome: string | null
          org_id: number | null
          owner_id: number | null
          owner_nome: string | null
          sync_id: string | null
          valor: number | null
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          codigo?: string | null
          criado_em?: string
          deal_id: number
          key: string
          motivo?: string | null
          nome?: string | null
          org_id?: number | null
          owner_id?: number | null
          owner_nome?: string | null
          sync_id?: string | null
          valor?: number | null
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          codigo?: string | null
          criado_em?: string
          deal_id?: number
          key?: string
          motivo?: string | null
          nome?: string | null
          org_id?: number | null
          owner_id?: number | null
          owner_nome?: string | null
          sync_id?: string | null
          valor?: number | null
        }
        Relationships: []
      }
      dcs_clientes: {
        Row: {
          ativo: boolean
          atualizado_em: string
          codigo: string | null
          deal_id: number
          deal_ids: number[]
          inativado_em: string | null
          key: string
          label_ids: number[]
          nome: string
          org_id: number | null
          owner_id: number | null
          owner_nome: string | null
          person_id: number | null
          segmento: string
          stage_id: number
          sync_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string | null
          deal_id: number
          deal_ids: number[]
          inativado_em?: string | null
          key: string
          label_ids?: number[]
          nome: string
          org_id?: number | null
          owner_id?: number | null
          owner_nome?: string | null
          person_id?: number | null
          segmento?: string
          stage_id: number
          sync_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          codigo?: string | null
          deal_id?: number
          deal_ids?: number[]
          inativado_em?: string | null
          key?: string
          label_ids?: number[]
          nome?: string
          org_id?: number | null
          owner_id?: number | null
          owner_nome?: string | null
          person_id?: number | null
          segmento?: string
          stage_id?: number
          sync_id?: string | null
        }
        Relationships: []
      }
      dcs_clientes_financeiro: {
        Row: {
          atualizado_em: string
          key: string
          mrr: number | null
          origem: string
        }
        Insert: {
          atualizado_em?: string
          key: string
          mrr?: number | null
          origem?: string
        }
        Update: {
          atualizado_em?: string
          key?: string
          mrr?: number | null
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_clientes_financeiro_key_fkey"
            columns: ["key"]
            isOneToOne: true
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      dcs_cobertura: {
        Row: {
          atualizado_em: string
          contato_por_atividade: Json | null
          data_contato_efetivo: string | null
          key: string
          proximo: Json | null
          sync_id: string | null
          ultima_tentativa: Json | null
          ultimo_efetivo: Json | null
          ultimo_incerto: Json | null
        }
        Insert: {
          atualizado_em?: string
          contato_por_atividade?: Json | null
          data_contato_efetivo?: string | null
          key: string
          proximo?: Json | null
          sync_id?: string | null
          ultima_tentativa?: Json | null
          ultimo_efetivo?: Json | null
          ultimo_incerto?: Json | null
        }
        Update: {
          atualizado_em?: string
          contato_por_atividade?: Json | null
          data_contato_efetivo?: string | null
          key?: string
          proximo?: Json | null
          sync_id?: string | null
          ultima_tentativa?: Json | null
          ultimo_efetivo?: Json | null
          ultimo_incerto?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "dcs_cobertura_key_fkey"
            columns: ["key"]
            isOneToOne: true
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      dcs_config: {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          valor: Json
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          valor?: Json
        }
        Relationships: []
      }
      dcs_diagnosticos: {
        Row: {
          analista_id: string
          ciclo: number
          cliente_key: string
          completude: number | null
          concluido_em: string | null
          derivado: Json | null
          id: string
          indice: number | null
          iniciado_em: string
          itens: Json
          meta: Json
          metricas: Json
          proxima_revisao: string | null
          regras_id: string
          resultados: Json
          resumo: string | null
          salvo_em: string
          status: string
          versao: number
        }
        Insert: {
          analista_id: string
          ciclo: number
          cliente_key: string
          completude?: number | null
          concluido_em?: string | null
          derivado?: Json | null
          id?: string
          indice?: number | null
          iniciado_em?: string
          itens?: Json
          meta?: Json
          metricas?: Json
          proxima_revisao?: string | null
          regras_id: string
          resultados?: Json
          resumo?: string | null
          salvo_em?: string
          status?: string
          versao?: number
        }
        Update: {
          analista_id?: string
          ciclo?: number
          cliente_key?: string
          completude?: number | null
          concluido_em?: string | null
          derivado?: Json | null
          id?: string
          indice?: number | null
          iniciado_em?: string
          itens?: Json
          meta?: Json
          metricas?: Json
          proxima_revisao?: string | null
          regras_id?: string
          resultados?: Json
          resumo?: string | null
          salvo_em?: string
          status?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "dcs_diagnosticos_analista_id_fkey"
            columns: ["analista_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dcs_diagnosticos_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: false
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "dcs_diagnosticos_regras_id_fkey"
            columns: ["regras_id"]
            isOneToOne: false
            referencedRelation: "dcs_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_diagnosticos_eventos: {
        Row: {
          ator: string | null
          dados: Json | null
          diagnostico_id: string
          em: string
          id: number
          tipo: string
        }
        Insert: {
          ator?: string | null
          dados?: Json | null
          diagnostico_id: string
          em?: string
          id?: never
          tipo: string
        }
        Update: {
          ator?: string | null
          dados?: Json | null
          diagnostico_id?: string
          em?: string
          id?: never
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_diagnosticos_eventos_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "dcs_diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_feedback: {
        Row: {
          criado_em: string
          descricao: string
          funcionalidade: string | null
          id: number
          pagina: string | null
          status: string
          tipo: string
          user_id: string
          versao: string | null
        }
        Insert: {
          criado_em?: string
          descricao: string
          funcionalidade?: string | null
          id?: never
          pagina?: string | null
          status?: string
          tipo: string
          user_id: string
          versao?: string | null
        }
        Update: {
          criado_em?: string
          descricao?: string
          funcionalidade?: string | null
          id?: never
          pagina?: string | null
          status?: string
          tipo?: string
          user_id?: string
          versao?: string | null
        }
        Relationships: []
      }
      dcs_integracao_logs: {
        Row: {
          dados: Json | null
          em: string
          id: number
          job_id: string | null
          mensagem: string
          nivel: string
          origem: string
          sync_id: string | null
        }
        Insert: {
          dados?: Json | null
          em?: string
          id?: never
          job_id?: string | null
          mensagem: string
          nivel: string
          origem: string
          sync_id?: string | null
        }
        Update: {
          dados?: Json | null
          em?: string
          id?: never
          job_id?: string | null
          mensagem?: string
          nivel?: string
          origem?: string
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dcs_integracao_logs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "dcs_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_jobs: {
        Row: {
          atualizado_em: string
          chave: string
          criado_em: string
          criado_por: string | null
          erro: string | null
          id: string
          payload: Json
          proxima_tentativa: string
          resultado: Json | null
          status: string
          tentativas: number
          tipo: string
          travado_em: string | null
        }
        Insert: {
          atualizado_em?: string
          chave: string
          criado_em?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          payload: Json
          proxima_tentativa?: string
          resultado?: Json | null
          status?: string
          tentativas?: number
          tipo: string
          travado_em?: string | null
        }
        Update: {
          atualizado_em?: string
          chave?: string
          criado_em?: string
          criado_por?: string | null
          erro?: string | null
          id?: string
          payload?: Json
          proxima_tentativa?: string
          resultado?: Json | null
          status?: string
          tentativas?: number
          tipo?: string
          travado_em?: string | null
        }
        Relationships: []
      }
      dcs_membros: {
        Row: {
          ativo: boolean
          atualizado_em: string
          carteiras: number[]
          clientes: string[]
          convidado_por: string | null
          convite_expira_em: string | null
          criado_em: string
          financeiro: boolean
          modulos: string[] | null
          perfil: string
          permissoes: Json
          pipedrive_user_id: number | null
          pode_editar: boolean
          pode_exportar: boolean
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          carteiras?: number[]
          clientes?: string[]
          convidado_por?: string | null
          convite_expira_em?: string | null
          criado_em?: string
          financeiro?: boolean
          modulos?: string[] | null
          perfil: string
          permissoes?: Json
          pipedrive_user_id?: number | null
          pode_editar?: boolean
          pode_exportar?: boolean
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          carteiras?: number[]
          clientes?: string[]
          convidado_por?: string | null
          convite_expira_em?: string | null
          criado_em?: string
          financeiro?: boolean
          modulos?: string[] | null
          perfil?: string
          permissoes?: Json
          pipedrive_user_id?: number | null
          pode_editar?: boolean
          pode_exportar?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_membros_convidado_por_fkey"
            columns: ["convidado_por"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dcs_membros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_mensagens: {
        Row: {
          assunto: string | null
          canal: string
          criado_em: string
          criado_por: string
          diagnostico_id: string
          id: string
          origem: string
          texto: string
        }
        Insert: {
          assunto?: string | null
          canal: string
          criado_em?: string
          criado_por?: string
          diagnostico_id: string
          id?: string
          origem: string
          texto: string
        }
        Update: {
          assunto?: string | null
          canal?: string
          criado_em?: string
          criado_por?: string
          diagnostico_id?: string
          id?: string
          origem?: string
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_mensagens_diagnostico_id_fkey"
            columns: ["diagnostico_id"]
            isOneToOne: false
            referencedRelation: "dcs_diagnosticos"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_metas: {
        Row: {
          atualizado_em: string
          definido_por: string | null
          id: number
          indicador: string
          meta_valor: number
          periodo: string
        }
        Insert: {
          atualizado_em?: string
          definido_por?: string | null
          id?: never
          indicador: string
          meta_valor: number
          periodo: string
        }
        Update: {
          atualizado_em?: string
          definido_por?: string | null
          id?: never
          indicador?: string
          meta_valor?: number
          periodo?: string
        }
        Relationships: []
      }
      dcs_notas_cliente: {
        Row: {
          autor_id: string
          cliente_key: string
          criado_em: string
          id: string
          job_id: string | null
          texto: string
        }
        Insert: {
          autor_id: string
          cliente_key: string
          criado_em?: string
          id?: string
          job_id?: string | null
          texto: string
        }
        Update: {
          autor_id?: string
          cliente_key?: string
          criado_em?: string
          id?: string
          job_id?: string | null
          texto?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_notas_cliente_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: false
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "dcs_notas_cliente_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "dcs_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_onboarding: {
        Row: {
          atualizado_em: string
          concluido_em: string | null
          estado: string
          etapa_atual: string | null
          etapas_concluidas: string[]
          preferencias: Json
          tour: string
          user_id: string
          versao: number
        }
        Insert: {
          atualizado_em?: string
          concluido_em?: string | null
          estado?: string
          etapa_atual?: string | null
          etapas_concluidas?: string[]
          preferencias?: Json
          tour: string
          user_id: string
          versao?: number
        }
        Update: {
          atualizado_em?: string
          concluido_em?: string | null
          estado?: string
          etapa_atual?: string | null
          etapas_concluidas?: string[]
          preferencias?: Json
          tour?: string
          user_id?: string
          versao?: number
        }
        Relationships: []
      }
      dcs_pipeline_onboarding: {
        Row: {
          ativo: boolean
          atualizado_em: string
          deal_id: number
          entrada_etapa_em: string | null
          inativado_em: string | null
          key: string
          org_id: number
          owner_id: number | null
          owner_nome: string | null
          stage_id: number
          sync_id: string | null
          titulo: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          deal_id: number
          entrada_etapa_em?: string | null
          inativado_em?: string | null
          key: string
          org_id: number
          owner_id?: number | null
          owner_nome?: string | null
          stage_id: number
          sync_id?: string | null
          titulo?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          deal_id?: number
          entrada_etapa_em?: string | null
          inativado_em?: string | null
          key?: string
          org_id?: number
          owner_id?: number | null
          owner_nome?: string | null
          stage_id?: number
          sync_id?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      dcs_pre_cadastros: {
        Row: {
          aplicado_em: string | null
          aplicado_user: string | null
          ativo: boolean
          atualizado_em: string
          carteiras: number[]
          clientes: string[]
          convite_enviado_em: string | null
          criado_em: string
          criado_por: string | null
          email: string
          expira_em: string | null
          financeiro: boolean
          metodo: string
          modulos: string[] | null
          nome: string | null
          perfil: string
          permissoes: Json
          pipedrive_user_id: number | null
          pode_editar: boolean
          pode_exportar: boolean
          revogado_em: string | null
          revogado_por: string | null
        }
        Insert: {
          aplicado_em?: string | null
          aplicado_user?: string | null
          ativo?: boolean
          atualizado_em?: string
          carteiras?: number[]
          clientes?: string[]
          convite_enviado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email: string
          expira_em?: string | null
          financeiro?: boolean
          metodo?: string
          modulos?: string[] | null
          nome?: string | null
          perfil: string
          permissoes?: Json
          pipedrive_user_id?: number | null
          pode_editar?: boolean
          pode_exportar?: boolean
          revogado_em?: string | null
          revogado_por?: string | null
        }
        Update: {
          aplicado_em?: string | null
          aplicado_user?: string | null
          ativo?: boolean
          atualizado_em?: string
          carteiras?: number[]
          clientes?: string[]
          convite_enviado_em?: string | null
          criado_em?: string
          criado_por?: string | null
          email?: string
          expira_em?: string | null
          financeiro?: boolean
          metodo?: string
          modulos?: string[] | null
          nome?: string | null
          perfil?: string
          permissoes?: Json
          pipedrive_user_id?: number | null
          pode_editar?: boolean
          pode_exportar?: boolean
          revogado_em?: string | null
          revogado_por?: string | null
        }
        Relationships: []
      }
      dcs_preferencias: {
        Row: {
          atualizado_em: string
          user_id: string
          valor: Json
        }
        Insert: {
          atualizado_em?: string
          user_id?: string
          valor?: Json
        }
        Update: {
          atualizado_em?: string
          user_id?: string
          valor?: Json
        }
        Relationships: [
          {
            foreignKeyName: "dcs_preferencias_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dcs_regras: {
        Row: {
          ativa: boolean
          config: Json
          criado_em: string
          criado_por: string | null
          id: string
          metodologia: string
          versao: string
        }
        Insert: {
          ativa?: boolean
          config: Json
          criado_em?: string
          criado_por?: string | null
          id?: string
          metodologia: string
          versao: string
        }
        Update: {
          ativa?: boolean
          config?: Json
          criado_em?: string
          criado_por?: string | null
          id?: string
          metodologia?: string
          versao?: string
        }
        Relationships: []
      }
      dcs_responsaveis: {
        Row: {
          ativo: boolean
          email: string | null
          nome: string
          pipedrive_user_id: number
          visto_em: string
        }
        Insert: {
          ativo: boolean
          email?: string | null
          nome: string
          pipedrive_user_id: number
          visto_em?: string
        }
        Update: {
          ativo?: boolean
          email?: string | null
          nome?: string
          pipedrive_user_id?: number
          visto_em?: string
        }
        Relationships: []
      }
      dcs_seguranca_conta: {
        Row: {
          atualizado_em: string
          provisoria_expira_em: string | null
          provisoria_gerada_em: string | null
          provisoria_gerada_por: string | null
          senha_definida_em: string | null
          troca_obrigatoria: boolean
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          provisoria_expira_em?: string | null
          provisoria_gerada_em?: string | null
          provisoria_gerada_por?: string | null
          senha_definida_em?: string | null
          troca_obrigatoria?: boolean
          user_id: string
        }
        Update: {
          atualizado_em?: string
          provisoria_expira_em?: string | null
          provisoria_gerada_em?: string | null
          provisoria_gerada_por?: string | null
          senha_definida_em?: string | null
          troca_obrigatoria?: boolean
          user_id?: string
        }
        Relationships: []
      }
      dcs_solicitacoes_sync: {
        Row: {
          atendido_em: string | null
          erro: string | null
          id: string
          solicitado_em: string
          solicitado_por: string | null
          status: string
          tipo: string
        }
        Insert: {
          atendido_em?: string | null
          erro?: string | null
          id?: string
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          tipo: string
        }
        Update: {
          atendido_em?: string | null
          erro?: string | null
          id?: string
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      dcs_sync_execucoes: {
        Row: {
          alterados: number | null
          completo: boolean | null
          concluido_em: string | null
          criados: number | null
          detalhes: Json | null
          erro: string | null
          id: string
          inativados: number | null
          iniciado_em: string
          lidos: number | null
          modo: string
          status: string
          tipo: string
        }
        Insert: {
          alterados?: number | null
          completo?: boolean | null
          concluido_em?: string | null
          criados?: number | null
          detalhes?: Json | null
          erro?: string | null
          id?: string
          inativados?: number | null
          iniciado_em?: string
          lidos?: number | null
          modo?: string
          status?: string
          tipo: string
        }
        Update: {
          alterados?: number | null
          completo?: boolean | null
          concluido_em?: string | null
          criados?: number | null
          detalhes?: Json | null
          erro?: string | null
          id?: string
          inativados?: number | null
          iniciado_em?: string
          lidos?: number | null
          modo?: string
          status?: string
          tipo?: string
        }
        Relationships: []
      }
      dcs_testes_conexao: {
        Row: {
          atendido_em: string | null
          concluido_em: string | null
          erro: string | null
          id: string
          resultado: Json | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
        }
        Insert: {
          atendido_em?: string | null
          concluido_em?: string | null
          erro?: string | null
          id?: string
          resultado?: Json | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
        }
        Update: {
          atendido_em?: string | null
          concluido_em?: string | null
          erro?: string | null
          id?: string
          resultado?: Json | null
          solicitado_em?: string
          solicitado_por?: string | null
          status?: string
        }
        Relationships: []
      }
      dcs_tipos_atividade: {
        Row: {
          chave: string
          nome: string | null
          ocorrencias: number
          visto_em: string
        }
        Insert: {
          chave: string
          nome?: string | null
          ocorrencias?: number
          visto_em?: string
        }
        Update: {
          chave?: string
          nome?: string | null
          ocorrencias?: number
          visto_em?: string
        }
        Relationships: []
      }
      dcs_utilizacao: {
        Row: {
          acao_retomada: string | null
          acompanhamento: string | null
          atualizado_em: string
          atualizado_por: string | null
          cliente_key: string
          evidencias: string | null
          intervalo_dias: number | null
          motivo: string | null
          observacoes: string | null
          proxima_revisao: string | null
          recuperado_em: string | null
          responsavel_id: string | null
          sem_uso_desde: string | null
          status: string
          ultima_desconhecida: boolean
          ultima_utilizacao: string | null
          ultimo_acompanhamento: string | null
          versao: number
        }
        Insert: {
          acao_retomada?: string | null
          acompanhamento?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_key: string
          evidencias?: string | null
          intervalo_dias?: number | null
          motivo?: string | null
          observacoes?: string | null
          proxima_revisao?: string | null
          recuperado_em?: string | null
          responsavel_id?: string | null
          sem_uso_desde?: string | null
          status?: string
          ultima_desconhecida?: boolean
          ultima_utilizacao?: string | null
          ultimo_acompanhamento?: string | null
          versao?: number
        }
        Update: {
          acao_retomada?: string | null
          acompanhamento?: string | null
          atualizado_em?: string
          atualizado_por?: string | null
          cliente_key?: string
          evidencias?: string | null
          intervalo_dias?: number | null
          motivo?: string | null
          observacoes?: string | null
          proxima_revisao?: string | null
          recuperado_em?: string | null
          responsavel_id?: string | null
          sem_uso_desde?: string | null
          status?: string
          ultima_desconhecida?: boolean
          ultima_utilizacao?: string | null
          ultimo_acompanhamento?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "dcs_utilizacao_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: true
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      dcs_utilizacao_eventos: {
        Row: {
          ator: string | null
          cliente_key: string
          dados: Json | null
          em: string
          id: number
          resultado: string | null
          tipo: string
        }
        Insert: {
          ator?: string | null
          cliente_key: string
          dados?: Json | null
          em?: string
          id?: never
          resultado?: string | null
          tipo: string
        }
        Update: {
          ator?: string | null
          cliente_key?: string
          dados?: Json | null
          em?: string
          id?: never
          resultado?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "dcs_utilizacao_eventos_cliente_key_fkey"
            columns: ["cliente_key"]
            isOneToOne: false
            referencedRelation: "dcs_clientes"
            referencedColumns: ["key"]
          },
        ]
      }
      entradas_telegram: {
        Row: {
          arquivo: Json | null
          atualizado_em: string
          bot_id: number | null
          chat_id: number
          created_at: string
          erro: string | null
          extracao_erro: string | null
          id: string
          legenda: string | null
          status: string
          texto: string | null
          tipo: string
          update_id: number
          user_id: string | null
        }
        Insert: {
          arquivo?: Json | null
          atualizado_em?: string
          bot_id?: number | null
          chat_id: number
          created_at?: string
          erro?: string | null
          extracao_erro?: string | null
          id?: string
          legenda?: string | null
          status?: string
          texto?: string | null
          tipo: string
          update_id: number
          user_id?: string | null
        }
        Update: {
          arquivo?: Json | null
          atualizado_em?: string
          bot_id?: number | null
          chat_id?: number
          created_at?: string
          erro?: string | null
          extracao_erro?: string | null
          id?: string
          legenda?: string | null
          status?: string
          texto?: string | null
          tipo?: string
          update_id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      google_tokens: {
        Row: {
          atualizado_em: string
          escopos: string[] | null
          refresh_token: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          escopos?: string[] | null
          refresh_token?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string
          escopos?: string[] | null
          refresh_token?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "google_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          response_ciphertext: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          response_ciphertext: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          response_ciphertext?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      item_embeddings: {
        Row: {
          chunk_index: number
          conteudo: string
          created_at: string
          embedding: string
          id: string
          item_id: string
          model: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          conteudo: string
          created_at?: string
          embedding: string
          id?: string
          item_id: string
          model?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          conteudo?: string
          created_at?: string
          embedding?: string
          id?: string
          item_id?: string
          model?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_embeddings_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_embeddings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itens: {
        Row: {
          area_id: string | null
          atualizado_em: string
          conteudo: string
          created_at: string
          data_alvo: string | null
          embedding: string | null
          id: string
          legacy_data: Json | null
          legacy_nota_id: string | null
          origem: string
          pessoa: string | null
          potencial: number
          prioridade: number
          projeto_id: string | null
          proximo_passo: string | null
          status: string
          tipo: string
          titulo: string
          user_id: string
        }
        Insert: {
          area_id?: string | null
          atualizado_em?: string
          conteudo?: string
          created_at?: string
          data_alvo?: string | null
          embedding?: string | null
          id?: string
          legacy_data?: Json | null
          legacy_nota_id?: string | null
          origem?: string
          pessoa?: string | null
          potencial?: number
          prioridade?: number
          projeto_id?: string | null
          proximo_passo?: string | null
          status?: string
          tipo?: string
          titulo: string
          user_id: string
        }
        Update: {
          area_id?: string | null
          atualizado_em?: string
          conteudo?: string
          created_at?: string
          data_alvo?: string | null
          embedding?: string | null
          id?: string
          legacy_data?: Json | null
          legacy_nota_id?: string | null
          origem?: string
          pessoa?: string | null
          potencial?: number
          prioridade?: number
          projeto_id?: string | null
          proximo_passo?: string | null
          status?: string
          tipo?: string
          titulo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itens_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ligacoes: {
        Row: {
          atualizado_em: string
          created_at: string
          id: string
          item_a: string
          item_b: string
          motivo: string
          origem: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          id?: string
          item_a: string
          item_b: string
          motivo: string
          origem?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          id?: string
          item_a?: string
          item_b?: string
          motivo?: string
          origem?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ligacoes_item_a_fkey"
            columns: ["item_a"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_item_b_fkey"
            columns: ["item_b"]
            isOneToOne: false
            referencedRelation: "itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ligacoes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      memoria: {
        Row: {
          atualizado_em: string
          conteudo_md: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          conteudo_md?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          conteudo_md?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memoria_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens: {
        Row: {
          autor: Database["public"]["Enums"]["autor_msg"]
          canal: Database["public"]["Enums"]["canal_msg"]
          conteudo: string
          conversa_id: string | null
          created_at: string
          id: number
          meta: Json
          user_id: string
        }
        Insert: {
          autor: Database["public"]["Enums"]["autor_msg"]
          canal: Database["public"]["Enums"]["canal_msg"]
          conteudo: string
          conversa_id?: string | null
          created_at?: string
          id?: number
          meta?: Json
          user_id: string
        }
        Update: {
          autor?: Database["public"]["Enums"]["autor_msg"]
          canal?: Database["public"]["Enums"]["canal_msg"]
          conteudo?: string
          conversa_id?: string | null
          created_at?: string
          id?: number
          meta?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notas: {
        Row: {
          area: string | null
          corpo_md: string | null
          created_at: string
          id: string
          lembrete_em: string | null
          resumo: string | null
          subcategoria: string | null
          tags: string[] | null
          titulo: string | null
          user_id: string
        }
        Insert: {
          area?: string | null
          corpo_md?: string | null
          created_at?: string
          id?: string
          lembrete_em?: string | null
          resumo?: string | null
          subcategoria?: string | null
          tags?: string[] | null
          titulo?: string | null
          user_id: string
        }
        Update: {
          area?: string | null
          corpo_md?: string | null
          created_at?: string
          id?: string
          lembrete_em?: string | null
          resumo?: string | null
          subcategoria?: string | null
          tags?: string[] | null
          titulo?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preferencias_munim: {
        Row: {
          ai_erro: string | null
          ai_pausada: boolean
          atualizado_em: string
          autonomia: Json
          created_at: string
          memoria_atualizada_em: string | null
          memoria_compacta: string
          pergunta_respondida_em: string | null
          perguntas_dia: number
          sugestoes_data: string | null
          sugestoes_dia: number
          sugestoes_usadas: number
          telegram_fim: string
          telegram_inicio: string
          user_id: string
        }
        Insert: {
          ai_erro?: string | null
          ai_pausada?: boolean
          atualizado_em?: string
          autonomia?: Json
          created_at?: string
          memoria_atualizada_em?: string | null
          memoria_compacta?: string
          pergunta_respondida_em?: string | null
          perguntas_dia?: number
          sugestoes_data?: string | null
          sugestoes_dia?: number
          sugestoes_usadas?: number
          telegram_fim?: string
          telegram_inicio?: string
          user_id: string
        }
        Update: {
          ai_erro?: string | null
          ai_pausada?: boolean
          atualizado_em?: string
          autonomia?: Json
          created_at?: string
          memoria_atualizada_em?: string | null
          memoria_compacta?: string
          pergunta_respondida_em?: string | null
          perguntas_dia?: number
          sugestoes_data?: string | null
          sugestoes_dia?: number
          sugestoes_usadas?: number
          telegram_fim?: string
          telegram_inicio?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "preferencias_munim_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          alertas_ativos: boolean
          created_at: string
          email: string | null
          fuso: string
          google_conectado: boolean
          horario_briefing: string
          id: string
          nome: string | null
          papel: Database["public"]["Enums"]["papel_usuario"]
          pipedrive_user_id: number | null
          telegram_chat_id: number | null
          telegram_codigo: string
          telegram_codigo_expira_em: string | null
          telegram_username: string | null
        }
        Insert: {
          alertas_ativos?: boolean
          created_at?: string
          email?: string | null
          fuso?: string
          google_conectado?: boolean
          horario_briefing?: string
          id: string
          nome?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"]
          pipedrive_user_id?: number | null
          telegram_chat_id?: number | null
          telegram_codigo?: string
          telegram_codigo_expira_em?: string | null
          telegram_username?: string | null
        }
        Update: {
          alertas_ativos?: boolean
          created_at?: string
          email?: string | null
          fuso?: string
          google_conectado?: boolean
          horario_briefing?: string
          id?: string
          nome?: string | null
          papel?: Database["public"]["Enums"]["papel_usuario"]
          pipedrive_user_id?: number | null
          telegram_chat_id?: number | null
          telegram_codigo?: string
          telegram_codigo_expira_em?: string | null
          telegram_username?: string | null
        }
        Relationships: []
      }
      registros: {
        Row: {
          corpo_md: string | null
          created_at: string
          data: string
          fonte: string
          id: string
          pipedrive_deal_id: number | null
          resumo: string | null
          risco: Database["public"]["Enums"]["nivel_risco"]
          user_id: string
        }
        Insert: {
          corpo_md?: string | null
          created_at?: string
          data?: string
          fonte?: string
          id?: string
          pipedrive_deal_id?: number | null
          resumo?: string | null
          risco?: Database["public"]["Enums"]["nivel_risco"]
          user_id: string
        }
        Update: {
          corpo_md?: string | null
          created_at?: string
          data?: string
          fonte?: string
          id?: string
          pipedrive_deal_id?: number | null
          resumo?: string | null
          risco?: Database["public"]["Enums"]["nivel_risco"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "registros_pipedrive_deal_id_fkey"
            columns: ["pipedrive_deal_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["pipedrive_deal_id"]
          },
          {
            foreignKeyName: "registros_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      solicitacoes_conexao: {
        Row: {
          created_at: string
          descricao: string
          ferramenta: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          descricao: string
          ferramenta: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          descricao?: string
          ferramenta?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "solicitacoes_conexao_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_bot_updates: {
        Row: {
          bot_id: number
          created_at: string
          status: string
          update_id: number
        }
        Insert: {
          bot_id: number
          created_at?: string
          status?: string
          update_id: number
        }
        Update: {
          bot_id?: number
          created_at?: string
          status?: string
          update_id?: number
        }
        Relationships: []
      }
      telegram_bots: {
        Row: {
          atualizado_em: string
          bot_id: number
          bot_nome: string
          bot_username: string
          chat_id: number | null
          codigo_vinculo: string | null
          conectado_em: string
          expira_em: string | null
          status: string
          token_cifrado: string
          ultimo_erro: string | null
          user_id: string
          webhook_secret: string
        }
        Insert: {
          atualizado_em?: string
          bot_id: number
          bot_nome: string
          bot_username: string
          chat_id?: number | null
          codigo_vinculo?: string | null
          conectado_em?: string
          expira_em?: string | null
          status?: string
          token_cifrado: string
          ultimo_erro?: string | null
          user_id: string
          webhook_secret: string
        }
        Update: {
          atualizado_em?: string
          bot_id?: number
          bot_nome?: string
          bot_username?: string
          chat_id?: number | null
          codigo_vinculo?: string | null
          conectado_em?: string
          expira_em?: string | null
          status?: string
          token_cifrado?: string
          ultimo_erro?: string | null
          user_id?: string
          webhook_secret?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_bots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_deliveries: {
        Row: {
          created_at: string
          local_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          local_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          local_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      telegram_notifications: {
        Row: {
          created_at: string
          notification_key: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notification_key: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notification_key?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      telegram_updates: {
        Row: {
          created_at: string
          status: string
          update_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          status?: string
          update_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          status?: string
          update_id?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          atualizado_em: string
          created_at: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          created_at?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      uso: {
        Row: {
          created_at: string
          custo_usd: number | null
          funcao: string | null
          id: number
          modelo: string | null
          tokens_entrada: number | null
          tokens_saida: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          custo_usd?: number | null
          funcao?: string | null
          id?: number
          modelo?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          custo_usd?: number | null
          funcao?: string | null
          id?: number
          modelo?: string | null
          tokens_entrada?: number | null
          tokens_saida?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uso_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cobertura_atual: {
        Row: {
          cobertos: number | null
          cs_nome: string | null
          owner_pipedrive_id: number | null
          pct: number | null
          total: number | null
        }
        Relationships: []
      }
      cs_snapshot_risco: {
        Row: {
          add_time: string | null
          atividades_abertas: number | null
          atividades_vencidas: number | null
          atualizado_em: string | null
          contato_dominios: string[] | null
          contato_efetivo: string | null
          created_at: string | null
          data_contratacao: string | null
          deal_id: number | null
          dias_contato: number | null
          dias_desde_envio: number | null
          email_status: string | null
          etiquetas: number[] | null
          org_id: number | null
          org_nome: string | null
          origem_contato: string | null
          owner_id: number | null
          owner_nome: string | null
          perfil_conta: string | null
          pipeline_id: number | null
          proxima_atividade_data: string | null
          retorno_dias: number | null
          risco_cor: string | null
          risco_fatores: string[] | null
          stage_change_time: string | null
          stage_id: number | null
          status: string | null
          sync_id: string | null
          titulo: string | null
          ultima_atividade_concluida: string | null
          ultima_reuniao_cs: string | null
          ultimo_contato_efetivo: string | null
          ultimo_email_enviado: string | null
          ultimo_email_recebido: string | null
          updated_at: string | null
          valor: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_snapshot_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "cs_sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      account_active: { Args: never; Returns: boolean }
      admin_mutation: {
        Args: { actor: string; operation: string; target: string; value: Json }
        Returns: undefined
      }
      buscar_itens_semanticos: {
        Args: { limite?: number; query_embedding: string; uid: string }
        Returns: {
          conteudo: string
          id: string
          similaridade: number
          tipo: string
          titulo: string
        }[]
      }
      connection_request_counts: {
        Args: never
        Returns: {
          ferramenta: string
          quantidade: number
        }[]
      }
      cs_atribuir_perfil: {
        Args: {
          actor: string
          owner: number
          papel_cs: Database["public"]["Enums"]["papel_usuario"]
          target: string
        }
        Returns: undefined
      }
      cs_atualizar_regras: { Args: { regras: Json }; Returns: undefined }
      cs_atualizar_regras_por: {
        Args: { actor: string; regras: Json }
        Returns: undefined
      }
      cs_avaliar_risco: {
        Args: {
          contato: string
          enviado: string
          etiquetas: number[]
          proxima: string
          recebido: string
          stage: number
          vencidas: number
        }
        Returns: {
          cor: string
          dias_contato: number
          fatores: string[]
          retorno_dias: number
        }[]
      }
      cs_email_status: {
        Args: {
          agora?: string
          analista_limite: number
          enviado: string
          recebido: string
          retorno_limite: number
        }
        Returns: string
      }
      cs_iniciar_sync: {
        Args: { actor?: string; source: string }
        Returns: string
      }
      cs_iniciar_sync_janela: { Args: { janela_id: string }; Returns: string }
      cs_pode_ver: {
        Args: { owner_id: number; pipeline_id: number }
        Returns: boolean
      }
      cs_publicar_atividades_historicas: {
        Args: { atividades: Json; run: string }
        Returns: number
      }
      cs_publicar_auditoria: {
        Args: { ate: string; desde: string; eventos: Json; negocios: number[] }
        Returns: undefined
      }
      cs_publicar_snapshot: {
        Args: { lidos: number; rows: Json; run: string }
        Returns: undefined
      }
      cs_publicar_tudo: {
        Args: { atividades: Json; lidos: number; rows: Json; run: string }
        Returns: undefined
      }
      dcs_analistas: {
        Args: never
        Returns: {
          nome: string
          user_id: string
        }[]
      }
      dcs_atender_solicitacoes: {
        Args: never
        Returns: {
          atendido_em: string | null
          erro: string | null
          id: string
          solicitado_em: string
          solicitado_por: string | null
          status: string
          tipo: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dcs_solicitacoes_sync"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dcs_atender_testes_conexao: {
        Args: never
        Returns: {
          atendido_em: string | null
          concluido_em: string | null
          erro: string | null
          id: string
          resultado: Json | null
          solicitado_em: string
          solicitado_por: string | null
          status: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dcs_testes_conexao"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dcs_atribuir_analise: {
        Args: { p_key: string; p_para: string }
        Returns: {
          analista_id: string
          ciclo: number
          cliente_key: string
          completude: number | null
          concluido_em: string | null
          derivado: Json | null
          id: string
          indice: number | null
          iniciado_em: string
          itens: Json
          meta: Json
          metricas: Json
          proxima_revisao: string | null
          regras_id: string
          resultados: Json
          resumo: string | null
          salvo_em: string
          status: string
          versao: number
        }
        SetofOptions: {
          from: "*"
          to: "dcs_diagnosticos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dcs_atualizar_acao: {
        Args: { p_campos: Json; p_id: string; p_versao: number }
        Returns: number
      }
      dcs_atualizar_alertas: { Args: never; Returns: number }
      dcs_atualizar_feedback: {
        Args: { p_id: number; p_status: string }
        Returns: undefined
      }
      dcs_auditar: {
        Args: { p_acao: string; p_dados: Json; p_ent: string; p_id: string }
        Returns: undefined
      }
      dcs_autorizar_credencial: { Args: { p_email: string }; Returns: Json }
      dcs_clientes_para_cobertura: {
        Args: never
        Returns: {
          deal_ids: number[]
          key: string
          org_id: number
          person_id: number
        }[]
      }
      dcs_concluir_analise: {
        Args: {
          p_acoes: Json
          p_derivado: Json
          p_id: string
          p_proxima_revisao: string
          p_registrar_pipedrive: boolean
          p_resumo: string
          p_versao: number
        }
        Returns: string
      }
      dcs_concluir_definicao_senha: {
        Args: { p_sessao: string; p_user: string }
        Returns: undefined
      }
      dcs_concluir_solicitacao: {
        Args: { p_erro: string; p_id: string; p_ok: boolean }
        Returns: undefined
      }
      dcs_concluir_teste_conexao: {
        Args: { p_erro: string; p_id: string; p_resultado: Json }
        Returns: undefined
      }
      dcs_config_produto: { Args: never; Returns: Json }
      dcs_confirmar_utilizacao: {
        Args: { p_key: string; p_obs: string }
        Returns: undefined
      }
      dcs_criar_acao: {
        Args: {
          p_acao: string
          p_categoria: string
          p_complexidade: string
          p_ganho_rapido: boolean
          p_key: string
          p_prazo: string
          p_prioridade: string
          p_problema: string
          p_responsavel: string
        }
        Returns: string
      }
      dcs_definir_config_produto: {
        Args: { p_chave: string; p_valor: Json }
        Returns: undefined
      }
      dcs_definir_escrita_pipedrive: {
        Args: { p_ativa: boolean }
        Returns: undefined
      }
      dcs_definir_meta: {
        Args: { p_indicador: string; p_periodo: string; p_valor: number }
        Returns: undefined
      }
      dcs_definir_status_usuario: {
        Args: { p_ativo: boolean; p_user: string }
        Returns: undefined
      }
      dcs_eh_admin: { Args: never; Returns: boolean }
      dcs_eh_master: { Args: never; Returns: boolean }
      dcs_enviar_feedback: {
        Args: {
          p_descricao: string
          p_funcionalidade: string
          p_pagina: string
          p_tipo: string
          p_versao: string
        }
        Returns: number
      }
      dcs_exigir_atuacao: { Args: { p_key: string }; Returns: undefined }
      dcs_exigir_definicao_senha: {
        Args: { p_acao: string; p_ator: string; p_user: string }
        Returns: undefined
      }
      dcs_falhar_sync: {
        Args: { p_erro: string; p_run: string }
        Returns: undefined
      }
      dcs_finalizar_job: {
        Args: {
          p_erro: string
          p_id: string
          p_resultado: Json
          p_status: string
        }
        Returns: undefined
      }
      dcs_iniciar_analise: {
        Args: { p_key: string }
        Returns: {
          analista_id: string
          ciclo: number
          cliente_key: string
          completude: number | null
          concluido_em: string | null
          derivado: Json | null
          id: string
          indice: number | null
          iniciado_em: string
          itens: Json
          meta: Json
          metricas: Json
          proxima_revisao: string | null
          regras_id: string
          resultados: Json
          resumo: string | null
          salvo_em: string
          status: string
          versao: number
        }
        SetofOptions: {
          from: "*"
          to: "dcs_diagnosticos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      dcs_iniciar_sync: {
        Args: { p_modo: string; p_tipo: string }
        Returns: string
      }
      dcs_liberar_job: { Args: { p_id: string }; Returns: undefined }
      dcs_listar_usuarios: {
        Args: never
        Returns: {
          ativo: boolean
          carteiras: number[]
          clientes: string[]
          convidado_por: string
          criado_em: string
          email: string
          financeiro: boolean
          master_principal: boolean
          modulos: string[]
          nome: string
          papel: string
          perfil: string
          permissoes: Json
          pipedrive_user_id: number
          pode_editar: boolean
          pode_exportar: boolean
          provisoria_expira_em: string
          status: string
          troca_senha: boolean
          ultimo_acesso: string
          user_id: string
        }[]
      }
      dcs_logs_seguranca: {
        Args: { p_limite?: number }
        Returns: {
          acao: string
          ator: string
          dados: Json
          em: string
          entidade: string
          entidade_id: string
        }[]
      }
      dcs_marcar_sem_utilizacao: {
        Args: {
          p_acao: string
          p_desconhecida: boolean
          p_evidencias: string
          p_intervalo: number
          p_key: string
          p_motivo: string
          p_obs: string
          p_proxima: string
          p_responsavel: string
          p_ultima: string
        }
        Returns: undefined
      }
      dcs_metodo_vinculo: {
        Args: { p_email_app: string; p_email_pd: string }
        Returns: string
      }
      dcs_meu_acesso: { Args: never; Returns: Json }
      dcs_minha_conexao_pipedrive: { Args: never; Returns: Json }
      dcs_notas_cliente_listar: {
        Args: { p_cliente_key: string }
        Returns: {
          autor_id: string
          autor_nome: string
          criado_em: string
          erro: string
          id: string
          status: string
          texto: string
        }[]
      }
      dcs_perfil: { Args: never; Returns: string }
      dcs_perfil_de: { Args: { p_user: string }; Returns: string }
      dcs_permissoes_validas: { Args: { p_perfil: string }; Returns: string[] }
      dcs_pipedrive_do_usuario: { Args: { p_user: string }; Returns: number }
      dcs_pode: { Args: { p: string }; Returns: boolean }
      dcs_pode_atuar_de: {
        Args: { p_key: string; p_owner: number; p_user: string }
        Returns: boolean
      }
      dcs_pode_editar: { Args: never; Returns: boolean }
      dcs_pode_ver: {
        Args: { p_key: string; p_owner: number }
        Returns: boolean
      }
      dcs_publicar_atividades: {
        Args: {
          p_completo: boolean
          p_lidos: number
          p_rows: Json
          p_run: string
        }
        Returns: Json
      }
      dcs_publicar_cancelamentos: {
        Args: {
          p_completo: boolean
          p_lidos: number
          p_rows: Json
          p_run: string
        }
        Returns: Json
      }
      dcs_publicar_carteira: {
        Args: {
          p_completo: boolean
          p_lidos: number
          p_rows: Json
          p_run: string
        }
        Returns: Json
      }
      dcs_publicar_cobertura: {
        Args: {
          p_completo: boolean
          p_detalhes: Json
          p_rows: Json
          p_run: string
        }
        Returns: number
      }
      dcs_publicar_pipeline_onboarding: {
        Args: {
          p_completo: boolean
          p_lidos: number
          p_rows: Json
          p_run: string
        }
        Returns: Json
      }
      dcs_publicar_regras: {
        Args: { p_config: Json; p_metodologia: string }
        Returns: string
      }
      dcs_publicar_responsaveis: {
        Args: { p_run: string; p_users: Json }
        Returns: number
      }
      dcs_reabrir_analise: {
        Args: { p_id: string; p_motivo: string }
        Returns: undefined
      }
      dcs_reenfileirar_jobs: { Args: never; Returns: number }
      dcs_registrar_convite: { Args: { p_email: string }; Returns: undefined }
      dcs_registrar_log: {
        Args: {
          p_dados: Json
          p_mensagem: string
          p_nivel: string
          p_origem: string
        }
        Returns: undefined
      }
      dcs_registrar_nota_cliente: {
        Args: { p_cliente_key: string; p_texto: string }
        Returns: string
      }
      dcs_registrar_provisoria: {
        Args: { p_ator: string; p_horas: number; p_user: string }
        Returns: undefined
      }
      dcs_registrar_tipos_atividade: {
        Args: { p_tipos: Json }
        Returns: number
      }
      dcs_regras_ativas: { Args: never; Returns: Json }
      dcs_reivindicar_acesso: { Args: never; Returns: boolean }
      dcs_reprocessar_registro: { Args: { p_diag: string }; Returns: string }
      dcs_reservar_jobs: {
        Args: { p_limite?: number; p_tipo: string }
        Returns: {
          atualizado_em: string
          chave: string
          criado_em: string
          criado_por: string | null
          erro: string | null
          id: string
          payload: Json
          proxima_tentativa: string
          resultado: Json | null
          status: string
          tentativas: number
          tipo: string
          travado_em: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "dcs_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dcs_responsaveis_admin: {
        Args: never
        Returns: {
          ativo: boolean
          email: string | null
          nome: string
          pipedrive_user_id: number
          visto_em: string
        }[]
        SetofOptions: {
          from: "*"
          to: "dcs_responsaveis"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      dcs_revisar_utilizacao: {
        Args: {
          p_key: string
          p_obs: string
          p_proxima: string
          p_resultado: string
          p_ultima: string
        }
        Returns: undefined
      }
      dcs_revogar_pre_cadastro: {
        Args: { p_email: string }
        Returns: undefined
      }
      dcs_revogar_sessoes: {
        Args: { p_ator: string; p_user: string }
        Returns: undefined
      }
      dcs_salvar_acesso: { Args: { p: Json }; Returns: Json }
      dcs_salvar_diagnostico: {
        Args: {
          p_derivado: Json
          p_id: string
          p_itens: Json
          p_meta: Json
          p_metricas: Json
          p_resultados: Json
          p_versao: number
        }
        Returns: number
      }
      dcs_salvar_membro: {
        Args: {
          p_ativo: boolean
          p_carteiras: number[]
          p_clientes: string[]
          p_financeiro: boolean
          p_modulos: string[]
          p_perfil: string
          p_pipedrive: number
          p_user: string
        }
        Returns: undefined
      }
      dcs_salvar_onboarding: {
        Args: {
          p_concluidas: string[]
          p_estado: string
          p_etapa: string
          p_prefs: Json
          p_tour: string
          p_versao: number
        }
        Returns: undefined
      }
      dcs_salvar_permissoes: {
        Args: {
          p_ativo: boolean
          p_carteiras: number[]
          p_clientes: string[]
          p_editar: boolean
          p_exportar: boolean
          p_financeiro: boolean
          p_modulos: string[]
          p_perfil: string
          p_user: string
        }
        Returns: undefined
      }
      dcs_salvar_usuario: {
        Args: {
          p_ativo: boolean
          p_carteiras: number[]
          p_clientes: string[]
          p_editar: boolean
          p_email: string
          p_exportar: boolean
          p_financeiro: boolean
          p_nome: string
          p_perfil: string
          p_pipedrive: number
        }
        Returns: Json
      }
      dcs_senha_igual_atual: { Args: { p_senha: string }; Returns: boolean }
      dcs_situacao_senha: { Args: never; Returns: Json }
      dcs_solicitar_sync: { Args: { p_tipo: string }; Returns: string }
      dcs_solicitar_teste_conexao: { Args: never; Returns: string }
      dcs_status_conexao: { Args: never; Returns: Json }
      dcs_status_registro: { Args: { p_diag: string }; Returns: Json }
      dcs_transferir_analise: {
        Args: { p_id: string; p_motivo: string; p_para: string }
        Returns: undefined
      }
      dcs_transferir_master: { Args: { p_novo: string }; Returns: undefined }
      dcs_troca_pendente: { Args: { p_user: string }; Returns: boolean }
      dcs_ve_financeiro: { Args: never; Returns: boolean }
      dcs_vinculos_pipedrive: {
        Args: never
        Returns: {
          ativo_no_pipedrive: boolean
          compartilhado: boolean
          metodo: string
          nome_pipedrive: string
          pipedrive_user_id: number
          user_id: string
        }[]
      }
      estruturar_projeto_pessoal: {
        Args: { etapas: Json; item: string; respostas: string[] }
        Returns: undefined
      }
      has_role: {
        Args: { role: Database["public"]["Enums"]["app_role"]; uid: string }
        Returns: boolean
      }
      link_telegram: { Args: { chat: number; code: string }; Returns: string }
      link_telegram_user: {
        Args: { chat: number; code: string; handle: string }
        Returns: string
      }
      meu_acesso: {
        Args: never
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
          status: string
          terms_accepted_at: string
        }[]
      }
      meu_papel: {
        Args: never
        Returns: Database["public"]["Enums"]["papel_usuario"]
      }
      meu_pipedrive_id: { Args: never; Returns: number }
      registrar_acesso_auxiliar: { Args: { uid: string }; Returns: undefined }
      registrar_meu_acesso: { Args: never; Returns: undefined }
      vincular_bot_telegram: {
        Args: { bot: number; chat: number; code: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "user"
      autor_msg: "usuario" | "munim" | "sistema"
      canal_msg: "app" | "telegram"
      nivel_risco: "baixo" | "medio" | "alto"
      papel_usuario: "cs" | "gestor" | "admin"
      status_acao: "pendente" | "aprovada" | "executada" | "recusada" | "erro"
      tipo_acao:
        | "atividade_pipedrive"
        | "nota_pipedrive"
        | "rascunho_gmail"
        | "evento_agenda"
      tipo_briefing: "manha" | "alerta" | "leitura_cs" | "rodada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["superadmin", "admin", "user"],
      autor_msg: ["usuario", "munim", "sistema"],
      canal_msg: ["app", "telegram"],
      nivel_risco: ["baixo", "medio", "alto"],
      papel_usuario: ["cs", "gestor", "admin"],
      status_acao: ["pendente", "aprovada", "executada", "recusada", "erro"],
      tipo_acao: [
        "atividade_pipedrive",
        "nota_pipedrive",
        "rascunho_gmail",
        "evento_agenda",
      ],
      tipo_briefing: ["manha", "alerta", "leitura_cs", "rodada"],
    },
  },
} as const
