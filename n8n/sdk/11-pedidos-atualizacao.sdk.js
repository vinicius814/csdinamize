import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

// Atende os pedidos da interface (dcs_solicitar_sync, permissão 'integracoes'): consulta a fila a cada minuto e executa
// o 01 (carteira), o 04 (responsáveis) ou o 05 (cobertura). Nenhum segredo no navegador.
// D40: antes, 'responsaveis' caía no ramo da cobertura.
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'A cada minuto', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } } });
const atender = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Reservar pedidos', parameters: {
  method: 'POST', url: SB + 'dcs_atender_solicitacoes', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'pedidos' } } } }, credentials: credSupabase } });
const separar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Separar pedidos', parameters: { mode: 'runOnceForAllItems', jsCode: `let lista = [];
try { lista = JSON.parse($input.first().json.pedidos || '[]'); } catch (e) { lista = []; }
const ordem = { carteira: 0, responsaveis: 1, cobertura: 2 };
return (Array.isArray(lista) ? lista : [])
  .sort((a, b) => (ordem[a.tipo] ?? 9) - (ordem[b.tipo] ?? 9))
  .map((p) => ({ json: { id: p.id, tipo: p.tipo } }));` } } });
const ehCarteira = ifElse({ version: 2.2, config: { name: 'Carteira?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [{ leftValue: expr('{{ $json.tipo }}'), rightValue: 'carteira', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } } } });
const execCarteira = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.3, config: { name: 'Executar 01 — Carteira', onError: 'continueRegularOutput', parameters: {
  source: 'database', workflowId: { __rl: true, mode: 'id', value: 'wz4g4KIsoi1NoGlG' }, mode: 'each', options: { waitForSubWorkflow: true } } } });
const ehResponsaveis = ifElse({ version: 2.2, config: { name: 'Responsáveis?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [{ leftValue: expr('{{ $json.tipo }}'), rightValue: 'responsaveis', operator: { type: 'string', operation: 'equals' } }], combinator: 'and' } } } });
const execResponsaveis = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.3, config: { name: 'Executar 04 — Responsáveis', onError: 'continueRegularOutput', parameters: {
  source: 'database', workflowId: { __rl: true, mode: 'id', value: 'R34Vz2vThH1pOacp' }, mode: 'each', options: { waitForSubWorkflow: true } } } });
const concluirResponsaveis = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Concluir pedido (responsáveis)', parameters: {
  method: 'POST', url: SB + 'dcs_concluir_solicitacao', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ JSON.stringify({ p_id: $('Separar pedidos').item.json.id, p_ok: !$json.error, p_erro: $json.error ? String($json.error.message || $json.error) : null }) }}"),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase } });
const execCobertura = node({ type: 'n8n-nodes-base.executeWorkflow', version: 1.3, config: { name: 'Executar 05 — Cobertura', onError: 'continueRegularOutput', parameters: {
  source: 'database', workflowId: { __rl: true, mode: 'id', value: 'Yy7d9zwQRGfTaNhy' }, mode: 'each', options: { waitForSubWorkflow: true } } } });
const concluirCarteira = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Concluir pedido (carteira)', parameters: {
  method: 'POST', url: SB + 'dcs_concluir_solicitacao', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ JSON.stringify({ p_id: $('Separar pedidos').item.json.id, p_ok: !$json.error, p_erro: $json.error ? String($json.error.message || $json.error) : null }) }}"),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase } });
const concluirCobertura = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Concluir pedido (cobertura)', parameters: {
  method: 'POST', url: SB + 'dcs_concluir_solicitacao', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ JSON.stringify({ p_id: $('Separar pedidos').item.json.id, p_ok: !$json.error, p_erro: $json.error ? String($json.error.message || $json.error) : null }) }}"),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase } });

export default workflow('dcs-11', 'Dinamize CS | 11 — Pedidos de atualização da interface')
  .add(agendamento).to(atender).to(separar).to(ehCarteira.onTrue(execCarteira.to(concluirCarteira)).onFalse(ehResponsaveis.onTrue(execResponsaveis.to(concluirResponsaveis)).onFalse(execCobertura.to(concluirCobertura))));
