# Auditoria técnica — Envio de diagnósticos e análises ao Pipedrive

Data: 25/11/2026. Auditoria independente, sem alterações em produção (nenhuma migration, nenhum workflow
alterado, escrita no Pipedrive não habilitada, nenhuma nota fictícia criada). Evidências coletadas por
inspeção de código (migrations, workflow n8n), consulta direta ao Supabase e consulta direta ao Pipedrive
(não apenas leitura do status interno).

## A. Veredito principal

**PARCIALMENTE.**

O mecanismo de envio existe, está corretamente implementado e foi **comprovadamente funcional** — mas está
**bloqueado por desenho** (`dcs_config.pipedrive_escrita.ativa = false`) e, além disso, cobre só uma parte
do que a pergunta original pede: diagnóstico concluído sim; plano de ação, não, em nenhuma hipótese
atual (não é um bug — a tabela de fila nem aceita esse tipo de evento; ver seção D).

Nenhum diagnóstico real concluído atualmente no sistema chegou ao Pipedrive. Existe, porém, **um registro
histórico confirmado** (18/11/2026) que prova que o caminho completo funciona quando autorizado.

## B. Matriz das integrações

| Funcionalidade | Salva no Supabase | Envia ao Pipedrive | Confirmado no destino | Problemas |
|---|---|---|---|---|
| Diagnóstico concluído | ✅ `dcs_diagnosticos` | ⚠️ Gera job, mas fica retido (`aguardando_autorizacao`) | ✅ Comprovado em 1 caso histórico (18/11); ❌ nenhum dos 6 diagnósticos reais atuais | Bloqueio é intencional (config), não falha técnica |
| Índice de aproveitamento | ✅ campo `indice` | ✅ Incluído no texto da nota (quando o job roda) | ✅ Confirmado no caso histórico | Não vai como campo estruturado, só como texto |
| Resumo da análise | ✅ campo `resumo` | ✅ Enviado como corpo da nota (HTML simples) | ✅ Confirmado no caso histórico | Sem link de volta para o diagnóstico no Dinamize CS |
| Oportunidades / recomendações | ✅ embutidas em `resumo` e `dcs_acoes` | ⚠️ Só o texto que já estava em `resumo` no momento da conclusão | ✅ Confirmado no caso histórico (texto) | Não há envio estruturado separado; é uma fotografia única, não atualizável |
| Plano de ação (criação) | ✅ `dcs_acoes` | ❌ Nenhum mecanismo | ❌ N/A | **Lacuna funcional**: `dcs_jobs.tipo` só aceita `pipedrive_atividade_diagnostico` e `mensagem_ia` (CHECK constraint) |
| Atualização de ação | ✅ `dcs_acoes_eventos` | ❌ Nenhum mecanismo | ❌ N/A | Idem — nenhum evento de ação gera job |
| Conclusão de ação | ✅ `dcs_acoes_eventos` | ❌ Nenhum mecanismo | ❌ N/A | Idem |

## C. Fluxo técnico real

```
Analista conclui diagnóstico (UI)
  → RPC dcs_concluir_analise (SECURITY DEFINER)
      → grava dcs_diagnosticos (status=concluido) + dcs_acoes (plano) + dcs_diagnosticos_eventos/dcs_acoes_eventos
      → SE p_registrar_pipedrive: insere 1 linha em dcs_jobs
            tipo='pipedrive_atividade_diagnostico', chave='DZCS-<cliente>-C<ciclo>' (idempotência),
            status = 'pendente' SE dcs_config.pipedrive_escrita.ativa=true, SENÃO 'aguardando_autorizacao'
→ n8n "Dinamize CS | 06 — Registro do diagnóstico no Pipedrive" (ativo, agendado a cada 5 min, 825 execuções
  históricas, todas "success" — mas idle, porque dcs_reservar_jobs só pega status IN ('pendente','falha'))
      → reserva jobs → monta corpo (subject, type='anlise', note=HTML do resumo) → busca atividades do
        negócio (idempotência pela marca DZCS-...) → POST (nova) ou PATCH (já existe) em
        api.pipedrive.com/v2/activities → grava resultado via dcs_finalizar_job
```

