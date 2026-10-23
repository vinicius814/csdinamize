import {createServerFn} from "@tanstack/react-start";
import {requireActive} from "./access.middleware";
import { telegramCodeExpires } from "./telegram-rules";
export const telegramLink=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  if(!process.env["TELEGRAM_BOT_TOKEN"])return {url:null,configured:false,expiresAt:null};
  const T=await import("./telegram.server");const bot=await T.telegram("getMe");
  const code=crypto.randomUUID().replaceAll("-","")+crypto.randomUUID().replaceAll("-","");
  const expiresAt=telegramCodeExpires(Date.now());
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const update=await db.from("profiles").update({telegram_codigo:code,telegram_codigo_expira_em:expiresAt}).eq("id",context.userId);if(update.error)throw update.error;
  return {url:`https://t.me/${bot.username}?start=${code}`,configured:true,expiresAt};
});
export const telegramStatus=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const p=await context.supabase.from("profiles").select("telegram_chat_id,telegram_username").eq("id",context.userId).single();if(p.error)throw p.error;
  return {configured:!!process.env["TELEGRAM_BOT_TOKEN"],connected:!!p.data.telegram_chat_id,username:p.data.telegram_username};
});
export const disconnectTelegram=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
  const result=await db.from("profiles").update({telegram_chat_id:null,telegram_username:null,telegram_codigo:crypto.randomUUID().replaceAll("-",""),telegram_codigo_expira_em:null}).eq("id",context.userId);
  if(result.error)throw result.error;return {ok:true};
});