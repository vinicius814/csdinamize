# Auditoria operacional de UX — Dinamize CS (18/11/2026)

Foco: a rotina de um time de CS que acompanha centenas de contas. A pergunta para cada tela foi: o que o analista precisa
fazer agora? Quantos passos isso exige hoje? O que pode ser automatizado sem esconder informação?

Ganhos em cliques e minutos são **estimativas** feitas percorrendo o fluxo antes e depois da mudança, com os dados
simulados do teste visual. Ainda não houve medição com usuários reais. Medir no uso real: tempo médio por diagnóstico
(iniciado → concluído, já registrado em `dcs_diagnosticos`) e número de acompanhamentos por semana.

## 1. Achados e o que foi feito

| # | Achado (antes) | Impacto | Solução implementada | Ganho estimado |
|---|---|---|---|---|
| U1 | "Minhas análises" eram 4 listas soltas (andamento, vencidas, pendências, concluídas) sem ordem de prioridade | o analista decidia sozinho por onde começar; análises paradas e revisões vencidas se misturavam | **Central de trabalho**: uma fila única ordenada por urgência (sem utilização vencida → análise parada há 5 dias ou mais → revisão vencida → em andamento → revisão próxima → pendências → carteira a iniciar, maior valor primeiro), com destaque "Próxima tarefa" e filtro por tipo (`src/lib/dcs/fila.ts`, testado) | escolher o próximo cliente passa de ~1–2 min de varredura para 1 clique |
| U2 | Novo ciclo herdava respostas sem distinguir o que foi revisto do que só foi copiado | risco de concluir com informação velha; nenhuma rastreabilidade | **Revisão incremental**: "Confirmar igual", "Revalidar" e "Não se aplica mais" em cada item herdado, com data e usuário; mudança de estado registra "Alterado" automaticamente; contador por categoria; filtro "Mostrar só o que precisa de atenção"; confirmação em lote **apenas** das automações da matriz sem mudança (`src/lib/dcs/revisao.ts`, testado) | 2º ciclo: das ~60 perguntas, revisar só as alteradas ou pendentes (estimado: −40% a −60% do tempo) |
| U3 | Contas paradas exigiam o diagnóstico completo ou ficavam "aguardando" para sempre | índice distorcido (zeros), dezenas de recomendações irrelevantes, conta sem dono | **Contas sem utilização**: formulário de 1 tela, diagnóstico dispensado temporariamente, índice "indisponível" preservando o último, revisão rápida em 1 clique + data, aba própria na carteira, alertas e indicadores | marcar ~1 min; revisar ~20 s (antes: não havia fluxo) |
| U4 | Depois de concluir, voltar à carteira perdia os filtros; achar o próximo cliente exigia nova busca | retrabalho em toda conclusão | Filtros da carteira guardados na sessão e restaurados pelo "voltar"; **"Próximo cliente elegível"** na ficha concluída (mesma carteira, sem diagnóstico, maior valor, ignora contas sem utilização) | −3 a −5 cliques por conclusão |
| U5 | Atribuir análises era cliente a cliente | distribuir a carteira entre analistas levava minutos | **Atribuição em lote** (admin): seleção na carteira (só "aguardando" e em utilização) → escolher analista → atribuir; falhas listadas uma a uma. Nada é concluído em massa | 20 atribuições: de ~60 cliques para ~23 |
| U6 | Registro no Pipedrive era manual, e não havia como saber se a atividade foi criada | duplicidade ou esquecimento | Registro automático (workflow 06) com situação visível na ficha: Pendente de confirmação / Aguardando / Registrando / Registrado (link) / Falha + Reprocessar | ~3–5 min por diagnóstico (copiar relatório, criar atividade, vincular) |
| U7 | Cadastrar alguém exigia a pessoa entrar primeiro e o admin aprovar depois | dependência de horário entre as duas pessoas | **Novo usuário com pré-cadastro**: permissões aplicadas no 1º login com e-mail verificado; convite copiável, reenvio, revogação e histórico | 1 interação do admin em vez de 2 |
| U8 | Entregabilidade com 2 períodos (30/90) e 15 campos, frequência informada à mão | preenchimento lento e inconsistente | Período único de 60 dias + situação atual; principais visíveis e complementares recolhidos; frequência semanal calculada (disparos ÷ 60/7), com ajuste manual explícito | −10 campos por diagnóstico |
| U9 | Ação principal da carteira não considerava o estado da conta | "Iniciar análise" aparecia em conta sem utilização | Ação principal muda para "Revisar utilização"; menu ganha "Marcar sem utilização…" | — |

Itens mantidos da auditoria anterior (`docs/FUNCTIONAL_AUDIT.md`): salvamento automático com indicador e aviso ao sair,
conflito de edição detectado, atalhos de teclado, colunas configuráveis, filtros na URL.

## 2. Preenchimento automático e origem dos dados

Regra: todo dado preenchido automaticamente mostra a origem.
- "Sugerido pelas métricas" nos itens marcados pela entregabilidade (o analista pode alterar).
- Frequência semanal: "Calculada: disparos ÷ (60 ÷ 7)" ou "Preenchida manualmente".
- Responsável, organização, pessoa e valor vêm da sincronização do Pipedrive (já rotulados na ficha).

## 3. Oportunidades com APIs (documentadas, **não implementadas**)

Hipóteses a validar com a documentação oficial e credenciais, sem implementação nesta etapa:

| Fonte | Dado possível | Uso no Dinamize CS | Pré-requisito |
|---|---|---|---|
| API Dinamize Marketing | envios, entregas, aberturas, cliques, bounces, descadastros e spam por período; nº de disparos; base e engajamento | preencher a Entregabilidade de 60 dias e a situação atual com origem "API"; detectar "sem utilização" (nenhum disparo em N dias) e sugerir a marcação | credencial por conta-cliente ou de parceiro; confirmar endpoints, limites e se os números batem com os relatórios da plataforma |
| API Dinamize Marketing | automações existentes e status (ativa/pausada) | pré-preencher a matriz de automações ("implementada", "ativa") deixando "funcional" para o analista | mapeamento automação → item da metodologia |
| Atendo | tickets e conversas recentes do cliente | evidências da conta sem utilização; última interação real; contexto para o diagnóstico | API e escopo de leitura; vínculo cliente ↔ organização |

Nenhum dado de API deve sobrescrever resposta do analista. A sugestão aparece com a origem, como já acontece com as
métricas.

## 4. Pendências de UX (próximas iterações)
- Medir o tempo real por diagnóstico antes/depois (dados já existem em `dcs_diagnosticos`).
- Revisão incremental também nas métricas (hoje: itens e matriz).
- Pré-preenchimento por API (seção 3), após validar as fontes.
- Envio automático de convite por e-mail (hoje: convite copiável; o envio automático exige configurar o e-mail transacional do Supabase).
