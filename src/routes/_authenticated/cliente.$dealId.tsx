import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { cliente360 } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { CS_PIPELINES, CS_STAGES, csDias, csEhReuniao, csEstadoReuniao } from "@/lib/cs-rules";
import { money, fmt } from "@/components/munim/CSWorkspace";
import { RiscoBadge } from "@/components/munim/RiscoBadge";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";

export const Route=createFileRoute("/_authenticated/cliente/$dealId")({head:()=>({meta:[{title:"Cliente 360 — Munim CS"},{name:"description",content:"Visão completa do cliente na Central CS Dinamize: contrato, contato, atividades e risco."},{property:"og:title",content:"Cliente 360 — Munim CS"},{property:"og:description",content:"Visão 360 do cliente de Customer Success."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Cliente360});

function Item({k,v}:{k:string;v:React.ReactNode}){return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="mt-1 break-words text-sm">{v}</dd></div>;}
function Cliente360(){
 const {dealId}=Route.useParams();const {session}=useAuth();const read=useServerFn(cliente360);
 const q=useQuery({queryKey:["cs-360",session?.user.id,dealId],queryFn:()=>read({data:{dealId:Number(dealId)}}),staleTime:10*60_000});
 if(q.isPending)return <Pagina><PageSkeleton/></Pagina>;
 if(q.error)return <Pagina><p role="alert" className="text-destructive">{q.error.message}</p></Pagina>;
 const r=q.data.row;
 if(!r)return <Pagina><Cabecalho titulo="Cliente não encontrado" frase="Este cliente não existe na base atual ou não está no seu escopo."/><Button variant="outline" asChild><Link to="/carteira"><ArrowLeft/>Voltar</Link></Button></Pagina>;
 const det=q.data.detalhe;
 const reuniaoConcluida=det?.concluidas.find(a=>a.reuniao&&a.tipo!=="no_show_implementao")?.data??null;
 const realizada=[r.ultima_reuniao_cs,reuniaoConcluida].filter((x):x is string=>!!x).sort().at(-1)??null;
 const agendada=det?.abertas.find(a=>a.reuniao&&a.tipo!=="no_show_implementao")??null;
 const hoje=new Date().toISOString().slice(0,10);
 const linha=[...(det?.concluidas??[]).map(a=>({data:a.data,texto:`${a.tipo==="no_show_implementao"?"Reunião não realizada":a.reuniao?"Reunião concluída":"Atividade concluída"} · ${a.assunto}`})),...(r.ultimo_email_recebido?[{data:r.ultimo_email_recebido.slice(0,10),texto:"E-mail recebido do cliente"}]:[]),...(r.ultimo_email_enviado?[{data:r.ultimo_email_enviado.slice(0,10),texto:"E-mail enviado ao cliente"}]:[])].filter(x=>x.data).sort((a,b)=>String(b.data).localeCompare(String(a.data)));
 return <Pagina><Cabecalho titulo={r.org_nome??r.titulo} frase={`${CS_PIPELINES[r.pipeline_id as 15|16|1]} · ${r.titulo}`}/>
 <div className="mb-6 flex flex-wrap items-center gap-3"><RiscoBadge cor={r.risco_cor} fatores={r.risco_fatores}/><Button variant="outline" size="sm" asChild><Link to="/retornos" search={{q:r.org_nome??r.titulo}}>Retornos do cliente</Link></Button><Button variant="outline" size="sm" asChild><a href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer"><ExternalLink/>Abrir no Pipedrive</a></Button></div>
 {!!r.risco_fatores?.length&&<section className="card-munim mb-6 p-4"><h2 className="mb-2 text-sm font-medium">Fatores do termômetro</h2><ul className="list-disc pl-5 text-sm text-muted-foreground">{r.risco_fatores.map(f=><li key={f}>{f}</li>)}</ul></section>}
 <dl className="card-munim mb-6 grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
  <Item k="Responsável" v={r.owner_nome??"sem dados"}/><Item k="MRR" v={money(r.valor)}/><Item k="Status contratual" v={CS_STAGES[r.stage_id]??r.stage_id}/><Item k="Data de contratação" v={fmt(r.data_contratacao)}/>
  <Item k="Perfil da conta" v={r.perfil_conta??"sem dados"}/><Item k="Último contato efetivo" v={r.contato_efetivo?`${fmt(r.contato_efetivo)} · ${csDias(r.contato_efetivo)} dias · ${r.origem_contato}`:"sem dados"}/>
  <Item k="Última reunião realizada" v={realizada?fmt(realizada):"sem dados"}/><Item k="Próxima reunião agendada" v={agendada?`${fmt(agendada.data)} · ${agendada.assunto}`:det?"nenhuma agendada":"sem dados"}/>
  <Item k="Atividades abertas" v={r.atividades_abertas??"sem dados"}/><Item k="Atividades atrasadas" v={r.atividades_vencidas}/><Item k="Retorno pendente" v={r.retorno_dias!==null&&r.retorno_dias!==undefined?`cliente aguardando há ${r.retorno_dias} dias`:"nenhum"}/><Item k="Último e-mail" v={`recebido ${fmt(r.ultimo_email_recebido)} · enviado ${fmt(r.ultimo_email_enviado)}`}/>
 </dl>
 {q.data.erro&&<p role="alert" className="mb-4 text-sm text-warning">Atividades e notas indisponíveis agora: {q.data.erro}</p>}
 <div className="grid gap-6 lg:grid-cols-2">
  <section><h2 className="mb-3 font-display text-lg">Atividades abertas</h2>{det?det.abertas.length?<ul className="divide-y divide-border border-y border-border">{det.abertas.map(a=><li key={a.id} className="flex justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{a.reuniao?"Reunião agendada · ":""}{a.assunto}</span><span className={a.data&&a.data<hoje?"text-destructive":"text-muted-foreground"}>{fmt(a.data)}</span></li>)}</ul>:<p className="text-sm text-muted-foreground">Nenhuma atividade aberta.</p>:<p className="text-sm text-muted-foreground">sem dados</p>}</section>
  <section><h2 className="mb-3 font-display text-lg">Histórico resumido</h2>{linha.length?<ol className="border-l border-border pl-4">{linha.map((x,i)=><li key={i} className="mb-3 text-sm"><span className="text-xs text-muted-foreground">{fmt(x.data)}</span><p>{x.texto}</p></li>)}</ol>:<p className="text-sm text-muted-foreground">sem dados</p>}</section>
  <section><h2 className="mb-3 font-display text-lg">Reuniões</h2>{(()=>{const rs=(q.data.atividadesCache??[]).filter(a=>csEhReuniao(a.tipo));return rs.length?<ul className="divide-y divide-border border-y border-border">{rs.map(a=>{const e=csEstadoReuniao(a);return <li key={a.activity_id} className="flex justify-between gap-3 py-2 text-sm"><span className="min-w-0 truncate">{a.assunto}</span><span className={e==="encerrada_nao_confirmada"||e==="nao_realizada"?"text-warning":"text-muted-foreground"}>{fmt(a.dia)} · {e==="realizada"?"realizada":e==="agendada"?"agendada":e==="nao_realizada"?"não realizada":"horário encerrado, não confirmada"}</span></li>;})}</ul>:<p className="text-sm text-muted-foreground">Nenhuma reunião nos últimos 30 dias ou próximos 14.</p>;})()}</section>
  <section><h2 className="mb-3 font-display text-lg">Últimos e-mails</h2>{det?.emails?.length?<ul className="divide-y divide-border border-y border-border">{det.emails.map(m=><li key={m.id} className="py-2 text-sm"><span className="text-xs text-muted-foreground">{fmt(m.data)} · {m.direcao} · {m.remetente}</span><p className="truncate">{m.assunto}</p></li>)}</ul>:<p className="text-sm text-muted-foreground">{det?"Sem e-mail vinculado.":"sem dados"}</p>}</section>
  <section className="lg:col-span-2"><h2 className="mb-3 font-display text-lg">Últimas notas</h2>{det?det.notas.length?<ul className="grid gap-3">{det.notas.map((n:{id:number;data:string|null;resumo:string})=><li key={n.id} className="card-munim p-3 text-sm"><span className="text-xs text-muted-foreground">{fmt(n.data)}</span><p className="mt-1">{n.resumo||"(nota sem texto)"}</p></li>)}</ul>:<p className="text-sm text-muted-foreground">Nenhuma nota.</p>:<p className="text-sm text-muted-foreground">sem dados</p>}</section>
 </div></Pagina>;
}
