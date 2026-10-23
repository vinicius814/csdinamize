import { createFileRoute } from "@tanstack/react-router";
import { parseUpdate, processUpdate } from "@/lib/telegram-bot";

/** Per-user bot webhook: authenticated by the bot's own secret_token. */
export const Route=createFileRoute("/api/public/telegram/bot/$botId")({server:{handlers:{
  POST:async({request,params})=>{
    const botId=Number(params.botId);if(!Number.isSafeInteger(botId)||botId<=0)return new Response("Unauthorized",{status:401});
    const T=await import("@/lib/telegram.server");
    const bot=await T.findBot(botId);
    if(!bot||!T.equalSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token")??"",bot.webhook_secret))return new Response("Unauthorized",{status:401});
    const raw=await request.text();if(raw.length>200_000)return Response.json({ok:true});
    let entrada;try{entrada=parseUpdate(JSON.parse(raw));}catch{return Response.json({ok:true});}
    if(!entrada)return Response.json({ok:true});
    const e=entrada;
    const task=(async()=>{
      const {decifrar}=await import("@/lib/cripto.server");const token=decifrar(bot.token_cifrado);
      const {tgCall,sendBotText}=await import("@/lib/telegram-rules");
      const self={bot_id:botId,user_id:bot.user_id,chat_id:bot.chat_id==null?null:Number(bot.chat_id),token};
      const out=await processUpdate(self,e,await T.botDeps(self));
      try{
        if(out.callback){await tgCall(token,"answerCallbackQuery",{callback_query_id:out.callback.id,text:out.callback.texto});
          if(out.callback.limpar&&out.callback.message_id)await tgCall(token,"editMessageReplyMarkup",{chat_id:e.chat_id,message_id:out.callback.message_id,reply_markup:{inline_keyboard:[]}}).catch(()=>{});}
        for(const r of out.respostas)await sendBotText(token,e.chat_id,r.texto,r.teclado??undefined);
      }catch(err){await T.flagBot(bot.user_id,err);console.error("telegram bot: envio falhou",err instanceof Error?err.message:"erro");}
    })();
    const {runBackground}=await import("@/lib/background.server");runBackground(task);
    return Response.json({ok:true});
  },
}}});
