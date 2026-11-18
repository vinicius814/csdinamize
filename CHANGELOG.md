# Changelog — Dinamize CS

## Beta 1.0 — 18/11/2026 (branch `dinamize-cs/finalizacao-beta`, aguardando homologação)

### Acesso e segurança
- Acesso somente por convite; cadastro público bloqueado no banco (trigger em `auth.users`), inclusive pelo Google.
- Assistente "Convidar usuário" em 5 etapas com permissões definidas antes do convite (menor privilégio).
- Permissões granulares: concluir, planos, redistribuir, usuários, configurações, integrações (+ edição e financeiro).
- Métodos de acesso: Google, link por e-mail ou senha provisória (gerada no servidor, exibida uma vez, 48 h configuráveis).
- Troca obrigatória de senha no 1º acesso, aplicada no banco (sem dados enquanto pendente, qualquer método de login).
- Redefinir acesso, encerrar sessões, desativar/reativar, histórico por usuário e logs de segurança.
- Exportações removidas (CSV da carteira e legados) e bloqueadas no banco; rotas e funções administrativas legadas do Munin desativadas.
- Tabelas legadas de CS restritas por perfil e permissão financeira.

### Identidade e experiência
- Tokens da marca Dinamize (vermelho #EA5456 para marca, #D13F41 para ações por contraste AA; texto #3D3D3B; Circular Std/Inter).
- Selo BETA (desativável pelo Master) e "Exclusivo para e-commerces", com dicas; "Sobre o sistema" com versão, build e commit.
- Nova tela de login e "Configure sua senha de acesso".
- Dicas contextuais no menu e nos indicadores (textos centralizados em `src/lib/dcs/ajuda.ts`).
- Onboarding: boas-vindas, tours por módulo e perfil, persistência por usuário, retomada e reinício.
- Central de ajuda pesquisável e canal de feedback (consulta pelo Master).

### Dados
- Limpeza dos registros de teste com backup em `dcs_backup.*_20261118` (ver `docs/PRODUCTION_DATA_CLEANUP.md`).

### Correções
- Guard das rotas internas e aceite de convite falhavam com o builder do supabase-js (encontrado na homologação visual).
