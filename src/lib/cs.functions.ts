import { createServerFn } from "@tanstack/react-start";
import { requireActive } from "./access.middleware";
import { csPodeVer, csMetricas, csDia, type CSRow } from "./cs-rules";
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
 return pipes.map(pipeline=>{
  const b=(base??[]).filter(r=>r.pipeline_id===pipeline);const temBase=b.length>0;
  const evs=(ev??[]).filter(r=>r.pipeline_id===pipeline);const up=evs.filter(r=>Number(r.valor_novo)>Number(r.valor_anterior));
  const valorDisponivel=data.from>=CS_VALOR_DESDE;
  return {pipeline,historicoDesde:first?.dia??null,valorDesde:CS_VALOR_DESDE,
   mrrInicial:temBase&&b.every(r=>r.mrr!==null)?b.reduce((s,r)=>s+Number(r.mrr),0):null,clientesIniciais:temBase?b.reduce((s,r)=>s+r.clientes_ativos,0):null,
   expansao:valorDisponivel?up.reduce((s,r)=>s+Number(r.valor_novo)-Number(r.valor_anterior),0):null,upgrades:valorDisponivel?new Set(up.map(r=>r.deal_id)).size:null};
 });
});

const regrasSchema=z.object({dias_atencao:z.number().int().min(1).max(365),dias_risco:z.number().int().min(1).max(365),vencidas_atencao:z.number().int().min(1).max(100),vencidas_risco:z.number().int().min(1).max(100),considerar_sem_uso_como_risco:z.boolean(),retorno_pendente_dias:z.number().int().min(0).max(60)}).refine(r=>r.dias_risco>r.dias_atencao,"Dias para risco deve ser maior que dias para atenção.").refine(r=>r.vencidas_risco>=r.vencidas_atencao,"Vencidas para risco deve ser igual ou maior que para atenção.");
export const readRegrasCS=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const {data,error}=await context.supabase.from("cs_regras_risco").select("dias_atencao,dias_risco,vencidas_atencao,vencidas_risco,considerar_sem_uso_como_risco,retorno_pendente_dias,atualizado_em").maybeSingle();if(error)throw new Error(error.message);
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
 return {row:normalize(row),detalhe,erro};
});
