# Decisões técnicas

| # | Data | Decisão | Motivo | Situação |
|---|---|---|---|---|
| D1 | 16/11/2026 | Trabalho em branch `dinamize-cs/fase-0`; `main` intocada até homologar | `main` sincroniza com o Lovable e publica | ativa |
| D2 | 16/11/2026 | Banco aditivo com prefixo `dcs_`, reaproveitando `profiles`, `user_roles`, `account_access`, Auth Google | preservar usuários e infraestrutura; rollback isolado | ativa |
| D3 | 16/11/2026 | Metodologia portada 1:1 em arquivo próprio; correções só em `motor.ts` | auditar o original e testar cada correção | ativa |
| D4 | 16/11/2026 | Valor recorrente = soma de `deal.value`; ausente = nulo | regra confirmada pela operação (docs/regras-operacao-cs.md, 25/10/2026); `mrr` da API vem nulo | ativa |
| D5 | 17/11/2026 | **Contato efetivo = campo do negócio "Data do último contato efetivo" no Pipedrive** (maior data entre os negócios do cliente). A classificação de atividades do artefato fica como referência: tentativas, atividades sem evidência, agendados e sinal de divergência | confirmado pelo Vinícius em 17/11/2026 | ativa |
| D6 | 16/11/2026 | Sincronização central do Munin (`cs-sync.server.ts`, `cs_snapshot`) mantida; carteira DCS vem pelo n8n | n8n é obrigatório para o DCS; o Munin atende outras telas | revisar ao descontinuar telas do Munin |
| D7 | 16/11/2026 | "Incremental" relê o funil inteiro (poucas páginas) e grava só o que mudou; nunca inativa | consolidar todos os negócios de cada organização sem dados parciais | ativa |
| D8 | 16/11/2026 | Escrita no Pipedrive desligada (`dcs_config.pipedrive_escrita=false`); jobs aguardam liberação de admin | briefing: gravações reais só com autorização | ativa |
| D9 | 16/11/2026 | Dados do artefato não acessíveis pelo conector; migração via exportações CSV do próprio artefato (carteira, histórico, planos) ou exportação do banco pelo dono | o HTML não contém os registros | pendente |
| D10 | 16/11/2026 | Perfil admin do DCS herda de admin/superadmin do Munin | evitar segunda fonte de autoridade para administradores | ativa |
| D11 | 16/11/2026 | Classificação do n8n distingue "tentativa" (palavra de exclusão) de "ignorar" | briefing pede identificar tentativas sem sucesso; para contato efetivo as duas equivalem | ativa |
| D12 | 17/11/2026 | Migration `dcs_fundacao` aplicada no Supabase "Munim V2" (versão 20261117142211; arquivo renomeado para casar com a versão e evitar reaplicação). Inclui revogação de privilégios padrão (TRUNCATE etc.) de anon/authenticated | acesso ao Supabase liberado; mudança aditiva com rollback | aplicada |
| D13 | 17/11/2026 | Tipos de atividade que não existiam na configuração do artefato (ex.: "Contato de retenção") ficam fora da cobertura até o Vinícius classificar | não presumir contato efetivo | aguarda confirmação |
| D14 | 17/11/2026 | Achado: as migrations do Munin `20261025120000` e `20261025140000` estão no repositório mas **não** foram aplicadas no banco (última aplicada: 20261024203941). Não foram tocadas | fora do escopo do DCS; podem afetar telas do Munin | informar o Vinícius |
| D15 | 17/11/2026 | Workflows criados direto no n8n pelo conector (Workflow SDK), prefixo "Dinamize CS \|"; fonte versionada em `n8n/sdk/`. 01, 04, 05, 08 e 10 ativos após execução de teste com dados reais | somente leitura no Pipedrive; escrita só em tabelas dcs_* | ativa |
| D16 | 17/11/2026 | Nó que abre sincronização sem nova tentativa automática e com resposta em texto | a 1ª execução de teste repetiu a chamada e colidiu com a trava de concorrência (execução marcada como falha, sem efeito em dados) | ativa |
| D17 | 17/11/2026 | Sincronização incremental (02) e webhooks (03) adiados: a carteira completa roda diariamente e a cobertura 2x/dia; o 03 exige cadastrar webhook no Pipedrive (escrita de configuração) | reduzir escrita no Pipedrive até a homologação | pendente |
