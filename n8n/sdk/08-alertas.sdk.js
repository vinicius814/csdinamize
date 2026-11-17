import { workflow, node, trigger } from '@n8n/workflow-sdk';

const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };

const agendamento = trigger({
  type: 'n8n-nodes-base.scheduleTrigger', version: 1.3,
  config: { name: 'Diário 07:35', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 35 7 * * *' }] } } }
});
const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });

const alertas = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Atualizar alertas', retryOnFail: true, maxTries: 3, waitBetweenTries: 10000,
    parameters: {
      method: 'POST', url: SB + 'dcs_atualizar_alertas', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json', jsonBody: '{}',
      options: { timeout: 60000, response: { response: { responseFormat: 'text', outputPropertyName: 'alertas' } } }
    },
    credentials: credSupabase
  }
});

export default workflow('dcs-08', 'Dinamize CS | 08 — Revisões e alertas')
  .add(agendamento)
  .to(alertas)
  .add(manual)
  .to(alertas);
