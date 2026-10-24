import { createServerFn } from "@tanstack/react-start";
import { requireActive } from "./access.middleware";
import { csPodeVer, type CSRow } from "./cs-rules";

export const readCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const db=context.supabase;
 const {data:perfil,error:pError}=await db.from("profiles").select("papel,pipedrive_user_id").eq("id",context.userId).single();if(pError)throw new Error(pError.message);
 const rows:CSRow[]=[];
 for(let start=0;;start+=1000){const {data,error}=await db.from("cs_snapshot").select("*").order("deal_id").range(start,start+999);if(error)throw new Error(error.message);for(const r of data??[]) {if(!csPodeVer(context.role,perfil.papel,perfil.pipedrive_user_id,r.owner_id,r.pipeline_id))continue;rows.push({...r,valor:r.valor===null?null:Number(r.valor)});}if((data?.length??0)<1000)break;}
 const {data:runs,error}=await db.from("cs_sync_runs").select("id,status,iniciado_em,concluido_em,negocios_lidos,erro,origem").order("iniciado_em",{ascending:false}).limit(20);if(error)throw new Error(error.message);
 const latest=runs?.[0]??null;const {data:success,error:sError}=await db.from("cs_sync_runs").select("concluido_em").eq("status","sucesso").order("concluido_em",{ascending:false}).limit(1).maybeSingle();if(sError)throw new Error(sError.message);
 return {rows,latest,lastSuccess:success?.concluido_em??null,perfil,role:context.role};
});
export const syncCS = createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
 const {runCSSync}=await import("./cs-sync.server");return runCSSync("manual",context.userId);
});