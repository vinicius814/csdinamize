import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };
const PAG = {
  pagination: {
    paginationMode: 'updateAParameterInEachRequest',
    parameters: { parameters: [{ type: 'qs', name: 'cursor', value: expr('{{ $response.body.additional_data.next_cursor }}') }] },
    paginationCompleteWhen: 'other',
    completeExpression: expr('{{ !$response.body.additional_data || !$response.body.additional_data.next_cursor }}'),
    limitPagesFetched: true, maxRequests: 200, requestInterval: 250
  }
};

const agendamento = trigger({
  type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'Seg a sex 07:20 e 13:20', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 20 7,13 * * 1-5' }] } } }
});
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });

const abrir = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Abrir sincronização',
    parameters: {
      method: 'POST', url: SB + 'dcs_iniciar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{"p_tipo":"cobertura","p_modo":"completa"}',
      options: { timeout: 120000, response: { response: { responseFormat: 'text', outputPropertyName: 'run' } } }
    },
    credentials: credSupabase
  }
});

const clientes = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Clientes ativos',
    parameters: {
      method: 'POST', url: SB + 'dcs_clientes_para_cobertura', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
      options: { timeout: 120000, response: { response: { responseFormat: 'text', outputPropertyName: 'clientes' } } }
    },
    credentials: credSupabase
  }
});

const negocios = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Negócios do funil CS', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
    parameters: {
      method: 'GET', url: 'https://api.pipedrive.com/api/v2/deals', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
      sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [{ name: 'pipeline_id', value: '15' }, { name: 'status', value: 'open' }, { name: 'limit', value: '500' }, { name: 'custom_fields', value: '58cd094a23bd14b9275f4c006f1b19457b3c1d63' }] },
      options: { timeout: 60000, pagination: PAG }
    },
    credentials: credPipedrive
  }
});

const feitas = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Atividades concluídas', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
    parameters: {
      method: 'GET', url: 'https://api.pipedrive.com/api/v2/activities', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
      sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [{ name: 'done', value: 'true' }, { name: 'limit', value: '500' }, { name: 'updated_since', value: expr("{{ $now.minus({ days: 120 }).toUTC().toFormat(\"yyyy-MM-dd'T'HH:mm:ss'Z'\") }}") }] },
      options: { timeout: 60000, pagination: PAG }
    },
    credentials: credPipedrive
  }
});

const abertas = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Atividades agendadas', executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000, onError: 'continueRegularOutput',
    parameters: {
      method: 'GET', url: 'https://api.pipedrive.com/api/v2/activities', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
      sendQuery: true, specifyQuery: 'keypair', queryParameters: { parameters: [{ name: 'done', value: 'false' }, { name: 'limit', value: '500' }] },
      options: { timeout: 60000, pagination: PAG }
    },
    credentials: credPipedrive
  }
});

