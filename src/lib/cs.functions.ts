import { createServerFn } from "@tanstack/react-start";
import { requireActive, requireAdmin } from "./access.middleware";
import { comCredenciais } from "./credenciais.middleware";
import { csPodeVer, csDia, csEhRetorno, csNomeResponsavel, type CSRow } from "./cs-rules";
import { z } from "zod";

type Db = any;
const num=(v:unknown)=>v===null||v===undefined?null:Number(v);
function normalize(r:any):CSRow{return {...r,valor:num(r.valor),owner_nome:csNomeResponsavel(Number(r.owner_id),r.owner_nome),risco_fatores:r.risco_fatores??[]};}
async function readRows(db:Db,apply:(q:any)=>any=q=>q):Promise<CSRow[]>{
 // Paginação por chave (deal_id > último) em faixas paralelas: OFFSET reavaliava a view (RLS + risco) desde o início a cada página
 // e a leitura completa levava ~24s; por chave cada página custa o mesmo (~0,3s) e as faixas rodam juntas.
 const {data:topo,error:tErr}=await db.from("cs_snapshot").select("deal_id").order("deal_id",{ascending:false}).limit(1).maybeSingle();if(tErr)throw new Error(tErr.message);
 const max=Number(topo?.deal_id??0);if(!max)return [];
 const FAIXAS=6,passo=Math.ceil((max+1)/FAIXAS);
 const faixa=async(ini:number,fim:number)=>{const out:CSRow[]=[];let ultimo=ini-1;
  for(;;){const {data,error}=await apply(db.from("cs_snapshot_risco").select("*")).gt("deal_id",ultimo).lt("deal_id",fim).order("deal_id").limit(1000);if(error)throw new Error(error.message);
   const lote=data??[];out.push(...lote.map(normalize));if(lote.length<1000)break;ultimo=Number(lote[lote.length-1].deal_id);}
  return out;};
 const partes=await Promise.all(Array.from({length:FAIXAS},(_,i)=>faixa(i*passo,i===FAIXAS-1?max+1:(i+1)*passo)));
 return partes.flat();
}
export const readCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const db=context.supabase;
 const {data:perfil,error:pError}=await db.from("profiles").select("papel,pipedrive_user_id").eq("id",context.userId).single();if(pError)throw new Error(pError.message);
 const rows=(await readRows(db)).filter(r=>csPodeVer(context.role,perfil.papel,perfil.pipedrive_user_id,r.owner_id,r.pipeline_id));
 const {data:runs,error}=await db.from("cs_sync_runs").select("id,status,iniciado_em,concluido_em,negocios_lidos,erro,origem").order("iniciado_em",{ascending:false}).limit(20);if(error)throw new Error(error.message);
 const latest=runs?.[0]??null;const {data:success,error:sError}=await db.from("cs_sync_runs").select("concluido_em").eq("status","sucesso").order("concluido_em",{ascending:false}).limit(1).maybeSingle();if(sError)throw new Error(sError.message);
 const {data:manual,error:mError}=await db.from("cs_sync_runs").select("iniciado_em").eq("origem","manual").order("iniciado_em",{ascending:false}).limit(1).maybeSingle();if(mError)throw new Error(mError.message);
 return {rows,latest,lastManual:manual?.iniciado_em??null,lastSuccess:success?.concluido_em??null,perfil,role:context.role};
});
export const syncCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const {runCSSync}=await import("./cs-sync.server");return runCSSync("manual",context.userId);
});
/** Lazy sync: first authenticated CS visit after 08h/12h (São Paulo) claims that window once; failures are not retried in the same window. */
export const autoSyncCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async()=>{
 const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");const {csPrecisaAtualizar,csJanela}=await import("./cs-rules");
 const now=new Date();
 const {data,error}=await db.from("cs_sync_runs").select("iniciado_em").order("iniciado_em",{ascending:false}).limit(1).maybeSingle();if(error)throw new Error(error.message);
 if(!csPrecisaAtualizar(now,data?.iniciado_em??null))return {executado:false};
 const {runCSSync}=await import("./cs-sync.server");const r=await runCSSync("agendado",null,csJanela(now));return {executado:r.status==="sucesso"};
});

