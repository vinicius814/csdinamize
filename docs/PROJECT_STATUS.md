# Status do projeto

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
