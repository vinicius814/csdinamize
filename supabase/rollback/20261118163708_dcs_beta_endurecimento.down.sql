-- Reversão de 20261118163708_dcs_beta_endurecimento.
GRANT EXECUTE ON FUNCTION public.dcs_salvar_membro(uuid,text,boolean,boolean,integer[],text[],text[],integer) TO authenticated;
ALTER FUNCTION public.dcs_permissoes_validas(text) RESET search_path;
