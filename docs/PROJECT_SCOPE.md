# Escopo funcional

Sistema interno de Customer Success da Dinamize que substitui o artefato do Claude, sem depender do Claude em uso.
Foco inicial: clientes **e-commerce** do funil Customer Success (Pipedrive, funil 15). Arquitetura preparada para outros
segmentos (`dcs_clientes.segmento`).

Módulos (detalhes de regra em BUSINESS_RULES.md; equivalência em ARTIFACT_MAPPING.md):
1. Visão geral (dashboard executivo com acesso aos clientes de cada indicador).
2. Carteira de clientes (sincronizada do Pipedrive; busca, filtros, colunas, exportação conforme permissão).
3. Minhas análises (atribuídas, em andamento, concluídas, revisões vencidas, pendências).
4. Diagnóstico da conta (7 categorias, 6 estados, subitens condicionais, evidências, autosave, concorrência).
5. Matriz de automações (12 automações; implementada/ativa/funcional/relatório/melhoria; janela de 1 dia).
6. Índice de aproveitamento (pesos 25/30/15/10/10/5/5; preliminar/indisponível; regras versionadas).
7. Planos de ação (gerados do diagnóstico; status próprios; reincidência; independem do status do diagnóstico).
8. Cobertura de CS (contato efetivo ≠ atividade concluída; tentativas; agendados; metas por carteira/valor).
9. Inteligência gerencial. 10. Histórico de ciclos. 11. Mensagens (templates; IA opcional via n8n; nunca envia).
12. Usuários e permissões (admin, analista de CS, analista de contas; carteira, cliente, financeiro, módulos).
13. Configurações administrativas.

Fora do escopo agora (só estruturas mínimas): Dinamize Marketing/Atendo, health score, churn, IA de priorização.
