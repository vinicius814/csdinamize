# Regras de negócio

Fonte: artefato original (`src/lib/dcs/artefato-v1.ts`, porte 1:1) + correções em `src/lib/dcs/motor.ts`. Versão: `v1-artefato+c1`.

## Diagnóstico
- 7 categorias: tec, aut, ent, cap, mul, seg, res. Itens `main` pontuam; `sub` só detalham e geram recomendação específica; `hide` ficam só nos dados.
- Estados: nao_analisado, funcional, melhoria, nao_funciona, nao_impl, na.
- Dependência (`needs`): se o pré-requisito for nao_impl/na, a pergunta é dispensada (fora do total). Ex.: mul_waauto e mul_coord dependem de mul_wa.
- Entregabilidade: métricas de 30 dias fora da referência (entrega ≥95%, hard ≤2%, soft ≤5%, descadastro ≤0,5%, spam ≤0,1%) sugerem estado (o analista pode sobrescrever).

## Índice de aproveitamento
- Crédito: funcional 1; melhoria 0,6; nao_funciona 0,25; nao_impl 0. Não analisado e N/A ficam fora. Item essencial (`e`) pesa 1,5.
- Pesos por categoria: tec 25, aut 30, ent 15, cap 10, seg 10, mul 5, res 5 (redistribuídos entre categorias com dados).
- Completude < 40% → índice **indisponível**; < 100% → **preliminar**; faixa máxima (Excelente) só com completude ≥ 80% (senão rebaixa uma faixa).
- Faixas: 0–39 Crítico · 40–59 Baixo · 60–79 Bom · 80–94 Alto · 95–100 Excelente.

## Matriz de automações
- 12 automações. Estado pela matriz: impl=n → nao_impl; ativa=n ou func=n → nao_funciona; ativa=s e func=s → funcional, ou melhoria se rel=n ou melh=s.
- Carrinho abandonado e produto de interesse exigem janela de atribuição de 1 dia.

## Recomendações e plano
- Prioridade base do item; nao_funciona sobe um nível; melhoria desce um. Ganho rápido = complexidade baixa e prioridade ≠ baixa.
- Recomendação de sub substitui a genérica do principal (exceto se o principal for nao_impl). Extras: janela ≠ 1 dia (alta), relatório ausente, conteúdo, recursos sem uso.
- Plano entre ciclos: prazo = data + dias do item; item ausente no novo ciclo fica obsoleto (manuais nunca); item implementado que volta = reincidência e reabre.
- Status de implementação: aguardando_contato, aguardando_cliente, aguardando_aprovacao, em_implementacao, aguardando_ativacao, implementado, nao_aprovado.
- O plano é independente do status do diagnóstico (concluir ≠ implementar).

## Cobertura
- **Contato efetivo (fonte oficial)**: campo de negócio "Data do último contato efetivo" (`58cd094a…`), maior data entre os negócios do cliente (`motor.dataContatoEfetivo`). Sem data no campo = "sem registro".
- A classificação abaixo é **referência**: alimenta tentativas, atividades sem evidência, próximos agendados e o sinal de divergência (`motor.divergenciaContato`: atividade efetiva mais de 7 dias mais nova que o campo, ou campo vazio).
- Classificação por tipo de atividade: forte (sempre efetivo), sim (efetivo salvo palavra de exclusão), kw (só com palavra positiva), nao (ignora).
- Palavras de exclusão marcam **tentativa**; concluída sem evidência = **incerto**. Atividades do próprio sistema (assunto "CS | Diagnóstico de utilização" ou marca DZCS) nunca contam.
- Faixas padrão: ≤30 dias em dia, ≤45 atenção, ≤60 pendente, >60 crítico; sem registro; dados indisponíveis sem sincronização. Regras por responsável e faixa de valor sobrepõem o padrão.

## Carteira
- Funil 15, status aberto, etapas 101, 102, 103, 135, 147, 104 (105 Cancelados fora). E-commerce = segmento opção 360 ou etiqueta 690.
- Consolidação por organização (sem organização: chave `d<deal_id>`); negócio principal = maior valor; título "código - nome".
- Responsável = dono do negócio (ou campo Gerente de Contas, configurável). Valor = soma de `value` (MRR confirmado pela operação em 25/10/2026).

## Correções em relação ao artefato
| # | Original | Correção | Teste |
|---|---|---|---|
| C1 | relatório sem rel/janela contava como validado | `statusConversao` = null (insuficiente) | "C1: relatório sem informação…" |
| C2 | ausência de dados não gerava ação | recomendação `x_val_<automação>` de validação | idem |
| C3 | reaparecimento de item obsoleto sempre somava reincidência | só soma se estava implementado | "plano de ação entre ciclos" |
| C4 | valor ausente somado como 0 | mrr = null | "C4: valor ausente…" |
| C5 | leitura parava em 80 páginas e inativava o restante | inativação só com leitura completa (motor e SQL) | "C5…" + pglite |
