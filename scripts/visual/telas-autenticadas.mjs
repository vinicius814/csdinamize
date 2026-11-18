// Ambiente controlado: backend 100% simulado no navegador de teste (sessão fictícia + dados sintéticos).
import { chromium } from "playwright-core";
const U = "11111111-1111-4111-8111-111111111111";
const hoje = new Date();
const d = (n) => new Date(hoje.getTime() - n * 864e5).toISOString().slice(0, 10);
const resp = [[1, "Responsável A"], [2, "Responsável B"], [3, "Responsável C"]];
const clientes = [], fin = [], cob = [], diags = [], acoes = [];
for (let i = 1; i <= 60; i++) {
  const [oid, on] = resp[i % 3];
  clientes.push({ key: String(i), org_id: i, nome: `Loja Exemplo ${i} Comércio Eletrônico`, codigo: String(1000 + i), deal_id: i, deal_ids: [i], stage_id: 103, owner_id: oid, owner_nome: on, person_id: null, label_ids: [], segmento: "ecommerce", ativo: true, inativado_em: null, atualizado_em: hoje.toISOString() });
  fin.push({ key: String(i), mrr: 500 + i * 37 });
  cob.push({ key: String(i), data_contato_efetivo: i % 7 === 0 ? null : d(i * 2), contato_por_atividade: null, ultimo_incerto: null, ultima_tentativa: i % 4 ? null : { id: i, date: d(3), type: "tarefa", subject: "Tentativa de contato", owner: oid }, proximo: i % 5 ? null : { id: 900 + i, date: d(-i), type: "reuniao", subject: "Reunião", owner: oid }, atualizado_em: hoje.toISOString() });
  if (i % 3 === 0) {
    const concl = i % 6 === 0;
    diags.push({ id: `00000000-0000-4000-8000-0000000000${String(i).padStart(2, "0")}`, cliente_key: String(i), ciclo: 1, status: concl ? "concluido" : "em_analise", analista_id: U, regras_id: "r", itens: { tec_dom: { s: concl ? "nao_impl" : "funcional" }, aut_cart: { s: "nao_funciona", sub: { impl: "s", ativa: "n" } } }, metricas: {}, resultados: {}, meta: {}, derivado: concl ? { score: 30 + i, band: "Baixo aproveitamento", opp: 5, crit: 1, quick: 2, cats: { tec: 50, aut: 40 } } : null, resumo: null, indice: concl ? 30 + i : null, completude: concl ? 85 : 40, versao: 1, iniciado_em: d(i), salvo_em: d(i), concluido_em: concl ? d(i - 2) + "T12:00:00Z" : null, proxima_revisao: concl ? d(-30) : null });
    acoes.push({ id: `a${i}`, cliente_key: String(i), rec_id: `r${i}`, categoria: "aut", problema: "Carrinho abandonado não funciona", acao: "Revisar gatilhos da automação de carrinho abandonado e reativar o fluxo", beneficio: "Recuperação de vendas", prioridade: i % 2 ? "critica" : "media", complexidade: "media", quem: "ambos", ganho_rapido: i % 2 === 0, status: i % 9 === 0 ? "implementado" : "aguardando_cliente", responsavel: on, prazo: d(i % 2 ? 5 : -10), observacoes: null, manual: false, obsoleta: false, obsoleta_em: null, reincidencias: i % 4 === 0 ? 1 : 0, primeiro_ciclo: 1, ultimo_ciclo: 1, versao: 1, atualizado_em: hoje.toISOString() });
  }
}
const syncs = [{ id: "s1", tipo: "carteira", modo: "completa", status: "sucesso", iniciado_em: hoje.toISOString(), concluido_em: hoje.toISOString(), lidos: 700, criados: 0, alterados: 3, inativados: 0, completo: true, detalhes: {}, erro: null }, { id: "s2", tipo: "cobertura", modo: "completa", status: "sucesso", iniciado_em: hoje.toISOString(), concluido_em: hoje.toISOString(), lidos: null, criados: 0, alterados: 0, inativados: 0, completo: true, detalhes: {}, erro: null }];
const alertas = clientes.slice(0, 12).map((c, i) => ({ id: i, tipo: ["cobertura_critica", "acao_atrasada", "revisao_vencida", "oportunidade_critica"][i % 4], cliente_key: c.key, referencia: null, detalhe: {}, gerado_em: hoje.toISOString() }));
const util = [
  { cliente_key: "4", status: "sem_uso", acompanhamento: "aguardando", sem_uso_desde: d(20), ultima_utilizacao: d(75), ultima_desconhecida: false, motivo: "Implementação não concluída", observacoes: null, evidencias: null, acao_retomada: "Reunião com o novo time de marketing", responsavel_id: U, proxima_revisao: d(3), intervalo_dias: null, ultimo_acompanhamento: d(20) + "T12:00:00Z", recuperado_em: null, atualizado_em: hoje.toISOString(), atualizado_por: U, versao: 1 },
  { cliente_key: "8", status: "sem_uso", acompanhamento: "retomada_em_andamento", sem_uso_desde: d(40), ultima_utilizacao: null, ultima_desconhecida: true, motivo: "Problemas técnicos", observacoes: null, evidencias: null, acao_retomada: "Validar integração da loja", responsavel_id: U, proxima_revisao: d(-5), intervalo_dias: null, ultimo_acompanhamento: d(5) + "T12:00:00Z", recuperado_em: null, atualizado_em: hoje.toISOString(), atualizado_por: U, versao: 2 },
  { cliente_key: "10", status: "em_uso", acompanhamento: "retomada", sem_uso_desde: null, ultima_utilizacao: d(2), ultima_desconhecida: false, motivo: "Cliente temporariamente sem operação", observacoes: null, evidencias: null, acao_retomada: null, responsavel_id: U, proxima_revisao: null, intervalo_dias: null, ultimo_acompanhamento: d(2) + "T12:00:00Z", recuperado_em: d(2), atualizado_em: hoje.toISOString(), atualizado_por: U, versao: 3 },
];
const utilEv = [{ id: 1, cliente_key: "10", em: d(2) + "T12:00:00Z", ator: U, tipo: "revisar", resultado: "retomou", dados: { obs: "Voltou a disparar" } }, { id: 2, cliente_key: "4", em: d(20) + "T12:00:00Z", ator: U, tipo: "marcar", resultado: null, dados: { motivo: "Implementação não concluída" } }];
const pre = [{ email: "nova.analista@dinamize.com", nome: "Nova Analista", perfil: "cs", financeiro: false, pode_editar: true, pode_exportar: false, ativo: true, carteiras: [1], clientes: [], pipedrive_user_id: 1, criado_por: U, criado_em: hoje.toISOString(), atualizado_em: hoje.toISOString(), convite_enviado_em: null, aplicado_em: null, aplicado_user: null, revogado_em: null }];
const tabelas = { dcs_clientes: clientes, dcs_clientes_financeiro: fin, dcs_cobertura: cob, dcs_diagnosticos: diags, dcs_acoes: acoes, dcs_sync_execucoes: syncs, dcs_alertas: alertas, dcs_utilizacao: util, dcs_utilizacao_eventos: utilEv, dcs_pre_cadastros: pre, dcs_config: [{ chave: "pipedrive_escrita", valor: { ativa: false } }], dcs_solicitacoes_sync: [], dcs_jobs: [], dcs_integracao_logs: [], dcs_acoes_eventos: [], dcs_auditoria: [], dcs_regras: [{ id: "r", versao: "1", config: null, metodologia: "v1", ativa: true, criado_por: null, criado_em: hoje.toISOString() }], profiles: [{ nome: "Usuário de Teste", papel: null, pipedrive_user_id: null }] };
const rpcs = { dcs_meu_acesso: { perfil: "admin", master: true, financeiro: true, editar: true, exportar: true, modulos: null, pipedrive: 1 },
  dcs_status_registro: { status: "concluido", tentativas: 1, erro: null, activity_id: 159570, deal_id: 6, escrita_ativa: false }, dcs_analistas: [{ user_id: U, nome: "Analista de Teste" }],
  dcs_listar_usuarios: [{ user_id: U, nome: "Usuário de Teste", email: "teste@exemplo.com", status: "ativo", papel: "superadmin", ultimo_acesso: hoje.toISOString(), perfil: "admin", financeiro: true, pode_editar: true, pode_exportar: true, ativo: true, carteiras: [], clientes: [], modulos: null, pipedrive_user_id: 1, master_principal: true }, { user_id: "3", nome: "Admin Secundário", email: "admin2@exemplo.com", status: "ativo", papel: "admin", ultimo_acesso: null, perfil: "admin", financeiro: true, pode_editar: true, pode_exportar: true, ativo: true, carteiras: [], clientes: [], modulos: null, pipedrive_user_id: null, master_principal: false }, { user_id: "2", nome: "Pessoa Pendente", email: "p@exemplo.com", status: "pendente", papel: "user", ultimo_acesso: null, perfil: null, financeiro: false, pode_editar: true, pode_exportar: false, ativo: false, carteiras: [], clientes: [], modulos: null, pipedrive_user_id: null, master_principal: false }],
  dcs_responsaveis_admin: resp.map(([id, nome]) => ({ pipedrive_user_id: id, nome, email: `resp${id}@dinamize.com`, ativo: true, visto_em: hoje.toISOString() })) };
