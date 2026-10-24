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
      cs_eventos_valor: {
        Row: {
          atualizado_em: string
          created_at: string
          deal_id: number
          dia: string
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
          owner_id?: number
          pipeline_id?: number
          valor_anterior?: number
          valor_novo?: number
        }
        Relationships: []
      }
      cs_metricas_diarias: {
        Row: {
          atividades_vencidas: number
          cancelados_dia: number
          clientes_ativos: number
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
          atualizado_em: string
          atualizado_por: string | null
          considerar_sem_uso_como_risco: boolean
          created_at: string
          dias_atencao: number
          dias_risco: number
          id: boolean
          retorno_pendente_dias: number
          vencidas_atencao: number
          vencidas_risco: number
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          considerar_sem_uso_como_risco?: boolean
          created_at?: string
          dias_atencao?: number
          dias_risco?: number
          id?: boolean
          retorno_pendente_dias?: number
          vencidas_atencao?: number
          vencidas_risco?: number
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          considerar_sem_uso_como_risco?: boolean
          created_at?: string
          dias_atencao?: number
          dias_risco?: number
          id?: boolean
          retorno_pendente_dias?: number
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
          contato_efetivo: string | null
          created_at: string
          data_contratacao: string | null
          deal_id: number
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
          contato_efetivo?: string | null
          created_at?: string
          data_contratacao?: string | null
          deal_id: number
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
          contato_efetivo?: string | null
          created_at?: string
          data_contratacao?: string | null
          deal_id?: number
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
          id: string
          iniciado_em: string
          iniciado_por: string | null
          janela: string | null
          negocios_lidos: number
          origem: string
          status: string
          updated_at: string
        }
        Insert: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          janela?: string | null
          negocios_lidos?: number
          origem: string
          status: string
          updated_at?: string
        }
        Update: {
          concluido_em?: string | null
          created_at?: string
          erro?: string | null
          id?: string
          iniciado_em?: string
          iniciado_por?: string | null
          janela?: string | null
          negocios_lidos?: number
          origem?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
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
          contato_efetivo: string | null
          created_at: string | null
          data_contratacao: string | null
          deal_id: number | null
          dias_contato: number | null
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
      cs_iniciar_sync: {
        Args: { actor?: string; source: string }
        Returns: string
      }
      cs_iniciar_sync_janela: { Args: { janela_id: string }; Returns: string }
      cs_pode_ver: {
        Args: { owner_id: number; pipeline_id: number }
        Returns: boolean
      }
      cs_publicar_snapshot: {
        Args: { lidos: number; rows: Json; run: string }
        Returns: undefined
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
