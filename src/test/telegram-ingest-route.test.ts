import {describe,it,expect,vi,afterEach} from "vitest";
vi.mock("@/lib/telegram.server",()=>({equalSecret:(a:string,b:string)=>a===b,ingestDeps:async()=>({claim:async()=>true,record:vi.fn(async()=>{}),finish:vi.fn(async()=>{}),link:vi.fn(async()=>{}),findUser:async()=>"u1",activeRole:async()=>"user",button:vi.fn(async()=>"ok"),converse:vi.fn(async()=>({resposta:"Olá",captura:null,pendentes:[]}))})}));
import {Route} from "@/routes/api/public/telegram/ingest";
const post=(Route.options as any).server.handlers.POST;
afterEach(()=>{delete process.env["MUNIM_INGEST_SECRET"];});
describe("POST /api/public/telegram/ingest",()=>{
  it("recusa com 401 quando o secret não está configurado",async()=>{const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"s"},body:"{}"})});expect(r.status).toBe(401);});
  it("recusa com 401 quando o header é diferente",async()=>{process.env["MUNIM_INGEST_SECRET"]="certo";const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"errado"},body:"{}"})});expect(r.status).toBe(401);});
  it("aceita corpo mínimo do Make com números como texto",async()=>{process.env["MUNIM_INGEST_SECRET"]="certo";const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"certo"},body:JSON.stringify({update_id:"1",chat_id:"42",evento:"mensagem",tipo:"texto",texto:"oi"})})});expect(r.status).toBe(200);expect((await r.json()).respostas[0]?.texto).toBe("Olá");});
  it("devolve respostas vazias e registra o campo inválido sem revelar o conteúdo",async()=>{process.env["MUNIM_INGEST_SECRET"]="certo";const log=vi.spyOn(console,"error").mockImplementation(()=>{});const r=await post({request:new Request("http://x",{method:"POST",headers:{"X-Munim-Secret":"certo"},body:JSON.stringify({update_id:"1",evento:"mensagem",tipo:"texto",texto:"conteudo-secreto"})})});expect(r.status).toBe(200);expect(await r.json()).toEqual({respostas:[],callback:null});expect(log).toHaveBeenCalledWith("ingest: corpo inválido:",expect.stringContaining("chat_id"));expect(log.mock.calls.map(c=>c.join(" ")).join()).not.toContain("conteudo-secreto");log.mockRestore();});
});
