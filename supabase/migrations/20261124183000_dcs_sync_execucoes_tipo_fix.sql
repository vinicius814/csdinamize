-- Corrige dcs_sync_execucoes_tipo_check: faltavam os tipos 'onboarding', 'atividades' e
-- 'cancelamentos' (adicionados em sessões anteriores para os workflows 13/14/15, mas nunca
-- incluídos nesta constraint). Sem isso, dcs_iniciar_sync('onboarding'|'atividades'|'cancelamentos')
-- falhava com "violates check constraint dcs_sync_execucoes_tipo_check" — descoberto ao testar as
-- credenciais dos workflows 13/14/15 anexadas manualmente no n8n em 24/11/2026.
ALTER TABLE public.dcs_sync_execucoes DROP CONSTRAINT dcs_sync_execucoes_tipo_check;
ALTER TABLE public.dcs_sync_execucoes ADD CONSTRAINT dcs_sync_execucoes_tipo_check
  CHECK (tipo = ANY (ARRAY['carteira'::text, 'responsaveis'::text, 'cobertura'::text,
    'onboarding'::text, 'atividades'::text, 'cancelamentos'::text]));
