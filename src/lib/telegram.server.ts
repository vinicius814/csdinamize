import { timingSafeEqual, randomBytes } from "node:crypto";
import {allowedToSpeak} from "./personal-rules";
import { rodarComo } from "./credenciais.server";
import { briefingDue, sendBotText, tgCall, TelegramError, connectBot, TELEGRAM_MAX_FILE, type Keyboard, type CallDeps, defaultDeps } from "./telegram-rules";
import type { Bot, BotDeps, Entrada } from "./telegram-bot";

export function equalSecret(a:string,b:string) { const left=Buffer.from(a),right=Buffer.from(b);return left.length===right.length && timingSafeEqual(left,right); }
async function admin(){return (await import("@/integrations/supabase/client.server")).supabaseAdmin;}
async function decrypt(v:string){return (await import("./cripto.server")).decifrar(v);}

/** Marks the bot as failing when Telegram reports a revoked token or a blocked bot. */
export async function flagBot(userId:string,e:unknown){if(e instanceof TelegramError&&e.revoked){const db=await admin();await db.from("telegram_bots").update({status:"erro",ultimo_erro:e.status===401?"O token do bot foi revogado. Troque o bot no Munim.":"O bot foi bloqueado no Telegram. Desbloqueie e envie /start."}).eq("user_id",userId);}}
export async function activeBot(userId:string){const db=await admin();const b=await db.from("telegram_bots").select("token_cifrado,chat_id,status").eq("user_id",userId).maybeSingle();if(b.error)throw b.error;if(!b.data||b.data.status!=="ativo"||!b.data.chat_id)return null;return {token:await decrypt(b.data.token_cifrado),chat:Number(b.data.chat_id)};}
/** Proactive output always goes through the person's own bot; without an active bot nothing is sent. */
export async function sendText(userId:string,text:string,keyboard?:Keyboard,deps:CallDeps=defaultDeps){
  const bot=await activeBot(userId);if(!bot)return false;
  try{await sendBotText(bot.token,bot.chat,text,keyboard,deps);return true;}catch(e){await flagBot(userId,e);throw e;}
}

export async function saveBotToken(userId:string,token:string){
  const db=await admin();const {cifrar}=await import("./cripto.server");
  const prev=await db.from("telegram_bots").select("token_cifrado,bot_id").eq("user_id",userId).maybeSingle();if(prev.error)throw prev.error;
  const result=await connectBot(userId,token,{...defaultDeps,encrypt:cifrar,secret:()=>randomBytes(32).toString("hex"),
    async owner(botId){const r=await db.from("telegram_bots").select("user_id").eq("bot_id",botId).maybeSingle();if(r.error)throw r.error;return r.data?.user_id??null;},
    async save(row){const r=await db.from("telegram_bots").upsert({...row,chat_id:null,codigo_vinculo:null,expira_em:null,ultimo_erro:null,conectado_em:new Date().toISOString()},{onConflict:"user_id"});if(r.error){if(r.error.code==="23505")throw new Error("Esse bot já está conectado a outra conta do Munim.");throw r.error;}
      const p=await db.from("profiles").update({telegram_chat_id:null,telegram_username:null}).eq("id",userId);if(p.error)throw p.error;}});
  // Replacing a different bot: release the old webhook (best effort).
  if(prev.data&&String(prev.data.bot_id)!==String(result.bot_username)){try{const old=await decrypt(prev.data.token_cifrado);if(old!==token.trim())await tgCall(old,"deleteWebhook",{});}catch{/* old token may be revoked */}}
  return result;
}
export async function removeBot(userId:string){
  const db=await admin();const b=await db.from("telegram_bots").select("token_cifrado").eq("user_id",userId).maybeSingle();if(b.error)throw b.error;
  if(b.data){try{await tgCall(await decrypt(b.data.token_cifrado),"deleteWebhook",{});}catch{/* token may already be revoked */}}
  const del=await db.from("telegram_bots").delete().eq("user_id",userId);if(del.error)throw del.error;
  const p=await db.from("profiles").update({telegram_chat_id:null,telegram_username:null}).eq("id",userId);if(p.error)throw p.error;
}

async function activeUser(userId:string) {
  const db=await admin();
  const [access,role]=await Promise.all([db.from("account_access").select("status,terms_accepted_at").eq("user_id",userId).single(),db.from("user_roles").select("role").eq("user_id",userId).single()]);
  if(access.error || role.error || access.data?.status!=="ativo" || !access.data.terms_accepted_at)throw new Error("Sua conta ainda não está liberada.");
  return {db,role:role.data.role};
}

export async function findBot(botId:number){const db=await admin();const r=await db.from("telegram_bots").select("user_id,bot_id,chat_id,webhook_secret,token_cifrado").eq("bot_id",botId).maybeSingle();if(r.error)throw r.error;return r.data;}

