import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MODELO = "anthropic/claude-sonnet-5";
const PIPEDRIVE_GW = "https://connector-gateway.lovable.dev/pipedrive";

const TIPOS = ["atividade_pipedrive", "nota_pipedrive", "rascunho_gmail", "evento_agenda"] as const;

const FERRAMENTAS = [
  {
    name: "carteira",
    description:
      "Consulta AO VIVO no Pipedrive a carteira de Customer Success do usuário (funil CS, negócios abertos dele). Traz dias sem contato pelo campo 'Data do último contato efetivo', próxima atividade e pendências.",
    input_schema: {
      type: "object",
      properties: {
        sem_contato_dias: { type: "number", description: "Só clientes sem contato efetivo há mais de N dias (ou sem data)" },
        ordenar: { type: "string", enum: ["mais_tempo_sem_contato", "mais_pendencias", "maior_valor"] },
      },
    },
  },
  {
    name: "buscar_cliente",
    description: "Busca um cliente/negócio no Pipedrive pelo nome e traz notas e atividades recentes.",
    input_schema: { type: "object", properties: { nome: { type: "string" } }, required: ["nome"] },
  },
  {
    name: "buscar_emails",
    description:
      "Pesquisa no Gmail do usuário com a sintaxe de busca do Gmail (ex.: 'from:dufrio newer_than:7d', 'is:unread in:inbox', 'subject:proposta'). Retorna remetente, assunto, data e trecho.",
    input_schema: { type: "object", properties: { consulta: { type: "string" }, max: { type: "number" } }, required: ["consulta"] },
  },
  {
    name: "ler_email",
    description: "Lê o conteúdo completo de um e-mail pelo id retornado em buscar_emails.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
  {
    name: "agenda",
    description: "Lista os compromissos do Google Agenda entre duas datas/horas ISO 8601 (fuso -03:00). Use para checar o dia, a semana ou horários livres.",
    input_schema: { type: "object", properties: { inicio: { type: "string" }, fim: { type: "string" } }, required: ["inicio", "fim"] },
  },
  {
    name: "buscar_notas",
    description: "Procura no Segundo Cérebro (arquivos .md da pasta '01 Notas' no Google Drive) por texto e devolve as notas encontradas com conteúdo.",
    input_schema: { type: "object", properties: { texto: { type: "string" } }, required: ["texto"] },
  },
  {
    name: "salvar_nota",
    description: "Salva uma nota, ideia, tarefa ou lembrete no Segundo Cérebro (novo arquivo .md em '01 Notas' no Drive). Use quando o usuário ditar algo para guardar.",
    input_schema: {
      type: "object",
      properties: {
        titulo: { type: "string" },
        area: { type: "string", description: "Ex.: dinamize, wojtec, crm-content, pessoal, ideias" },
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
      "Prepara uma ação para o usuário aprovar com 1 toque. Nada é executado sem aprovação. Tipos: atividade_pipedrive (parametros: deal_id, assunto, data YYYY-MM-DD, tipo), nota_pipedrive (deal_id, conteudo), rascunho_gmail (para, assunto, corpo), evento_agenda (titulo, inicio ISO, fim ISO, convidados: string[]).",
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

function promptSistema(p: { nome: string | null }, memoria: string, agora: string) {
  return `Você é o Munim, o J.A.R.V.I.S. pessoal de ${p.nome ?? "seu usuário"}. Produto da Wojtec. Assistente executivo 1 a 1, nunca de equipe.
Personalidade: confiante, calmo, preciso, levemente espirituoso, sempre a um passo à frente. Português do Brasil, respostas curtas em Markdown leve. Chame-o pelo nome de vez em quando.
Agora: ${agora} (America/Sao_Paulo).

Você tem acesso ao vivo a: Pipedrive (carteira e negócios), Gmail (ler e buscar), Google Agenda, e o Segundo Cérebro no Google Drive (notas .md).
Como agir:
- Antecipe. Ao responder, cruze fontes: um cliente citado → veja Pipedrive, e-mails recentes e notas. Aponte riscos, prazos e o que está esquecido.
- Proteja o tempo dele: priorize por impacto, diga o que pode esperar e o que pode ser delegado.
- Melhore ideias com sugestões concretas e próximos passos, não com elogios.
- Nunca invente dados: use as ferramentas. Se uma fonte falhar, diga com naturalidade e siga com o que tem.
- Nada é enviado, apagado ou alterado sem aprovação: para agir no Pipedrive, Gmail ou Agenda use propor_acao e diga que está aguardando o ok em Aprovações. E-mail vira rascunho, nunca envio direto.
- Quando ele ditar ideias, tarefas ou lembretes, salve com salvar_nota e diga onde guardou.
- Termine com um próximo passo útil quando fizer sentido.

Memória de longo prazo (Memória.md do Segundo Cérebro — trate como verdade):
${memoria || "(indisponível agora)"}`;
}

type Ctx = { supabase: any; userId: string; pipedriveUserId: number | null };

async function executarFerramenta(nome: string, input: any, ctx: Ctx): Promise<{ texto: string; acaoId?: string }> {
  const I = await import("./integracoes.server");
  const { supabase, userId } = ctx;
  try {
    if (nome === "carteira") {
      let lista = await I.carteiraPipedrive(ctx.pipedriveUserId);
      const d = Number(input?.sem_contato_dias);
      if (d) lista = lista.filter((c) => c.dias_sem_contato === null || c.dias_sem_contato > d);
      const ord = input?.ordenar ?? "mais_tempo_sem_contato";
      lista.sort((a, b) =>
        ord === "mais_pendencias" ? b.atividades_pendentes - a.atividades_pendentes
        : ord === "maior_valor" ? b.valor - a.valor
        : (b.dias_sem_contato ?? 9999) - (a.dias_sem_contato ?? 9999),
      );
      return { texto: JSON.stringify({ total: lista.length, clientes: lista.slice(0, 60) }) };
    }
    if (nome === "buscar_cliente") return { texto: JSON.stringify(await I.buscarDealPipedrive(String(input?.nome ?? ""))) };
    if (nome === "buscar_emails") return { texto: JSON.stringify(await I.buscarEmails(String(input?.consulta ?? "in:inbox"), Math.min(Number(input?.max) || 8, 15))) };
    if (nome === "ler_email") return { texto: JSON.stringify(await I.lerEmail(String(input?.id ?? ""))) };
    if (nome === "agenda") return { texto: JSON.stringify(await I.eventos(String(input.inicio), String(input.fim))) };
    if (nome === "buscar_notas") {
      const achadas = await I.listarNotasDrive(String(input?.texto ?? ""), 6);
      const com = await Promise.all(achadas.map(async (n) => ({ nome: n.nome, modificado: n.modificado, conteudo: (await I.lerArquivoDrive(n.id).catch(() => "")).slice(0, 2500) })));
      return { texto: JSON.stringify(com) };
    }
    if (nome === "salvar_nota") {
      let ondeDrive = "";
      try {
        const r = await I.salvarNotaDrive(input);
        ondeDrive = `Drive: Segundo Cérebro/01 Notas/${r.nome}`;
      } catch (e: any) {
        console.error("salvar drive", e?.message);
      }
      const { error } = await supabase.from("notas").insert({
        user_id: userId,
        titulo: input.titulo,
        area: input.area ?? null,
        tags: input.tags ?? null,
        corpo_md: input.corpo_md,
        resumo: String(input.corpo_md ?? "").slice(0, 160),
        lembrete_em: input.lembrete_em ?? null,
      });
      return { texto: ondeDrive ? `nota salva (${ondeDrive})` : error ? `erro: ${error.message}` : "nota salva no Munim (Drive indisponível agora)" };
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
  } catch (e: any) {
    return { texto: `erro ao consultar: ${e?.message ?? "falha"}` };
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
    const I = await import("./integracoes.server");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");

    const [{ data: perfil }, { data: mem }, { data: hist }, memDrive] = await Promise.all([
      supabase.from("profiles").select("nome, papel, pipedrive_user_id").eq("id", userId).maybeSingle(),
      supabase.from("memoria").select("conteudo_md").eq("user_id", userId).maybeSingle(),
      supabase.from("mensagens").select("autor, conteudo").neq("autor", "sistema").order("created_at", { ascending: false }).limit(20),
      I.memoriaDrive().catch((e: any) => (console.error("memoria drive", e?.message), "")),
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
    const memoria = [memDrive, mem?.conteudo_md].filter(Boolean).join("\n\n");
    const system = promptSistema({ nome: perfil?.nome ?? null }, memoria, agora);
    const ctx: Ctx = { supabase, userId, pipedriveUserId: perfil?.pipedrive_user_id ? Number(perfil.pipedrive_user_id) : null };
    let entrada = 0, saida = 0, resposta = "";
    let acaoId: string | undefined;

    try {
      for (let i = 0; i < 8; i++) {
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
        const resultados = await Promise.all(
          usos.map(async (u) => {
            const r = await executarFerramenta(u.name, u.input, ctx);
            if (r.acaoId) acaoId = r.acaoId;
            return { type: "tool_result", tool_use_id: u.id, content: r.texto.slice(0, 30000) };
          }),
        );
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
    const I = await import("./integracoes.server");
    const p = (acao.parametros ?? {}) as Record<string, any>;
    const { data: perf } = await supabase.from("profiles").select("pipedrive_user_id").eq("id", context.userId).maybeSingle();
    const dono = perf?.pipedrive_user_id ? Number(perf.pipedrive_user_id) : undefined;
    let status: "executada" | "erro" = "executada";
    let resultado: any = {};
    try {
      if (acao.tipo === "atividade_pipedrive") {
        const r = await pipedrive("/activities", { deal_id: Number(p["deal_id"]), subject: p["assunto"], ...(dono ? { user_id: dono } : {}), due_date: p["data"], type: p["tipo"] ?? "task" });
        resultado = { id: r?.data?.id };
      } else if (acao.tipo === "nota_pipedrive") {
        const r = await pipedrive("/notes", { deal_id: Number(p["deal_id"]), content: p["conteudo"] });
        resultado = { id: r?.data?.id };
      } else if (acao.tipo === "rascunho_gmail") {
        resultado = await I.criarRascunho(String(p["para"] ?? ""), String(p["assunto"] ?? ""), String(p["corpo"] ?? ""));
      } else if (acao.tipo === "evento_agenda") {
        const conv = Array.isArray(p["convidados"]) ? p["convidados"] : String(p["convidados"] ?? "").split(/[,;\s]+/);
        resultado = await I.criarEvento({ titulo: String(p["titulo"]), inicio: String(p["inicio"]), fim: String(p["fim"]), convidados: conv, descricao: p["descricao"] });
      }
    } catch (e: any) {
      status = "erro";
      resultado = { erro: e?.message ?? "falha" };
    }
    await supabaseAdmin.from("acoes").update({ status, resultado }).eq("id", acao.id);
    return { status, resultado };
  });
