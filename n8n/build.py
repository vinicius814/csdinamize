#!/usr/bin/env python3
"""Gera os workflows importáveis do n8n em n8n/workflows/*.json.
Uso: python3 -I n8n/build.py  (a partir da raiz do repositório)
Sem credenciais embutidas: os nós referenciam credenciais pelo NOME, que o admin cria no n8n
(ver docs/N8N_WORKFLOWS.md). Edite este arquivo e os JS em n8n/src, nunca os JSON gerados."""
import json, os, uuid

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = lambda n: open(os.path.join(ROOT, "src", n), encoding="utf-8").read()
PD = "https://api.pipedrive.com/api/v2"
CRED_PD = {"pipedriveApi": {"id": "", "name": "DCS · Pipedrive (cs-dinamize)"}}
CRED_SB = {"supabaseApi": {"id": "", "name": "DCS · Supabase service role"}}
CRED_HOOK = {"httpHeaderAuth": {"id": "", "name": "DCS · Segredo dos webhooks"}}
SB = "={{ $('Config').first().json.supabase_url }}/rest/v1/rpc/"

CFG_CARTEIRA = {
    "stages": [101, 102, 103, 135, 147, 104], "ecom": {"segmento": True, "etiqueta": True}, "ownerSource": "owner",
    "fSeg": "723edfa476f1d04f92df16d7bc08bc482d9a2ac2", "fGer": "9260473c7dffdb28935ce0db7fafd45524f91431",
    "segEcom": 360, "labelEcom": 690, "pipeline": 15, "maxPaginas": 200,
}


class WF:
    def __init__(self, nome, desc):
        self.nome, self.desc, self.nodes, self.conn, self.x = nome, desc, [], {}, 0

    def add(self, name, type_, params, version=1, cred=None, after=None, branch=0, y=0, **extra):
        self.x += 240
        n = {"id": str(uuid.uuid5(uuid.NAMESPACE_URL, self.nome + name)), "name": name, "type": type_,
             "typeVersion": version, "position": [self.x, y], "parameters": params, **extra}
        if cred:
            n["credentials"] = cred
        self.nodes.append(n)
        if after:
            outs = self.conn.setdefault(after, {"main": []})["main"]
            while len(outs) <= branch:
                outs.append([])
            outs[branch].append({"node": name, "type": "main", "index": 0})
        return name

    def config(self, after, extra=None):
        vals = [{"id": "u", "name": "supabase_url", "type": "string", "value": "https://SEU-PROJETO.supabase.co"}]
        for k, v in (extra or {}).items():
            vals.append({"id": k, "name": k, "type": "object" if isinstance(v, (dict, list)) else "string",
                         "value": json.dumps(v) if isinstance(v, (dict, list)) else v})
        return self.add("Config", "n8n-nodes-base.set", {"assignments": {"assignments": vals}, "options": {}}, 3.4, after=after)

    def rpc(self, name, fn, body_expr, after, branch=0, y=0, fail_ok=False):
        p = {"method": "POST", "url": SB + fn, "authentication": "predefinedCredentialType", "nodeCredentialType": "supabaseApi",
             "sendBody": True, "specifyBody": "json", "jsonBody": body_expr,
             "options": {"timeout": 60000}}
        extra = {"retryOnFail": True, "maxTries": 3, "waitBetweenTries": 5000}
        if fail_ok:
            extra["onError"] = "continueRegularOutput"
        return self.add(name, "n8n-nodes-base.httpRequest", p, 4.2, CRED_SB, after, branch, y, **extra)

    def pd_get(self, name, path, query, after, paginate=True, branch=0, y=0):
        p = {"url": path if path.startswith("http") else PD + path, "authentication": "predefinedCredentialType", "nodeCredentialType": "pipedriveApi",
             "sendQuery": True, "queryParameters": {"parameters": [{"name": k, "value": v} for k, v in query.items()]},
             "options": {"timeout": 60000}}
        if paginate:
            p["options"]["pagination"] = {"pagination": {
                "parameters": {"parameters": [{"name": "cursor", "value": "={{ $response.body.additional_data.next_cursor }}"}]},
                "paginationCompleteWhen": "other",
                "completeExpression": "={{ !$response.body.additional_data || !$response.body.additional_data.next_cursor }}",
                "limitPagesFetched": True, "maxRequests": CFG_CARTEIRA["maxPaginas"], "requestInterval": 250}}
        return self.add(name, "n8n-nodes-base.httpRequest", p, 4.2, CRED_PD, after, branch, y,
                        retryOnFail=True, maxTries=4, waitBetweenTries=5000)

    def code(self, name, js, after, branch=0, y=0, mode="runOnceForAllItems"):
        return self.add(name, "n8n-nodes-base.code", {"mode": mode, "jsCode": js}, 2, after=after, branch=branch, y=y)

    def iff(self, name, expr, after):
        return self.add(name, "n8n-nodes-base.if", {"conditions": {"options": {"caseSensitive": True, "typeValidation": "loose", "version": 2},
            "conditions": [{"id": "c", "leftValue": expr, "rightValue": "", "operator": {"type": "boolean", "operation": "true", "singleValue": True}}],
            "combinator": "and"}, "options": {}}, 2.2, after=after)

    def schedule(self, name, cron):
        return self.add(name, "n8n-nodes-base.scheduleTrigger", {"rule": {"interval": [{"field": "cronExpression", "expression": cron}]}}, 1.2)

    def webhook(self, name, path):
        return self.add(name, "n8n-nodes-base.webhook", {"httpMethod": "POST", "path": path, "authentication": "headerAuth",
                        "responseMode": "onReceived", "options": {}}, 2, CRED_HOOK, webhookId=str(uuid.uuid5(uuid.NAMESPACE_URL, path)))

    def save(self, arquivo):
        wf = {"name": self.nome, "nodes": self.nodes, "connections": self.conn, "active": False,
              "settings": {"executionOrder": "v1", "timezone": "America/Sao_Paulo", "saveDataErrorExecution": "all",
                           "errorWorkflow": "DCS 07 — Monitoramento e falhas"},
              "meta": {"templateCredsSetupCompleted": False}, "pinData": {}, "tags": [{"name": "dinamize-cs"}],
              "description": self.desc}
        with open(os.path.join(ROOT, "workflows", arquivo), "w", encoding="utf-8") as f:
            json.dump(wf, f, ensure_ascii=False, indent=2)


