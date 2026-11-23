# Dinamize CS — Gestão Operacional MVP (status)

Frente nova, aditiva, sobre o produto Dinamize CS já publicado (Beta 1.1). Não mexe no artefato Gestor
(outro projeto, repo/VPS separados) nem no motor de diagnóstico (`src/lib/dcs/motor.ts`, `artefato-v1.ts`).

## Checkpoint
- Branch: `dinamize-cs/gestor-operacional-mvp`, criada a partir de `main@3008d74` (23/11/2026).
- Push ao GitHub confirmado nesta sessão (acesso liberado por admin da org). Repo foi transferido/renomeado para
  `vinicius814/omunim` — **continua público, com `.env` commitado na raiz** (pendência de segurança já registrada
  nos docs antigos como A-08; só o dono resolve via GitHub settings).

## Módulos implementados (confirmados por módulo entre `dcs_*`/`src/components/dcs`)
Visão geral, Carteira de clientes, Minhas análises, Planos de ação, Cobertura de CS, Alertas e pendências,
Inteligência gerencial, Histórico de diagnósticos, Usuários e permissões, Configurações, Integrações,
Diagnóstico detalhado (motor completo, testado). Onboarding guiado do app (tours) também existe, mas é
funcionalidade diferente do onboarding operacional de clientes.

## Gaps confirmados (pedidos no spec, ausentes no módulo `dcs_*`)
- Cancelamentos e retenção — só existe em `cs_cancelamentos` (sistema Munim legado), não portado.
- Onboarding operacional de clientes (pipeline Pipedrive id 1, 8 etapas) — não existe no `dcs_*`.
- Gestão da equipe (visão por responsável) — só existe como `/carteiras-cs` no sistema legado.
- Radar de inteligência — hoje é "Alertas e pendências", sem estrutura motivo/evidência/prioridade/ação.
- Metas — não existe.
- Assistente gerencial — não existe.
- Relatórios gerenciais — "Inteligência gerencial" cobre parte, não a amplitude pedida.

## Arquivos principais
- Navegação: `src/components/dcs/navegacao.ts`, `src/components/dcs/Shell.tsx`.
- Pipedrive: pipeline Onboarding id 1 (8 etapas, validado via API em 23/11/2026).
- Supabase: projeto "Munim V2" (`dknywurmzgrkxiytvncp`). Achados do advisor de segurança: 8 tabelas legadas
  `cs_*`/`google_tokens`/`registros` com RLS habilitado e sem política (achado, não corrigido ainda);
  leaked password protection desativada (pendência já conhecida).

## Último commit
`3008d74` — "Status: Beta 1.1 publicado; vínculo duplicado corrigido; repositório privado pendente".

## Próxima etapa
1ª mensagem ao agente Lovable (23/11/2026, em andamento): reorganizar `navegacao.ts`/`Shell.tsx` nos grupos
Início/Operação/Acompanhamento/Inteligência/Diagnósticos/Administração, com itens novos (Assistente, Onboarding,
Gestão da equipe, Atividades e pendências, Cancelamentos e retenção, Metas) marcados "Em breve" até serem
implementados um a um. Sem alterar rotas ou lógica existentes.

## Pendências/bloqueios
- Repo público + `.env` commitado: ação do dono no GitHub.
- RLS sem política em 8 tabelas legadas: avaliar se ainda são usadas antes de criar políticas ou remover.
- Pendências antigas já registradas em `docs/PROJECT_STATUS.md` (transferência de Master, Supabase Auth,
  usuário de integração dedicado no Pipedrive) seguem em aberto, independentes desta frente.
