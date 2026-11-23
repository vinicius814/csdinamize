import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

// Sincronização do funil Onboarding (pipeline_id=1, Pipedrive) para dcs_pipeline_onboarding.
// Aditivo: não altera a carteira CS (funil 15, workflow 01).
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'Diário 05:50', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 50 5 * * *' }] } } } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });

const abrir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Abrir sincronização', parameters: {
  method: 'POST', url: SB + 'dcs_iniciar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{"p_tipo":"onboarding","p_modo":"completa"}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'run' } } } }, credentials: credSupabase },
  output: [{ run: '11111111-1111-1111-1111-111111111111' }] });

const usuarios = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Usuários Pipedrive', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/v1/users', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 60000 } }, credentials: credPipedrive },
  output: [{ success: true, data: [{ id: 13687532, name: 'Vinícius Alves' }] }] });

const negocios = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Negócios do funil Onboarding', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/api/v2/deals', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
    sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [
      { name: 'pipeline_id', value: '1' }, { name: 'status', value: 'open' }, { name: 'limit', value: '500' }, { name: 'sort_by', value: 'id' }, { name: 'sort_direction', value: 'asc' } ] },
    options: { timeout: 60000, pagination: { pagination: { paginationMode: 'updateAParameterInEachRequest',
      parameters: { parameters: [{ type: 'qs', name: 'cursor', value: expr('{{ $response.body.additional_data.next_cursor }}') }] },
      paginationCompleteWhen: 'other', completeExpression: expr('{{ !$response.body.additional_data || !$response.body.additional_data.next_cursor }}'),
      limitPagesFetched: true, maxRequests: 200, requestInterval: 250 } } } }, credentials: credPipedrive },
  output: [{ success: true, data: [{ id: 24700, title: 'Loja Exemplo', org_id: 116508, stage_id: 136, owner_id: 13687532, status: 'open', is_archived: false, stage_change_time: '2026-11-20 10:00:00' }] }] });

const mapear = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Mapear negócios de Onboarding', parameters: { mode: 'runOnceForAllItems', jsCode: `function mapear(deals, nomes) {
  const idDe = (v) => (v == null ? null : typeof v === "object" ? (v.value ?? v.id ?? null) : Number(v));
  const out = [];
  for (const d of deals) {
    if (d.is_archived || (d.status && d.status !== "open")) continue;
    const org = idDe(d.org_id);
    if (!org) continue;
    const oid = idDe(d.owner_id);
    out.push({
      key: String(d.id), org_id: org, deal_id: d.id, stage_id: Number(d.stage_id),
      owner_id: oid, owner_nome: oid != null ? (nomes[String(oid)] ?? "Usuário " + oid) : null,
      titulo: String(d.title || "").trim(), entrada_etapa_em: d.stage_change_time || null,
    });
  }
  return out;
}

const run = String($('Abrir sincronização').first().json.run || '').replace(/"/g, '').trim();
const us = $('Usuários Pipedrive').first().json;
const paginas = $input.all();
const erro = !/^[0-9a-f-]{36}$/.test(run) ? 'Sincronização não aberta'
  : (us.error || !Array.isArray(us.data)) ? 'Falha ao ler usuários do Pipedrive'
  : paginas.some((p) => p.json.error || p.json.success === false || !Array.isArray(p.json.data)) ? 'Falha ao ler negócios do Pipedrive'
  : null;
if (erro) return [{ json: { falha: true, p_run: run, p_erro: erro + '; dados anteriores preservados' } }];
const nomes = {}; for (const u of us.data) nomes[String(u.id)] = u.name;
const deals = paginas.flatMap((p) => p.json.data || []);
const ultima = paginas[paginas.length - 1].json;
const completo = !ultima.additional_data?.next_cursor && paginas.length < 200;
const rows = mapear(deals, nomes);
return [{ json: { falha: false, p_run: run, p_rows: rows, p_lidos: deals.length, p_completo: completo } }];` } },
  output: [{ falha: false, p_run: '11111111-1111-1111-1111-111111111111', p_rows: [], p_lidos: 1, p_completo: true }] });

const ok = ifElse({ version: 2.2, config: { name: 'Leitura válida?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [{ leftValue: expr('{{ $json.falha }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' } } } });

const publicar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Publicar onboarding', parameters: {
  method: 'POST', url: SB + 'dcs_publicar_pipeline_onboarding', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_rows: $json.p_rows, p_lidos: $json.p_lidos, p_completo: $json.p_completo }) }}'), options: { timeout: 120000 } }, credentials: credSupabase },
  output: [{ criados: 1, alterados: 0, inativados: 0 }] });

const falhar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Registrar falha', parameters: {
  method: 'POST', url: SB + 'dcs_falhar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_erro: $json.p_erro }) }}'),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase },
  output: [{ resultado: 'ok' }] });

export default workflow('dcs-13', 'Dinamize CS | 13 — Sincronização do funil Onboarding')
  .add(agendamento).to(abrir).to(usuarios).to(negocios).to(mapear).to(ok.onTrue(publicar).onFalse(falhar))
  .add(manual).to(abrir);