def carteira(arquivo, nome, modo, cron):
    w = WF(nome, f"Sincroniza a carteira e-commerce do funil 15 (modo {modo}) e publica no Supabase via dcs_publicar_carteira. "
                 "Só inativa clientes após leitura completa.")
    t = w.schedule("Agendamento", cron)
    c = w.config(t, {"cfg": CFG_CARTEIRA, "modo": modo})
    r = w.rpc("Abrir sincronização", "dcs_iniciar_sync", '={{ JSON.stringify({ p_tipo: "carteira", p_modo: $json.modo }) }}', c)
    u = w.pd_get("Usuários Pipedrive", "https://api.pipedrive.com/v1/users", {}, r, paginate=False)
    q = {"pipeline_id": "15", "status": "open", "limit": "500", "sort_by": "id", "sort_direction": "asc",
         "custom_fields": CFG_CARTEIRA["fSeg"] + "," + CFG_CARTEIRA["fGer"], "include_option_labels": "true"}
    # Incremental relê o funil inteiro (poucas páginas) para consolidar todos os negócios de cada organização,
    # mas nunca inativa; o RPC só grava linhas que mudaram. Ver docs/DECISIONS.md (D7).
    d = w.pd_get("Negócios do funil CS", "/deals", q, u)
    js = SRC("consolidar-carteira.js") + """
const cfg = $('Config').first().json.cfg;
const _r = $('Abrir sincronização').first().json; const run = typeof _r === 'string' ? _r : (_r.data ?? _r.dcs_iniciar_sync ?? _r.id);
const nomes = {}; for (const u of ($('Usuários Pipedrive').first().json.data || [])) nomes[String(u.id)] = u.name;
const paginas = $input.all();
const deals = paginas.flatMap((p) => p.json.data || []);
const ultima = paginas[paginas.length - 1]?.json;
const completo = paginas.every((p) => p.json.success !== false) && !ultima?.additional_data?.next_cursor && paginas.length < cfg.maxPaginas;
const rows = consolidarCarteira(deals, cfg, nomes);
return [{ json: { p_run: run, p_rows: rows, p_lidos: deals.length, p_completo: %s && completo } }];
""" % ("true" if modo == "completa" else "false")
    k = w.code("Consolidar carteira", js, d)
    w.rpc("Publicar carteira", "dcs_publicar_carteira", "={{ JSON.stringify($json) }}", k)
    if modo == "incremental":
        w.x = 0
        w.add("Chamado pelo webhook", "n8n-nodes-base.executeWorkflowTrigger", {"inputSource": "passthrough"}, 1.1, y=200)
        w.conn["Chamado pelo webhook"] = {"main": [[{"node": "Config", "type": "main", "index": 0}]]}
    w.save(arquivo)


