REVOKE ALL ON public.solicitacoes_conexao FROM anon, authenticated;
GRANT SELECT, INSERT ON public.solicitacoes_conexao TO authenticated;
GRANT ALL ON public.solicitacoes_conexao TO service_role;
REVOKE ALL ON public.telegram_notifications FROM anon, authenticated;
GRANT ALL ON public.telegram_notifications TO service_role;