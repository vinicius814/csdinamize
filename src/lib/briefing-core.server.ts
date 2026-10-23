import { recordAuxiliary } from "./auxiliary-record";

const GW = "https://connector-gateway.lovable.dev";
const MODELO = "anthropic/claude-sonnet-5";
const FUSO = "America/Sao_Paulo";

async function google(conector: "google_calendar" | "google_mail", envKey: string, path: string) {
  const I=await import("./integracoes.server");
  return I.gw(conector,path);
}

async function localDayRange(timezone:string,offsetDays=0){
 const date=new Date(Date.now()+offsetDays*86400000).toLocaleDateString("en-CA",{timeZone:timezone});
 // Resolve local midnight to UTC, including non-Brazilian offsets and DST.
 const utc=(day:string)=>{let instant=Date.parse(`${day}T00:00:00Z`);for(let i=0;i<3;i++){const p=new Intl.DateTimeFormat("en-CA",{timeZone:timezone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(instant));const v=(type:string)=>p.find(x=>x.type===type)?.value;const displayed=Date.parse(`${v("year")}-${v("month")}-${v("day")}T${v("hour")}:${v("minute")}:${v("second")}Z`);instant+=Date.parse(`${day}T00:00:00Z`)-displayed;}return new Date(instant).toISOString();};
 const next=new Date(Date.parse(`${date}T12:00:00Z`)+86400000).toISOString().slice(0,10);return {ini:utc(date),fim:utc(next)};
}
async function agendaHoje(timezone:string){const I=await import("./integracoes.server");const {ini,fim}=await localDayRange(timezone);return I.eventos(ini,fim);}

async function emailsImportantes(){const I=await import("./integracoes.server");return I.buscarEmails("is:unread in:inbox newer_than:2d -category:promotions -category:social",8);}

export type TipoRotina = "manha" | "riscos" | "fechamento" | "semana";
// Mapeia cada rotina para o tipo já existente na tabela de briefings.
export const TIPO_BANCO = { manha: "manha", riscos: "alerta", fechamento: "rodada", semana: "leitura_cs" } as const;

const INSTRUCOES: Record<TipoRotina, string> = {
  manha: `Briefing da manhã, no máximo 200 palavras. Estrutura: uma frase de abertura; "**Seu dia**" (compromissos com horário); "**Pede atenção**" (e-mails, aprovações e clientes em risco que importam); "**Foco sugerido**" (as 3 prioridades do dia, cada uma com o porquê); "**Pergunta do dia**" (uma pergunta curta que ajude a decidir algo importante).`,
  riscos: `Radar de riscos, no máximo 220 palavras. Liste os riscos mais relevantes agora, cada um com nível (🔴 alto, 🟡 médio, 🟢 baixo), o porquê com dados concretos (cliente, valor, dias, e-mail) e uma ação de mitigação. Termine com "**Se fizer só uma coisa hoje**".`,
  fechamento: `Fechamento do dia, no máximo 200 palavras. Estrutura: "**Como foi**" (o que aconteceu na agenda e o que foi decidido/aprovado); "**Ficou pendente**"; "**Amanhã**" (agenda de amanhã e as 2 primeiras coisas a atacar); uma frase final calma.`,
  semana: `Revisão estratégica da semana, no máximo 300 palavras. Estrutura: "**Saúde da carteira**" (números e tendência); "**Riscos da semana**"; "**Ideias e projetos**" (aponte as 1 a 3 grandes ideias com maior potencial e por que priorizar agora, e o que deve ser descartado ou pausado); "**Direcionamento**" (sua recomendação estratégica para a próxima semana); "**Perguntas para você**" (2 perguntas que melhorariam seu contexto).`,
};

export async function gerarRotinaCore(data:{tipo:TipoRotina}, context:{supabase:any;userId:string}) {
    const { supabase, userId } = context;
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Cérebro sem chave configurada.");
    const I = await import("./integracoes.server");
    const C=await import("./credenciais.server");const hasPipedrive=!!(await C.pipedriveAtual());
    const tipo = data.tipo;
    const {checkBudget}=await import("./budget.server");await checkBudget(userId);

    const { data: perfil } = await supabase.from("profiles").select("nome, pipedrive_user_id, fuso").eq("id", userId).maybeSingle();
    const timezone=perfil?.fuso ?? FUSO;
    const tomorrow=await localDayRange(timezone,1);
    const pdId = perfil?.pipedrive_user_id ? Number(perfil.pipedrive_user_id) : null;
    const desde = new Date(Date.now() - (tipo === "semana" ? 7 : 1) * 86400000).toISOString();

    const [agenda, emails, pend, notas, riscos, ideias, decididas, agAmanha, memoria] = await Promise.all([
      tipo !== "semana" ? agendaHoje(timezone).catch((e) => ({erro:e.message,acao:"/conexoes"})) : null,
      tipo === "manha" ? emailsImportantes().catch((e) => ({erro:e.message,acao:"/conexoes"})) : null,
      supabase.from("acoes").select("resumo").eq("user_id",userId).eq("status", "pendente").limit(10),
      supabase.from("notas").select("titulo, lembrete_em").eq("user_id",userId).not("lembrete_em", "is", null).gte("lembrete_em", new Date().toISOString()).order("lembrete_em").limit(5),
      hasPipedrive && tipo !== "fechamento" ? I.sinaisDeRisco(pdId).catch((e) => ({erro:e.message,acao:"/conexoes"})) : null,
      tipo === "semana" || tipo === "manha"
        ? supabase.from("notas").select("titulo, subcategoria, tags, resumo").eq("user_id",userId).in("subcategoria", ["ideia", "projeto"]).order("created_at", { ascending: false }).limit(30)
        : null,
      tipo !== "manha" ? supabase.from("acoes").select("resumo, status").eq("user_id",userId).neq("status", "pendente").gte("decidido_em", desde).limit(20) : null,
      tipo === "fechamento" ? I.eventos(tomorrow.ini,tomorrow.fim).catch(e => ({erro:e.message,acao:"/conexoes"})) : null,
      tipo === "semana" ? I.memoriaDrive().then((m) => m.slice(0, 4000)).catch(() => "") : "",
    ]);

    const contexto = JSON.stringify({
      agora: new Date().toLocaleString("pt-BR", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }),
      agenda_hoje: agenda ?? undefined,
      agenda_amanha: agAmanha ?? undefined,
      emails_nao_lidos: emails ?? undefined,
      aprovacoes_pendentes: pend.error?{erro:pend.error.message}:pend.data?.map((a: {resumo:string|null}) => a.resumo) ?? [],
      acoes_decididas_no_periodo: decididas?.data ?? undefined,
      proximos_lembretes: notas.error?{erro:notas.error.message}:notas.data ?? [],
      sinais_de_risco: riscos ?? undefined,
      ideias_e_projetos: ideias?.error?{erro:ideias.error.message}:ideias?.data ?? undefined,
      memoria: memoria || undefined,
    }).slice(0, 40000);

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ baseURL: "https://ai.gateway.lovable.dev", apiKey, maxRetries: 0, defaultHeaders: { "X-Lovable-AIG-SDK": "anthropic-sdk" } });

    let md = "";
    let entrada=0,saida=0;
    try {
      const r = await client.messages
        .stream({
          model: MODELO,
          max_tokens: 1800,
          system: `Você é o Munim, conselheiro executivo pessoal de ${perfil?.nome ?? "seu usuário"}, inspirado no J.A.R.V.I.S.: confiante, calmo, preciso, próximo. Português do Brasil, Markdown leve. Seja direto, recomende, não apenas descreva. Não invente nada fora dos dados; se uma fonte estiver indisponível, diga claramente qual falhou e ofereça [Conectar](/conexoes). Nunca conclua tudo em dia a partir de erro ou lista vazia. Use apenas números exatos retornados. Não use saudação Bom dia/Boa tarde/Boa noite: o texto pode ser exibido em outro horário.\n\n${INSTRUCOES[tipo]}${hasPipedrive?"":"\nCS não está ativo: omita carteira, clientes, cobertura e pipeline; substitua essas seções por compromissos, ideias e prioridades pessoais."}`,
          messages: [{ role: "user", content: `Dados:\n${contexto}` }],
        })
        .finalMessage();
      entrada=r.usage.input_tokens;saida=r.usage.output_tokens;
      md = r.content.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n").trim();
    } catch (e: any) {
      console.error("rotina erro", tipo, e?.status, e?.message);
      throw new Error(e?.status === 402 ? "Os créditos de IA acabaram." : e?.status === 429 ? "Muitos pedidos agora. Tente em instantes." : "Não consegui montar agora.");
    }
    if (!md) throw new Error("Não consegui montar agora.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("briefings").insert({ user_id: userId, tipo: TIPO_BANCO[tipo], conteudo_md: md });
    if (error) throw new Error("Não consegui salvar.");
    await recordAuxiliary(() => supabaseAdmin.from("uso").insert({user_id:userId,funcao:`rotina_${tipo}`,modelo:MODELO,tokens_entrada:entrada,tokens_saida:saida,custo_usd:(entrada*3+saida*15)/1000000}), "routine_usage");
    return { ok: true, md };
}
