import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODELO = "anthropic/claude-sonnet-5";
const PIPEDRIVE_GW = "https://connector-gateway.lovable.dev/pipedrive";

const TIPOS = ["atividade_pipedrive", "nota_pipedrive", "rascunho_gmail", "evento_agenda"] as const;

const FERRAMENTAS = [
  {
    name: "carteira",
    description: "Lista os clientes da carteira do usuário com último contato, próxima atividade e pendências.",
    input_schema: { type: "object", properties: { sem_contato_dias: { type: "number", description: "Filtra clientes sem contato há mais de N dias" } } },
  },
  {
    name: "buscar_cliente",
    description: "Busca um cliente pelo nome e traz os dados e os registros recentes (riscos, resumos).",
    input_schema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
  },
  {
    name: "buscar_notas",
    description: "Busca nas notas do usuário (segundo cérebro) por texto.",
    input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
  },
  {
    name: "salvar_nota",
    description: "Salva uma nota, ideia ou lembrete do usuário. Use quando ele pedir para anotar ou lembrar algo.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        area: { type: "string", description: "Ex.: trabalho, projetos, pessoal, ideias" },
        tags: { type: "array", items: { type: "string" } },
        corpo_md: { type: "string" },
        lembrete_em: { type: "string", description: "Data/hora ISO 8601 do lembrete, se houver" },
      },
      required: ["titulo", "corpo_md"],
    },
  },
  {
    name: "propor_acao",
    description:
      "Prepara uma ação para o usuário aprovar. Nada é executado sem aprovação. Tipos: atividade_pipedrive (parametros: deal_id, assunto, data YYYY-MM-DD, tipo), nota_pipedrive (deal_id, conteudo), rascunho_gmail (para, assunto, corpo), evento_agenda (titulo, inicio ISO, fim ISO, convidados).",
    input_schema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: [...TIPOS] },
        resumo: { type: "string", description: "Frase curta do que será feito" },
        parametros: { type: "object" },
      },
      required: ["tipo", "resumo", "parametros"],
    },
  },
];

function promptSistema(p: { nome: string | null; papel: string }, memoria: string, agora: string) {
  return `Você é o Munim, assistente pessoal proativo de ${p.nome ?? "seu usuário"} (${p.papel}), produto da Wojtec inspirado no J.A.R.V.I.S.
Personalidade: confiante, calmo, preciso e próximo. Respostas curtas, em português do Brasil, em Markdown leve.
Agora: ${agora} (America/Sao_Paulo).

O que você faz: organiza o dia, lembra de tudo, ajuda a priorizar projetos, melhora ideias com sugestões concretas, responde sobre a carteira de clientes (Customer Success: cobertura de 60 dias, riscos, clientes sem retorno) e prepara ações.
Regras que não mudam:
- Nada é enviado, apagado ou alterado sem aprovação: para agir no Pipedrive, Gmail ou Agenda, use propor_acao e avise que está esperando a aprovação.
- E-mail nunca é enviado, só vira rascunho.
- Quando o usuário ditar ideias, tarefas ou lembretes, organize e salve com salvar_nota, e diga onde guardou.
- Nunca invente dados de clientes; use as ferramentas. Se algo não estiver conectado ainda (Google), diga com naturalidade.
- Tome a iniciativa: termine com um próximo passo útil quando fizer sentido.

Memória sobre o usuário:
${memoria || "(ainda vazia)"}`;
}

type Ctx = { supabase: any; userId: string };

