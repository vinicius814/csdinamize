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

## Administrador Master e permissões (17/11/2026)
- Master = `superadmin` + conta ativa (`dcs_eh_master()`), identidade do Supabase Auth; nada vem do front-end.
- Impedido no banco: alterar o próprio acesso; alterar o master por `dcs_salvar_permissoes`; não-master conceder/alterar perfil Administrador;
  analista elevar privilégios; remover/suspender/rebaixar o último master (gatilho `dcs_garantir_master`, adiado até o fim da transação).
- Edição: gatilho `dcs_exigir_edicao` em diagnósticos e ações (perfil sem `pode_editar` recebe 42501).
- Lista de usuários (`dcs_listar_usuarios`) e responsáveis só para admin; histórico de permissões em `dcs_auditoria`.
- Botão de atualização: só admin registra pedido; execução no n8n com credenciais do n8n.
- Testado (pglite, 47 cenários) e no banco real com sessões simuladas (master antes/depois: superadmin, ativo, 1 sessão, financeiro e acesso total).
