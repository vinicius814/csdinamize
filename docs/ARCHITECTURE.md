# Arquitetura

```
Navegador (React/TanStack Start, Lovable hosting)
   │  supabase-js com sessão do usuário (Supabase Auth, Google OAuth — já existente no Munin)
   ▼
Supabase (Postgres + RLS) ── fonte oficial dos dados operacionais (dcs_*)
   ▲            │ outbox dcs_jobs (atividade de diagnóstico, mensagem IA)
   │ RPC service_role (credencial no n8n)
n8n ── workflows 01–09 (n8n/workflows) ── Pipedrive API (fonte oficial comercial)
```

- O navegador nunca chama Pipedrive nem webhooks privilegiados. Funções de integração só aceitam `service_role`.
- Regras de cálculo: `src/lib/dcs/motor.ts` (puro, testado). O código JS embutido no n8n é testado contra o motor (`src/test/dcs-n8n.test.ts`).
- Concorrência: versão otimista em `dcs_diagnosticos.versao` e `dcs_acoes.versao`; uma análise aberta por cliente (índice único parcial);
  uma sincronização por tipo (índice único parcial); fila com `FOR UPDATE SKIP LOCKED`.
- Resiliência: o app lê só o Supabase, então diagnósticos continuam com Pipedrive/n8n fora; operações externas ficam em `dcs_jobs` e são
  reprocessadas (07b) com backoff; respostas ambíguas são conferidas pela marca `DZCS-<cliente>-C<ciclo>` antes de recriar.
- Coexistência com o Munin: tabelas `cs_*` e a sincronização central do Munin (`cs-sync.server.ts`) continuam intactas (DECISIONS D6).