async function executarFerramenta(nome: string, input: any, ctx: Ctx): Promise<{ texto: string; acaoId?: string }> {
  const { supabase, userId } = ctx;
  if (nome === "carteira") {
    const { data, error } = await supabase
      .from("clientes")
      .select("pipedrive_deal_id, titulo, nome_curto, etapa, ultimo_contato_efetivo, proxima_atividade, proxima_atividade_assunto, atividades_pendentes")
      .eq("pipeline_id", 15)
      .neq("stage_id", 105)
      .limit(300);
    if (error) return { texto: `erro: ${error.message}` };
    let lista = data ?? [];
    const d = Number(input?.sem_contato_dias);
    if (d) {
      const lim = Date.now() - d * 86400000;
      lista = lista.filter((c: any) => !c.ultimo_contato_efetivo || new Date(c.ultimo_contato_efetivo).getTime() < lim);
    }
    return { texto: JSON.stringify({ total: lista.length, clientes: lista.slice(0, 80) }) };
  }
  if (nome === "buscar_cliente") {
    const termo = String(input?.nome ?? "").replace(/[%,()]/g, "");
    const { data } = await supabase
      .from("clientes")
      .select("*")
      .or(`titulo.ilike.%${termo}%,nome_curto.ilike.%${termo}%`)
      .limit(5);
    const ids = (data ?? []).map((c: any) => c.pipedrive_deal_id);
    const { data: regs } = ids.length
      ? await supabase.from("registros").select("pipedrive_deal_id, data, risco, resumo").in("pipedrive_deal_id", ids).order("data", { ascending: false }).limit(15)
      : { data: [] };
    return { texto: JSON.stringify({ clientes: data ?? [], registros: regs ?? [] }) };
  }
  if (nome === "buscar_notas") {
    const t = String(input?.texto ?? "").replace(/[%,()]/g, "");
    const { data } = await supabase
      .from("notas")
      .select("titulo, area, tags, resumo, corpo_md, lembrete_em, created_at")
      .or(`titulo.ilike.%${t}%,corpo_md.ilike.%${t}%,resumo.ilike.%${t}%`)
      .order("created_at", { ascending: false })
      .limit(10);
    return { texto: JSON.stringify(data ?? []) };
  }
  if (nome === "salvar_nota") {
    const { error } = await supabase.from("notas").insert({
      user_id: userId,
      titulo: input.titulo,
      area: input.area ?? null,
      tags: input.tags ?? null,
      corpo_md: input.corpo_md,
      resumo: String(input.corpo_md ?? "").slice(0, 160),
      lembrete_em: input.lembrete_em ?? null,
    });
    return { texto: error ? `erro: ${error.message}` : "nota salva" };
  }
  if (nome === "propor_acao") {
    if (!TIPOS.includes(input?.tipo)) return { texto: "erro: tipo inválido" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("acoes")
      .insert({ user_id: userId, tipo: input.tipo, resumo: input.resumo, parametros: input.parametros ?? {} })
      .select("id")
      .single();
    if (error) return { texto: `erro: ${error.message}` };
    return { texto: `ação criada (id ${data.id}), aguardando aprovação`, acaoId: data.id };
  }
  return { texto: "ferramenta desconhecida" };
}

export const conversarComMunim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { conteudo: string }) => {
    const c = String(i?.conteudo ?? "").trim();
    if (!c || c.length > 8000) throw new Error("Mensagem inválida");
    return { conteudo: c };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const [{ data: perfil }, { data: mem }, { data: hist }] = await Promise.all([
      supabase.from("profiles").select("nome, papel").eq("id", userId).maybeSingle(),
      supabase.from("memoria").select("conteudo_md").eq("user_id", userId).maybeSingle(),
      supabase.from("mensagens").select("autor, conteudo").neq("autor", "sistema").order("created_at", { ascending: false }).limit(20),
    ]);

    const msgs: any[] = [];
    for (const m of (hist ?? []).reverse()) {
      const role = m.autor === "munim" ? "assistant" : "user";
      const ult = msgs[msgs.length - 1];
      if (ult && ult.role === role) ult.content += "\n\n" + m.conteudo;
      else msgs.push({ role, content: m.conteudo });
    }
    while (msgs[0]?.role === "assistant") msgs.shift();
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") msgs.push({ role: "user", content: data.conteudo });

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({
      baseURL: "https://ai.gateway.lovable.dev",
      apiKey,
      maxRetries: 0,
      defaultHeaders: { "X-Lovable-AIG-SDK": "anthropic-sdk" },
    });

    const agora = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "full", timeStyle: "short" });
    const system = promptSistema({ nome: perfil?.nome ?? null, papel: perfil?.papel ?? "cs" }, mem?.conteudo_md ?? "", agora);
    let entrada = 0, saida = 0, resposta = "";
    let acaoId: string | undefined;

    try {
      for (let i = 0; i < 6; i++) {
        const stream = client.messages.stream({ model: MODELO, max_tokens: 4000, system, tools: FERRAMENTAS as any, messages: msgs });
        const final = await stream.finalMessage();
        entrada += final.usage.input_tokens;
        saida += final.usage.output_tokens;
        msgs.push({ role: "assistant", content: final.content });
        if (final.stop_reason === "refusal") {
          resposta = "Prefiro não seguir com esse pedido.";
          break;
        }
        const usos = final.content.filter((b: any) => b.type === "tool_use") as any[];
        resposta = final.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim() || resposta;
        if (final.stop_reason !== "tool_use" || !usos.length) break;
        const resultados = [];
        for (const u of usos) {
          const r = await executarFerramenta(u.name, u.input, { supabase, userId });
          if (r.acaoId) acaoId = r.acaoId;
          resultados.push({ type: "tool_result", tool_use_id: u.id, content: r.texto });
        }
        msgs.push({ role: "user", content: resultados });
      }
    } catch (e: any) {
      const st = e?.status;
      console.error("cerebro erro", st, e?.message);
      resposta =
        st === 402 ? "Meus créditos de IA acabaram. Recarregue em Configurações do workspace e tento de novo."
        : st === 429 ? "Estou recebendo muitos pedidos agora. Tente de novo em instantes."
        : "Tive um problema para pensar agora. Tente de novo em instantes.";
    }

    if (!resposta) resposta = "Pronto.";
    await supabaseAdmin.from("mensagens").insert({
      user_id: userId, autor: "munim", canal: "app", conteudo: resposta, meta: acaoId ? { acao_id: acaoId } : {},
    });
    const custo = (entrada * 3 + saida * 15) / 1_000_000;
    await supabaseAdmin.from("uso").insert({ user_id: userId, funcao: "chat", modelo: MODELO, tokens_entrada: entrada, tokens_saida: saida, custo_usd: custo });
    return { ok: true };
  });

