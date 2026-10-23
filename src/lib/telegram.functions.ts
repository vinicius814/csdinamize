import {createServerFn} from "@tanstack/react-start";
import {requireActive} from "./access.middleware";
export const telegramLink=createServerFn({method:"POST"}).middleware([requireActive]).handler(async({context})=>{
  if(!process.env["TELEGRAM_BOT_TOKEN"])return {url:null,configured:false};
  const T=await import("./telegram.server");const bot=await T.telegram("getMe");
  const profile=await context.supabase.from("profiles").select("telegram_codigo").eq("id",context.userId).single();if(profile.error)throw profile.error;
  return {url:`https://t.me/${bot.username}?start=${profile.data.telegram_codigo}`,configured:true};
});