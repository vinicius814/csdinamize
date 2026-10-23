import {describe,it,expect,vi} from "vitest";
import {briefingDue,retrySend,SEND_ATTEMPTS,telegramCodeExpires,telegramCodeValid,splitResposta,sendViaMake,EMPTY_MARKUP,telegramAvailable} from "@/lib/telegram-rules";
import {processIngest,MSG,type IngestDeps,type Ingest} from "@/lib/telegram-ingest";

const base:Ingest={update_id:1,chat_id:42,username:"vini",evento:"mensagem",tipo:"texto",texto:"oi",legenda:null,arquivo:null,extracao_erro:null,callback_data:null,callback_id:null,message_id:null};
function deps(over:Partial<IngestDeps>={}){
  const seen=new Set<number>();
  const d:IngestDeps={claim:async id=>{if(seen.has(id))return false;seen.add(id);return true;},record:vi.fn(async()=>{}),finish:vi.fn(async()=>{}),link:vi.fn(async()=>{}),findUser:async()=>"u1",activeRole:async()=>"user",button:vi.fn(async()=>"Ação executada."),converse:vi.fn(async()=>({resposta:"Olá",captura:null,pendentes:[]})),...over};
  return d;
}
describe("Telegram",()=>{
  it("expira o vínculo exatamente em 15 minutos",()=>{const now=Date.parse("2026-10-23T17:21:00Z");const expiry=telegramCodeExpires(now);expect(expiry).toBe("2026-10-23T17:36:00.000Z");expect(telegramCodeValid(expiry,now+899999)).toBe(true);expect(telegramCodeValid(expiry,now+900000)).toBe(false);});
  it("tenta enviar no máximo três vezes",()=>{expect(SEND_ATTEMPTS).toBe(3);expect(retrySend(503,2)).toBe(true);expect(retrySend(503,3)).toBe(false);expect(retrySend(403,1)).toBe(false);});
  it("respeita horário e fuso do usuário",()=>{expect(briefingDue(new Date("2026-10-23T10:30:00Z"),"America/Sao_Paulo","07:30:00")).toEqual({date:"2026-10-23",due:true});});
  it("divide textos acima de 3.900 caracteres e põe botões só na última parte",()=>{const r=splitResposta("a".repeat(7801),{inline_keyboard:[[{text:"x"}]]});expect(r.map(p=>p.texto.length)).toEqual([3900,3900,1]);expect(r[0]?.reply_markup).toBe(EMPTY_MARKUP);expect(JSON.parse(r[2]!.reply_markup).inline_keyboard[0][0].text).toBe("x");});
  it("só fica disponível com os três secrets",()=>{expect(telegramAvailable({MUNIM_INGEST_SECRET:"a",MAKE_TELEGRAM_SEND_URL:"b"})).toBe(false);expect(telegramAvailable({MUNIM_INGEST_SECRET:"a",MAKE_TELEGRAM_SEND_URL:"b",TELEGRAM_BOT_USERNAME:"c"})).toBe(true);});
  it("envia pelo Make com chat_id, texto e reply_markup e repete falhas temporárias",async()=>{
    const fetch=vi.fn().mockResolvedValueOnce(new Response("",{status:503})).mockResolvedValue(new Response("ok"));const sleep=vi.fn(async()=>{});
    await sendViaMake("https://hook.make/x",42,"Bom dia",undefined,{fetch,sleep});
    expect(fetch).toHaveBeenCalledTimes(2);expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({chat_id:42,texto:"Bom dia",reply_markup:EMPTY_MARKUP});expect(sleep).toHaveBeenCalledWith(2000);
  });
  it("desiste do Make após três tentativas",async()=>{const fetch=vi.fn(async()=>new Response("",{status:500}));await expect(sendViaMake("u",1,"x",undefined,{fetch,sleep:async()=>{}})).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(3);});
});
describe("Endpoint de entrada",()=>{
  it("vincula com /start <codigo>",async()=>{const d=deps();const r=await processIngest({...base,tipo:"comando",texto:"/start abc123"},d);expect(d.link).toHaveBeenCalledWith("abc123",42,"vini");expect(r.respostas[0]?.texto).toBe(MSG.linked);});
  it("orienta chat não vinculado",async()=>{const r=await processIngest(base,deps({findUser:async()=>null}));expect(r.respostas[0]?.texto).toBe(MSG.unlinked);});
  it("bloqueia conta não ativa",async()=>{const r=await processIngest(base,deps({activeRole:async()=>null}));expect(r.respostas[0]?.texto).toBe(MSG.inactive);});
  it("responde texto com captura e ações pendentes",async()=>{const r=await processIngest(base,deps({converse:async()=>({resposta:"Feito",captura:{id:"c1",tipo:"ideia",titulo:"App"},pendentes:[{id:"a1",resumo:"Enviar e-mail"}]})}));expect(r.respostas.map(x=>x.texto)).toEqual(["Feito","Salvei: ideia · App","Enviar e-mail"]);expect(r.respostas[2]?.reply_markup).toContain("aprovada:a1");expect(r.callback).toBeNull();});
  it("pede reenvio quando a extração da mídia falhou",async()=>{const d=deps();const r=await processIngest({...base,tipo:"voz",texto:"",extracao_erro:"timeout"},d);expect(r.respostas[0]?.texto).toBe(MSG.extraction);expect(d.converse).not.toHaveBeenCalled();expect(d.finish).toHaveBeenCalledWith(1,"erro","timeout");});
  it("guarda tipo e file_id da mídia como contexto",async()=>{const d=deps();await processIngest({...base,tipo:"foto",texto:"recibo",legenda:"almoço",arquivo:{file_id:"F1",mime:"image/jpeg",nome:null,tamanho:10}},d);expect(d.converse).toHaveBeenCalledWith("u1","user","almoço\n\nrecibo",{origem_tipo:"foto",file_id:"F1"});});
  it("trata botão aprovar devolvendo callback e limpando botões",async()=>{const d=deps();const r=await processIngest({...base,evento:"botao",texto:"",callback_data:"aprovada:11111111-1111-1111-1111-111111111111",callback_id:"cb"},d);expect(d.button).toHaveBeenCalledWith("u1","user","aprovada:11111111-1111-1111-1111-111111111111");expect(r).toEqual({respostas:[],callback:{texto:"Ação executada.",limpar_botoes:true}});});
  it("ignora update repetido",async()=>{const d=deps();await processIngest(base,d);const r=await processIngest(base,d);expect(r).toEqual({respostas:[],callback:null});expect(d.converse).toHaveBeenCalledTimes(1);});
});
