# Limpeza dos dados de teste — produção

Executada em 18/11/2026 (≈13:41–13:42, horário de Brasília) com autorização do Vinícius registrada em `dcs_auditoria`
(entidade `limpeza`, ações `excluir_teste` e `excluir_testes`, campo `autorizado_por`).

## Backup recuperável
Esquema `dcs_backup` (sem acesso pela API: nenhum USAGE para `anon`/`authenticated`), tabelas com sufixo `_20261118`:

| Tabela de backup | Linhas |
|---|---|
| diagnosticos_20261118 | 9 |
| acoes_20261118 | 57 |
| acoes_eventos_20261118 / acoes_eventos_restantes_20261118 | 166 / 162 |
| diagnosticos_eventos_20261118 | 17 |
| jobs_20261118 | 6 |
| membros_20261118, pre_cadastros_20261118 | 4, 4 (referência; não excluídos) |
| auditoria_20261118 | 21 (referência; auditoria preservada) |
| utilizacao_20261118, mensagens_20261118, integracao_logs_20261118 | 0 |

## O que foi removido
- 9 diagnósticos de teste (ciclos de homologação em 5 clientes reais) e seus 17 eventos.
- 56 ações de plano derivadas desses diagnósticos + 1 "ação fake de teste", com os eventos.
- 5 registros de envio ao Pipedrive que aguardavam autorização foram cancelados (nada foi gravado no Pipedrive).

## O que foi preservado
Clientes sincronizados (221, todos `segmento = ecommerce`), responsáveis, cobertura, usuários reais, convites reais
(3 colegas), Master, configurações e regras publicadas, migrations, políticas RLS, auditoria, credenciais e integrações.
O job concluído do registro homologado no Pipedrive foi mantido como histórico.

## Verificação pós-limpeza (18/11/2026, 14:30)
`dcs_diagnosticos` 0 · `dcs_acoes` 0 · `dcs_utilizacao` 0 · `dcs_feedback` 0 · `dcs_onboarding` 0 · `dcs_clientes` 221 ·
alertas recalculados pelo job diário a partir dos dados reais (cobertura). Indicadores de diagnóstico mostram estado vazio
("nenhum diagnóstico concluído"), não zero.

## Decisões pendentes (não executadas)
1. **Atividade 159570 no Pipedrive** (registro de homologação do diagnóstico, formato anterior): não excluída — exige autorização específica.
2. **Contas antigas sem relação clara com a equipe:** uma conta externa já desativada (perfil Analista de contas) e a conta secundária
   do Vinícius no domínio `.com`. Não foram removidas; o Vinícius decide se mantém ou desativa.

## Restauração (se necessário)
```sql
-- exemplo: restaurar um diagnóstico e suas ações
INSERT INTO public.dcs_diagnosticos SELECT * FROM dcs_backup.diagnosticos_20261118 WHERE id = '<id>';
INSERT INTO public.dcs_acoes        SELECT * FROM dcs_backup.acoes_20261118        WHERE cliente_key = '<key>';
```
Executar pelo SQL Editor (service role). Após o período de homologação, as tabelas de backup podem ser removidas com autorização.