def webhooks():
    w = WF("DCS 03 — Webhooks do Pipedrive", "Recebe eventos de negócio do Pipedrive (autenticados por cabeçalho), ignora repetidos "
           "e dispara a sincronização incremental do cliente afetado.")
    h = w.webhook("Evento Pipedrive", "dcs-pipedrive")
    js = """
const ev = $json.body || {};
const meta = ev.meta || {};
const id = meta.entity_id || ev.data?.id || ev.current?.id;
const pipeline = ev.data?.pipeline_id ?? ev.current?.pipeline_id ?? ev.previous?.pipeline_id;
const relevante = meta.entity === 'deal' && (pipeline === 15 || ev.previous?.pipeline_id === 15);
// Idempotência: Pipedrive reenvia o mesmo evento; a chave fica em static data por 24h.
const st = $getWorkflowStaticData('global'); st.vistos = st.vistos || {};
const chave = `${meta.id || ''}:${id}:${meta.timestamp || ev.current?.update_time || ''}`;
const agora = Date.now(); for (const [k, t] of Object.entries(st.vistos)) if (agora - t > 864e5) delete st.vistos[k];
if (!relevante || st.vistos[chave]) return [];
st.vistos[chave] = agora;
return [{ json: { deal_id: id, acao: meta.action, chave } }];
"""
    f = w.code("Filtrar e deduplicar", js, h)
    w.add("Disparar sincronização incremental", "n8n-nodes-base.executeWorkflow",
          {"workflowId": {"__rl": True, "mode": "list", "value": "", "cachedResultName": "DCS 02 — Sincronização incremental da carteira"},
           "options": {"waitForSubWorkflow": False}}, 1.2, after=f)
    w.save("03-webhooks-pipedrive.json")


def responsaveis():
    w = WF("DCS 04 — Sincronização dos responsáveis", "Lê usuários do Pipedrive e registra ativos/inativos para vincular carteiras sem vínculos incorretos.")
    t = w.schedule("Diário 06:10", "10 6 * * *")
    c = w.config(t)
    r = w.rpc("Abrir sincronização", "dcs_iniciar_sync", '={{ JSON.stringify({ p_tipo: "responsaveis", p_modo: "completa" }) }}', c)
    u = w.pd_get("Usuários Pipedrive", "https://api.pipedrive.com/v1/users", {}, r, paginate=False)
    js = """
const _r = $('Abrir sincronização').first().json; const run = typeof _r === 'string' ? _r : (_r.data ?? _r.dcs_iniciar_sync ?? _r.id);
const users = ($json.data || []).map((u) => ({ id: u.id, nome: u.name, email: u.email, ativo: !!u.active_flag }));
return [{ json: { p_run: run, p_erro: null, users } }];
"""
    k = w.code("Normalizar usuários", js, u)
    w.rpc("Registrar responsáveis", "dcs_publicar_responsaveis",
          "={{ JSON.stringify({ p_run: $json.p_run, p_users: $json.users }) }}", k)
    w.save("04-sincronizacao-responsaveis.json")