function filtrar(rows, url) {
  let r = rows;
  for (const [k, v] of url.searchParams) {
    if (["select", "order", "limit", "offset"].includes(k)) continue;
    if (v.startsWith("eq.")) r = r.filter((x) => String(x[k]) === v.slice(3));
  }
  return r;
}
const vps = process.env.VP === "390" ? [["390", 390, 844]] : process.env.VP ? [["1440x900", 1440, 900]] : [["1920x1080", 1920, 1080], ["1440x900", 1440, 900], ["1366x768", 1366, 768], ["tablet", 820, 1180], ["390", 390, 844]];
const paginas = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "/usr/bin/google-chrome", args: ["--no-sandbox"] });
for (const [n, w, h] of vps) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([U]) => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const tok = "x." + btoa(JSON.stringify({ sub: U, exp, role: "authenticated" })).replace(/=/g, "") + ".y";
    localStorage.setItem("sb-dknywurmzgrkxiytvncp-auth-token", JSON.stringify({ access_token: tok, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: exp, user: { id: U, email: "teste@exemplo.com", app_metadata: { provider: "email" }, user_metadata: {}, aud: "authenticated" } }));
  }, [U]);
  await ctx.route(/supabase\.co/, async (route) => {
    const req = route.request(); const url = new URL(req.url());
    const one = (req.headers()["accept"] || "").includes("vnd.pgrst.object");
    let body = [];
    if (url.pathname.endsWith("/rpc/dcs_iniciar_analise")) body = { ...diags[0], cliente_key: "1", id: "00000000-0000-4000-8000-000000000999", ciclo: 1, status: "em_analise", analista_id: U };
    else if (url.pathname.startsWith("/rest/v1/rpc/")) body = rpcs[url.pathname.split("/").pop()] ?? [];
    else if (url.pathname.startsWith("/rest/v1/")) { const rows = filtrar(tabelas[url.pathname.split("/").pop()] ?? [], url); body = one ? (rows[0] ?? null) : rows; }
    else if (url.pathname.startsWith("/auth/v1/user")) body = { id: U, email: "teste@exemplo.com", aud: "authenticated", app_metadata: {}, user_metadata: {} };
    if (req.method() === "HEAD") return route.fulfill({ status: 200, headers: { "content-range": "0-0/3", "access-control-allow-origin": "*", "access-control-expose-headers": "content-range" } });
    return route.fulfill({ status: 200, contentType: "application/json", headers: { "access-control-allow-origin": "*", "content-range": "0-0/3", "access-control-expose-headers": "content-range" }, body: JSON.stringify(body) });
  });
  await ctx.route(/_serverFn/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ result: { status: "ativo", accepted: true, role: "superadmin", onboarded: true } }) }));
  for (const p of paginas) {
    const pg = await ctx.newPage();
    const erros = [];
    pg.on("pageerror", (e) => erros.push(e.message.slice(0, 200)));
    pg.on("console", (m) => { if (m.type() === "error") erros.push("console:" + m.text().slice(0, 300)); });
    await pg.goto("http://127.0.0.1:5173" + p, { waitUntil: "networkidle", timeout: 90000 }).catch(() => {});
    await pg.waitForTimeout(2500);
    if (process.env.INICIAR) {
      const chamadas = [];
      pg.on("request", (q) => { if (/rpc\/dcs_iniciar_analise/.test(q.url())) chamadas.push(q.postData()); });
      await pg.getByRole("button", { name: "Iniciar análise" }).first().click();
      await pg.waitForTimeout(2500);
      console.log("INICIAR rpc_chamada=" + chamadas.length + " corpo=" + chamadas[0] + " url_final=" + pg.url());
    }
    if (process.env.CLIQUE) { await pg.getByRole("tab", { name: /Automa/ }).first().click().catch(() => {}); await pg.waitForTimeout(800); }
    if (process.env.LARGO) console.log(await pg.evaluate(() => { const cw = document.documentElement.clientWidth; let e = document.querySelector("table"); const out = []; while (e) { out.push(e); e = e.parentElement; } return out.slice(0, 9).map((e) => e.tagName + "." + String(e.className).slice(0, 90) + " w=" + Math.round(e.getBoundingClientRect().width) + " sw=" + e.scrollWidth).join("\n"); }));
    const r = await pg.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, munin: /Munin|Wojtec/.test(document.body.innerText), path: location.pathname, txt: document.body.innerText.slice(0, 80).replace(/\n/g, " ") }));
    const nome = p.replace(/\W/g, "_") + "-" + n;
    await pg.screenshot({ path: `/home/claude/vtest/shots/a${nome}.png`, fullPage: false });
    console.log(nome, "path=" + r.path, "overflowX=" + (r.sw > r.cw) + `(${r.sw}/${r.cw})`, "munin=" + r.munin, erros.length ? "ERROS:" + erros.join("|") : "", "|", r.txt);
    await pg.close();
  }
  await ctx.close();
}
await b.close();
