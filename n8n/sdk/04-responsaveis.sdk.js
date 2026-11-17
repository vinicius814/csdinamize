import { workflow, node, trigger, expr } from '@n8n/workflow-sdk';

const SB = 'https://dknywurmzgrkxiytvncp.supabase.co/rest/v1/rpc/';
const credSupabase = { supabaseApi: { id: 'TqXGYCOmVGd2AvKp', name: 'DCS · Supabase service role' } };
const credPipedrive = { pipedriveApi: { id: 'RLiF1ChIGaWvWg1f', name: 'Pipedrive account' } };

const agendamento = trigger({
  type: 'n8n-nodes-base.scheduleTrigger',
  version: 1.3,
  config: { name: 'Diário 06:10', parameters: { rule: { interval: [{ field: 'cronExpression', expression: '0 10 6 * * *' }] } } }
});

const manual = trigger({ type: 'n8n-nodes-base.manualTrigger', version: 1, config: { name: 'Execução manual' } });

// Sem nova tentativa automática: abrir a sincronização não é idempotente (trava de uma execução por tipo).
const abrir = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Abrir sincronização',
    parameters: {
      method: 'POST', url: SB + 'dcs_iniciar_sync',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: '{"p_tipo":"responsaveis","p_modo":"completa"}',
      options: { timeout: 30000, response: { response: { responseFormat: 'text', outputPropertyName: 'run' } } }
    },
    credentials: credSupabase
  }
});

const usuarios = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Usuários Pipedrive',
    executeOnce: true, retryOnFail: true, maxTries: 4, waitBetweenTries: 5000,
    parameters: {
      method: 'GET', url: 'https://api.pipedrive.com/v1/users',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'pipedriveApi',
      options: { timeout: 60000 }
    },
    credentials: credPipedrive
  }
});

const normalizar = node({
  type: 'n8n-nodes-base.code',
  version: 2,
  config: {
    name: 'Normalizar usuários',
    parameters: {
      mode: 'runOnceForAllItems',
      jsCode: `const run = String($('Abrir sincronização').first().json.run || '').replace(/"/g, '').trim();
if (!/^[0-9a-f-]{36}$/.test(run)) throw new Error('Sincronização não aberta: ' + run);
const resp = $input.first().json;
if (resp.success === false || !Array.isArray(resp.data) || !resp.data.length) throw new Error('Leitura de usuários do Pipedrive falhou: nada alterado');
const users = resp.data.map((u) => ({ id: u.id, nome: u.name, email: u.email, ativo: !!u.active_flag }));
return [{ json: { p_run: run, p_users: users } }];`
    }
  }
});

const publicar = node({
  type: 'n8n-nodes-base.httpRequest',
  version: 4.4,
  config: {
    name: 'Publicar responsáveis',
    parameters: {
      method: 'POST', url: SB + 'dcs_publicar_responsaveis',
      authentication: 'predefinedCredentialType', nodeCredentialType: 'supabaseApi',
      sendBody: true, contentType: 'json', specifyBody: 'json',
      jsonBody: expr('{{ JSON.stringify($json) }}'),
      options: { timeout: 60000, response: { response: { responseFormat: 'text', outputPropertyName: 'resultado' } } }
    },
    credentials: credSupabase
  }
});

export default workflow('dcs-04', 'Dinamize CS | 04 — Sincronização dos responsáveis')
  .add(agendamento)
  .to(abrir)
  .to(usuarios)
  .to(normalizar)
  .to(publicar)
  .add(manual)
  .to(abrir);
