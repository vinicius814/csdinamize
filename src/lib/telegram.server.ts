import { createHmac, timingSafeEqual } from "node:crypto";
import {allowedToSpeak} from "./personal-rules";
import { createParser } from "eventsource-parser";
import { rodarComo } from "./credenciais.server";
import { providerError } from "./provider-error";
import { retryTranscription, TRANSCRIPTION_ATTEMPTS, briefingDue } from "./telegram-rules";

function token() { const value=process.env["TELEGRAM_BOT_TOKEN"]; if(!value)throw new Error("Bot ainda não configurado."); return value; }
export function webhookSecret() { return createHmac("sha256",token()).update("munim-telegram-webhook").digest("hex"); }
export function equalSecret(a:string,b:string) { const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length && timingSafeEqual(left,right); }
export async function telegram(method:string, body:Record<string,unknown>={}) {
  // The user explicitly chose a plain bot-token secret, not a gateway connection.
  const response=await fetch(`https://api.telegram.org/bot${token()}/${method}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const text=await response.text();const result=JSON.parse(text);
  if(!response.ok || !result.ok) throw new Error(`Telegram HTTP ${response.status}: ${String(result.description ?? "Falha").replaceAll(token(),"[protegido]")}`);
  return result.result;
}
export async function sendText(chat:number,text:string,keyboard?:unknown) {
  for(let index=0; index<text.length; index+=3900) await telegram("sendMessage",{chat_id:chat,text:text.slice(index,index+3900),...(index+3900>=text.length && keyboard?{reply_markup:keyboard}:{})});
}
async function transcribe(fileId:string) {
  const apiKey=process.env["LOVABLE_API_KEY"]; if(!apiKey)throw new Error("Transcrição não configurada.");
  const file=await telegram("getFile",{file_id:fileId});
  if(file.file_size>20_000_000)throw new Error("Áudio muito grande. Envie até 20 MB.");
  if(typeof file.file_path!=="string" || !/^[a-zA-Z0-9_./-]+$/.test(file.file_path) || file.file_path.includes(".."))throw new Error("Arquivo inválido.");
  const response=await fetch(`https://api.telegram.org/file/bot${token()}/${file.file_path}`);
  if(!response.ok)throw new Error(`Não consegui baixar o áudio (${response.status}).`);
  const reader=response.body?.getReader(); if(!reader)throw new Error("Áudio vazio.");
  const chunks:Uint8Array[]=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>20_000_000){await reader.cancel();throw new Error("Áudio muito grande.");}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  const audio=new File([bytes],"voice.ogg",{type:"audio/ogg"});
  for(let attempt=1;attempt<=TRANSCRIPTION_ATTEMPTS;attempt++){
    const form=new FormData();form.append("file",audio);form.append("model","openai/gpt-transcribe");form.append("stream","true");form.append("response_format","json");
    const r=await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions",{method:"POST",headers:{Authorization:`Bearer ${apiKey}`},body:form});
    if(!r.ok){const message=providerError(await r.text());if(retryTranscription(r.status,attempt)){const delay=Number(r.headers.get("Retry-After"));await new Promise(resolve=>setTimeout(resolve,Number.isFinite(delay)&&delay>0?delay*1000:1000*2**attempt));continue;}throw new Error(`Transcrição HTTP ${r.status}: ${message}`);}
    let final:string|undefined, streamError:string|undefined;
    const parser=createParser({onEvent:event=>{if(event.data==="[DONE]")return;const value=JSON.parse(event.data);if(value.type==="transcript.text.done")final=value.text;if(value.type==="error")streamError=value.error?.message??value.message??"Falha na transcrição";}});
    const stream=r.body?.getReader();if(!stream)throw new Error("Transcrição sem resposta.");const decoder=new TextDecoder();
    while(true){const {done,value}=await stream.read();if(done)break;parser.feed(decoder.decode(value,{stream:true}));}parser.feed(decoder.decode());
    if(streamError)throw new Error(streamError);if(!final?.trim())throw new Error("Não consegui entender o áudio. Envie novamente ou escreva.");return final.trim();
  }throw new Error("Não consegui transcrever após três tentativas.");
}
async function activeUser(userId:string) {
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const [access,role]=await Promise.all([db.from("account_access").select("status,terms_accepted_at").eq("user_id",userId).single(),db.from("user_roles").select("role").eq("user_id",userId).single()]);
  if(access.error || role.error || access.data?.status!=="ativo" || !access.data.terms_accepted_at)throw new Error("Sua conta ainda não está liberada.");
  return {db,role:role.data.role};
}
export async function handleTelegram(update:any) {
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const message=update.message ?? update.callback_query?.message;
  const sender=update.message?.from ?? update.callback_query?.from;
  if(!message || message.chat?.type!=="private" || sender?.id!==message.chat.id)return;
  const chat=message.chat.id;
  const claim=await db.from("telegram_updates").insert({update_id:update.update_id});
  if(claim.error){if(claim.error.code==="23505")return;throw claim.error;}
  try {
    if(/^\/start(?:@\w+)?\s+/.test(message.text??"")){
      const code=message.text.trim().split(/\s+/)[1];
      const result=await db.rpc("link_telegram_user",{code,chat,handle:sender.username??null});if(result.error)throw new Error(result.error.message);
      await sendText(chat,"Telegram conectado ao Munim. Pode escrever ou enviar um áudio.");
    } else {
      const profile=await db.from("profiles").select("id").eq("telegram_chat_id",chat).maybeSingle();if(profile.error)throw profile.error;
      if(!profile.data){await sendText(chat,"Abra https://munim.wojtec.com.br/conexoes e gere seu código no cartão Telegram para conectar sua conta.");await db.from("telegram_updates").update({status:"done"}).eq("update_id",update.update_id);return;}
      const userId=profile.data.id;const {role}=await activeUser(userId);
      await rodarComo({userId,admin:role==="admin"||role==="superadmin",superadmin:role==="superadmin"},async()=>{
        if(update.callback_query){
          const match=/^(aprovada|recusada):([0-9a-f-]{36})$/.exec(update.callback_query.data??"");if(!match)throw new Error("Aprovação inválida.");
          const actionId=match[2];if(!actionId)throw new Error("Aprovação inválida.");
          const {decidirCore}=await import("./munim-core.server");
          const result=await decidirCore({acao_id:actionId,decisao:match[1] as "aprovada"|"recusada"},{supabase:db,userId});
          await telegram("answerCallbackQuery",{callback_query_id:update.callback_query.id,text:result.status==="executada"?"Ação executada.":result.status==="recusada"?"Ação recusada.":"Não consegui executar."});
          await telegram("editMessageReplyMarkup",{chat_id:chat,message_id:message.message_id,reply_markup:{inline_keyboard:[]}});return;
        }
        const content=message.voice?await transcribe(message.voice.file_id):String(message.text??"").trim();
        if(!content || content.startsWith("/")){await sendText(chat,"Escreva uma mensagem ou envie um áudio para o Munim.");return;}
        if(content.length>8000)throw new Error("Mensagem muito longa. Envie em partes.");
        const insert=await db.from("mensagens").insert({user_id:userId,autor:"usuario",canal:"telegram",conteudo:content});if(insert.error)throw insert.error;
        const {conversarCore}=await import("./munim-core.server");const result=await conversarCore({conteudo:content},{supabase:db,userId,role},"telegram");
        await sendText(chat,result.resposta);
        const pending=await db.from("acoes").select("id,resumo").eq("user_id",userId).eq("status","pendente").order("created_at",{ascending:false}).limit(10);if(pending.error)throw pending.error;
        for(const action of pending.data??[])await sendText(chat,action.resumo??"Ação aguardando sua decisão.",{inline_keyboard:[[{text:"Aprovar",callback_data:`aprovada:${action.id}`},{text:"Recusar",callback_data:`recusada:${action.id}`}]]});
      });
    }
    const completed=await db.from("telegram_updates").update({status:"done"}).eq("update_id",update.update_id);if(completed.error)throw completed.error;
  } catch(e) {
    await db.from("telegram_updates").update({status:"failed"}).eq("update_id",update.update_id);
    await sendText(chat,e instanceof Error?e.message:"Não consegui concluir agora.");
  }
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