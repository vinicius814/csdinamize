import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

// Sincronização de atividades abertas do Pipedrive (funil CS, pipeline_id=15) para
// dcs_atividades. Aditivo: não altera dcs_cobertura (workflow 05, resumo de último
// contato/próximo) nem a carteira. Base da central de Atividades e pendências (Prioridade 4).
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };
const PAG = { pagination: { paginationMode: 'updateAParameterInEachRequest',
  parameters: { parameters: [{ type: 'qs', name: 'cursor', value: expr('{{ $response.body.additional_data.next_cursor }}') }] },
  paginationCompleteWhen: 'other', completeExpression: expr('{{ !$response.body.additional_data || !$response.body.additional_data.next_cursor }}'),
  limitPagesFetched: true, maxRequests: 200, requestInterval: 250 } };

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'A cada hora (07h-19h, dias úteis)', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 0 7-19 * * 1-5' }] } } } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });

const abrir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Abrir sincronização', parameters: {
  method: 'POST', url: SB + 'dcs_iniciar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{"p_tipo":"atividades","p_modo":"completa"}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'run' } } } }, credentials: credSupabase },
  output: [{ run: '11111111-1111-1111-1111-111111111111' }] });

const usuarios = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Usuários Pipedrive', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/v1/users', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 60000 } }, credentials: credPipedrive },
  output: [{ success: true, data: [{ id: 13687532, name: 'Vinícius Alves' }] }] });

const clientes = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Clientes ativos', executeOnce: true, parameters: {
  method: 'POST', url: SB + 'dcs_clientes_para_cobertura', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
  options: { timeout: 60000, response: { response: { responseFormat: 'text', outputPropertyName: 'clientes' } } } }, credentials: credSupabase },
  output: [{ clientes: '[{"key":"1-24700","deal_ids":[24700],"org_id":116508,"person_id":null}]' }] });

const abertas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Atividades abertas', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/api/v2/activities', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
    sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [{ name: 'done', value: 'false' }, { name: 'limit', value: '500' }] },
    options: { timeout: 60000, pagination: PAG } }, credentials: credPipedrive },
  output: [{ success: true, data: [{ id: 555, due_date: '2026-11-24', type: 'call', subject: 'Follow-up', owner_id: 13687532, deal_id: 24700, org_id: 116508, person_id: null, is_deleted: false }] }] });

const mapear = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Mapear atividades por cliente', parameters: { mode: 'runOnceForAllItems', jsCode: `function mapear(acts, clientes, nomes) {
  const byDeal = {}, byOrg = {}, byPerson = {};
  for (const c of clientes) { (c.deal_ids || []).forEach((d) => byDeal[d] = c.key); if (c.org_id) byOrg[c.org_id] = c.key; if (c.person_id) byPerson[c.person_id] = c.key; }
  const cliente = (a) => (a.deal_id && byDeal[a.deal_id]) || (a.org_id && byOrg[a.org_id]) || (a.person_id && byPerson[a.person_id]) || null;
  const out = [];
  for (const a of acts) {
    if (a.is_deleted) continue;
    const k = cliente(a); if (!k) continue;
    const oid = a.owner_id ?? null;
    out.push({ id: a.id, cliente_key: k, owner_id: oid, owner_nome: oid != null ? (nomes[String(oid)] ?? "Usuário " + oid) : null,
      data: a.due_date || null, tipo: a.type || null, assunto: String(a.subject || "").slice(0, 160) });
  }
  return out;
}

const run = String($('Abrir sincronização').first().json.run || '').replace(/"/g, '').trim();
const us = $('Usuários Pipedrive').first().json;
let clientes = null; try { clientes = JSON.parse($('Clientes ativos').first().json.clientes || 'null'); } catch (e) { clientes = null; }
const paginas = $input.all();
const erro = !/^[0-9a-f-]{36}$/.test(run) ? 'Sincronização não aberta'
  : (us.error || !Array.isArray(us.data)) ? 'Falha ao ler usuários do Pipedrive'
  : !Array.isArray(clientes) ? 'Falha ao ler clientes'
  : paginas.some((p) => p.json.error || p.json.success === false || !Array.isArray(p.json.data)) ? 'Falha ao ler atividades do Pipedrive'
  : null;
if (erro) return [{ json: { falha: true, p_run: run, p_erro: erro + '; dados anteriores preservados' } }];
const nomes = {}; for (const u of us.data) nomes[String(u.id)] = u.name;
const acts = paginas.flatMap((p) => p.json.data || []);
const ultima = paginas[paginas.length - 1].json;
const completo = !ultima.additional_data?.next_cursor && paginas.length < 200;
const rows = mapear(acts, clientes, nomes);
return [{ json: { falha: false, p_run: run, p_rows: rows, p_lidos: acts.length, p_completo: completo } }];` } },
  output: [{ falha: false, p_run: '11111111-1111-1111-1111-111111111111', p_rows: [], p_lidos: 1, p_completo: true }] });

const ok = ifElse({ version: 2.2, config: { name: 'Leitura válida?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [{ leftValue: expr('{{ $json.falha }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' } } } });

const publicar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Publicar atividades', parameters: {
  method: 'POST', url: SB + 'dcs_publicar_atividades', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_rows: $json.p_rows, p_lidos: $json.p_lidos, p_completo: $json.p_completo }) }}'), options: { timeout: 120000 } }, credentials: credSupabase },
  output: [{ criados: 1, alterados: 0, excluidos: 0 }] });

const falhar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Registrar falha', parameters: {
  method: 'POST', url: SB + 'dcs_falhar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_erro: $json.p_erro }) }}'),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase },
  output: [{ resultado: 'ok' }] });

export default workflow('dcs-14', 'Dinamize CS | 14 — Sincronização de atividades abertas')
  .add(agendamento).to(abrir).to(usuarios).to(clientes).to(abertas).to(mapear).to(ok.onTrue(publicar).onFalse(falhar))
  .add(manual).to(abrir);