const regrasSchema=z.object({sem_proxima_atividade_e_atencao:z.boolean(),analista_aguardando_dias:z.number().int().min(1).max(90),prazo_onboarding_dias:z.number().int().min(1).max(365),prazo_por_etapa_dias:z.number().int().min(1).max(365),dias_atencao:z.number().int().min(1).max(365),dias_risco:z.number().int().min(1).max(365),vencidas_atencao:z.number().int().min(1).max(100),vencidas_risco:z.number().int().min(1).max(100),considerar_sem_uso_como_risco:z.boolean(),retorno_pendente_dias:z.number().int().min(0).max(60)}).refine(r=>r.dias_risco>r.dias_atencao,"Dias para risco deve ser maior que dias para atenção.").refine(r=>r.vencidas_risco>=r.vencidas_atencao,"Vencidas para risco deve ser igual ou maior que para atenção.");
export const readRegrasCS=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const {data,error}=await context.supabase.from("cs_regras_risco").select("dias_atencao,dias_risco,vencidas_atencao,vencidas_risco,considerar_sem_uso_como_risco,retorno_pendente_dias,sem_proxima_atividade_e_atencao,analista_aguardando_dias,prazo_onboarding_dias,prazo_por_etapa_dias,atualizado_em").maybeSingle();if(error)throw new Error(error.message);
 const {data:p,error:pe}=await context.supabase.from("profiles").select("papel").eq("id",context.userId).single();if(pe)throw new Error(pe.message);
 return {regras:data,podeEditar:["admin","superadmin"].includes(context.role)||["admin","gestor"].includes(p.papel)};
});
export const saveRegrasCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>regrasSchema.parse(i)).handler(async({data,context})=>{
 const {data:p,error:pe}=await context.supabase.from("profiles").select("papel").eq("id",context.userId).single();if(pe)throw new Error(pe.message);
 if(!(["admin","superadmin"].includes(context.role)||["admin","gestor"].includes(p.papel)))throw new Error("Apenas gestores e administradores alteram as regras de risco.");
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 const {error}=await supabaseAdmin.rpc("cs_atualizar_regras_por",{actor:context.userId,regras:data});if(error)throw new Error(error.message);return {ok:true};
});

export const cliente360=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>z.object({dealId:z.number().int().positive()}).parse(i)).handler(async({data,context})=>{
 // RLS (cs_pode_ver) decides visibility before any Pipedrive read.
 const {data:row,error}=await context.supabase.from("cs_snapshot_risco").select("*").eq("deal_id",data.dealId).maybeSingle();if(error)throw new Error(error.message);
 if(!row)return {row:null,detalhe:null};
 const {cliente360Detalhe}=await import("./cs-360.server");const {cachedIntegration}=await import("./integration-cache.server");
 let detalhe=null,erro:string|null=null;
 try{detalhe=await cachedIntegration(context.userId,`cs360:${data.dealId}`,()=>cliente360Detalhe(data.dealId),()=>true,10*60_000);}catch(e){erro=e instanceof Error?e.message:"Não consegui ler o Pipedrive agora.";}
 const {data:reunioes,error:re}=await context.supabase.from("cs_atividades_cache").select("activity_id,tipo,assunto,inicio,fim,dia,concluida").eq("deal_id",data.dealId).order("dia",{ascending:false});if(re)throw new Error(re.message);
 return {row:normalize(row),detalhe,erro,atividadesCache:reunioes??[]};
});