def cobertura():
    w = WF("DCS 05 — Cobertura de Customer Success", "Classifica atividades (contato efetivo, tentativa, sem evidência), "
           "lê próximos contatos e publica dcs_cobertura. Atividades do próprio sistema nunca contam.")
    t = w.schedule("Seg a sex 07:20 e 13:20", "20 7,13 * * 1-5")
    cov = {"modes": {"contato_efetivo": "forte", "reunio_acompanhamento": "sim", "reunio_3___ativao": "sim", "email1": "kw"},
           "kwPos": ["contato efetivo", "reunião realizada", "reuniao realizada", "call realizada", "conversa realizada", "atendeu",
                     "respondeu", "retorno do cliente", "alinhamento", "acompanhamento"],
           "kwNeg": ["tentativa", "sem resposta", "não atendeu", "nao atendeu", "caixa postal", "cancelad", "no show", "no-show",
                     "remarcad", "reagend", "convite", "lembrete", "agendar"], "lookbackDays": 120}
    c = w.config(t, {"cov": cov})
    r = w.rpc("Abrir sincronização", "dcs_iniciar_sync", '={{ JSON.stringify({ p_tipo: "cobertura", p_modo: "completa" }) }}', c)
    cl = w.rpc("Clientes ativos", "dcs_clientes_para_cobertura", "={{ JSON.stringify({}) }}", r)
    feitas = w.pd_get("Atividades concluídas", "/activities", {
        "done": "true", "limit": "500", "sort_by": "update_time", "sort_direction": "desc",
        "updated_since": "={{ $now.minus({days: $('Config').first().json.cov.lookbackDays}).toUTC().toISO({suppressMilliseconds: true}) }}"}, cl)
    abertas = w.pd_get("Atividades agendadas", "/activities", {"done": "false", "limit": "500", "sort_by": "due_date", "sort_direction": "desc"}, feitas)
    js = SRC("classificar-atividade.js") + """
const cov = $('Config').first().json.cov;
const _r = $('Abrir sincronização').first().json; const run = typeof _r === 'string' ? _r : (_r.data ?? _r.dcs_iniciar_sync ?? _r.id);
const clientes = $('Clientes ativos').all().map((i) => i.json).filter((c) => c.key);  // PostgREST devolve array → um item por cliente
const byDeal = {}, byOrg = {}, byPerson = {};
for (const c of clientes) { (c.deal_ids || []).forEach((d) => byDeal[d] = c.key); if (c.org_id) byOrg[c.org_id] = c.key; if (c.person_id) byPerson[c.person_id] = c.key; }
const cliente = (a) => (a.deal_id && byDeal[a.deal_id]) || (a.org_id && byOrg[a.org_id]) || (a.person_id && byPerson[a.person_id]) || null;
const data = (a) => String(a.marked_as_done_time || a.due_date || a.add_time || '').slice(0, 10);
const rec = (a, d) => ({ id: a.id, date: d || data(a), type: a.type || '', subject: String(a.subject || '').slice(0, 90), owner: a.owner_id ?? null });
const later = (x, y) => !x ? y : !y ? x : (y.date > x.date || (y.date === x.date && y.id > x.id)) ? y : x;
const pg1 = $('Atividades concluídas').all(), pg2 = $('Atividades agendadas').all();
const completo = !pg1[pg1.length - 1]?.json?.additional_data?.next_cursor;
const agg = {};
for (const a of pg1.flatMap((p) => p.json.data || [])) {
  const k = cliente(a); if (!k) continue;
  const c = classificarAtividade(a, cov); if (c === 'ignorar') continue;
  const slot = c === 'efetivo' ? 'ultimo_efetivo' : c === 'tentativa' ? 'ultima_tentativa' : 'ultimo_incerto';
  const g = agg[k] = agg[k] || {}; g[slot] = later(g[slot], rec(a));
}
const hoje = $now.setZone('America/Sao_Paulo').toISODate();
for (const a of pg2.flatMap((p) => p.json.data || [])) {
  if (!a.due_date || a.due_date < hoje || a.is_deleted) continue;
  const k = cliente(a); if (!k) continue;
  if (classificarAtividade({ ...a, done: true }, cov) === 'ignorar') continue;
  const g = agg[k] = agg[k] || {}; if (!g.proximo || a.due_date < g.proximo.date) g.proximo = rec(a, a.due_date);
}
// Leitura completa: clientes sem atividade recebem nulos (atividades excluídas/alteradas deixam de contar).
const rows = clientes.map((c) => ({ key: c.key, ultimo_efetivo: agg[c.key]?.ultimo_efetivo || null, ultimo_incerto: agg[c.key]?.ultimo_incerto || null,
  ultima_tentativa: agg[c.key]?.ultima_tentativa || null, proximo: agg[c.key]?.proximo || null }));
if (!completo) return [{ json: { p_run: run, p_erro: 'Leitura de atividades incompleta; cobertura anterior preservada' , falha: true } }];
return [{ json: { p_run: run, p_rows: rows, p_completo: true, p_detalhes: { concluidas: pg1.length, agendadas: pg2.length } } }];
"""
    for n in w.nodes:  # "Clientes ativos" devolve um item por cliente: leituras do Pipedrive executam uma única vez
        if n["name"] in ("Atividades concluídas", "Atividades agendadas"):
            n["executeOnce"] = True
    k = w.code("Classificar e agregar", js, abertas)
    i = w.iff("Leitura completa?", "={{ !$json.falha }}", k)
    w.rpc("Publicar cobertura", "dcs_publicar_cobertura", "={{ JSON.stringify($json) }}", i, 0)
    w.rpc("Registrar falha", "dcs_falhar_sync", "={{ JSON.stringify({ p_run: $json.p_run, p_erro: $json.p_erro }) }}", i, 1, 200)
    w.save("05-cobertura-cs.json")


