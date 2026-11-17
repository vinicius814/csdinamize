import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };

const erro = trigger({ type: 'n8n-nodes-base.errorTrigger', version: 1, config: { name: 'Erro em workflow Dinamize CS' } });

const registrar = node({
  type: 'n8n-nodes-base.httpRequest', version: 4.4,
  config: {
    name: 'Registrar erro', retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
    parameters: {
      method: 'POST', url: SB + 'dcs_registrar_log', authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify({ p_origem: $json.workflow.name, p_nivel: "erro", p_mensagem: ($json.execution.error && $json.execution.error.message) || "Falha sem mensagem", p_dados: { execucao: $json.execution.id, no: $json.execution.lastNodeExecuted, url: $json.execution.url } }) }}'),
      options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } }
    },
    credentials: credSupabase
  }
});

export default workflow('dcs-07', 'Dinamize CS | 07 — Monitoramento e falhas')
  .add(erro)
  .to(registrar);
