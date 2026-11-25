# Status do projeto

**19/11/2026 12h — Beta 1.1 PUBLICADO** em https://csdinamize.lovable.app (deploy Lovable `79b0f1c4`, commit `95068de`), com aprovação do Vinícius.
Vínculo duplicado com o Pipedrive removido da conta secundária (auditado). Repositório GitHub ainda público: a mudança para privado
precisa ser feita pelo dono no GitHub (o ambiente bloqueia escrita de configurações e o Chrome está em outra conta).

**19/11/2026 — Beta 1.1 (evolução de produto) na branch `dinamize-cs/evolucao-produto`.** Migration `20261119012714_dcs_conexao_pipedrive`
aplicada; n8n 04/06/11 atualizados e 12 criado (publicados). Detalhes: `docs/PRODUCT_UX_EVOLUTION.md`, D38–D40.
Pendências novas: usuário de integração dedicado no Pipedrive; revisar vínculos compartilhados; homologar "Hoje"/Atenção com analistas.

**Fase atual (18/11/2026, 15h):** Dinamize CS **Beta 1.0** na branch `dinamize-cs/finalizacao-beta` (pushed), aguardando homologação.
Banco já migrado (20261118163544/163708/163837). `main` (preview) ainda sem o Beta. Decisões D33–D37.
Documentos: `FINAL_SECURITY_AUDIT.md`, `AUTHENTICATION_AND_INVITATIONS.md`, `PRODUCTION_DATA_CLEANUP.md`, `USER_GUIDE.md`, `DEPLOYMENT.md`, `/CHANGELOG.md`.

## Entregue (implementado + testado)
- Convite em 5 etapas, permissões granulares, Google / link por e-mail / senha provisória, troca obrigatória no banco, redefinir acesso,
  desativação com encerramento de sessões, logs de segurança, Master protegido.
- Cadastro público bloqueado no banco; exportações e rotas/funções legadas bloqueadas; tabelas legadas restritas.
- Marca (tokens oficiais), selo Beta, e-commerce, Sobre o sistema; dicas; onboarding com tours por perfil; central de ajuda; feedback.
- Limpeza dos testes com backup (`dcs_backup.*_20261118`).
- Testes: vitest 278; pglite 127; banco real (transação desfeita) cenários 1–8 ok; tsc 0; build ok; visual 1440/390 px.

## Depende do Vinícius
1. **Repositório GitHub público** (achado alto A-08): tornar privado.
2. **Transferir o Master** para vinicius.alves@dinamize.net pela interface (Usuários → Gerenciar → Tornar Master principal).
3. Homologar no preview após o merge (roteiro em AUTHENTICATION_AND_INVITATIONS.md, inclusive senha provisória com um colega).
4. Supabase Auth: *Leaked password protection*, *Max rows* 1000, redirect `/definir-senha`.
5. Enviar os arquivos oficiais do logotipo (o site bloqueou o download) → `public/marca/`.
6. Decidir: atividade 159570 no Pipedrive; contas antigas (externa desativada e a `.com`); ativar o registro no Pipedrive.
7. Revisão jurídica de Termos/Privacidade (não realizada).
8. n8n: definir o 07 como Error workflow nos demais.

## Próxima ação objetiva
Autorizar o merge fast-forward na `main` (atualiza o preview do Lovable, sem publicar) → homologação → Publish.

---
## Histórico anterior

**Fase atual (18/11/2026):** evolução funcional na branch `dinamize-cs/evolucao-operacional`. Decisões D27–D32; auditoria de UX em
`docs/UX_OPERATIONAL_AUDIT.md`. Banco aplicado: `dcs_evolucao` (20261118144532) e `dcs_meu_acesso_pipedrive` (20261118150803).
n8n: workflow 06 (`5sMpOPysvKwcNSmf`) ativo; só processa registros liberados.

## Entregue nesta fase (implementado + testado)
- Fase 1, Administração: "Novo usuário" com pré-cadastro aplicado no 1º login com e-mail verificado; convite copiável, reenvio, revogação e
  histórico; vínculo com o usuário do Pipedrive; transferência do Master pela interface (validações no banco, auditoria).
