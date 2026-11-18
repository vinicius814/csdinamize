# Autenticação e convites — Dinamize CS Beta

## Política
- Acesso **exclusivamente por convite** de administrador autorizado. Domínio corporativo não autoriza nada.
- Não existe cadastro público: a tela de login só tem e-mail/senha, "Entrar com Google" e "Esqueci minha senha".
- Barreira no banco: trigger `dcs_exigir_convite` em `auth.users` recusa a criação de qualquer identidade sem convite válido
  (vale para e-mail, Google e API administrativa). Mensagem ao usuário sempre genérica:
  "Não foi possível autorizar seu acesso. Entre em contato com o administrador responsável."
- Autorização pela identidade autenticada (`auth.uid()`) e pelo perfil no banco; nunca por e-mail no front-end.

## Perfis e permissões
Perfis: Administrador Master (papel `superadmin`, único, transferível só por ele), Administrador, Analista de CS, Analista de contas.

| Permissão | Chave | Disponível para |
|---|---|---|
| Editar diagnósticos | `pode_editar` | todos os perfis |
| Ver indicadores financeiros | `financeiro` | só quem convida e também possui |
| Concluir diagnósticos | `concluir` | todos |
| Administrar planos de ação | `planos` | todos |
| Redistribuir análises | `redistribuir` | Administrador |
| Administrar usuários | `usuarios` | Administrador |
| Acessar configurações | `config` | Administrador |
| Acessar integrações | `integracoes` | Administrador |

Regras (função `dcs_salvar_acesso`, caminho único): nada vem marcado por padrão; o ator só concede o que possui; só o Master cria
ou altera Administradores; ninguém altera o próprio acesso nem o Master; carteiras/clientes/módulos definidos antes do convite.
Exportação de dados não existe (CHECK no banco). Triggers aplicam cada permissão nas tabelas (`dcs_diagnosticos`, `dcs_acoes`,
`dcs_regras`, `dcs_jobs`, `dcs_membros`, `dcs_pre_cadastros`).

## Convite (Usuários e permissões → Convidar usuário)
1. Identificação: nome, e-mail, responsável no Pipedrive (sugerido pelo e-mail).
2. Perfil.
3. Permissões: carteiras, clientes, módulos, edição, financeiro e as permissões acima.
4. Conferência: resumo, método de acesso e validade (1–30 dias; padrão configurável pelo Master, inicial 7).
5. Convite registrado em `dcs_pre_cadastros` com autor, data e validade; auditoria `convite/criar`.

Métodos:
- **Google** — a pessoa entra com "Entrar com Google" usando o e-mail convidado; o banco aceita a identidade e aplica as permissões.
- **Link por e-mail** — `inviteUserByEmail` (Supabase Auth, link individual e temporário) → página "Configure sua senha de acesso".
- **Senha provisória** — gerada no servidor (`crypto.getRandomValues`, 20 caracteres, 4 classes, sem ambíguos), criada pela API
  administrativa oficial; exibida **uma vez** com botão de copiar; nunca gravada em texto, log, URL ou e-mail. Validade padrão 48 h
  (configurável pelo Master). Gerar outra invalida a anterior e encerra sessões.

O convite não é reutilizável por outra identidade; revogado ou expirado não funciona. No 1º acesso, `dcs_reivindicar_acesso` copia as
permissões definidas e ativa a conta, sem nova aprovação.

## Primeiro acesso com troca obrigatória
- Enquanto `dcs_seguranca_conta.troca_obrigatoria`, o banco devolve perfil nulo: nenhuma tabela, RPC ou rota retorna dados, inclusive
  se a pessoa entrar pelo Google. O app redireciona para `/definir-senha`.
- Requisitos: 12+ caracteres, maiúscula, minúscula, número, especial, sem espaços nas pontas, diferente da provisória (comparação no banco).
- Conclusão (`definirSenha`, servidor): troca a senha pela API oficial, limpa a exigência, encerra as demais sessões, audita e leva ao onboarding.
- Provisória expirada: a página informa e orienta pedir nova credencial ao administrador.

## Recuperação e redefinição
- "Esqueci minha senha": fluxo oficial do Supabase (token temporário de uso único); a resposta é sempre a mesma, exista ou não o e-mail.
  Conta desativada recupera a senha, mas continua sem dados (perfil nulo).
- Administrador → Gerenciar → **Redefinir acesso**: gerar nova senha provisória, enviar link por e-mail, encerrar sessões,
  desativar/reativar. Administradores nunca veem senhas definitivas.

## Status exibidos
Usuários: Ativo · Aguardando primeiro acesso · Aguardando alteração de senha · Desativado · Sem autorização (contas antigas sem perfil).
Convites: Convite pendente · Convite enviado · Convite expirado · Convite revogado · Aceito.

## Auditoria
`dcs_auditoria` (entidades `convite`, `acesso`, `config`): criar, enviar, aceitar, revogar, permissões, senha_provisoria, convite_email,
senha_definida, revogar_sessoes, desativar, reativar, transferir. Consulta: Usuários → Logs de segurança (`dcs_logs_seguranca`, exige
`usuarios`). Nunca contém senhas, tokens ou links.

## Testes
- pglite: cenários C1–C8 (`supabase/tests/dcs_fundacao.pglite.mjs`).
- Banco real em transação desfeita: ver `FINAL_SECURITY_AUDIT.md`.
- **Homologação manual pendente (precisa de uma pessoa real):**
  1. Master convida um colega com senha provisória → copia → o colega entra → é levado a "Configure sua senha" → nenhuma tela abre antes.
  2. O colega tenta "Entrar com Google" antes de trocar → continua bloqueado.
  3. Troca a senha → vê o onboarding → acessa só as carteiras definidas; a senha provisória não funciona mais.
  4. Master revoga um convite pendente e confere que o login é recusado.
  5. Master desativa um usuário e confere que ele perde os dados ao recarregar.
