# Decisões técnicas

| # | Data | Decisão | Motivo | Situação |
|---|---|---|---|---|
| D1 | 16/11/2026 | Trabalho em branch `dinamize-cs/fase-0`; `main` intocada até homologar | `main` sincroniza com o Lovable e publica | ativa |
| D2 | 16/11/2026 | Banco aditivo com prefixo `dcs_`, reaproveitando `profiles`, `user_roles`, `account_access`, Auth Google | preservar usuários e infraestrutura; rollback isolado | ativa |
| D3 | 16/11/2026 | Metodologia portada 1:1 em arquivo próprio; correções só em `motor.ts` | auditar o original e testar cada correção | ativa |
| D4 | 16/11/2026 | Valor recorrente = soma de `deal.value`; ausente = nulo | regra confirmada pela operação (docs/regras-operacao-cs.md, 25/10/2026); `mrr` da API vem nulo | ativa |
| D5 | 16/11/2026 | Cobertura do Dinamize CS usa a classificação de atividades do artefato; o campo "Data do último contato efetivo" do Munin fica como referência lado a lado | o briefing exige a inteligência do artefato; o Munin definiu o campo em 25/10 | **aguarda confirmação do Vinícius** |
| D6 | 16/11/2026 | Sincronização central do Munin (`cs-sync.server.ts`, `cs_snapshot`) mantida; carteira DCS vem pelo n8n | n8n é obrigatório para o DCS; o Munin atende outras telas | revisar ao descontinuar telas do Munin |
| D7 | 16/11/2026 | "Incremental" relê o funil inteiro (poucas páginas) e grava só o que mudou; nunca inativa | consolidar todos os negócios de cada organização sem dados parciais | ativa |
| D8 | 16/11/2026 | Escrita no Pipedrive desligada (`dcs_config.pipedrive_escrita=false`); jobs aguardam liberação de admin | briefing: gravações reais só com autorização | ativa |
| D9 | 16/11/2026 | Dados do artefato não acessíveis pelo conector; migração via exportações CSV do próprio artefato (carteira, histórico, planos) ou exportação do banco pelo dono | o HTML não contém os registros | pendente |
| D10 | 16/11/2026 | Perfil admin do DCS herda de admin/superadmin do Munin | evitar segunda fonte de autoridade para administradores | ativa |
| D11 | 16/11/2026 | Classificação do n8n distingue "tentativa" (palavra de exclusão) de "ignorar" | briefing pede identificar tentativas sem sucesso; para contato efetivo as duas equivalem | ativa |
