import { timingSafeEqual } from "node:crypto";
import {allowedToSpeak} from "./personal-rules";
import { rodarComo } from "./credenciais.server";
import { briefingDue, sendViaMake } from "./telegram-rules";
import type { Ingest, IngestDeps } from "./telegram-ingest";

export function equalSecret(a:string,b:string) { const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length && timingSafeEqual(left,right); }
/** Proactive output goes through the Make scenario; the Munim never calls the Telegram API directly. */
export async function sendText(chat:number,text:string,keyboard?:unknown) {
  const url=process.env["MAKE_TELEGRAM_SEND_URL"]; if(!url)throw new Error("Envio pelo Telegram não configurado.");
  await sendViaMake(url,chat,text,keyboard);
}
async function activeUser(userId:string) {
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const [access,role]=await Promise.all([db.from("account_access").select("status,terms_accepted_at").eq("user_id",userId).single(),db.from("user_roles").select("role").eq("user_id",userId).single()]);
  if(access.error || role.error || access.data?.status!=="ativo" || !access.data.terms_accepted_at)throw new Error("Sua conta ainda não está liberada.");
  return {db,role:role.data.role};
}
export async function ingestDeps():Promise<IngestDeps> {
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const as=<T,>(userId:string,role:string,fn:()=>Promise<T>)=>rodarComo({userId,admin:role==="admin"||role==="superadmin",superadmin:role==="superadmin"},fn);
  return {
    async claim(id){const c=await db.from("telegram_updates").insert({update_id:id});if(c.error){if(c.error.code==="23505")return false;throw c.error;}return true;},
    async record(b:Ingest,userId){const r=await db.from("entradas_telegram").upsert({update_id:b.update_id,user_id:userId,chat_id:b.chat_id,tipo:b.tipo,texto:b.texto,legenda:b.legenda,arquivo:b.arquivo,extracao_erro:b.extracao_erro,status:"recebida"},{onConflict:"update_id"});if(r.error)throw r.error;},
    async finish(id,status,erro){await db.from("entradas_telegram").update({status,erro:erro??null}).eq("update_id",id);await db.from("telegram_updates").update({status:status==="erro"?"failed":"done"}).eq("update_id",id);},
    async link(code,chat,handle){const r=await db.rpc("link_telegram_user",{code,chat,handle});if(r.error)throw new Error(r.error.message);},
    async findUser(chat){const p=await db.from("profiles").select("id").eq("telegram_chat_id",chat).maybeSingle();if(p.error)throw p.error;return p.data?.id??null;},
    async activeRole(userId){try{return (await activeUser(userId)).role;}catch{return null;}},
    async button(userId,role,data){return as(userId,role,async()=>{
      const undo=/^desfazer:([0-9a-f-]{36})$/.exec(data);if(undo){const removed=await db.from("itens").delete().eq("id",undo[1]??"").eq("user_id",userId);if(removed.error)throw removed.error;return "Captura desfeita.";}
      const match=/^(aprovada|recusada):([0-9a-f-]{36})$/.exec(data);if(!match||!match[2])throw new Error("Aprovação inválida.");
      const {decidirCore}=await import("./munim-core.server");
      const result=await decidirCore({acao_id:match[2],decisao:match[1] as "aprovada"|"recusada"},{supabase:db,userId});
      return result.status==="executada"?"Ação executada.":result.status==="recusada"?"Ação recusada.":"Não consegui executar.";
    });},
    async converse(userId,role,content,meta){return as(userId,role,async()=>{
      const topic=await db.from("conversas").select("id").eq("user_id",userId).eq("titulo","Telegram").eq("arquivada",false).limit(1).maybeSingle();if(topic.error)throw topic.error;
      let topicId=topic.data?.id;if(!topicId){const created=await db.from("conversas").insert({user_id:userId,titulo:"Telegram"}).select("id").single();if(created.error)throw created.error;topicId=created.data.id;}
      const insert=await db.from("mensagens").insert({user_id:userId,autor:"usuario",canal:"telegram",conteudo:content,conversa_id:topicId,meta:meta as any});if(insert.error)throw insert.error;
      const {conversarCore}=await import("./munim-core.server");const result=await conversarCore({conteudo:content,conversa_id:topicId},{supabase:db,userId,role},"telegram");
      const c=result.captura as any;
      const pending=await db.from("acoes").select("id,resumo").eq("user_id",userId).eq("status","pendente").order("created_at",{ascending:false}).limit(10);if(pending.error)throw pending.error;
      return {resposta:result.resposta,captura:c&&!c.suggestion&&"id" in c?{id:c.id,tipo:c.tipo,titulo:c.titulo}:null,pendentes:pending.data??[]};
    });},
  };
}
export async function deliverBriefings() {
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");let delivered=0;
  // Explicit pagination: never silently ignore accounts past the API page limit.
  for(let start=0;;start+=500){
    const profiles=await db.from("profiles").select("id,telegram_chat_id,fuso,horario_briefing").not("telegram_chat_id","is",null).eq("alertas_ativos",true).order("id").range(start,start+499);if(profiles.error)throw profiles.error;
    for(const p of profiles.data??[]){
      const due=briefingDue(new Date(),p.fuso,p.horario_briefing);if(!due.due || !p.telegram_chat_id)continue;
      let role;try{role=(await activeUser(p.id)).role;}catch{continue;}
      const pref=await db.from("preferencias_munim").select("telegram_inicio,telegram_fim,ai_pausada").eq("user_id",p.id).maybeSingle();if(pref.error||pref.data?.ai_pausada)continue;const localTime=new Intl.DateTimeFormat("en-GB",{timeZone:p.fuso,hour:"2-digit",minute:"2-digit"}).format(new Date());if(!allowedToSpeak(localTime,pref.data?.telegram_inicio.slice(0,5)??"08:00",pref.data?.telegram_fim.slice(0,5)??"20:00"))continue;
      const blocked=await db.from("telegram_deliveries").select("status").eq("user_id",p.id).eq("status","failed").limit(1);if(blocked.error)throw blocked.error;if(blocked.data?.length)continue;
      const claim=await db.from("telegram_deliveries").insert({user_id:p.id,local_date:due.date});if(claim.error){if(claim.error.code==="23505")continue;throw claim.error;}
      try{
        const result=await rodarComo({userId:p.id,admin:role==="admin"||role==="superadmin",superadmin:role==="superadmin"},async()=>{const {gerarRotinaCore}=await import("./briefing-core.server");return gerarRotinaCore({tipo:"manha"},{supabase:db,userId:p.id});});
        await sendText(p.telegram_chat_id,result.md);await db.from("telegram_deliveries").update({status:"sent"}).eq("user_id",p.id).eq("local_date",due.date);delivered++;
      }catch{await db.from("telegram_deliveries").update({status:"failed"}).eq("user_id",p.id).eq("local_date",due.date);}
    }if((profiles.data?.length??0)<500)break;
  }const notifications=await deliverNotifications();return {delivered,...notifications};
}
async function deliverNotifications(){
 const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");let notifications=0;
 async function once(userId:string,key:string,send:()=>Promise<void>){const claim=await db.from("telegram_notifications").insert({user_id:userId,notification_key:key});if(claim.error){if(claim.error.code==="23505")return;throw claim.error;}try{await send();const done=await db.from("telegram_notifications").update({status:"sent"}).eq("user_id",userId).eq("notification_key",key);if(done.error)throw done.error;notifications++;}catch{await db.from("telegram_notifications").update({status:"failed"}).eq("user_id",userId).eq("notification_key",key);}}
 for(let start=0;;start+=500){const profiles=await db.from("profiles").select("id,telegram_chat_id,fuso").eq("alertas_ativos",true).not("telegram_chat_id","is",null).order("id").range(start,start+499);if(profiles.error)throw profiles.error;
 for(const p of profiles.data??[]){if(!p.telegram_chat_id)continue;const chat=p.telegram_chat_id;let role;try{role=(await activeUser(p.id)).role;}catch{continue;}
 const pref=await db.from("preferencias_munim").select("telegram_inicio,telegram_fim,ai_pausada").eq("user_id",p.id).maybeSingle();if(pref.error||pref.data?.ai_pausada)continue;const localTime=new Intl.DateTimeFormat("en-GB",{timeZone:p.fuso,hour:"2-digit",minute:"2-digit"}).format(new Date());if(!allowedToSpeak(localTime,pref.data?.telegram_inicio.slice(0,5)??"08:00",pref.data?.telegram_fim.slice(0,5)??"20:00"))continue;const due=briefingDue(new Date(),p.fuso,"18:00");
 if(due.due)await once(p.id,`resumo:${due.date}`,async()=>{const result=await rodarComo({userId:p.id,admin:role==="admin"||role==="superadmin"},async()=>{const {gerarRotinaCore}=await import("./briefing-core.server");return gerarRotinaCore({tipo:"fechamento"},{supabase:db,userId:p.id});});await sendText(chat,result.md);});
 for(let offset=0;;offset+=500){const notes=await db.from("itens").select("id,titulo,data_alvo,tipo,status").eq("user_id",p.id).not("data_alvo","is",null).neq("status","concluído").neq("status","arquivado").lte("data_alvo",new Date(Date.now()+86400000).toISOString()).order("id").range(offset,offset+499);if(notes.error)throw notes.error;
 for(const note of notes.data??[]){if(!note.data_alvo)continue;if(note.tipo!=="promessa"&&Date.parse(note.data_alvo)>Date.now())continue;const date=new Intl.DateTimeFormat("en-CA",{timeZone:p.fuso,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(note.data_alvo));if(note.tipo!=="promessa"&&date!==due.date)continue;await once(p.id,`lembrete:${note.id}:${note.data_alvo}`,()=>sendText(chat,`Lembrete: ${note.titulo??"Compromisso"}`));}if((notes.data?.length??0)<500)break;}
 }if((profiles.data?.length??0)<500)break;
 }return {notifications};
}