/** Reads media with a vision/audio model; text documents are decoded directly. */
async function extractMedia(token:string,userId:string,e:Entrada){
  if(!e.arquivo)throw new Error("Sem arquivo.");
  const info=await tgCall<{file_path?:string;file_size?:number}>(token,"getFile",{file_id:e.arquivo.file_id});
  if(!info.file_path)throw new Error("Arquivo indisponível.");if((info.file_size??0)>TELEGRAM_MAX_FILE)throw new Error("Arquivo grande demais.");
  const dl=await fetch(`https://api.telegram.org/file/bot${token}/${info.file_path}`);if(!dl.ok)throw new Error(`Download falhou (${dl.status}).`);
  const bytes=Buffer.from(await dl.arrayBuffer());if(bytes.length>TELEGRAM_MAX_FILE)throw new Error("Arquivo grande demais.");
  const mime=e.arquivo.mime??"application/octet-stream";
  if(e.tipo==="documento"&&(mime.startsWith("text/")||/\.(txt|md|csv)$/i.test(e.arquivo.nome??"")))return bytes.toString("utf8").slice(0,20000);
  const b64=bytes.toString("base64");
  const fmt=/mpeg|mp3/.test(mime)?"mp3":/wav/.test(mime)?"wav":/mp4|m4a|aac/.test(mime)?"m4a":"ogg";
  const part=e.tipo==="foto"?{type:"image_url",image_url:{url:`data:${mime};base64,${b64}`}}
    :e.tipo==="documento"?{type:"file",file:{filename:e.arquivo.nome??"documento.pdf",file_data:`data:application/pdf;base64,${b64}`}}
    :{type:"input_audio",input_audio:{data:b64,format:fmt}};
  const ask=e.tipo==="foto"?"Transcreva o texto visível nesta imagem. Se não houver texto relevante, descreva a imagem em uma ou duas frases."
    :e.tipo==="documento"?"Extraia o conteúdo principal deste documento em texto corrido, preservando números, datas e nomes. No máximo 4000 palavras."
    :"Transcreva este áudio em português, fielmente, sem comentários.";
  const key=process.env["LOVABLE_API_KEY"];if(!key)throw new Error("IA sem chave configurada.");
  const {checkBudget}=await import("./budget.server");await checkBudget(userId);
  for(let attempt=1;;attempt++){
    const r=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model:"google/gemini-3.8-flash",messages:[{role:"user",content:[{type:"text",text:ask},part]}]})});
    if(r.ok){const j=await r.json() as {choices?:{message?:{content?:string}}[];usage?:{prompt_tokens?:number;completion_tokens?:number}};
      const {recordAuxiliary}=await import("./auxiliary-record");const db=await admin();const u=j.usage??{};
      await recordAuxiliary(()=>db.from("uso").insert({user_id:userId,funcao:`telegram_${e.tipo}`,modelo:"google/gemini-3.8-flash",tokens_entrada:u.prompt_tokens??0,tokens_saida:u.completion_tokens??0,custo_usd:((u.prompt_tokens??0)*0.3+(u.completion_tokens??0)*2.5)/1000000}),"chat_usage");
      return j.choices?.[0]?.message?.content??"";}
    const body=await r.text();if(attempt>=3||(r.status!==429&&r.status<500))throw new Error(`Leitura falhou [${r.status}]: ${body.slice(0,200)}`);
    await new Promise(res=>setTimeout(res,1000*2**attempt));
  }
}

