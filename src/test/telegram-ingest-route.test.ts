import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("@/lib/telegram.server",()=>({equalSecret:(a:string,b:string)=>a===b,ingestDeps:async()=>({claim:async()=>true,record:vi.fn(async()=>{}),finish:vi.fn(async()=>{}),link:vi.fn(async()=>{}),findUser:async()=>"u1",activeRole:async()=>"user",button:vi.fn(async()=>"ok"),converse:vi.fn(async()=>({resposta:"Olá",captura:null,pendentes:[]}))})}));
import {Route} from "@/routes/api/public/telegram/ingest";
const post=(Route.options as any).server.handlers.POST;
afterEach(()=>{delete process.env["MUNIM_INGEST_SECRET"];});
describe("POST /api/public/telegram/ingest",()=>{
  it("recusa com 401 quando o secret não está configurado",async()=>{const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"s"},body:"{}"})});expect(r.status).toBe(401);});
  it("recusa com 401 quando o header é diferente",async()=>{process.env["MUNIM_INGEST_SECRET"]="certo";const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"errado"},body:"{}"})});expect(r.status).toBe(401);});
});
