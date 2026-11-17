import { workflow, node, trigger } from '@n8n/workflow-sdk';

const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };

const agendamento = trigger({
  type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'A cada 30 minutos', parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 30 }] } } }
});

const reenfileirar = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Reenfileirar pendentes', retryOnFail: true, maxTries: 3, waitBetweenTries: 10000,
    parameters: {
      method: 'POST', url: SB + 'dcs_reenfileirar_jobs', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
      options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'reenfileirados' } } }
    },
    credentials: credSupabase
  }
});

export default workflow('dcs-10', 'Dinamize CS | 10 — Reprocessamento de operações pendentes')
  .add(agendamento)
  .to(reenfileirar);