export async function botDeps(bot:Bot&{token:string}):Promise<BotDeps> {
  const db=await admin();
  const as=<T,>(userId:string,role:string,fn:()=>Promise<T>)=>rodarComo({userId,admin:role==="admin"||role==="superadmin",superadmin:role==="superadmin"},fn);
  return {
    async claim(id){const c=await db.from("telegram_bot_updates").insert({bot_id:bot.bot_id,update_id:id});if(c.error){if(c.error.code==="23505")return false;throw c.error;}return true;},
    async record(e,userId){const r=await db.from("entradas_telegram").upsert({bot_id:bot.bot_id,update_id:e.update_id,user_id:userId,chat_id:e.chat_id,tipo:e.tipo==="outro"?"documento":e.tipo,texto:e.texto||null,legenda:e.legenda,arquivo:e.arquivo,status:"recebida"},{onConflict:"bot_id,update_id"});if(r.error)throw r.error;},
    async finish(id,status,erro){await db.from("entradas_telegram").update({status,erro:erro??null}).eq("bot_id",bot.bot_id).eq("update_id",id);await db.from("telegram_bot_updates").update({status:status==="erro"?"failed":"done"}).eq("bot_id",bot.bot_id).eq("update_id",id);},
    async link(code,chat){const r=await db.rpc("vincular_bot_telegram",{bot:bot.bot_id,code,chat});if(r.error)throw new Error(r.error.message);},
    async activeRole(userId){try{return (await activeUser(userId)).role;}catch{return null;}},
    extract:(userId,e)=>extractMedia(bot.token,userId,e),
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
  const db=await admin();let delivered=0;
  // Explicit pagination: never silently ignore accounts past the API page limit.
  for(let start=0;;start+=500){
    const profiles=await db.from("profiles").select("id,telegram_chat_id,fuso,horario_briefing").not("telegram_chat_id","is",null).eq("alertas_ativos",true).order("id").range(start,start+499);if(profiles.error)throw profiles.error;
    for(const p of profiles.data??[]){
      const due=briefingDue(new Date(),p.fuso,p.horario_briefing);if(!due.due || !p.telegram_chat_id)continue;
      let role;try{role=(await activeUser(p.id)).role;}catch{continue;}
      if(!(await activeBot(p.id)))continue;
      const pref=await db.from("preferencias_munim").select("telegram_inicio,telegram_fim,ai_pausada").eq("user_id",p.id).maybeSingle();if(pref.error||pref.data?.ai_pausada)continue;const localTime=new Intl.DateTimeFormat("en-GB",{timeZone:p.fuso,hour:"2-digit",minute:"2-digit"}).format(new Date());if(!allowedToSpeak(localTime,pref.data?.telegram_inicio.slice(0,5)??"08:00",pref.data?.telegram_fim.slice(0,5)??"20:00"))continue;
      const blocked=await db.from("telegram_deliveries").select("status").eq("user_id",p.id).eq("status","failed").limit(1);if(blocked.error)throw blocked.error;if(blocked.data?.length)continue;
      const claim=await db.from("telegram_deliveries").insert({user_id:p.id,local_date:due.date});if(claim.error){if(claim.error.code==="23505")continue;throw claim.error;}
      try{
        const result=await rodarComo({userId:p.id,admin:role==="admin"||role==="superadmin",superadmin:role==="superadmin"},async()=>{const {gerarRotinaCore}=await import("./briefing-core.server");return gerarRotinaCore({tipo:"manha"},{supabase:db,userId:p.id});});
        await sendText(p.id,result.md);await db.from("telegram_deliveries").update({status:"sent"}).eq("user_id",p.id).eq("local_date",due.date);delivered++;
      }catch{await db.from("telegram_deliveries").update({status:"failed"}).eq("user_id",p.id).eq("local_date",due.date);}
    }if((profiles.data?.length??0)<500)break;
  }const notifications=await deliverNotifications();return {delivered,...notifications};
}
async function deliverNotifications(){
 const db=await admin();let notifications=0;
 async function once(userId:string,key:string,send:()=>Promise<unknown>){const claim=await db.from("telegram_notifications").insert({user_id:userId,notification_key:key});if(claim.error){if(claim.error.code==="23505")return;throw claim.error;}try{await send();const done=await db.from("telegram_notifications").update({status:"sent"}).eq("user_id",userId).eq("notification_key",key);if(done.error)throw done.error;notifications++;}catch{await db.from("telegram_notifications").update({status:"failed"}).eq("user_id",userId).eq("notification_key",key);}}
 for(let start=0;;start+=500){const profiles=await db.from("profiles").select("id,telegram_chat_id,fuso").eq("alertas_ativos",true).not("telegram_chat_id","is",null).order("id").range(start,start+499);if(profiles.error)throw profiles.error;
 for(const p of profiles.data??[]){if(!p.telegram_chat_id)continue;let role;try{role=(await activeUser(p.id)).role;}catch{continue;}if(!(await activeBot(p.id)))continue;
 const pref=await db.from("preferencias_munim").select("telegram_inicio,telegram_fim,ai_pausada").eq("user_id",p.id).maybeSingle();if(pref.error||pref.data?.ai_pausada)continue;const localTime=new Intl.DateTimeFormat("en-GB",{timeZone:p.fuso,hour:"2-digit",minute:"2-digit"}).format(new Date());if(!allowedToSpeak(localTime,pref.data?.telegram_inicio.slice(0,5)??"08:00",pref.data?.telegram_fim.slice(0,5)??"20:00"))continue;const due=briefingDue(new Date(),p.fuso,"18:00");
 if(due.due)await once(p.id,`resumo:${due.date}`,async()=>{const result=await rodarComo({userId:p.id,admin:role==="admin"||role==="superadmin"},async()=>{const {gerarRotinaCore}=await import("./briefing-core.server");return gerarRotinaCore({tipo:"fechamento"},{supabase:db,userId:p.id});});await sendText(p.id,result.md);});
 for(let offset=0;;offset+=500){const notes=await db.from("itens").select("id,titulo,data_alvo,tipo,status").eq("user_id",p.id).not("data_alvo","is",null).neq("status","concluído").neq("status","arquivado").lte("data_alvo",new Date(Date.now()+86400000).toISOString()).order("id").range(offset,offset+499);if(notes.error)throw notes.error;
 for(const note of notes.data??[]){if(!note.data_alvo)continue;if(note.tipo!=="promessa"&&Date.parse(note.data_alvo)>Date.now())continue;const date=new Intl.DateTimeFormat("en-CA",{timeZone:p.fuso,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(note.data_alvo));if(note.tipo!=="promessa"&&date!==due.date)continue;await once(p.id,`lembrete:${note.id}:${note.data_alvo}`,()=>sendText(p.id,`Lembrete: ${note.titulo??"Compromisso"}`));}if((notes.data?.length??0)<500)break;}
 }if((profiles.data?.length??0)<500)break;
 }return {notifications};
}
