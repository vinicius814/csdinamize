export async function checkBudget(userId:string){
 const {supabaseAdmin:db}=await import("@/integrations/supabase/client.server");
 const {data:config,error}=await db.from("config_usuario").select("limite_custo_usd").eq("user_id",userId).maybeSingle();if(error)throw error;
 const month=new Date();month.setUTCDate(1);month.setUTCHours(0,0,0,0);let cost=0;
 for(let start=0;;start+=1000){const{data,error}=await db.from("uso").select("custo_usd").eq("user_id",userId).gte("created_at",month.toISOString()).order("id").range(start,start+999);if(error)throw error;cost+=(data??[]).reduce((n,u)=>n+Number(u.custo_usd??0),0);if((data?.length??0)<1000)break;}
 if(cost>=Number(config?.limite_custo_usd??20))throw new Error("Seu limite mensal de IA foi atingido.");
}
