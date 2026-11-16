# Segurança e permissões

- Autenticação: Supabase Auth do Munin (Google, restrito a e-mails autorizados por trigger existente). Conta precisa de `account_access.status='ativo'`.
- Perfis: admin (ou admin/superadmin do Munin), cs, contas — `dcs_membros`. Convite expira em 7 dias se nunca usado. Desativar = `ativo=false` (efeito imediato na RLS).
- RLS em todas as tabelas `dcs_*`; `authenticated` só tem SELECT (exceto mensagens e preferências próprias). Toda escrita por função SECURITY DEFINER com `search_path` fixo.
- Isolamento: `dcs_pode_ver(owner_id, key)` — carteiras (owner do Pipedrive) e clientes avulsos. Admin vê tudo.
- Financeiro: tabela separada, linha inexistente para quem não tem `financeiro` — vale para API e navegador.
- Funções de integração: EXECUTE só para `service_role` (usada apenas no n8n). Webhooks n8n com cabeçalho secreto.
- Auditoria: `dcs_auditoria` (membros, regras, jobs), eventos append-only de diagnósticos e ações.
- Entradas: payloads validados nas funções (tipos jsonb, campos permitidos em `dcs_atualizar_acao`, status permitidos); SQL só parametrizado.
- LGPD: o banco guarda apenas dados comerciais necessários (nome da empresa, IDs, responsável); a IA recebe só fatos agregados do diagnóstico, sem contatos pessoais.
- Testado (pglite): CS sem carteira não vê, conta suspensa não vê, sem financeiro não lê valores, escrita direta bloqueada, usuário não executa funções de integração.
- Pendente: revisar com o advisor de segurança do Supabase após aplicar; revisar a política de e-mails permitidos.
