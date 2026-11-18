import { workflow, node, trigger, ifElse, expr } from '@n8n/workflow-sdk';

// Registra cada diagnóstico concluído como atividade "Análise" (concluída) no Pipedrive.
// Fila: dcs_jobs tipo 'pipedrive_atividade_diagnostico'. Só processa jobs 'pendente' (liberados pelo Master ou com
// dcs_config.pipedrive_escrita ativa); 'aguardando_autorizacao' nunca é lido aqui.
// Idempotência: 1 job por cliente+ciclo (chave única) e marca DZCS-<cliente>-C<ciclo> na nota. Antes de criar, procura
// atividade do negócio com a marca; se existir (ou se o job já tiver activity_id), atualiza em vez de criar outra.
// Falha no Pipedrive não perde o diagnóstico: o job volta como 'falha' com backoff e pode ser reprocessado.
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const PD = 'https://api.pipedrive.com/api/v2/activities';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };
const TIPO_ATIVIDADE = 'anlise'; // "Análise" no Pipedrive da Dinamize

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'A cada 5 minutos', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 5 }] } } } });
const reservar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Reservar registros', parameters: {
  method: 'POST', url: SB + 'dcs_reservar_jobs', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{"p_tipo":"pipedrive_atividade_diagnostico","p_limite":5}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'jobs' } } } }, credentials: credSupabase } });
const preparar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Preparar atividades', parameters: { mode: 'runOnceForAllItems', jsCode: `let lista = [];
try { lista = JSON.parse($input.first().json.jobs || '[]'); } catch (e) { lista = []; }
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
// Texto do relatório (seções em MAIÚSCULAS, listas com "- ") → HTML simples aceito pela nota do Pipedrive.
function html(txt) {
  const out = []; let lista = false;
  for (const l of String(txt || '').split(/\\r?\\n/)) {
    const t = l.trim();
    const item = /^[-•]\\s+/.test(t);
    if (lista && !item) { out.push('</ul>'); lista = false; }
    if (!t) continue;
    if (item) { if (!lista) { out.push('<ul>'); lista = true; } out.push('<li>' + esc(t.replace(/^[-•]\\s+/, '')) + '</li>'); }
    else if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ0-9 .,—–-]{4,}$/.test(t) && t === t.toUpperCase()) out.push('<p><b>' + esc(t) + '</b></p>');
    else out.push('<p>' + esc(t) + '</p>');
  }
  if (lista) out.push('</ul>');
  return out.join('');
}
return (Array.isArray(lista) ? lista : []).map((j) => {
  const p = j.payload || {};
  const marca = p.marca || j.chave;
  const corpo = { subject: p.subject || 'CS | Diagnóstico de utilização — Dinamize Marketing', type: '${TIPO_ATIVIDADE}', done: true,
    due_date: String(p.data || new Date().toISOString()).slice(0, 10),
    note: html(p.resumo) + '<p><small>Registro automático Dinamize CS · ' + esc(marca) + '</small></p>' };
  if (p.deal_id) corpo.deal_id = Number(p.deal_id);
  if (p.org_id) corpo.org_id = Number(p.org_id);
  if (p.person_id) corpo.participants = [{ person_id: Number(p.person_id), primary: true }];
  const dono = p.user_id || p.owner_id; // analista com vínculo no Pipedrive; senão, responsável da carteira
  if (dono) corpo.owner_id = Number(dono);
  const anterior = j.resultado && j.resultado.activity_id ? Number(j.resultado.activity_id) : null;
  return { json: { job_id: j.id, chave: j.chave, marca, deal_id: corpo.deal_id || null, anterior, corpo } };
});` } } });
const temNegocio = ifElse({ version: 2.2, config: { name: 'Tem negócio?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr('{{ $json.deal_id }}'), rightValue: '', operator: { type: 'number', operation: 'exists', singleValue: true } }], combinator: 'and' } } } });
const semNegocio = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Falha: sem negócio', parameters: {
  method: 'POST', url: SB + 'dcs_finalizar_job', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ JSON.stringify({ p_id: $json.job_id, p_status: 'ambiguo', p_resultado: null, p_erro: 'Cliente sem negócio principal no Pipedrive' }) }}"),
  options: { timeout: 30000 } }, credentials: credSupabase } });
const buscar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Atividades do negócio', onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: PD, authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
  sendQuery: true, queryParameters: { parameters: [{ name: 'deal_id', value: expr('{{ $json.deal_id }}') }, { name: 'limit', value: '500' }] },
  options: { timeout: 30000, response: { response: { responseFormat: 'json', outputPropertyName: 'resp' } } } }, credentials: credPipedrive } });
const decidir = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Criar ou atualizar', parameters: { mode: 'runOnceForEachItem', jsCode: `const base = $('Preparar atividades').item.json;
const r = $json;
if (r.error) return { json: { ...base, metodo: null, erro: 'Leitura do Pipedrive: ' + String(r.error.message || r.error) } };
const ativs = Array.isArray(r.data) ? r.data : (Array.isArray(r.resp && r.resp.data) ? r.resp.data : []);
const achada = ativs.find((a) => !a.is_deleted && String(a.note || '').includes(base.marca));
const id = base.anterior || (achada && achada.id) || null;
return { json: { ...base, metodo: id ? 'PATCH' : 'POST', url: id ? '${PD}/' + id : '${PD}', erro: null } };` } } });
const podeGravar = ifElse({ version: 2.2, config: { name: 'Leitura ok?', parameters: { conditions: {
  options: { caseSensitive: true, leftValue: '', typeValidation: 'loose' },
  conditions: [{ leftValue: expr('{{ $json.metodo }}'), rightValue: '', operator: { type: 'string', operation: 'notEmpty', singleValue: true } }], combinator: 'and' } } } });
const gravar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Gravar atividade', onError: 'continueRegularOutput', parameters: {
  method: expr('{{ $json.metodo }}'), url: expr('{{ $json.url }}'), authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json.corpo) }}'),
  options: { timeout: 30000 } }, credentials: credPipedrive } });
const finalizar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Finalizar registro', parameters: {
  method: 'POST', url: SB + 'dcs_finalizar_job', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ (() => { const b = $('Criar ou atualizar').item.json; const id = $json.data && $json.data.id; return JSON.stringify(id ? { p_id: b.job_id, p_status: 'concluido', p_resultado: { activity_id: id, deal_id: b.deal_id, metodo: b.metodo, em: new Date().toISOString() }, p_erro: null } : { p_id: b.job_id, p_status: 'falha', p_resultado: null, p_erro: 'Pipedrive: ' + String(($json.error && ($json.error.message || $json.error)) || 'resposta sem id') }); })() }}"),
  options: { timeout: 30000 } }, credentials: credSupabase } });
const falhaLeitura = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Falha na leitura', parameters: {
  method: 'POST', url: SB + 'dcs_finalizar_job', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json',
  jsonBody: expr("{{ JSON.stringify({ p_id: $json.job_id, p_status: 'falha', p_resultado: null, p_erro: $json.erro }) }}"),
  options: { timeout: 30000 } }, credentials: credSupabase } });

export default workflow('dcs-06', 'Dinamize CS | 06 — Registro do diagnóstico no Pipedrive')
  .add(agendamento).to(reservar).to(preparar)
  .to(temNegocio.onTrue(buscar.to(decidir).to(podeGravar.onTrue(gravar.to(finalizar)).onFalse(falhaLeitura))).onFalse(semNegocio));
