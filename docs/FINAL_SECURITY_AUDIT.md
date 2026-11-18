# Auditoria final de segurança — Dinamize CS Beta 1.0

Data: 18/11/2026 · Branch: `dinamize-cs/finalizacao-beta` · Banco: Supabase "Munim V2" (`dknywurmzgrkxiytvncp`).
Escopo: Supabase (RLS, RPC, Auth, triggers, views, sessões), front-end (rotas, exportações, armazenamento, erros), integrações
(n8n, Pipedrive, chaves) e GitHub. Nenhum segredo é reproduzido neste documento.

## Resumo

| Severidade | Encontrados | Corrigidos | Abertos (dependem de ação externa) |
|---|---|---|---|
| Crítico | 2 | 2 | 0 |
| Alto | 7 | 6 | 1 (A-08: repositório público) |
| Médio | 5 | 1 | 4 (configurações do painel, transferência do Master, publicação) |
| Baixo | 4 | 2 | 2 (aceitos, documentados) |
| Informativo | 4 | — | — |

Não há falha crítica aberta. A-08 (alto) depende de alterar a visibilidade do repositório no GitHub, decisão do responsável.

## Críticos

| ID | Achado | Correção | Evidência |
|---|---|---|---|
| C-01 | **Cadastro público / acesso por domínio.** Qualquer pessoa com conta Google (ou e-mail) criava usuário no Supabase Auth; a conta ficava "pendente", mas existia e podia ser aprovada fora de um fluxo controlado. | Trigger `dcs_exigir_convite` BEFORE INSERT em `auth.users`: só cria a identidade se houver convite válido (não expirado, não revogado, não aplicado) para o mesmo e-mail. Vale para e-mail/senha, Google e API administrativa. Tela de login sem "criar conta". | Banco real (transação desfeita): cadastro sem convite → "Cadastro não autorizado"; convite usado por outra identidade → negado. pglite C1. |
| C-02 | **Regressão funcional encontrada na homologação visual:** o guard das rotas internas e o aceite de convite usavam `.catch` sobre o builder do supabase-js (que não é uma Promise completa). Todas as páginas internas falhavam e o 1º acesso de convidados quebrava. Nunca chegou à `main`. | `Promise.resolve(...)` nos dois pontos; teste de regressão `src/test/dcs-convite.test.ts`. Commit `5aded9a`. | Playwright 1440/390 px após a correção: páginas carregam sem erros. |

## Altos

| ID | Achado | Correção |
|---|---|---|
| A-01 | Tabelas legadas de CS do Munin (`cs_snapshot`, `cs_cancelamentos`, `cs_base_diaria`…) liam por regra antiga que ignorava desativação, troca obrigatória de senha e permissão financeira do Dinamize CS. | Políticas RESTRITIVAS adicionais (migration `20261118163837_beta_legado_restrito`): exigem perfil efetivo e, para valores, `dcs_ve_financeiro()`. Views legadas sem leitura anônima. Nenhuma política removida. |
| A-02 | Troca de senha obrigatória contornável (redirecionamento apenas visual; login Google ignorava). | `dcs_perfil()`, `dcs_eh_master()` e `dcs_perfil_de()` retornam NULL/false enquanto `dcs_seguranca_conta.troca_obrigatoria`: toda a RLS e as RPCs param de devolver dados, qualquer que seja o método de login. Banco real: perfil=null, clientes=0, diagnósticos=0 com troca pendente. |
| A-03 | Segundo caminho de edição de acesso (`dcs_salvar_membro`, `dcs_salvar_usuario`, `dcs_salvar_permissoes`) sem as checagens anti-elevação. | EXECUTE revogado de `authenticated`; caminho único `dcs_salvar_acesso` (permissões ⊆ do ator, admin só pelo Master, ninguém altera a si mesmo nem o Master). |
| A-04 | Exportação CSV da carteira (com valores) e dos cancelamentos legados; permissão `pode_exportar`. | Botões e código removidos; `pode_exportar` forçado a false com CHECK (`dcs_membros_sem_exportacao`, `dcs_pre_sem_exportacao`); permissão inexistente no convite. |
| A-05 | Rotas legadas do Munin (`/admin`, `/cancelamentos`, `/carteiras-cs`…) acessíveis por URL a administradores. | `destinoLegado` redireciona para todos (D33). Teste `dcs-legado.test.ts`. |
| A-06 | Funções de servidor legadas `adminAction`/`adminOverview` (service role) alteravam papéis/status fora do fluxo de convite, mesmo com a tela bloqueada. | Recusam antes de qualquer acesso privilegiado (D37). Teste `dcs-legado-admin.test.ts`. |
| A-07 | Usuários desativados mantinham sessão e refresh token. | `dcs_definir_status_usuario(false)` e a geração de nova credencial apagam `auth.sessions`; perfil nulo para conta inativa. Observação: um access token já emitido continua válido até expirar (≈1 h), mas sem dados (perfil nulo). |
| **A-08 (aberto)** | **Repositório GitHub público** (`viniciusalves-crypto/omunim`). Não há segredos versionados (verificado no histórico: `.env` contém apenas a chave *publishable*, pública por natureza), mas o histórico expõe e-mails de colaboradores, nomes de clientes nos documentos, IDs do Pipedrive e a metodologia interna. | **Ação do responsável:** GitHub → Settings → General → Danger Zone → *Change visibility* → Private (confirmar depois que o Lovable continua sincronizando). O histórico não será reescrito (AGENTS.md); novos documentos não citam nomes nem e-mails reais. |

