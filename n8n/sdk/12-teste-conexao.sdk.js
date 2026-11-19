import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

// Atende o botão "Testar conexão" da central de Integrações (D40). Só LEITURAS no Pipedrive, com a credencial institucional
// guardada no n8n. O resultado gravado tem apenas rótulos, contagens e o nome da conta: nunca token, e-mail ou cabeçalho.
// A permissão de escrita não é testada (testar exigiria criar dados); a central a infere do último registro confirmado.
const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const V1 = 'https://api.pipedrive.com/v1/';
const V2 = 'https://api.pipedrive.com/api/v2/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };

const agendamento = trigger({ type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'A cada minuto', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } } });
const reservar = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Reservar teste', parameters: {
  method: 'POST', url: SB + 'dcs_atender_testes_conexao', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
  options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'testes' } } } }, credentials: credSupabase } });
const temTeste = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Há teste?', parameters: { mode: 'runOnceForAllItems', jsCode: `let l = [];
try { l = JSON.parse($input.first().json.testes || '[]'); } catch (e) { l = []; }
return Array.isArray(l) && l.length ? [{ json: { teste_id: l[0].id } }] : [];` } } });

// Leituras (uma por nó; erro não interrompe: o nó 'Avaliar' classifica cada uma).
const me = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Conta (users/me)', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V1 + 'users/me', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 30000 } }, credentials: credPipedrive } });
const deals = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Negócios', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V2 + 'deals', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'pipeline_id', value: '15' }, { name: 'limit', value: '1' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const orgs = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Organizações', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V2 + 'organizations', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'limit', value: '1' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const pessoas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Pessoas', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V2 + 'persons', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'limit', value: '1' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const ativs = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Atividades', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V2 + 'activities', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'limit', value: '1' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const users = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Usuários', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V1 + 'users', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 30000 } }, credentials: credPipedrive } });
const campos = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Campos de negócio', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V1 + 'dealFields', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'limit', value: '500' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const etapas = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Etapas do funil', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V1 + 'stages', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', sendQuery: true, queryParameters: { parameters: [{ name: 'pipeline_id', value: '15' }] }, options: { timeout: 30000 } }, credentials: credPipedrive } });
const tipos = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Tipos de atividade', executeOnce: true, alwaysOutputData: true, onError: 'continueRegularOutput', parameters: {
  method: 'GET', url: V1 + 'activityTypes', authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi', options: { timeout: 30000 } }, credentials: credPipedrive } });

const avaliar = node({ type: 'n8n-nodes-base.code', version: 2, config: { name: 'Avaliar', parameters: { mode: 'runOnceForAllItems', jsCode: `const r = (n) => { try { return $(n).first().json || {}; } catch (e) { return { error: { message: 'não executado' } }; } };
const erro = (j) => j.error ? String(j.error.message || j.error.description || j.error).slice(0, 160) : (j.success === false ? String(j.error || 'recusado') : null);
const lista = (j) => Array.isArray(j.data) ? j.data : [];
const checks = [];
const add = (chave, rotulo, j, extra) => {
  const e = erro(j);
  const s = e ? (/401|403|unauthor|forbidden|scope/i.test(e) ? 'sem_permissao' : 'falha') : (extra && extra.status) || 'ok';
  checks.push({ chave, rotulo, status: s, detalhe: e ? e : (extra && extra.detalhe) || null });
};
const m = r('Conta (users/me)');
add('autenticacao', 'Autenticação da conta institucional', m, { detalhe: m.data ? 'Conta: ' + (m.data.company_name || '—') : null });
add('negocios', 'Leitura de negócios (funil 15)', r('Negócios'));
add('organizacoes', 'Leitura de organizações', r('Organizações'));
add('pessoas', 'Leitura de pessoas', r('Pessoas'));
add('atividades', 'Leitura de atividades', r('Atividades'));
const u = r('Usuários');
add('usuarios', 'Leitura de usuários (responsáveis)', u, { detalhe: lista(u).filter((x) => x.active_flag).length + ' usuário(s) ativo(s)' });
const cf = r('Campos de negócio');
const chaves = new Set(lista(cf).map((f) => f.key));
const exigidos = { '723edfa476f1d04f92df16d7bc08bc482d9a2ac2': 'Segmento', '9260473c7dffdb28935ce0db7fafd45524f91431': 'Gerente de CS', '58cd094a23bd14b9275f4c006f1b19457b3c1d63': 'Data do contato efetivo' };
const faltam = Object.entries(exigidos).filter(([k]) => !chaves.has(k)).map(([, v]) => v);
add('campos', 'Campos personalizados usados pelo Dinamize CS', cf, faltam.length && !erro(cf) ? { status: 'falha', detalhe: 'Ausentes: ' + faltam.join(', ') } : { detalhe: 'Segmento, gerente de CS e contato efetivo encontrados' });
const et = r('Etapas do funil');
const ids = new Set(lista(et).map((s) => s.id));
const etFalt = [101, 102, 103, 135, 147, 104].filter((i) => !ids.has(i));
add('funil', 'Etapas da carteira (funil 15)', et, etFalt.length && !erro(et) ? { status: 'falha', detalhe: 'Etapas ausentes: ' + etFalt.join(', ') } : { detalhe: 'Etapas configuradas encontradas' });
const tp = r('Tipos de atividade');
const anl = lista(tp).find((t) => t.key_string === 'anlise');
add('tipo_analise', 'Tipo de atividade "Análise"', tp, !erro(tp) && (!anl || anl.active_flag === false) ? { status: 'falha', detalhe: 'Tipo "Análise" ausente ou inativo' } : { detalhe: 'Disponível para o registro automático' });
checks.push({ chave: 'escrita', rotulo: 'Criação de atividades', status: 'nao_testado', detalhe: 'Não testada para não criar dados; ver o último registro confirmado.' });
const auth = checks[0].status === 'ok';
const falhas = checks.filter((c) => c.status === 'falha' || c.status === 'sem_permissao').length;
return [{ json: { p_id: $('Há teste?').first().json.teste_id,
  p_resultado: { checks, conta: m.data ? { empresa: m.data.company_name || null, usuario: m.data.name || null } : null, falhas, em: new Date().toISOString() },
  p_erro: auth ? null : 'Autenticação recusada pelo Pipedrive: verifique a credencial "Pipedrive account" no n8n' } }];` } } });
const concluir = node({ type: 'n8n-nodes-base.httpRequest', version: 4.4, config: { name: 'Concluir teste', parameters: {
  method: 'POST', url: SB + 'dcs_concluir_teste_conexao', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
  sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: expr('{{ JSON.stringify($json) }}'),
  options: { timeout: 30000 } }, credentials: credSupabase } });

export default workflow('dcs-12', 'Dinamize CS | 12 — Teste de conexão com o Pipedrive')
  .add(agendamento).to(reservar).to(temTeste).to(me).to(deals).to(orgs).to(pessoas).to(ativs).to(users).to(campos).to(etapas).to(tipos).to(avaliar).to(concluir);