const agregar = node({
  type: 'n8n-nodes-base.code', version: 2,
  config: { name: 'Calcular cobertura', parameters: { mode: 'runOnceForAllItems', jsCode: `// Regra D5: contato efetivo = campo "Data do último contato efetivo" (maior data entre os negócios do cliente).
// Classificação de atividades do artefato = referência (n8n/src/*.js, equivalência testada contra o motor).
function dataContatoEfetivo(deals, campo) {
  let max = null;
  for (const d of deals) {
    const v = d.custom_fields?.[campo];
    if (typeof v !== "string" || !/^\\d{4}-\\d{2}-\\d{2}/.test(v)) continue;
    const dia = v.slice(0, 10);
    if (!max || dia > max) max = dia;
  }
  return max;
}
function classificarAtividade(a, cov) {
  const temPalavra = (txt, lista) => { const t = txt.toLowerCase(); return (lista || []).some((k) => k && t.includes(String(k).toLowerCase())); };
  const semHtml = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  if (!a || !a.done || a.is_deleted) return "ignorar";
  const subj = String(a.subject || "");
  if (subj.startsWith("CS | Diagnóstico de utilização") || /DZCS-\\S+-C\\d+/.test(String(a.note || ""))) return "ignorar";
  const mode = cov.modes?.[a.type || ""] || "nao";
  if (mode === "nao") return "ignorar";
  if (mode === "forte") return "efetivo";
  const txt = subj + " " + semHtml(a.note);
  if (temPalavra(txt, cov.kwNeg)) return "tentativa";
  if (mode === "sim") return "efetivo";
  return temPalavra(txt, cov.kwPos) ? "efetivo" : "incerto";
}
const cov = { modes: { contato_efetivo: "forte", reunio_acompanhamento: "sim", reunio_3___ativao: "sim", email1: "kw" },
  kwPos: ["contato efetivo","reunião realizada","reuniao realizada","call realizada","conversa realizada","atendeu","respondeu","retorno do cliente","alinhamento","acompanhamento"],
  kwNeg: ["tentativa","sem resposta","não atendeu","nao atendeu","caixa postal","cancelad","no show","no-show","remarcad","reagend","convite","lembrete","agendar"] };
const run = String($('Abrir sincronização').first().json.run || '').replace(/"/g, '').trim();
let clientes = null;
try { clientes = JSON.parse($('Clientes ativos').first().json.clientes || 'null'); } catch (e) { clientes = null; }
const pgD = $('Negócios do funil CS').all(), pgF = $('Atividades concluídas').all(), pgA = $('Atividades agendadas').all();
const falhou = (pgs) => !pgs.length || pgs.some((p) => p.json.error || p.json.success === false || !Array.isArray(p.json.data)) || !!pgs[pgs.length - 1].json.additional_data?.next_cursor;
const erro = !/^[0-9a-f-]{36}$/.test(run) ? 'Sincronização não aberta' : !Array.isArray(clientes) ? 'Falha ao ler clientes'
  : falhou(pgD) ? 'Leitura de negócios incompleta' : falhou(pgF) ? 'Leitura de atividades concluídas incompleta' : falhou(pgA) ? 'Leitura de atividades agendadas incompleta' : null;
if (erro) return [{ json: { falha: true, p_run: run, p_erro: erro + '; cobertura anterior preservada' } }];
const byDeal = {}, byOrg = {}, byPerson = {};
for (const c of clientes) { (c.deal_ids || []).forEach((d) => byDeal[d] = c.key); if (c.org_id) byOrg[c.org_id] = c.key; if (c.person_id) byPerson[c.person_id] = c.key; }
const cliente = (a) => (a.deal_id && byDeal[a.deal_id]) || (a.org_id && byOrg[a.org_id]) || (a.person_id && byPerson[a.person_id]) || null;
const deals = pgD.flatMap((p) => p.json.data);
const dealsPorCliente = {};
for (const d of deals) { const k = byDeal[d.id]; if (k) (dealsPorCliente[k] = dealsPorCliente[k] || []).push(d); }
const data = (a) => String(a.marked_as_done_time || a.due_date || a.add_time || '').slice(0, 10);
const rec = (a, d) => ({ id: a.id, date: d || data(a), type: a.type || '', subject: String(a.subject || '').slice(0, 90), owner: a.owner_id ?? null });
const later = (x, y) => !x ? y : !y ? x : (y.date > x.date || (y.date === x.date && y.id > x.id)) ? y : x;
const agg = {};
for (const a of pgF.flatMap((p) => p.json.data)) {
  const k = cliente(a); if (!k) continue;
  const c = classificarAtividade(a, cov); if (c === 'ignorar') continue;
  const slot = c === 'efetivo' ? 'contato_por_atividade' : c === 'tentativa' ? 'ultima_tentativa' : 'ultimo_incerto';
  const g = agg[k] = agg[k] || {}; g[slot] = later(g[slot], rec(a));
}
const hoje = $now.setZone('America/Sao_Paulo').toISODate();
for (const a of pgA.flatMap((p) => p.json.data)) {
  if (!a.due_date || a.due_date < hoje || a.is_deleted) continue;
  const k = cliente(a); if (!k) continue;
  if (classificarAtividade({ ...a, done: true }, cov) === 'ignorar') continue;
  const g = agg[k] = agg[k] || {}; if (!g.proximo || a.due_date < g.proximo.date) g.proximo = rec(a, a.due_date);
}
const rows = clientes.map((c) => ({ key: c.key, data_contato_efetivo: dataContatoEfetivo(dealsPorCliente[c.key] || [], "58cd094a23bd14b9275f4c006f1b19457b3c1d63"),
  contato_por_atividade: agg[c.key]?.contato_por_atividade || null, ultimo_incerto: agg[c.key]?.ultimo_incerto || null,
  ultima_tentativa: agg[c.key]?.ultima_tentativa || null, proximo: agg[c.key]?.proximo || null }));
return [{ json: { falha: false, p_run: run, p_rows: rows, p_completo: true,
  p_detalhes: { negocios: deals.length, paginas_concluidas: pgF.length, paginas_agendadas: pgA.length, com_campo: rows.filter((r) => r.data_contato_efetivo).length } } }];` } }
});

const ok = ifElse({
  version: 2.2,
  config: {
    name: 'Leitura completa?',
    parameters: { conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'strict' },
      conditions: [{ leftValue: expr('{{ $json.falha }}'), operator: { type: 'boolean', operation: 'false', singleValue: true } }],
      combinator: 'and'
    } }
  }
});
const publicar = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Publicar cobertura',
    parameters: {
      method: 'POST', url: SB + 'dcs_publicar_cobertura', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_rows: $json.p_rows, p_completo: $json.p_completo, p_detalhes: $json.p_detalhes }) }}'),
      options: { timeout: 120000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } }
    },
    credentials: credSupabase
  }
});

const falhar = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Registrar falha',
    parameters: {
      method: 'POST', url: SB + 'dcs_falhar_sync', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify({ p_run: $json.p_run, p_erro: $json.p_erro }) }}'),
      options: { timeout: 120000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } }
    },
    credentials: credSupabase
  }
});

export default workflow('dcs-05', 'Dinamize CS | 05 — Cobertura de Customer Success')
  .add(agendamento)
  .to(abrir)
  .to(clientes)
  .to(negocios)
  .to(feitas)
  .to(abertas)
  .to(agregar)
  .to(ok.onTrue(publicar).onFalse(falhar))
  .add(manual)
  .to(abrir);