## Médios

| ID | Achado | Situação |
|---|---|---|
| M-01 | Proteção contra senhas vazadas (HaveIBeenPwned) desativada no Supabase Auth. | **Aberto** — Supabase → Authentication → Providers/Policies → *Leaked password protection* (pode exigir plano pago). A política do app já exige 12+ caracteres e 4 classes. |
| M-02 | "Allow new users to sign up" continua ligado no painel (o MCP não altera Auth). | Mitigado pelo trigger C-01 (o INSERT é recusado). Recomendado manter ligado enquanto convites por Google dependerem do auto-cadastro; o trigger é a barreira efetiva. |
| M-03 | Extração em massa: o front-end lê tabelas pela API REST. | Mitigado: RLS isola carteiras e financeiro; sem exportação; colunas mínimas. **Recomendado:** API Settings → *Max rows* = 1000. Não há limite de frequência por usuário (custo/complexidade desproporcionais ao Beta interno). |
| M-04 | Master ainda é `vinicius@crmcontent.com`; o pedido exige `vinicius.alves@dinamize.net`. | **Aberto** — transferência protegida pela interface (Usuários → Vinícius Alves → *Tornar Master principal*). Não foi feita por SQL: exige a identidade autenticada do Master atual. |
| M-05 | O preview atual (`main`) ainda usa RPCs antigas revogadas na migração (gestão de usuários do preview falha até o merge). | Corrigido com o merge da branch Beta. |

## Baixos

| ID | Achado | Situação |
|---|---|---|
| B-01 | 45 funções SECURITY DEFINER executáveis por `authenticated` (advisor). | Aceito por desenho (CLAUDE.md: toda escrita por função com checagem interna). Funções só de serviço (`dcs_registrar_provisoria`, `dcs_concluir_definicao_senha`, `dcs_revogar_sessoes`, `dcs_exigir_definicao_senha`) **não** estão expostas. |
| B-02 | `search_path` não fixo em função auxiliar. | Corrigido (`20261118163708`). |
| B-03 | `dcs_senha_igual_atual` permite ao usuário comparar texto com a **própria** senha. | Aceito: não revela senha de terceiros; usada para impedir reutilização da provisória. |
| B-04 | Sessão do Supabase em `localStorage` (padrão do supabase-js). | Aceito; sem dados operacionais persistidos no navegador além de preferências do menu. |

## Informativos
- 8 tabelas legadas com RLS e nenhuma política (= sem acesso pela API) — correto.
- Esquema `dcs_backup` (cópias da limpeza) sem USAGE/SELECT para `anon`/`authenticated`.
- n8n: credenciais do Pipedrive e do Supabase somente no cofre do n8n; webhooks não usados pelo app (pedidos via fila `dcs_solicitacoes_sync`, D20); gravação no Pipedrive desligada até ativação do Master (`dcs_config.pipedrive_escrita`).
- Termos de uso e política de privacidade: textos internos (D22) **sem revisão jurídica**. Recomenda-se revisão antes da liberação ampla; ao revisar, subir `TERMS_VERSION`.

## Testes de segurança executados
- **Local (pglite, banco simulado):** 127 cenários, 0 falhas (`supabase/tests/dcs_fundacao.pglite.mjs`).
- **Banco real, transação desfeita, usuários reais (sem credencial privilegiada simulando analista):** cenários 1–8 do pedido —
  cadastro sem convite; convite válido com carteira (59 clientes, 0 fora da carteira, 0 financeiro); convite revogado/expirado; novo convite após expirar;
  troca pendente (perfil nulo, 0 dados); desativado (0 dados); analista tentando convidar ou se elevar; admin comum convidando admin, desativando o Master e alterando a si mesmo; Master com todas as permissões. Todos com o resultado esperado; 6 eventos de auditoria gerados.
- **Front-end:** vitest 278; tsc 0; build ok; Playwright em 1440 e 390 px (backend simulado).
- **Não executado:** login real com senha provisória e e-mail de convite (exige uma pessoa recebendo a credencial) — roteiro em `AUTHENTICATION_AND_INVITATIONS.md`.

## Credenciais a rotacionar
Nenhuma credencial exposta foi encontrada. Não há rotação obrigatória.
