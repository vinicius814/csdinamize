# Status do projeto

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