Nenhum outro workflow envia dados do Dinamize CS para o Pipedrive. Os workflows 13/14/15 (e 01, 04, 05)
são **leitura** Pipedrive → Supabase, na direção oposta à pergunta.

## D. Dados verificados (evidência no destino, não apenas no status interno)

- **`dcs_config.pipedrive_escrita.ativa = false`** (confirmado por consulta direta, 25/11/2026). Esta é a
  trava — implementada na própria função SQL (`dcs_concluir_analise`), não só na aplicação.
- **`dcs_jobs`: 7 registros.** 6 com `status='aguardando_autorizacao'` (diagnósticos reais concluídos entre
  18/11 e 25/11). 1 com `status='concluido'` (chave `DZCS-139033-C3`, sem diagnóstico correspondente hoje em
  `dcs_diagnosticos` — ver nota de inconsistência abaixo).
- **Esse 1 registro concluído foi verificado diretamente no Pipedrive** (não apenas no status do Supabase):
  atividade `159570` no negócio `24730` (Calçados Bebecê Ltda.), tipo `anlise`, `done=true`, nota em HTML
  contendo cliente, responsável de CS, analista, data, índice (65/100), resumo do cenário, pontos positivos,
  problemas, oportunidades, recomendações prioritárias e a marca `DZCS-139033-C3`. **Confirma que o
  mecanismo funciona ponta a ponta quando autorizado.** `dcs_integracao_logs` mostra o POST inicial e um
  PATCH 15s depois (teste controlado em 18/11, não uma análise real de cliente).
- **Nenhum dos 6 diagnósticos reais atuais tem qualquer rastro no Pipedrive** — nem nota, nem atividade
  `anlise` com a marca correspondente. Consistente com o status `aguardando_autorizacao`.
- **Mapeamento cliente → negócio verificado em amostra** (ex.: `122501` → negócio `15412`, confere nome e
  `org_id` no Pipedrive): sem indício de risco de associar a negócio errado.
- **Workflow 06 está ativo e saudável** (825 execuções, 100% sucesso), só não tem o que processar — não é
  um workflow quebrado, é um workflow correto aguardando autorização.
- **Nenhum job com `status='falha'` ou `tentativas>=5`.** Não há fila travada nem descarte silencioso.

### Inconsistência encontrada (não bloqueante, só anotada)
O job `DZCS-139033-C3` (o único "concluído") não corresponde a nenhum diagnóstico em `dcs_diagnosticos`
hoje. Pelo texto da nota registrada no Pipedrive e pelo registro em `docs/PIPEDRIVE_INTEGRATION.md`
("Escrita não testada; comprovada pelo último registro confirmado"), tudo indica que foi um teste
controlado e autorizado anteriormente para validar o mecanismo — não uma análise real perdida. Não foi
possível confirmar a origem exata nesta auditoria; fica registrado para o caso de precisar rastrear depois.

## E. Auditoria quantitativa

- Diagnósticos concluídos (reais, hoje em `dcs_diagnosticos`): **6**
- Diagnósticos em andamento (`em_analise`, corretamente sem job): **4**
- Exigem envio ao Pipedrive pela regra existente: **6** (os 6 concluídos geraram job — 100% de cobertura na
  criação do job, 0 omissões)
- Efetivamente enviados (confirmados no destino): **0** dos 6 reais (bloqueados por configuração)
- Pendentes (aguardando autorização, não é falha): **6**
- Falharam: **0**
- Sem evento de integração gerado (quando deveriam ter gerado): **0** (todos os concluídos geraram)
- Inconsistências: **1** (job órfão `DZCS-139033-C3`, ver acima)
- Planos de ação que exigiriam sincronização (por regra a ser definida, hoje nenhuma): **22** ações ativas
  em `dcs_acoes` — nenhuma tem qualquer mecanismo de envio

**Taxa de envio confirmado: 0% dos diagnósticos reais atuais** — não por falha técnica, e sim porque a
liberação (`pipedrive_escrita.ativa`) nunca foi ativada desde que o mecanismo foi comprovado em 18/11. Não
calculo uma taxa "ajustada" porque não há base suficiente nem é isso que a pergunta original pede.

## F. Problemas identificados

