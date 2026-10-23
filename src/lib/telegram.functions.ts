import {createServerFn} from "@tanstack/react-start";
import {z} from "zod";
import {requireActive} from "./access.middleware";
import {telegramCodeExpires} from "./telegram-rules";

/** Only safe fields ever reach the browser: never the token or the webhook secret. */
export const telegramStatus=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const b=await db.from("telegram_bots").select("status,bot_username,bot_nome,chat_id,ultimo_erro").eq("user_id",context.userId).maybeSingle();if(b.error)throw b.error;
  if(!b.data)return {configured:false,status:null as string|null,bot:null as string|null,nome:null as string|null,connected:false,ultimo_erro:null as string|null};
  return {configured:true,status:b.data.status,bot:b.data.bot_username,nome:b.data.bot_nome,connected:!!b.data.chat_id&&b.data.status==="ativo",ultimo_erro:b.data.ultimo_erro};
});
export const connectTelegramBot=createServerFn({method:"POST"}).middleware([requireActive]).inputValidator(i=>z.object({token:z.string().trim().min(10).max(100)}).parse(i)).handler(async({data,context})=>{
  const {saveBotToken}=await import("./telegram.server");return saveBotToken(context.userId,data.token);
});
export const telegramLink=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const b=await db.from("telegram_bots").select("bot_username,chat_id").eq("user_id",context.userId).maybeSingle();if(b.error)throw b.error;
  if(!b.data)throw new Error("Conecte seu bot primeiro.");if(b.data.chat_id)throw new Error("Seu chat já está vinculado.");
  const code=crypto.randomUUID().replaceAll("-","");const expiresAt=telegramCodeExpires(Date.now());
  const u=await db.from("telegram_bots").update({codigo_vinculo:code,expira_em:expiresAt}).eq("user_id",context.userId);if(u.error)throw u.error;
  return {url:`https://t.me/${b.data.bot_username}?start=${code}`,expiresAt};
});
export const testTelegram=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const {sendText}=await import("./telegram.server");
  let ok;try{ok=await sendText(context.userId,"Teste do Munim: tudo certo por aqui.");}catch(e){throw new Error(e instanceof Error?e.message:"Envio falhou.");}
  if(!ok)throw new Error("Seu bot ainda não está ativo.");return {ok:true};
});
export const disconnectTelegram=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const {removeBot}=await import("./telegram.server");await removeBot(context.userId);return {ok:true};
});
