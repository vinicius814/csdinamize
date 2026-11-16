# Workflows n8n

Arquivos importáveis em `n8n/workflows/` (gerados por `n8n/build.py`; todos importam **inativos**). Nenhuma credencial embutida:
os nós apontam para credenciais pelo nome, que o admin cria no n8n:

| Credencial (nome exato) | Tipo n8n | Conteúdo |
|---|---|---|
| DCS · Supabase service role | Supabase API | URL do projeto + service role key |
| DCS · Pipedrive (cs-dinamize) | Pipedrive API | token de um usuário técnico |
| DCS · Segredo dos webhooks | Header Auth | cabeçalho `X-DCS-Token` + segredo forte |
| DCS · Anthropic (opcional) | Anthropic API | só se a IA de mensagens for ativada |

Depois de importar: preencher `supabase_url` no nó **Config** de cada workflow; no 03, escolher o workflow 02 no nó de execução;
definir o 07 como *Error workflow* dos demais.

| # | Arquivo | Gatilho | Faz |
|---|---|---|---|
| 01 | 01-sincronizacao-inicial-carteira | diário 05:40 | lê funil inteiro, consolida, publica; inativa ausentes só se leitura completa |
| 02 | 02-sincronizacao-incremental | seg–sex 8h–19h :15 e chamado pelo 03 | idem, nunca inativa |
| 03 | 03-webhooks-pipedrive | webhook POST `/dcs-pipedrive` | autentica, filtra funil 15, deduplica 24h, chama 02 |
| 04 | 04-sincronizacao-responsaveis | diário 06:10 | usuários ativos/inativos; nomes da carteira pelo ID |
| 05 | 05-cobertura-cs | seg–sex 07:20 e 13:20 | classifica atividades (120 dias), agendados; leitura incompleta não publica |
| 06 | 06-registro-diagnostico | a cada 5 min | fila dcs_jobs → confere marca DZCS → cria atividade → registra ID; ambíguo não duplica |
| 07 | 07-monitoramento-falhas | erro de workflow | log em dcs_integracao_logs |
| 07b | 07b-reprocessar-pendentes | a cada 30 min | devolve jobs ambíguos/travados à fila; alerta após 5 tentativas |
| 08 | 08-revisoes-alertas | diário 07:05 | recalcula dcs_alertas |
| 09 | 09-mensagens-ia-opcional | webhook `/dcs-mensagem-ia` | gera e valida JSON; o app cai para templates em caso de falha |

Situação: o n8n da Dinamize está acessível pelo conector, mas os workflows **não foram criados lá** (faltam as credenciais DCS e a
aprovação do primeiro deploy). Os 13 workflows existentes de onboarding/DPS não foram alterados.
Pendente de validação no n8n real: parâmetros de paginação do nó HTTP e formato da resposta das RPCs.
