import { createServerFn } from "@tanstack/react-start";
import { requireActive } from "./access.middleware";
import { csPodeVer, csMetricas, csDia, type CSRow } from "./cs-rules";
import { z } from "zod";

const filterSchema=z.object({pipeline:z.enum(["15","16","both"]),owner:z.number().int().positive().nullable(),stage:z.number().int().positive().nullable(),days:z.union([z.literal(30),z.literal(60),z.literal(90)]),search:z.string().max(200),from:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),to:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),mine:z.boolean()});
export const metricsCS=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(input=>filterSchema.parse(input)).handler(async({data,context})=>{
 const db=context.supabase;const {data:p,error}=await db.from("profiles").select("pipedrive_user_id").eq("id",context.userId).single();if(error)throw new Error(error.message);
 const rows:CSRow[]=[];
 for(let start=0;;start+=1000){let query=db.from("cs_snapshot").select("*").in("pipeline_id",data.pipeline==="both"?[15,16]:[Number(data.pipeline)]).order("deal_id");if(data.mine&&p.pipedrive_user_id)query=query.eq("owner_id",p.pipedrive_user_id);if(data.owner)query=query.eq("owner_id",data.owner);if(data.stage)query=query.eq("stage_id",data.stage);const {data:found,error:e}=await query.range(start,start+999);if(e)throw new Error(e.message);rows.push(...(found??[]).filter(r=>!data.search||`${r.titulo} ${r.owner_nome??""}`.toLowerCase().includes(data.search.toLowerCase())));if((found?.length??0)<1000)break;}
 return [15,16].map(pipeline=>({pipeline,metrics:csMetricas(rows.filter(r=>r.pipeline_id===pipeline),data.days,data.from,data.to,csDia())}));
});

export const readCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const db=context.supabase;
 const {data:perfil,error:pError}=await db.from("profiles").select("papel,pipedrive_user_id").eq("id",context.userId).single();if(pError)throw new Error(pError.message);
 const rows:CSRow[]=[];
 for(let start=0;;start+=1000){const {data,error}=await db.from("cs_snapshot").select("*").order("deal_id").range(start,start+999);if(error)throw new Error(error.message);for(const r of data??[]) {if(!csPodeVer(context.role,perfil.papel,perfil.pipedrive_user_id,r.owner_id,r.pipeline_id))continue;rows.push({...r,valor:r.valor===null?null:Number(r.valor)});}if((data?.length??0)<1000)break;}
 const {data:runs,error}=await db.from("cs_sync_runs").select("id,status,iniciado_em,concluido_em,negocios_lidos,erro,origem").order("iniciado_em",{ascending:false}).limit(20);if(error)throw new Error(error.message);
 const latest=runs?.[0]??null;const {data:success,error:sError}=await db.from("cs_sync_runs").select("concluido_em").eq("status","sucesso").order("concluido_em",{ascending:false}).limit(1).maybeSingle();if(sError)throw new Error(sError.message);
 const {data:manual,error:mError}=await db.from("cs_sync_runs").select("iniciado_em").eq("origem","manual").order("iniciado_em",{ascending:false}).limit(1).maybeSingle();if(mError)throw new Error(mError.message);
 return {rows,latest,lastManual:manual?.iniciado_em??null,lastSuccess:success?.concluido_em??null,perfil,role:context.role};
});
export const syncCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const {runCSSync}=await import("./cs-sync.server");return runCSSync("manual",context.userId);
});