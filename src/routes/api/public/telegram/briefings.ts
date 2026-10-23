import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/public/telegram/briefings")({server:{handlers:{POST:async({request})=>{
  const T=await import("@/lib/telegram.server");const secret=process.env["LOVABLE_CRON_SECRET"];
  if(!secret || !T.equalSecret(request.headers.get("Authorization")??"",`Bearer ${secret}`))return new Response("Unauthorized",{status:401});
  return Response.json(await T.deliverBriefings());
}}}});