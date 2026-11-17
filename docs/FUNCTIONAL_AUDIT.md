# Auditoria funcional — Dinamize CS (17/11/2026)

Ambientes: **U** unitário · **M** interface com backend simulado (Playwright, dados sintéticos) · **L** banco local (pglite, migrations reais) ·
**R** Supabase real: funções, RLS, gatilhos e migrations reais, identidade por `request.jwt.claims` do usuário real, transação desfeita no fim (zero resíduo verificado) ·
**P** produção real (n8n/Pipedrive) · **H** homologação manual com login Google (pendente, roteiro em PROJECT_STATUS).
Não houve teste com JWT emitido por login real a partir deste ambiente: o proxy bloqueia HTTP para o Supabase e o Chrome do usuário não estava conectado.

| Funcionalidade | Encontrado | Causa | Correção | Ambiente / evidência | Status |
|---|---|---|---|---|---|
| Iniciar análise pela carteira | Clientes ficavam "Aguardando"; nenhuma chamada `dcs_iniciar_analise` e nenhuma ficha aberta nos logs do Supabase do dia | Carteira sem ação visível; único caminho era clicar no nome; status era só selo | Coluna "Ações" fixa à direita: Iniciar / Continuar / Ver + menu; abre a ficha após confirmação do banco e invalida carteira, ficha, painéis e contadores | M: clique chama a RPC com a chave certa e abre `/dcs/cliente/<key>`; R: passo 1 (ciclo 1, analista = Master) | Validado com back-end real (banco); H pendente |
| Master iniciar/editar/concluir | Funções aceitavam o Master | — | — | R: passos 1–4, 12 | Validado com back-end real |
| Assumir / redistribuir / receber análise | Bloqueado para Master e admins legados | `dcs_transferir_analise` exigia cadastro em `dcs_membros` | Destino validado por `dcs_pode_atuar_de` (perfil ativo + edição + acesso ao cliente) | L: 8 cenários; R: passo 8 | Validado com back-end real |
| Atribuir análise não iniciada | Não existia | — | `dcs_atribuir_analise` (admin) + diálogo | L; R: passo 9 | Validado com back-end real |
| Uma análise por cliente | Garantido | — | Atribuir recusa se houver análise aberta | L | Testado localmente |
| Salvamento + conflito de versão | Ok | — | — | R: passos 2–3 (versão 1→2; 40001 no conflito) | Validado com back-end real |
| 7 categorias, matriz, janela 1 dia, observações, evidências, métricas | Ok | — | — | R: 38 itens, janela 3 dias gravada → recomendação "ajustar para 1 dia"; índice 53, completude 100 | Validado com back-end real |
| Conclusão, plano, revisão, job Pipedrive | Ok | — | — | R: passo 4 (status concluído, índice, revisão +90 dias, ações, job `aguardando_autorizacao`) | Validado com back-end real |
| Sem atividade duplicada no Pipedrive | Ok | — | — | R: passo 6 (reabrir + reconcluir = 1 job) | Validado com back-end real |
| Reabrir / nova rodada / histórico preservado | Reabrir sem botão | Faltava controle | Menu "Reabrir análise…" (motivo obrigatório) e "Iniciar nova rodada" | R: passos 6–7 (ciclo 2 herda 38 itens; ciclo 1 concluído, índice 53) | Validado com back-end real |
| Editar plano (status, responsável, prazo, prioridade, observações) | Prioridade não editável | Campo ausente no formulário | Prioridade no detalhe da ação | R: passo 5 (versão 2, 2 eventos) | Validado com back-end real |
| Ação manual | Não existia | — | `dcs_criar_acao` + botão "Nova ação" (planos e ficha) | L; R: passo 5b; preservada após reconclusão | Validado com back-end real |
| Permissões de analista | Ok | — | — | R: passo 10 (59 clientes da carteira, não vê fora, salva a própria, bloqueado fora/transferir/usuários) | Validado com back-end real |
| Usuário sem acesso / financeiro | Ok | — | — | R: passo 11 (0 clientes, 0 valores, 0 ações, iniciar bloqueado) | Validado com back-end real |
| Master preservado | Ok | — | — | R: passo 12 (master, financeiro); escrita no Pipedrive `ativa:false` | Validado com back-end real |
| Classificação de tipos de atividade | Regras de Configurações **não chegavam ao n8n** (05 tinha regras fixas) | Código do 05 | 05 lê `dcs_regras_ativas`, registra tipos vistos; modo "Tentativa"; tela com pendências | P: execução 68446 ok (701 negócios, 15 tipos; pendentes: reunio_1___ativao, pr_diagnstico, call); U: equivalência | Validado com back-end real |
| Rotas legadas do Munin | Acessíveis por URL para qualquer usuário | Só tinham saído do menu | Pessoais → `/dcs`; relatórios de CS legados só para admin (D23) | U: 3 testes | Testado localmente |
| Cargas automáticas legadas | Rodam só para admins, alimentam relatórios legados | — | Mantidas (dependência dos relatórios admin) | — | Implementado sem validação |
| Atualizar carteira (workflow 11) | Ok (já validado) | — | — | P: 17/11 17:40 | Validado com back-end real |
| Error workflow 07 | Não configurado | Conector não aplica `settings.errorWorkflow` | Instrução manual | — | Bloqueado por dependência externa |
| Alertas: atribuição/tratamento/resolução | Alertas são derivados (recalculados diariamente) e resolvem quando a causa some | Não há tratamento manual | — | — | Não implementado |
| Visão geral, inteligência, histórico, cobertura | Leitura dos mesmos dados | — | — | M (layout); R (consultas reais nos logs do Supabase, todas 200) | Implementado sem validação de valores com login real |
| Usuários e permissões | Salvamento real funcionou (2× `dcs_salvar_permissoes` 204 nos logs, feitos pelo usuário) | — | — | Logs reais | Validado com back-end real |
| Configurações (publicar versão) | — | — | — | L (validação); não publicado em produção pelo agente | Testado localmente |
| Persistência após recarregar / sair e entrar | — | — | — | — | Pendente H |

## Pendências fora do escopo (não bloqueiam)
Cadastro da equipe, convites, termos/privacidade, nome do projeto no Lovable, lint antigo dos arquivos legados, tratamento manual de alertas.