- Fase 2, Pipedrive: relatório em 10 seções; atividade "Análise" concluída e idempotente; situação e reprocessamento na ficha; ativação só pelo Master.
  Homologado no negócio Bebecê (atividade 159570).
- Fase 3, Metodologia v2 (D27).
- Fase 4, Contas sem utilização (D29): marcação, revisão rápida, aba na carteira, periodicidade configurável, alertas, indicadores (Visão geral e
  Inteligência) e produtividade separada.
- Fase 5, UX: central de trabalho, revisão incremental, próximo cliente elegível, filtros preservados, atribuição em lote.
- Testes: vitest 270; pglite 85 (30 novos); permissões no banco real com usuários reais em transação desfeita (11 cenários); tsc 0; build ok;
  visual em 1440 e 390 px.

## Depende do Vinícius
1. **Transferir o Master**: entrar com vinicius@crmcontent.com → Usuários → "Vinícius Alves" (vinicius.alves@dinamize.net) → "Tornar Master principal…".
   A conta atual continua como Administrador. Depois, entrar com a conta nova para conferir.
2. **Registro automático no Pipedrive**: decidir quando ativar (Integrações → "Ativar registro automático", só o Master). Registros antigos
   (5 aguardando: Bebecê C1/C2, 124499 C1/C2, 140050 C1) continuam parados até serem liberados um a um.
3. Atividade de teste 159570 no Bebecê: manter ou excluir (relatório no formato anterior).
4. Homologação visual com dados reais no preview; publicação definitiva só depois.
5. n8n: definir o 07 como Error workflow em 01, 04, 05, 06, 08, 10 e 11 (o conector não aplica essa opção).

## Próxima ação objetiva
Vinícius homologa no preview (roteiro acima); depois, merge na `main` e publicação no Lovable.

---
## Histórico anterior

**Fase atual (17/11/2026, tarde):** auditoria funcional na branch `dinamize-cs/auditoria-funcional` (merge na `main`). Matriz: `docs/FUNCTIONAL_AUDIT.md`.
- Causa do problema: carteira sem ação de início (nenhuma chamada de início chegou ao Supabase). Corrigido com coluna de ações.
- Ciclo completo validado no Supabase real (12 passos, transação desfeita). Login real pendente de homologação manual.

## Homologação manual (Vinícius, conta atual)
1. Carteira → em um cliente "Aguardando", **Iniciar análise** → abre a ficha; status "Em andamento"; voltar à carteira e conferir.
2. Preencher itens nas 7 categorias, a matriz de automações e a janela do carrinho; aguardar "Salvo"; **recarregar a página** e conferir; sair e entrar de novo.
3. Concluir → índice, plano de ação; editar uma ação (prioridade, prazo); criar uma **Nova ação**.
4. Histórico; **Reabrir análise…** (motivo) e concluir de novo; **Iniciar nova rodada**.
5. Visão geral: conferir que a análise concluída entrou nos indicadores.
6. Configurações → Cobertura: classificar os 3 tipos pendentes e publicar.
7. n8n: em 01, 04, 05, 08, 10 e 11, Settings → Error workflow = "Dinamize CS | 07 — Monitoramento e falhas".
Observação: os passos 1–4 gravam em um cliente real escolhido por você.

---
## Histórico anterior

**Fase atual (17/11/2026):** transformação completa em produto único "Dinamize CS" na branch `dinamize-cs/full-product-redesign`
(backup da main anterior: `backup/pre-redesign-2026-11-17` = 4d12750). Banco e n8n já atualizados (mudanças aditivas). Sem publicação definitiva.

