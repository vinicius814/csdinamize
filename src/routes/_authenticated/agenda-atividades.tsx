import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { agendaCS, googleAgendaCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { useCSData, UltimaAtualizacao, money, fmt, selectStyle } from "@/components/munim/CSWorkspace";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";
import { CS_PIPELINES, csDia, csEhReuniao, csEstadoReuniao, csClientes } from "@/lib/cs-rules";

export const Route=createFileRoute("/_authenticated/agenda-atividades")({head:()=>({meta:[{title:"Agenda e atividades — Munim CS"},{name:"description",content:"Agenda do dia e da semana, reuniões e pendências de e-mail da Central CS Dinamize."},{property:"og:title",content:"Agenda e atividades — Munim CS"},{property:"og:description",content:"Agenda e pendências de e-mail de Customer Success."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Agenda});
const tipoLabel=(t:string)=>csEhReuniao(t)?"Reunião":/call|liga/i.test(t)?"Ligação":/tarefa|task/i.test(t)?"Tarefa":"Outra";
const addDias=(d:string,n:number)=>new Date(Date.parse(d+"T12:00:00Z")+n*86400000).toISOString().slice(0,10);
function Agenda(){
 const {session}=useAuth();const cs=useCSData();const read=useServerFn(agendaCS),google=useServerFn(googleAgendaCS);
 const hoje=csDia();const [aba,setAba]=useState<"agenda"|"emails">("agenda");const [periodo,setPeriodo]=useState("semana"),[pipeline,setPipeline]=useState(""),[owner,setOwner]=useState(""),[tipo,setTipo]=useState("");
 const range=periodo==="hoje"?{from:hoje,to:hoje}:periodo==="semana"?{from:hoje,to:addDias(hoje,6)}:periodo==="14d"?{from:hoje,to:addDias(hoje,14)}:{from:addDias(hoje,-30),to:addDias(hoje,-1)};
 const a=useQuery({queryKey:["cs-agenda",session?.user.id,range.from,range.to,cs.data?.lastSuccess],queryFn:()=>read({data:range})});
 const venc=useQuery({queryKey:["cs-agenda-venc",session?.user.id,cs.data?.lastSuccess],queryFn:()=>read({data:{from:addDias(hoje,-30),to:addDias(hoje,-1)}})});
 const g=useQuery({queryKey:["cs-google",session?.user.id,range.from,range.to],queryFn:()=>google({data:range}),staleTime:5*60_000});
 if(cs.isPending)return <Pagina><PageSkeleton/></Pagina>;
 const deals=new Map((cs.data?.rows??[]).map(r=>[r.deal_id,r]));
 const owners=[...new Map((cs.data?.rows??[]).map(r=>[r.owner_id,r.owner_nome??String(r.owner_id)])).entries()];
 const filt=(x:{pipeline_id:number;owner_id:number;tipo:string})=>(!pipeline||x.pipeline_id===Number(pipeline))&&(!owner||x.owner_id===Number(owner))&&(!tipo||tipoLabel(x.tipo)===tipo);
 const lista=(a.data??[]).filter(filt);const vencidas=(venc.data??[]).filter(x=>!x.concluida).filter(filt);
 const pend=csClientes((cs.data?.rows??[]).filter(r=>(!pipeline||r.pipeline_id===Number(pipeline))&&(!owner||r.owner_id===Number(owner)))).filter(c=>c.rows.some(r=>r.email_status==="aguardando_resposta")).map(c=>({c,dias:Math.max(...c.rows.map(r=>r.retorno_dias??0))})).sort((x,y)=>y.dias-x.dias||(y.c.mrr??0)-(x.c.mrr??0));
 const linha=(x:typeof lista[number],destaque=false)=>{const d=deals.get(x.deal_id);const est=csEhReuniao(x.tipo)?csEstadoReuniao(x):null;return <tr key={x.activity_id} className="border-t border-border"><td className="px-3 py-2 whitespace-nowrap">{fmt(x.dia)}{x.inicio&&` ${new Date(x.inicio).toLocaleTimeString("pt-BR",{timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit"})}`}</td><td className="px-3 py-2">{tipoLabel(x.tipo)}</td><td className="px-3 py-2">{x.assunto}</td><td className="px-3 py-2">{d?<Link to="/cliente/$dealId" params={{dealId:String(x.deal_id)}} className="text-primary hover:underline">{d.org_nome??d.titulo}</Link>:"sem dados"}</td><td className="px-3 py-2">{d?.owner_nome??"sem dados"}</td><td className={`px-3 py-2 ${destaque?"text-destructive":""}`}>{destaque?"Vencida":x.concluida?(est?"Reunião realizada":"Concluída"):est==="encerrada_nao_confirmada"?"Horário encerrado, não confirmada":"Aberta"}</td><td className="px-3 py-2"><a className="text-primary hover:underline" href={`https://cs-dinamize.pipedrive.com/deal/${x.deal_id}`} target="_blank" rel="noreferrer">Pipedrive</a></td></tr>;};
 const head=<thead className="text-xs text-muted-foreground"><tr>{["Quando","Tipo","Assunto","Cliente","Responsável","Situação",""].map(t=><th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr></thead>;
 return <Pagina><Cabecalho titulo="Agenda e atividades" frase="Atividades do Pipedrive e pendências de e-mail."/>
 <div className="mb-4 border-b border-border pb-4"><UltimaAtualizacao d={cs.data}/></div>
 <div className="mb-4 flex gap-2"><Button variant={aba==="agenda"?"default":"outline"} onClick={()=>setAba("agenda")}>Agenda</Button><Button variant={aba==="emails"?"default":"outline"} onClick={()=>setAba("emails")}>Pendências de e-mail ({pend.length})</Button></div>
 <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
  <label className="grid gap-1 text-xs text-muted-foreground">Carteira<select className={selectStyle} value={pipeline} onChange={e=>setPipeline(e.target.value)}><option value="">Todas</option><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="1">Onboarding</option></select></label>
  <label className="grid gap-1 text-xs text-muted-foreground">Responsável<select className={selectStyle} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os permitidos</option>{owners.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>
  {aba==="agenda"&&<><label className="grid gap-1 text-xs text-muted-foreground">Tipo<select className={selectStyle} value={tipo} onChange={e=>setTipo(e.target.value)}><option value="">Todos</option>{["Reunião","Ligação","Tarefa","Outra"].map(t=><option key={t}>{t}</option>)}</select></label>
  <label className="grid gap-1 text-xs text-muted-foreground">Período<select className={selectStyle} value={periodo} onChange={e=>setPeriodo(e.target.value)}><option value="hoje">Hoje</option><option value="semana">Próximos 7 dias</option><option value="14d">Próximos 14 dias</option><option value="passado">Últimos 30 dias</option></select></label></>}
 </div>
 {aba==="agenda"?<>
  {!!vencidas.length&&<section className="mb-6"><h2 className="mb-2 font-display text-lg text-destructive">Atividades vencidas ({vencidas.length})</h2><div className="overflow-x-auto border-y border-border"><table className="w-full text-left text-sm">{head}<tbody>{vencidas.slice(0,50).map(x=>linha(x,true))}</tbody></table></div></section>}
  <div className="overflow-x-auto border-y border-border"><table className="w-full text-left text-sm">{head}<tbody>{lista.map(x=>linha(x))}</tbody></table>{!lista.length&&<p className="py-8 text-center text-sm text-muted-foreground">{a.isPending?"Carregando…":"Nenhuma atividade neste período."}</p>}</div>
  <section className="mt-8"><h2 className="mb-2 font-display text-lg">Sua Google Agenda</h2>{g.data?.conectado===false?<p className="text-sm text-muted-foreground">Opcional: conecte sua Google Agenda em <Link to="/conexoes" className="text-primary hover:underline">Conexões</Link> para ver seus eventos aqui. Só você vê sua agenda.</p>:g.data&&"erro" in g.data&&g.data.erro?<p className="text-sm text-warning">{g.data.erro}</p>:<ul className="divide-y divide-border border-y border-border">{(g.data?.eventos??[]).map((e,i)=>{const d=e.deal_id?deals.get(e.deal_id):null;return <li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span>{e.dia_todo?fmt(e.inicio):new Date(e.inicio).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"})} · {e.titulo}</span><span className="text-muted-foreground">{d?<Link to="/cliente/$dealId" params={{dealId:String(e.deal_id)}} className="text-primary hover:underline">{d.org_nome??d.titulo}</Link>:"sem cliente"}</span></li>;})}</ul>}</section>
 </>:<div className="overflow-x-auto border-y border-border"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{["Cliente","Carteira","Responsável","Aguardando há","MRR"].map(t=><th key={t} className="px-3 py-2 font-medium">{t}</th>)}</tr></thead><tbody>{pend.map(({c,dias})=>{const r=c.rows[0]!;return <tr key={c.key} className="border-t border-border"><td className="px-3 py-2"><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="text-primary hover:underline">{r.org_nome??r.titulo}</Link></td><td className="px-3 py-2">{CS_PIPELINES[c.pipeline_id as 15|16]}</td><td className="px-3 py-2">{r.owner_nome}</td><td className="px-3 py-2">{dias} dias</td><td className="px-3 py-2">{money(c.mrr)}</td></tr>;})}</tbody></table>{!pend.length&&<p className="py-8 text-center text-sm text-muted-foreground">Nenhum cliente aguardando resposta.</p>}</div>}
 </Pagina>;
}
