-- Endurecimento pós-auditoria (FINAL_SECURITY_AUDIT A-03, B-02).
-- dcs_salvar_membro era um segundo caminho de edição de acesso, sem as checagens anti-elevação de dcs_salvar_acesso.
REVOKE EXECUTE ON FUNCTION public.dcs_salvar_membro(uuid,text,boolean,boolean,integer[],text[],text[],integer) FROM PUBLIC, anon, authenticated;
-- search_path fixo também na função auxiliar imutável.
ALTER FUNCTION public.dcs_permissoes_validas(text) SET search_path = public;
