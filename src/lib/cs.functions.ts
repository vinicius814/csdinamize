import { createServerFn } from "@tanstack/react-start";
import { requireActive, requireAdmin } from "./access.middleware";
import { comCredenciais } from "./credenciais.middleware";
import { csPodeVer, csMetricas, csDia, csClientesUpgrade, csEhRetorno, type CSRow } from "./cs-rules";
import { z } from "zod";

/** Value-change tracking (expansion/upgrade) started with the first sync on this date. */
export const CS_VALOR_DESDE = "2026-10-24";
type Db = any;
const num=(v:unknown)=>v===null||v===undefined?null:Number(v);
function normalize(r:any):CSRow{return {...r,valor:num(r.valor),risco_fatores:r.risco_fatores??[]};}
async function readRows(db:Db,apply:(q:any)=>any=q=>q):Promise<CSRow[]>{
 const rows:CSRow[]=[];
 for(let start=0;;start+=1000){const {data,error}=await apply(db.from("cs_snapshot_risco").select("*")).order("deal_id").range(start,start+999);if(error)throw new Error(error.message);rows.push(...(data??[]).map(normalize));if((data?.length??0)<1000)break;}
 return rows;
}
const filterSchema=z.object({pipeline:z.enum(["15","16","both"]),owner:z.number().int().positive().nullable(),stage:z.number().int().positive().nullable(),days:z.union([z.literal(30),z.literal(60),z.literal(90)]),search:z.string().max(200),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),mine:z.boolean(),risco:z.enum(["","vermelho","amarelo","verde","sem_dados"]).default("")});
export const metricsCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(input=>filterSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase;const {data:p,error}=await db.from("profiles").select("pipedrive_user_id").eq("id",context.userId).single();if(error)throw new Error(error.message);
 const all=await readRows(db,q=>{q=q.in("pipeline_id",data.pipeline==="both"?[15,16]:[Number(data.pipeline)]);if(data.mine&&p.pipedrive_user_id)q=q.eq("owner_id",p.pipedrive_user_id);if(data.owner)q=q.eq("owner_id",data.owner);if(data.stage)q=q.eq("stage_id",data.stage);return q;});
 const rows=all.filter(r=>(!data.search||`${r.titulo} ${r.org_nome??""} ${r.owner_nome??""}`.toLowerCase().includes(data.search.toLowerCase()))&&(!data.risco||r.risco_cor===data.risco||!["open"].includes(r.status)||[105,111].includes(r.stage_id)));
 return [15,16].map(pipeline=>({pipeline,metrics:csMetricas(rows.filter(r=>r.pipeline_id===pipeline),data.days,data.from,data.to,csDia())}));
});

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