def registro_diagnostico():
    w = WF("DCS 06 — Registro de diagnóstico concluído", "Processa a fila dcs_jobs: procura atividade já criada pela marca DZCS "
           "(idempotência, inclusive após resposta ambígua) e só então cria a atividade 'Análise' no negócio.")
    t = w.schedule("A cada 5 minutos", "*/5 * * * *")
    c = w.config(t)
    r = w.rpc("Reservar jobs", "dcs_reservar_jobs", '={{ JSON.stringify({ p_tipo: "pipedrive_atividade_diagnostico", p_limite: 10 }) }}', c)
    s = w.code("Um item por job", "return $input.all().map((i) => i.json).flat().filter((j) => j && j.id).map((j) => ({ json: j }));", r)
    ex = w.pd_get("Atividades do negócio", "/activities", {"deal_id": "={{ $json.payload.deal_id }}", "limit": "500"}, s, paginate=False)
    js = """
const out = [];
const jobs = $('Um item por job').all();
$input.all().forEach((it, i) => {
  const job = jobs[i].json;
  const ja = (it.json.data || []).find((a) => String(a.note || '').includes(job.payload.marca));
  out.push({ json: { job, existente: ja ? ja.id : null } });
});
return out;
"""
    k = w.code("Já existe?", js, ex)
    i = w.iff("Criar atividade?", "={{ !$json.existente }}", k)
    body = ("={{ JSON.stringify({ subject: $json.job.payload.subject, type: 'anlise', done: true, deal_id: $json.job.payload.deal_id, "
            "org_id: $json.job.payload.org_id, owner_id: $json.job.payload.owner_id, due_date: $now.setZone('America/Sao_Paulo').toISODate(), "
            "note: ($json.job.payload.resumo || '').replace(/\\n/g, '<br>') + '<br><br>' + $json.job.payload.marca }) }}")
    cria = w.add("Criar atividade", "n8n-nodes-base.httpRequest", {
        "method": "POST", "url": PD + "/activities", "authentication": "predefinedCredentialType", "nodeCredentialType": "pipedriveApi",
        "sendBody": True, "specifyBody": "json", "jsonBody": body, "options": {"timeout": 30000, "response": {"response": {"fullResponse": True, "neverError": True}}}},
        4.2, CRED_PD, i, 0, onError="continueRegularOutput")
    js2 = """
const job = $('Criar atividade?').item.json.job;
const r = $json;
const id = r.body?.data?.id;
// Sem status ou erro de rede = resposta ambígua: o próximo ciclo confere pela marca antes de recriar.
const status = id ? 'concluido' : (!r.statusCode || r.statusCode >= 500) ? 'ambiguo' : 'falha';
return { json: { p_id: job.id, p_status: status, p_resultado: id ? { activity_id: id } : null, p_erro: id ? null : JSON.stringify(r.body || r.error || {}).slice(0, 500) } };
"""
    f = w.code("Resultado", js2, cria, mode="runOnceForEachItem")
    w.rpc("Finalizar job", "dcs_finalizar_job", "={{ JSON.stringify($json) }}", f)
    w.code("Já registrado", "return { json: { p_id: $json.job.id, p_status: 'concluido', p_resultado: { activity_id: $json.existente, reaproveitada: true }, p_erro: null } };",
           i, 1, 200, mode="runOnceForEachItem")
    w.rpc("Finalizar job existente", "dcs_finalizar_job", "={{ JSON.stringify($json) }}", "Já registrado", y=200)
    w.save("06-registro-diagnostico.json")