async function pipedrive(path: string, body: unknown) {
  const lk = process.env["LOVABLE_API_KEY"];
  const pk = process.env["PIPEDRIVE_API_KEY"];
  if (!lk || !pk) throw new Error("Pipedrive ainda não está conectado ao Munim.");
  const r = await fetch(`${PIPEDRIVE_GW}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": pk, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Pipedrive [${r.status}]: ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

export const decidirAcao = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { acao_id: string; decisao: "aprovada" | "recusada" }) => {
    if (!i?.acao_id || !["aprovada", "recusada"].includes(i.decisao)) throw new Error("Pedido inválido");
    return i;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: acao, error } = await supabase
      .from("acoes")
      .update({ status: data.decisao, decidido_em: new Date().toISOString() })
      .eq("id", data.acao_id)
      .eq("status", "pendente")
      .select("*")
      .single();
    if (error || !acao) throw new Error("Essa ação já foi decidida ou não existe.");
    if (data.decisao === "recusada") return { status: "recusada" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const p = (acao.parametros ?? {}) as Record<string, any>;
    let status: "executada" | "erro" = "executada";
    let resultado: any = {};
    try {
      if (acao.tipo === "atividade_pipedrive") {
        const r = await pipedrive("/activities", { deal_id: Number(p["deal_id"]), subject: p["assunto"], due_date: p["data"], type: p["tipo"] ?? "task" });
        resultado = { id: r?.data?.id };
      } else if (acao.tipo === "nota_pipedrive") {
        const r = await pipedrive("/notes", { deal_id: Number(p["deal_id"]), content: p["conteudo"] });
        resultado = { id: r?.data?.id };
      } else {
        throw new Error("Conecte sua conta Google em Configurações para eu criar rascunhos e eventos.");
      }
    } catch (e: any) {
      status = "erro";
      resultado = { erro: e?.message ?? "falha" };
    }
    await supabaseAdmin.from("acoes").update({ status, resultado }).eq("id", acao.id);
    return { status, resultado };
  });