const histSchema=z.object({pipeline:z.enum(["15","16","both"]),owner:z.number().int().positive().nullable(),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),mine:z.boolean()});
export const historyCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>histSchema.parse(i)).handler(async({data,context})=>{
 const db=context.supabase;const {data:p,error:pe}=await db.from("profiles").select("pipedrive_user_id").eq("id",context.userId).single();if(pe)throw new Error(pe.message);
 const pipes=data.pipeline==="both"?[15,16]:[Number(data.pipeline)];
 const owner=data.owner??(data.mine?p.pipedrive_user_id:null);
 const {data:first,error:fe}=await db.from("cs_metricas_diarias").select("dia").order("dia").limit(1).maybeSingle();if(fe)throw new Error(fe.message);
 let q=db.from("cs_metricas_diarias").select("pipeline_id,clientes_ativos,mrr").eq("dia",data.from).in("pipeline_id",pipes);if(owner)q=q.eq("owner_id",owner);
 const {data:base,error:be}=await q;if(be)throw new Error(be.message);
 let e=db.from("cs_eventos_valor").select("deal_id,pipeline_id,valor_anterior,valor_novo,dia").gte("dia",data.from).lte("dia",data.to).in("pipeline_id",pipes);if(owner)e=e.eq("owner_id",owner);
 const {data:ev,error:ee}=await e;if(ee)throw new Error(ee.message);
 // Logo churn by organization within the portfolio; owner breakdown uses the base owner (deal with highest MRR).
 const baseKeys:{pipeline_id:number;cliente:string}[]=[];for(let s=0;;s+=1000){let bq=db.from("cs_base_diaria").select("pipeline_id,cliente").eq("dia",data.from).in("pipeline_id",pipes);if(owner)bq=bq.eq("owner_id",owner);const {data:bd,error:bde}=await bq.range(s,s+999);if(bde)throw new Error(bde.message);baseKeys.push(...(bd??[]));if((bd?.length??0)<1000)break;}
 const {data:canc,error:ce}=await db.from("cs_snapshot").select("deal_id,org_id,pipeline_id,stage_change_time").in("stage_id",[105,111]).in("pipeline_id",pipes).gte("stage_change_time",data.from+"T03:00:00Z").lte("stage_change_time",new Date(Date.parse(data.to+"T03:00:00Z")+86400000).toISOString());if(ce)throw new Error(ce.message);
 const upgradeActivities:{deal_id:number;tipo:string;concluida:boolean;data_conclusao:string|null}[]=[];
 for(let start=0;;start+=1000){let aq=db.from("cs_atividades_cache").select("deal_id,tipo,concluida,data_conclusao").eq("tipo","upgrade").eq("concluida",true).gte("data_conclusao",data.from).lte("data_conclusao",data.to).in("pipeline_id",pipes);if(owner)aq=aq.eq("owner_id",owner);const {data:ad,error:ae}=await aq.order("activity_id").range(start,start+999);if(ae)throw new Error(ae.message);upgradeActivities.push(...(ad??[]));if((ad?.length??0)<1000)break;}
 const upgradeDeals=await readRows(db,q=>{q=q.in("pipeline_id",pipes);if(owner)q=q.eq("owner_id",owner);return q;});
 return pipes.map(pipeline=>{
  const b=(base??[]).filter(r=>r.pipeline_id===pipeline);const temBase=b.length>0;
  const evs=(ev??[]).filter(r=>r.pipeline_id===pipeline);const up=evs.filter(r=>Number(r.valor_novo)>Number(r.valor_anterior));
  const valorDisponivel=data.from>=CS_VALOR_DESDE;
  const baseSet=new Set(baseKeys.filter(k=>k.pipeline_id===pipeline).map(k=>k.cliente));const churned=new Set((canc??[]).filter(c=>c.pipeline_id===pipeline).map(c=>c.org_id===null?"deal:"+c.deal_id:"org:"+c.org_id).filter(k=>baseSet.has(k)));
  return {pipeline,historicoDesde:first?.dia??null,valorDesde:CS_VALOR_DESDE,
   mrrInicial:temBase&&b.every(r=>r.mrr!==null)?b.reduce((s,r)=>s+Number(r.mrr),0):null,clientesIniciais:temBase?b.reduce((s,r)=>s+r.clientes_ativos,0):null,
   expansao:up.length?up.reduce((s,r)=>s+Number(r.valor_novo)-Number(r.valor_anterior),0):(valorDisponivel?0:null),expansaoEventos:up.length,upgrades:csClientesUpgrade(upgradeDeals.filter(r=>r.pipeline_id===pipeline),upgradeActivities,data.from,data.to),baseInicial:baseSet.size||null,logoChurn:baseSet.size?churned.size/baseSet.size*100:null,logoCancelados:baseSet.size?churned.size:null};
 });
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
 for(let i=0;i<ids.length;i+=200){const {data,error}=await db.from("cs_snapshot").select("deal_id,titulo,org_nome,owner_nome,valor").in("deal_id",ids.slice(i,i+200));if(error)throw new Error(error.message);for(const d of data??[])deals.set(Number(d.deal_id),d);}
 return filtradas.filter(a=>deals.has(Number(a["deal_id"]))).map(a=>{const d=deals.get(Number(a["deal_id"]))!;return {activity_id:Number(a["activity_id"]),deal_id:Number(a["deal_id"]),pipeline_id:Number(a["pipeline_id"]),tipo:String(a["tipo"]),assunto:String(a["assunto"]),dia:a["dia"] as string|null,inicio:a["inicio"] as string|null,cliente:(d["org_nome"] as string|null)??(d["titulo"] as string),owner_nome:d["owner_nome"] as string|null,valor:d["valor"]===null||d["valor"]===undefined?null:Number(d["valor"])};});
});

