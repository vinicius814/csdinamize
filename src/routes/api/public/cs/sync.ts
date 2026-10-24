import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
export const Route=createFileRoute("/api/public/cs/sync")({server:{handlers:{POST:async({request})=>{
 const expected=process.env["LOVABLE_CRON_SECRET"],received=request.headers.get("X-Munim-Secret");
 if(!expected||!received||Buffer.byteLength(expected)!==Buffer.byteLength(received)||!timingSafeEqual(Buffer.from(expected),Buffer.from(received)))return new Response("Não autorizado",{status:401});
 try {const {runCSSync}=await import("@/lib/cs-sync.server");return Response.json(await runCSSync("agendado"));}
 catch(e){return Response.json({erro:e instanceof Error?e.message:"Falha na sincronização"},{status:500});}
}}}});