## Transformação completa (etapas 1–6) — implementada e testada
- Identidade: tema claro único (#EA5456 / #D13F41, fundo #F5F6F8, texto #1F2430, Inter), novo símbolo, favicon, manifest, metadados, telas de erro.
- Shell: menu lateral branco recolhível/responsivo (Visão geral · Operação · Inteligência · Administração), contadores, item ativo, visibilidade por perfil,
  rodapé com usuário/perfil/minha conta/sair; cabeçalho com página, status real do Pipedrive e n8n, notificações e "Atualizar carteira" (admin).
- "/" → `/dcs`. Login, recuperação de senha, aguardando liberação, termos e privacidade com a marca Dinamize CS.
- Telas: Visão geral (8 KPIs, evolução, utilização, cobertura com drill-down, planos, 7 filtros globais na URL); Carteira (15 colunas configuráveis,
  ordenação por coluna, agrupamento por responsável, exportação por permissão, analista, % analisado, oportunidades); Diagnóstico (categorias com
  progresso, atalhos Alt+←/→ e Ctrl+S, matriz de automações em tabela com resultado do motor, comparação com o ciclo anterior); Planos (tabela + kanban,
  filtros cliente/responsável/prioridade/status/prazo/complexidade, detalhe com edição e histórico); Cobertura; Alertas; Inteligência gerencial (nova);
  Histórico de diagnósticos (novo); Usuários e permissões (novo); Configurações versionadas (novo); Integrações e monitoramento; Minha conta.
- Banco (aplicado): `dcs_admin_produto`, `dcs_ultimo_master`, `dcs_admin_so_master` — ver D19–D21.
- n8n: workflow 11 (pedidos da interface) ativo; 01 e 05 receberam gatilho de subworkflow (D20). Teste real ok.
- Validação: tsc 0; vitest 234; pglite 47; build ok; visual automatizado em 5 resoluções (scripts/visual).

## Depende do Vinícius (verificações com login real no preview)
- Conferir visualmente as telas autenticadas com dados reais (o teste automatizado usou backend simulado).
- Cadastrar a equipe em Usuários e permissões (carteiras não foram presumidas) e aprovar contas pendentes.
- Definir o 07 como Error workflow nos demais workflows do n8n; classificar tipos de atividade (D13); autorizar ou não a escrita no Pipedrive.
- Publicação definitiva no Lovable só após homologação visual e funcional.

## Próxima ação objetiva
Vinícius abre o preview, confere as telas e cadastra a equipe; depois: workflows 02/03/06/09 e importação do histórico do artefato (se existir fora do Pipedrive).

---
## Histórico anterior

**Fase atual:** interface do núcleo na `main` (merge fast-forward 3455efe → 451e9e0 em 17/11/2026, sincronizado no Lovable; preview em estado ready). Site publicado do Munin só muda após Publish no Lovable.
**Branch:** `dinamize-cs/fase-0` (local; push aguardando permissão). **Base:** `main@3455efe` (tag `backup/munin-pre-dcs-2026-11-16`).

## Concluído (implementado + testado)
- Porte 1:1 da metodologia (`src/lib/dcs/artefato-v1.ts`) e motor com correções C1–C5 (`src/lib/dcs/motor.ts`): 28 testes.
- Migrations `dcs_*` (acesso, regras versionadas, carteira + financeiro isolado, cobertura, diagnósticos/ciclos/eventos, plano de ação,
  outbox, logs, alertas, config, mensagens, preferências) + rollback: 32 cenários pglite aprovados.
- 10 workflows n8n importáveis + código compartilhado testado contra o motor: 3 testes.
- Repositório: tsc 0 erros, eslint ok, 219 testes aprovados.
- IDs do Pipedrive validados por leitura (funil, etapas, campos, opção 360).

## Implementado, não homologado
- Migrations não aplicadas em nenhum Supabase real. Workflows não importados no n8n.

## Pendente
- Interface completa (todas as telas), renomear projeto no Lovable, identidade visual.
- Validação com dados reais em leitura; homologação; produção.

## Integrações em produção (17/11/2026)
- Supabase "Munim V2": migrations `dcs_fundacao`, `dcs_integracoes_alertas`, `dcs_responsaveis_por_coluna` aplicadas; 35 cenários pglite aprovados; verificador de segurança sem erros nos objetos dcs_* (avisos aceitos: funções SECURITY DEFINER chamáveis por usuários autenticados, todas com checagem interna).
- n8n: workflows 01, 04, 05, 08 e 10 ativos; 07 como workflow de erro. Execuções de teste com dados reais:
  - 04: 45 responsáveis (12 ativos).
  - 01: 700 negócios lidos no funil 15 → 221 clientes e-commerce, leitura completa, 0 inativados, todos com valor.
  - 05: 221 clientes com o campo de contato efetivo; 52 em dia, 14 atenção, 28 pendentes, 127 críticos; 36 divergências com as atividades.
  - 08: 127 alertas de cobertura crítica.
- Pendente no n8n: definir o 07 como "Error workflow" nas configurações dos demais (Settings → Error workflow); 02, 03, 06 e 09 (D17, escrita no Pipedrive aguarda autorização).

## Achados
- D14: migrations do Munin de 25/10 não aplicadas no banco.

## Interface (17/11/2026) — implementada e testada localmente
Área `/dcs` dentro do app (tema claro Dinamize, #EA5456), item "Dinamize CS" no menu:
- Visão geral (KPIs com acesso aos clientes, por responsável, recursos com menor adesão).
- Carteira (busca, filtros por responsável/status/cobertura, ordenação; valor só com permissão financeira e ordem padrão alfabética sem ela; paginação; inativos; CSV; link Pipedrive).
- Cliente: diagnóstico com 7 categorias, estados, subitens condicionais, dependências, matriz de automações + janela de 1 dia, métricas 30/90 dias com sugestão automática, resultados; salvamento automático (1,2 s) com indicador, conflito de versão e aviso ao sair; índice/faixa/preliminar; recomendações; conclusão com resumo e confirmação de pendências; plano de ação editável; histórico com comparação entre ciclos; mensagens WhatsApp/e-mail por template.
- Minhas análises, Planos de ação (filtros: abertas, atrasadas, ganhos rápidos, reincidências), Cobertura (faixas, precisam de contato, divergências campo × atividades), Alertas, Integrações (sincronizações, fila do Pipedrive, eventos).
Validação: tsc 0 erros, lint sem erros, 222 testes, build de produção ok; no banco real, sessões simuladas: superadmin vê 221 clientes/valores/cobertura/127 alertas, usuário sem cadastro não vê nada; fluxo iniciar → salvar → conflito 40001 → concluir → job "aguardando_autorizacao" → novo ciclo herdando respostas executado e desfeito (sem resíduo).

## Pendente
- Validação visual no preview com login real (Vinícius).
- Tela de usuários e permissões (hoje: admin/superadmin do Munin já entram como admin; demais exigem `dcs_membros`).
- Configurações administrativas (pesos, faixas, metas de cobertura) — banco pronto (`dcs_publicar_regras`).
- Inteligência gerencial ampliada (gráficos de evolução), workflows 02/03/06/09.

## Próxima ação objetiva
Após o merge: cadastrar a equipe (Cheyne, Manoela, Juliana, Enzo) com suas carteiras e construir Usuários e Configurações.

## 25/11/2026 — implementação das correções da auditoria Pipedrive (D41)
Correções #1 (plano de ação) e #2 (link) de `docs/PIPEDRIVE_INTEGRATION_AUDIT.md` implementadas e testadas
(migration `20261125120000_dcs_pipedrive_acoes_plano.sql`, 152 cenários pglite, 0 falhas, `tsc` 0 erros). Correção #3
já estava implementada desde 18/11 (achado da própria auditoria corrigido). Workflow n8n 06 atualizado para o novo
tipo de job e o link, mas **salvo só como rascunho**: credenciais dos nós HTTP precisam ser atribuídas manualmente
no n8n antes de publicar (pendente, sem risco — produção segue na versão de 19/11, sem alteração). Nenhuma escrita
real no Pipedrive habilitada (`pipedrive_escrita.ativa` continua `false`).
