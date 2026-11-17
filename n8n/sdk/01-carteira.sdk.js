import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

// Carteira completa: funil 15, e-commerce, consolidação por organização; só inativa com leitura completa.
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'Diário 05:40', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 40 5 * * *' }] } } } });
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });
// Pedido feito pelo botão "Atualizar carteira" do Dinamize CS (atendido pelo workflow 11).
const pedido = trigger({ type: 'n8n-nodes-base.executeWorkflowTrigger', version: 1.1, config: { name: 'Pedido do Dinamize CS', parameters: { inputSource: 'passthrough' } } });
const abrir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Abrir sincronização', parameters: {
  method: 'POST', url: SB + 'dcs_iniciar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{"p_tipo":"carteira","p_modo":"completa"}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'run' } } } }, credentials: credSupabase } });
const usuarios = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Usuários Pipedrive', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/v1/users', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 60000 } }, credentials: credPipedrive } });
const negocios = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Negócios do funil CS', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
  parameters: { method: 'GET', url: 'https://api.pipedrive.com/api/v2/deals', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
    sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [
      { name: 'pipeline_id', value: '15' }, { name: 'status', value: 'open' }, { name: 'limit', value: '500' }, { name: 'sort_by', value: 'id' }, { name: 'sort_direction', value: 'asc' },
      { name: 'custom_fields', value: '723edfa476f1d04f92df16d7bc08bc482d9a2ac2,9260473c7dffdb28935ce0db7fafd45524f91431' } ] },
    options: { timeout: 60000, pagination: { pagination: { paginationMode: 'updateAParameterInEachRequest',
      parameters: { parameters: [{ type: 'qs', name: 'cursor', value: expr('{{ $response.body.additional_data.next_cursor }}') }] },
      paginationCompleteWhen: 'other', completeExpression: expr('{{ !$response.body.additional_data || !$response.body.additional_data.next_cursor }}'),
      limitPagesFetched: true, maxRequests: 200, requestInterval: 250 } } } }, credentials: credPipedrive } });
const consolidar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Consolidar carteira', parameters: { mode: 'runOnceForAllItems', jsCode: `function consolidarCarteira(deals, cfg, nomes) {
  const idDe = (v) => (v == null ? null : typeof v === "object" ? (v.value ?? v.id ?? null) : Number(v));
  const incl = new Set(cfg.stages.map(Number));
  const ecom = (d) => {
    const segs = (d.custom_fields?.[cfg.fSeg] || []).map((x) => Number(typeof x === "object" && x ? x.id : x));
    const labs = (d.label_ids || []).map(Number);
    return (cfg.ecom.segmento && segs.includes(cfg.segEcom)) || (cfg.ecom.etiqueta && labs.includes(cfg.labelEcom));
  };
  const grupos = {};
  for (const d of deals) {
    if (d.is_archived || (d.status && d.status !== "open") || !incl.has(Number(d.stage_id)) || !ecom(d)) continue;
    const org = idDe(d.org_id);
    const key = org ? String(org) : "d" + d.id;
    (grupos[key] = grupos[key] || []).push(d);
  }
  const out = [];
  for (const [key, ds] of Object.entries(grupos)) {
    ds.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0) || a.id - b.id);
    const p = ds[0];
    const title = String(p.title || "").trim();
    const m = title.match(/^\\s*(\\d+)\\s*[-–]\\s*(.*)$/);
    let oid = idDe(p.owner_id);
    let oname = oid != null ? (nomes[String(oid)] ?? "Usuário " + oid) : "—";
    if (cfg.ownerSource === "gerente") {
      const g = p.custom_fields?.[cfg.fGer];
      oid = g?.id ?? null;
      oname = g?.label || "(sem gerente de contas)";
    }
    const semValor = ds.some((x) => x.value == null || isNaN(Number(x.value)));
    out.push({
      key, org_id: idDe(p.org_id), nome: m ? m[2] : title, codigo: m ? m[1] : "", deal_id: p.id,
      deal_ids: ds.map((x) => x.id), stage_id: Number(p.stage_id), owner_id: oid, owner_nome: oname,
      person_id: idDe(p.person_id), label_ids: p.label_ids || [],
      mrr: semValor ? null : Math.round(ds.reduce((a, x) => a + Number(x.value), 0) * 100) / 100,
    });
  }
  return out;
}

const cfg = { stages: [101, 102, 103, 135, 147, 104], ecom: { segmento: true, etiqueta: true }, ownerSource: "owner",
  fSeg: "723edfa476f1d04f92df16d7bc08bc482d9a2ac2", fGer: "9260473c7dffdb28935ce0db7fafd45524f91431", segEcom: 360, labelEcom: 690, maxPaginas: 200 };
const run = String($('Abrir sincronização').first().json.run || '').replace(/"/g, '').trim();
const us = $('Usuários Pipedrive').first().json;
const paginas = $input.all();
const erro = !/^[0-9a-f-]{36}$/.test(run) ? 'Sincronização não aberta'
  : (us.error || !Array.isArray(us.data)) ? 'Falha ao ler usuários do Pipedrive'
  : paginas.some((p) => p.json.error || p.json.success === false || !Array.isArray(p.json.data)) ? 'Falha ao ler negócios do Pipedrive'
  : null;
if (erro) return [{ json: { falha: true, p_run: run, p_erro: erro + '; carteira anterior preservada' } }];
const nomes = {}; for (const u of us.data) nomes[String(u.id)] = u.name;
const deals = paginas.flatMap((p) => p.json.data || []);
const ultima = paginas[paginas.length - 1].json;
const completo = !ultima.additional_data?.next_cursor && paginas.length < cfg.maxPaginas;
const rows = consolidarCarteira(deals, cfg, nomes);
return [{ json: { falha: false, p_run: run, p_rows: rows, p_lidos: deals.length, p_completo: completo } }];` } } });
const ok = ifElse({ version: 2.2, config: { name: 'Leitura válida?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
  conditions: [{ leftValue: expr('{{ $json.falha }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' } } } });
const publicar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Publicar carteira', parameters: {
  method: 'POST', url: SB + 'dcs_publicar_carteira', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_rows: $json.p_rows, p_lidos: $json.p_lidos, p_completo: $json.p_completo }) }}'), options: { timeout: 120000 } }, credentials: credSupabase } });
const falhar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Registrar falha', parameters: {
  method: 'POST', url: SB + 'dcs_falhar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_erro: $json.p_erro }) }}'),
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } } }, credentials: credSupabase } });

export default workflow('dcs-01', 'Dinamize CS | 01 — Sincronização completa da carteira')
  .add(agendamento).to(abrir).to(usuarios).to(negocios).to(consolidar).to(ok.onTrue(publicar).onFalse(falhar))
  .add(manual).to(abrir)
  .add(pedido).to(abrir);
