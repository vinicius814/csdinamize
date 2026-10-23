import { createFileRoute } from "@tanstack/react-router";
import { ingestSchema, processIngest } from "@/lib/telegram-ingest";
const EMPTY={respostas:[],callback:null};
export const Route=createFileRoute("/api/public/telegram/ingest")({server:{handlers:{
  POST:async({request})=>{
    const T=await import("@/lib/telegram.server");const secret=process.env["MUNIM_INGEST_SECRET"];
    if(!secret || !T.equalSecret(request.headers.get("X-Munim-Secret")??"",secret))return new Response("Unauthorized",{status:401});
    const reader=request.body?.getReader();if(!reader)return Response.json(EMPTY);let text="",size=0;const decoder=new TextDecoder();
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>100_000){await reader.cancel();return Response.json({respostas:[{texto:"Mensagem muito grande. Envie em partes.",reply_markup:'{"inline_keyboard":[]}'}],callback:null});}text+=decoder.decode(value,{stream:true});}text+=decoder.decode();
    let body;try{body=ingestSchema.parse(JSON.parse(text));}catch{console.error("ingest: corpo inválido");return Response.json(EMPTY);}
    return Response.json(await processIngest(body,await T.ingestDeps()));
  }
}}});
