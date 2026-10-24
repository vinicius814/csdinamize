import { describe,it,expect,vi,afterEach } from "vitest";
const rpc=vi.hoisted(()=>vi.fn());const eq=vi.hoisted(()=>vi.fn(()=>({eq:vi.fn().mockResolvedValue({error:null})})));const update=vi.hoisted(()=>vi.fn(()=>({eq}))); 
vi.mock("@/integrations/supabase/client.server",()=>({supabaseAdmin:{rpc,from:()=>({update})}}));
import { runCSSync } from "@/lib/cs-sync.server";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe("Sincronização central CS",()=>{
 it("publica somente após todas as leituras, sem escritas Pipedrive",async()=>{
  vi.stubEnv("PIPEDRIVE_SYNC_TOKEN","test-only");vi.stubEnv("PIPEDRIVE_SYNC_DOMAIN","cs-dinamize");rpc.mockResolvedValueOnce({data:"run",error:null}).mockResolvedValue({error:null});
  const get=vi.fn(async(input:URL,init:RequestInit)=>{expect(init.method).toBeUndefined();const isUsers=input.pathname.endsWith("users");return Response.json({success:true,data:isUsers?[{id:17273704,name:"CS"}]:[],additional_data:{next_cursor:null,pagination:{more_items_in_collection:false}}});});vi.stubGlobal("fetch",get);
  const result=await runCSSync("agendado");expect(result.status).toBe("sucesso");expect(get).toHaveBeenCalledTimes(10);expect(rpc).toHaveBeenLastCalledWith("cs_publicar_snapshot",{run:"run",rows:[],lidos:0});
 });
 it("paginação incompleta preserva snapshot e registra falha",async()=>{
  vi.stubEnv("PIPEDRIVE_SYNC_TOKEN","test-only");vi.stubEnv("PIPEDRIVE_SYNC_DOMAIN","cs-dinamize");rpc.mockResolvedValue({data:"run",error:null});vi.stubGlobal("fetch",vi.fn(async(input:URL)=>Response.json({success:true,data:input.pathname.endsWith("users")?[{id:1,name:"CS"}]:[]})));
  await expect(runCSSync("agendado")).rejects.toThrow("Paginação incompleta");expect(rpc).toHaveBeenCalledTimes(1);expect(update).toHaveBeenCalledWith(expect.objectContaining({status:"falha"}));
 });
 it("bloqueio persistente impede novo manual dentro de dez minutos",async()=>{
  rpc.mockResolvedValue({data:null,error:{message:"Aguarde 10 minutos entre atualizações manuais"}});const get=vi.fn();vi.stubGlobal("fetch",get);await expect(runCSSync("manual","user")).rejects.toThrow("10 minutos");expect(get).not.toHaveBeenCalled();
 });
});