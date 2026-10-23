import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
export const Route=createFileRoute("/api/public/telegram/webhook")({server:{handlers:{
  GET:async()=>Response.json({service:"Munim Telegram"}),
  POST:async({request})=>{
    const T=await import("@/lib/telegram.server");
    if(!process.env["TELEGRAM_BOT_TOKEN"] || !T.equalSecret(request.headers.get("X-Telegram-Bot-Api-Secret-Token")??"",T.webhookSecret()))return new Response("Unauthorized",{status:401});
    const reader=request.body?.getReader();if(!reader)return new Response("Invalid update",{status:400});let text="",size=0;const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100_000){await reader.cancel();return new Response("Too large",{status:413});}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
    let body;try{body=z.object({update_id:z.number().int().nonnegative(),message:z.any().optional(),callback_query:z.any().optional()}).parse(JSON.parse(text));}catch{return new Response("Invalid update",{status:400});}
    await T.handleTelegram(body);return Response.json({ok:true});
  }
}}});