const evoSchema=z.object({pipeline:z.enum(["15","16","both"]),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
/** Série histórica real de cs_metricas_diarias (preenchida a cada sincronização), agregada por dia e carteira. */
export const evolucaoCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>evoSchema.parse(i)).handler(async({data,context})=>{
 const db=context.supabase;const pipes=data.pipeline==="both"?[15,16]:[Number(data.pipeline)];
 const {data:first,error:fe}=await db.from("cs_metricas_diarias").select("dia").order("dia").limit(1).maybeSingle();if(fe)throw new Error(fe.message);
 const rows:Record<string,unknown>[]=[];
 for(let s=0;;s+=1000){const {data:r,error}=await db.from("cs_metricas_diarias").select("dia,pipeline_id,clientes_ativos,mrr,cobertura_60").gte("dia",data.from).lte("dia",data.to).in("pipeline_id",pipes).order("dia").range(s,s+999);if(error)throw new Error(error.message);rows.push(...(r??[]));if((r?.length??0)<1000)break;}
 const porDia=new Map<string,{clientes:number;mrr:number|null;cobPeso:number;cobBase:number}>();
 for(const r of rows){const k=String(r["dia"]);const g=porDia.get(k)??{clientes:0,mrr:0,cobPeso:0,cobBase:0};const c=Number(r["clientes_ativos"]);g.clientes+=c;
  if(r["mrr"]===null||r["mrr"]===undefined)g.mrr=null;else if(g.mrr!==null)g.mrr+=Number(r["mrr"]);
  if(r["cobertura_60"]!==null&&r["cobertura_60"]!==undefined&&c>0){g.cobPeso+=Number(r["cobertura_60"])*c;g.cobBase+=c;}
  porDia.set(k,g);}
 return {desde:(first?.dia as string|undefined)??null,serie:[...porDia.entries()].sort((a,b)=>a[0].localeCompare(b[0])).map(([dia,g])=>({dia,clientes:g.clientes,mrr:g.mrr,cobertura:g.cobBase?g.cobPeso/g.cobBase:null}))};
});

const histSchemaV2=z.object({pipeline:z.enum(["15","16","both"]),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
/** Historical cancellations and confirmed upgrades in the viewer's RLS scope. Rates only when a recorded base exists at period start. */
export const historicoCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>histSchemaV2.parse(i)).handler(async({data,context})=>{
 const db=context.supabase;const pipes=data.pipeline==="both"?[15,16]:[Number(data.pipeline)];
 const {csPeriodoAnterior}=await import("./cs-historico");const ant=csPeriodoAnterior(data.from,data.to);
 const all=async(t:string,cols:string,f:(q:any)=>any)=>{const out:any[]=[];for(let s=0;;s+=1000){const {data:r,error}=await f(db.from(t).select(cols)).range(s,s+999);if(error)throw new Error(error.message);out.push(...(r??[]));if((r?.length??0)<1000)break;}return out;};
 const canc=(await all("cs_cancelamentos","deal_id,org_id,pipeline_id,owner_id,stage_id,dia,valor,moeda,motivo,revertido",q=>q.in("pipeline_id",pipes).gte("dia",ant.from).lte("dia",data.to).order("deal_id"))).map(c=>({...c,deal_id:Number(c.deal_id),org_id:c.org_id===null?null:Number(c.org_id),valor:num(c.valor)}));
 const ev=(await all("cs_eventos_valor","deal_id,pipeline_id,owner_id,dia,valor_anterior,valor_novo",q=>q.in("pipeline_id",pipes).gte("dia",ant.from).lte("dia",data.to).order("deal_id"))).map(e=>({...e,deal_id:Number(e.deal_id),valor_anterior:Number(e.valor_anterior),valor_novo:Number(e.valor_novo)}));
 const ups=(await all("cs_atividades_cache","deal_id,tipo,concluida,data_conclusao,pipeline_id",q=>q.eq("tipo","upgrade").eq("concluida",true).in("pipeline_id",pipes).gte("data_conclusao",ant.from).lte("data_conclusao",data.to).order("activity_id"))).map(a=>({...a,deal_id:Number(a.deal_id)}));
 const {data:cr}=await db.from("cs_cancelamentos").select("dia").order("dia").limit(1).maybeSingle();
 const {data:lastExec}=await db.from("cs_cancelamentos").select("consultado_em").order("consultado_em",{ascending:false}).limit(1).maybeSingle();
 const {data:ve}=await db.from("cs_eventos_valor").select("dia").order("dia").limit(1).maybeSingle();
 const {count:base}=await db.from("cs_base_diaria").select("cliente",{count:"exact",head:true}).eq("dia",data.from).in("pipeline_id",pipes);
 const {data:mrrIni}=await db.from("cs_metricas_diarias").select("mrr,owner_id").eq("dia",data.from).in("pipeline_id",pipes);
 const mrrBase=(mrrIni??[]).length?(mrrIni??[]).reduce((s:number,x:any)=>s+Number(x.mrr??0),0):null;
 return {cancelamentos:canc,eventosValor:ev,atividadesUpgrade:ups,anterior:ant,
  cancelDesde:(cr?.dia as string|undefined)??null,cancelAte:lastExec?.consultado_em?String(lastExec.consultado_em).slice(0,10):null,
  valorDesde:(ve?.dia as string|undefined)??null,baseInicio:base&&base>0?base:null,mrrInicio:mrrBase};
});
/** Admin-only, explicit trigger: recovers 12 months of effective cancellations with the corporate integration (≈15 GET calls). */
export const recuperarHistoricoCS=createServerFn({method:"POST"}).middleware([requireAdmin]).handler(async({context})=>{
 const {runCSHistorico}=await import("./cs-historico.server");return runCSHistorico(context.userId,12);
});
