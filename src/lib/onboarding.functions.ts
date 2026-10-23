import {createServerFn} from "@tanstack/react-start";
import {comCredenciais} from "./credenciais.middleware";
import {z} from "zod";
export const onboardingOptions=createServerFn({method:"POST"}).middleware([comCredenciais]).handler(async({context})=>{
 const I=await import("./integracoes.server");
 const [pipelines,fields,config,profile]=await Promise.all([
 I.gw("pipedrive","/pipelines").catch(e=>({erro:e.message})),I.gw("pipedrive","/dealFields").catch(e=>({erro:e.message})),
 context.supabase.from("config_usuario").select("pipeline_id,campo_ultimo_contato,dias_alerta,onboarding_concluido").eq("user_id",context.userId).maybeSingle(),
 context.supabase.from("profiles").select("fuso,horario_briefing").eq("id",context.userId).single()]);
 return {pipelines:(pipelines.data??[]).map((p:any)=>({id:p.id,name:p.name})),fields:(fields.data??[]).filter((p:any)=>p.field_type==="date").map((p:any)=>({key:p.key,name:p.name})),erro:pipelines.erro??fields.erro??null,config:config.data,profile:profile.data};
});
const schema=z.object({pipeline_id:z.number().int().positive().nullable(),campo_ultimo_contato:z.string().max(100).nullable(),dias_alerta:z.number().int().min(1).max(3650),fuso:z.string(),horario_briefing:z.string().regex(/^\d{2}:\d{2}$/),concluir:z.boolean()});
export const saveOnboarding=createServerFn({method:"POST"}).middleware([comCredenciais]).inputValidator(i=>schema.parse(i)).handler(async({data,context})=>{
 try{new Intl.DateTimeFormat("pt-BR",{timeZone:data.fuso});}catch{throw new Error("Fuso inválido.");}
 if(data.pipeline_id&&!data.campo_ultimo_contato)throw new Error("Escolha o campo de último contato.");
 const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
 const config=await db.from("config_usuario").upsert({user_id:context.userId,pipeline_id:data.pipeline_id,campo_ultimo_contato:data.campo_ultimo_contato,dias_alerta:data.dias_alerta,onboarding_concluido:data.concluir},{onConflict:"user_id"});
 if(config.error)throw config.error;
 const profile=await db.from("profiles").update({fuso:data.fuso,horario_briefing:data.horario_briefing}).eq("id",context.userId);if(profile.error)throw profile.error;return {ok:true};
});