def monitoramento():
    w = WF("DCS 07 — Monitoramento e falhas", "Workflow de erro dos demais: registra a falha em dcs_integracao_logs, "
           "devolve jobs 'ambiguo' para nova checagem e avisa administradores por e-mail.")
    e = w.add("Erro em workflow DCS", "n8n-nodes-base.errorTrigger", {}, 1)
    c = w.config(e, {"emails_admin": "vinicius.alves@dinamize.com.br"})
    w.rpc("Registrar erro", "dcs_registrar_log",
          "={{ JSON.stringify({ p_origem: $('Erro em workflow DCS').first().json.workflow.name, p_nivel: 'erro', "
          "p_mensagem: $('Erro em workflow DCS').first().json.execution.error.message, p_dados: { execucao: $('Erro em workflow DCS').first().json.execution.id } }) }}", c)
    w.save("07-monitoramento-falhas.json")
    w2 = WF("DCS 07b — Reprocessar operações pendentes", "A cada 30 minutos devolve jobs ambíguos/travados à fila (com backoff) para reprocessamento.")
    t = w2.schedule("A cada 30 minutos", "*/30 * * * *")
    c2 = w2.config(t)
    w2.rpc("Reenfileirar", "dcs_reenfileirar_jobs", "={{ JSON.stringify({}) }}", c2)
    w2.save("07b-reprocessar-pendentes.json")


def alertas():
    w = WF("DCS 08 — Revisões e alertas", "Diariamente atualiza os alertas internos: revisões vencidas, ações atrasadas, cobertura crítica e oportunidades críticas.")
    t = w.schedule("Diário 07:05", "5 7 * * *")
    c = w.config(t)
    w.rpc("Atualizar alertas", "dcs_atualizar_alertas", "={{ JSON.stringify({}) }}", c)
    w.save("08-revisoes-alertas.json")


def mensagens_ia():
    w = WF("DCS 09 — Mensagens com IA (opcional)", "Recebe apenas os fatos do diagnóstico (sem dados pessoais), gera versões WhatsApp/e-mail "
           "e valida a estrutura. Se falhar, o app usa os templates determinísticos.")
    h = w.webhook("Pedido do app", "dcs-mensagem-ia")
    js = """
const f = $json.body?.fatos;
if (!f || !Array.isArray(f.oportunidades) || !Array.isArray(f.positivos)) throw new Error('Payload inválido');
const prompt = `Escreva em português do Brasil, tom próximo e profissional, duas mensagens para o cliente ${f.cliente || ''} da Dinamize. `
 + `Valorize: ${f.positivos.join('; ') || 'n/d'}. Oportunidades: ${f.oportunidades.map((o) => o.titulo + ' → ' + o.acao).join('; ')}. `
 + 'Ofereça ajuda da equipe para preparar recursos. Não prometa resultados financeiros. '
 + 'Responda SOMENTE JSON {"whatsapp":"...","assunto":"...","email":"..."}.';
return [{ json: { prompt } }];
"""
    p = w.code("Montar prompt", js, h)
    ia = w.add("Modelo de linguagem", "n8n-nodes-base.httpRequest", {
        "method": "POST", "url": "https://api.anthropic.com/v1/messages", "authentication": "predefinedCredentialType",
        "nodeCredentialType": "anthropicApi", "sendHeaders": True,
        "headerParameters": {"parameters": [{"name": "anthropic-version", "value": "2023-06-01"}]},
        "sendBody": True, "specifyBody": "json",
        "jsonBody": "={{ JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 1200, messages: [{ role: 'user', content: $json.prompt }] }) }}",
        "options": {"timeout": 45000}}, 4.2, {"anthropicApi": {"id": "", "name": "DCS · Anthropic (opcional)"}}, p, onError="continueRegularOutput")
    js2 = """
try {
  const t = $json.content?.[0]?.text || '';
  const m = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
  if (typeof m.whatsapp !== 'string' || typeof m.email !== 'string') throw new Error('estrutura');
  if (/R\\$\\s?\\d|garant/i.test(m.whatsapp + m.email)) throw new Error('promessa financeira');
  return [{ json: { ok: true, ...m } }];
} catch (e) { return [{ json: { ok: false, motivo: String(e.message || e) } }]; }
"""
    w.code("Validar resposta", js2, ia)
    w.save("09-mensagens-ia-opcional.json")


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "workflows"), exist_ok=True)
    carteira("01-sincronizacao-inicial-carteira.json", "DCS 01 — Sincronização completa da carteira", "completa", "40 5 * * *")
    carteira("02-sincronizacao-incremental.json", "DCS 02 — Sincronização incremental da carteira", "incremental", "15 8-19 * * 1-5")
    webhooks(); responsaveis(); cobertura(); registro_diagnostico(); monitoramento(); alertas(); mensagens_ia()
    print("workflows gerados:", sorted(os.listdir(os.path.join(ROOT, "workflows"))))