| # | Problema | Severidade |
|---|---|---|
| 1 | Plano de ação (criação, atualização, conclusão) não tem nenhum mecanismo de sincronização com o Pipedrive — nem um colega que só usa o CRM consegue acompanhar o plano | **Alto** (lacuna funcional, não falha) |
| 2 | A nota registrada na atividade não inclui link de volta para o diagnóstico completo no Dinamize CS | **Médio** |
| 3 | O "resumo" enviado é uma fotografia do momento da conclusão; se o diagnóstico for reaberto/revisado (`dcs_reabrir_analise`), nada reenvia automaticamente a versão nova — depende de alguém reativar `pipedrive_escrita` ou reprocessar manualmente | **Médio** |
| 4 | Job órfão `DZCS-139033-C3` sem diagnóstico correspondente — rastreabilidade incompleta desse registro específico | **Baixo** |
| 5 | `pipedrive_escrita.ativa=false` represando 100% dos envios reais desde que o recurso foi comprovado — não é bug, mas é o motivo direto do veredito "PARCIALMENTE" | **Informativo** (configuração proposital, não "problema" de código) |

Nenhum achado **Crítico** (não há risco de duplicidade, perda silenciosa, cliente errado ou exposição de
credencial — todos verificados na seção D).

## G. Proposta de correção (para autorização futura, nada implementado)

| # | Causa | Componente | Correção recomendada | Risco | Complexidade | Dependências | Exige autorização de escrita no Pipedrive? |
|---|---|---|---|---|---|---|---|
| 1 | `dcs_jobs.tipo` não contempla ações | Migration (CHECK constraint) + novo job type + extensão do workflow 06 (ou workflow novo) | Adicionar `tipo='pipedrive_atividade_acao'` (ou similar) dentro do mesmo padrão de fila/autorização já existente | Baixo (aditivo) | Média | Nenhuma | Sim, para o envio real; não para construir o mecanismo em si (nasce com o mesmo gate) |
| 2 | Payload do job não carrega URL do diagnóstico | `dcs_concluir_analise` (payload) + código do nó "Preparar atividades" no n8n | Incluir `link` no `jsonb_build_object` e no corpo da nota | Baixo | Baixa | Nenhuma | Não (é só composição de texto; a trava de escrita continua valendo) |
| 3 | Revisão de diagnóstico não reenvia | `dcs_reabrir_analise` / `dcs_concluir_analise` | Ao concluir uma revisão, gerar novo job ou reabrir o existente ao invés de depender de toggle manual | Médio (mexe em regra de negócio) | Média | Decisão de produto: "versão enviada deve ser sempre a mais recente?" | Sim, para qualquer envio real |

Nenhuma dessas correções foi implementada. Todas exigiriam: mudança aditiva no banco (nova migration),
teste novo (conforme `CLAUDE.md`), e autorização explícita separada para qualquer escrita real de teste.

## H. Recomendação funcional

Pelo que já está construído e funciona (caso de 18/11), a abordagem atual — **uma atividade "Análise" por
ciclo de diagnóstico, com nota estruturada e marca de idempotência** — já é o formato certo: um colaborador
que só usa o Pipedrive consegue ler cliente, analista, data, índice, resumo, problemas e recomendações
diretamente na atividade, sem precisar abrir o Dinamize CS. Recomendo manter esse mecanismo como está e
apenas:

1. Adicionar o link para o diagnóstico completo no Dinamize CS dentro da nota (problema #2).
2. Estender o mesmo padrão (fila + autorização) para plano de ação, mas como **um resumo consolidado do
   plano** (quantas ações, quantas críticas, quantas concluídas) atualizado quando o diagnóstico é revisado
   — e não uma nota por ação individual, que poluiria o histórico do negócio.
3. Não criar campos personalizados novos: o formato de nota já é legível e não exige mapeamento de schema
   no Pipedrive.

A decisão de quando ativar `pipedrive_escrita.ativa=true` (e liberar os 6 jobs represados) é de negócio, não
técnica — o mecanismo já está pronto para isso.

---
*Auditoria realizada sem autorização de escrita no Pipedrive, sem migrations, sem alteração de workflows em
produção e sem interferência na auditoria de UX em paralelo. Aguardando autorização antes de qualquer
implementação das correções acima.*
