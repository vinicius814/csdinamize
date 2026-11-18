import { createServerFn } from "@tanstack/react-start";
import { requireAdmin } from "./access.middleware";
import { z } from "zod";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), userId: z.string().uuid(), value: z.enum(["pendente", "ativo", "suspenso"]) }),
  z.object({ action: z.literal("role"), userId: z.string().uuid(), value: z.enum(["user", "admin", "superadmin"]) }),
  z.object({ action: z.literal("limit"), userId: z.string().uuid(), value: z.number().finite().min(0).max(100000) }),
  z.object({ action: z.literal("registration"), value: z.boolean() }),
  z.object({ action: z.literal("cs_profile"), userId: z.string().uuid(), value: z.object({ papel: z.enum(["cs","gestor","admin"]), owner: z.number().int().positive().nullable() }) }),
]);
export const LEGADO_ADMIN_DESATIVADO = "Função administrativa legada desativada no Dinamize CS Beta. Use Usuários e permissões.";
export const adminOverview = createServerFn({ method: "POST" }).middleware([requireAdmin]).handler(async ({ context }) => {
  // D37: listagem legada com dados de todos os usuários (custos, conexões); substituída por dcs_listar_usuarios.
  if (process.env["DCS_LEGADO_ADMIN"] !== "1") throw new Error(LEGADO_ADMIN_DESATIVADO);
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  // Every projection below contains account metadata only. Never fetch content.
  async function all(table: "profiles" | "account_access" | "user_roles" | "config_usuario" | "conexoes_pipedrive" | "app_user_connections", columns: string) {
    const rows: any[] = [];
    for (let start = 0; ; start += 1000) {
      const { data, error } = await db.from(table).select(columns).range(start, start + 999);
      if (error) throw error; rows.push(...(data ?? [])); if ((data?.length ?? 0) < 1000) break;
    } return rows;
  }
  const month = new Date(); month.setUTCDate(1); month.setUTCHours(0,0,0,0);
  const [profiles, access, roles, configs, pipes, bots, google, settings] = await Promise.all([
    all("profiles", "id,nome,email,created_at,telegram_chat_id,papel,pipedrive_user_id"), all("account_access", "user_id,status,last_access_at"),
    all("user_roles", "user_id,role"), all("config_usuario", "user_id,onboarding_concluido,limite_custo_usd"),
    all("conexoes_pipedrive", "user_id"), all("telegram_bots" as any, "user_id,status,chat_id"), all("app_user_connections", "user_id,connector_id"),
    db.from("admin_settings").select("manual_approval").eq("id", true).single(),
  ]);
  if (settings.error) throw settings.error;
  const costs: Record<string, number> = {};
  for (let start=0; ; start+=1000) {
    const { data, error } = await db.from("uso").select("user_id,custo_usd").gte("created_at", month.toISOString()).order("id").range(start,start+999);
    if (error) throw error;
    for (const item of data ?? []) if (item.user_id) costs[item.user_id]=(costs[item.user_id] ?? 0)+Number(item.custo_usd ?? 0);
    if ((data?.length ?? 0)<1000) break;
  }
  const users = await Promise.all(profiles.map(async p => {
    const a=access.find(r=>r.user_id===p.id), c=configs.find(r=>r.user_id===p.id);
    const { count, error }=await db.from("mensagens").select("id", { count:"exact", head:true }).eq("user_id",p.id).gte("created_at",month.toISOString());
    if (error) throw error;
    return { id:p.id,nome:p.nome,email:p.email,created_at:p.created_at,status:a?.status ?? "pendente",last_access_at:a?.last_access_at ?? null,
      role:roles.find(r=>r.user_id===p.id)?.role ?? "user",csRole:p.papel,owner:p.pipedrive_user_id,onboarded:c?.onboarding_concluido ?? false,limit:Number(c?.limite_custo_usd ?? 20),
      telegram:(()=>{const b=bots.find(r=>r.user_id===p.id);return b?(b.status==="ativo"&&b.chat_id?"conectado":b.status):"não";})(),pipedrive:pipes.some(r=>r.user_id===p.id),gmail:google.some(r=>r.user_id===p.id && r.connector_id==="google_mail"),
      agenda:google.some(r=>r.user_id===p.id && r.connector_id==="google_calendar"),drive:google.some(r=>r.user_id===p.id && r.connector_id==="google_drive"),messages:count ?? 0,cost:costs[p.id] ?? 0 };
  }));
  const active=(days:number)=>users.filter(u=>u.last_access_at && new Date(u.last_access_at).getTime()>=Date.now()-days*86400000).length;
  const owners=new Map<number,string>();
  for(let start=0;;start+=1000){const {data,error}=await db.from("cs_snapshot").select("owner_id,owner_nome").order("deal_id").range(start,start+999);if(error)throw error;for(const r of data??[])owners.set(r.owner_id,r.owner_nome??String(r.owner_id));if((data?.length??0)<1000)break;}
  return { users, owners:[...owners].map(([id,nome])=>({id,nome})), manualApproval:settings.data.manual_approval, canChangeRoles:context.role==="superadmin", metrics:{ total:users.length,active7:active(7),active30:active(30),pending:users.filter(u=>u.status==="pendente").length,cost:users.reduce((n,u)=>n+u.cost,0) } };
});
export const adminAction = createServerFn({ method:"POST" }).middleware([requireAdmin]).inputValidator(input=>actionSchema.parse(input)).handler(async ({ data, context }) => {
  // D37: segundo caminho de alteração de papéis/status, fora do fluxo de convite e das checagens de dcs_salvar_acesso.
  if (process.env["DCS_LEGADO_ADMIN"] !== "1") throw new Error(LEGADO_ADMIN_DESATIVADO);
  if (data.action==="role" && context.role!=="superadmin") throw new Error("Só o superadmin altera papéis.");
  if ("userId" in data && data.userId===context.userId && (data.action==="role" || data.action==="status")) throw new Error("Não altere seu próprio acesso administrativo.");
  // Atomic mutation + audit; role is verified before privileged access.
  const { supabaseAdmin: db }=await import("@/integrations/supabase/client.server");
  if(data.action==="cs_profile") {const {error}=await db.rpc("cs_atribuir_perfil",{actor:context.userId,target:data.userId,papel_cs:data.value.papel,owner:data.value.owner as number});if(error)throw new Error(error.message);return {ok:true};}
  const { error }=await db.rpc("admin_mutation", { actor:context.userId,target:"userId" in data ? data.userId : context.userId, operation:data.action, value:data.value });
  if(error) throw new Error(error.message); return {ok:true};
});