const periodoSchema=z.object({from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
/** Pipedrive activities from the central cache, scoped by cs_pode_ver RLS. */
export const agendaCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>periodoSchema.parse(i)).handler(async({data,context})=>{
 const out:any[]=[];for(let s=0;;s+=1000){const {data:a,error}=await context.supabase.from("cs_atividades_cache").select("activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,inicio,fim,dia,concluida").gte("dia",data.from).lte("dia",data.to).order("dia").order("inicio").range(s,s+999);if(error)throw new Error(error.message);out.push(...(a??[]));if((a?.length??0)<1000)break;}
 return out as {activity_id:number;deal_id:number;pipeline_id:number;owner_id:number;tipo:string;assunto:string;inicio:string|null;fim:string|null;dia:string|null;concluida:boolean}[];
});
/** The signed-in user's own Google Calendar (optional, read-only). Never another user's calendar. */
export const googleAgendaCS=createServerFn({method:"POST"}).middleware([comCredenciais]).inputValidator(i=>periodoSchema.parse(i)).handler(async({data,context})=>{
 const {eventos,SemConexao}=await import("./integracoes.server");const {csDominioCorporativo}=await import("./cs-rules");
 let evs:Awaited<ReturnType<typeof eventos>>;
 try{evs=await eventos(new Date(data.from+"T00:00:00-03:00").toISOString(),new Date(data.to+"T23:59:59-03:00").toISOString());}
 catch(e){if(e instanceof SemConexao)return {conectado:false as const,eventos:[]};return {conectado:true as const,erro:e instanceof Error?e.message:"Não consegui ler sua agenda.",eventos:[]};}
 // Domain -> clients visible to this user. Only an unambiguous single-client domain links an event.
 const dom=new Map<string,Set<number>>();
 for(let s=0;;s+=1000){const {data:r,error}=await context.supabase.from("cs_snapshot").select("deal_id,contato_dominios").eq("status","open").range(s,s+999);if(error)throw new Error(error.message);for(const x of r??[])for(const d of x.contato_dominios??[]){if(!dom.has(d))dom.set(d,new Set());dom.get(d)!.add(Number(x.deal_id));}if((r?.length??0)<1000)break;}
 return {conectado:true as const,eventos:evs.map(e=>{const ds=[...new Set((e.convidados as string[]).map((c:string)=>csDominioCorporativo(c)).filter((x:string|null):x is string=>!!x))];const deals=new Set(ds.flatMap(d=>[...(dom.get(d)??[])]));return {titulo:String(e.titulo),inicio:String(e.inicio??""),fim:String(e.fim??""),dia_todo:!!e.dia_todo,deal_id:deals.size===1?[...deals][0]!:null};})};
});

/** Retornos pendentes: atividades abertas do Pipedrive cujo assunto registra follow-up/retorno (csEhRetorno), no escopo visível do usuário via RLS. Somente leitura. */
export const retornosCS=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const db=context.supabase;const acts:Record<string,unknown>[]=[];
 for(let s=0;;s+=1000){const {data,error}=await db.from("cs_atividades_cache").select("activity_id,deal_id,pipeline_id,owner_id,tipo,assunto,dia,inicio").eq("concluida",false).or("assunto.ilike.%follow%,assunto.ilike.%flw%,assunto.ilike.%retorno%").order("activity_id").range(s,s+999);if(error)throw new Error(error.message);acts.push(...(data??[]));if((data?.length??0)<1000)break;}
 const filtradas=acts.filter(a=>csEhRetorno(String(a["assunto"]??"")));
 const ids=[...new Set(filtradas.map(a=>Number(a["deal_id"])))];
 const deals=new Map<number,Record<string,unknown>>();
 for(let i=0;i<ids.length;i+=200){const {data,error}=await db.from("cs_snapshot").select("deal_id,titulo,org_nome,owner_id,owner_nome,valor").in("deal_id",ids.slice(i,i+200));if(error)throw new Error(error.message);for(const d of data??[])deals.set(Number(d.deal_id),d);}
 return filtradas.filter(a=>deals.has(Number(a["deal_id"]))).map(a=>{const d=deals.get(Number(a["deal_id"]))!;return {activity_id:Number(a["activity_id"]),deal_id:Number(a["deal_id"]),pipeline_id:Number(a["pipeline_id"]),owner_id:Number(d["owner_id"]),tipo:String(a["tipo"]),assunto:String(a["assunto"]),dia:a["dia"] as string|null,inicio:a["inicio"] as string|null,cliente:(d["org_nome"] as string|null)??(d["titulo"] as string),owner_nome:csNomeResponsavel(Number(d["owner_id"]),d["owner_nome"] as string|null),valor:d["valor"]===null||d["valor"]===undefined?null:Number(d["valor"])};});
});

/** Admin-only, explicit trigger: recupera 36 meses de cancelamentos efetivos pela lista de perdidos (data de perda), sem changelog por negócio. */
export const recuperarHistoricoCS=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async({context})=>{
 const {runCSHistorico}=await import("./cs-historico.server");return runCSHistorico(context.userId,36);
});
/** Admin: atividades concluídas desde 01/01 do ano anterior, em lotes retomáveis (treinamentos e produtividade mensais). */
export const recuperarAtividadesCS=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async({context})=>{
 const {runAtividadesHistoricas}=await import("./cs-recuperacao.server");return runAtividadesHistoricas(context.userId,`${Number(csDia().slice(0,4))-1}-01-01`);
});
/** Admin: reconstrói a entrada real no Onboarding dos projetos abertos (changelog oficial), em lotes. */
export const reconstruirOnboardingCS=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async()=>{
 const {runEntradasOnboarding}=await import("./cs-recuperacao.server");return runEntradasOnboarding();
});

/** Entradas no Onboarding (escopo RLS). entrada_origem preenchida = data reconstruída do histórico oficial; vazia = estimativa (contratação/criação). */
type EntradaOnb={deal_id:number;entrou_em:string|null;entrada_origem:string|null};
export const onboardingEntradasCS=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context}):Promise<EntradaOnb[]>=>{
 const {data,error}=await (context.supabase as any).from("cs_eventos_onboarding").select("deal_id,entrou_em,entrada_origem").is("saiu_em",null);
 if(error)return [];
 return (data??[]).map((r:any)=>({deal_id:Number(r.deal_id),entrou_em:r.entrou_em as string|null,entrada_origem:r.entrada_origem as string|null}));
});

/** Admin: confirma pelo changelog a entrada em "Cancelados" e o CS responsável na data, em lotes retomáveis. */
export const confirmarCancelamentosCS=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async()=>{
 const {runConfirmarCancelamentos}=await import("./cs-historico.server");return runConfirmarCancelamentos();
});
