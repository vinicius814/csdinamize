import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, ArrowUpDown, Search } from "lucide-react";
import { retornosCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { CS_PIPELINES, csDia } from "@/lib/cs-rules";
import { useCSData, UltimaAtualizacao, money, selectStyle } from "@/components/munim/CSWorkspace";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Input } from "@/components/ui/input";

export const Route=createFileRoute("/_authenticated/retornos")({
 validateSearch:(s:Record<string,unknown>)=>({q:typeof s["q"]==="string"?s["q"]:""}),
 head:()=>({meta:[{title:"Retornos pendentes — Munim CS"},{name:"description",content:"Tarefas de retorno e follow-up abertas no Pipedrive, por cliente, responsável e tempo de espera."},{property:"og:title",content:"Retornos pendentes — Munim CS"},{property:"og:description",content:"Retornos pendentes da operação de Customer Success."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),
 component:Retornos});

type Retorno={activity_id:number;deal_id:number;pipeline_id:number;tipo:string;assunto:string;dia:string|null;inicio:string|null;cliente:string;owner_nome:string|null;valor:number|null};
type Ordem="tempo"|"mrr"|"responsavel"|"cliente"|"data";
const faixa=(d:number|null)=>d===null?"sem_data":d<=2?"0-2":d<=7?"3-7":d<=15?"8-15":"15+";
const FAIXAS:[string,string][]=[["0-2","Até 2 dias"],["3-7","3 a 7 dias"],["8-15","8 a 15 dias"],["15+","Acima de 15 dias"]];

function Retornos(){
 const {session}=useAuth();const cs=useCSData();const fn=useServerFn(retornosCS);
 const {q:buscaInicial}=Route.useSearch();
 const q=useQuery({queryKey:["cs-retornos",session?.user.id,cs.data?.lastSuccess],enabled:!!cs.data,queryFn:()=>fn(),staleTime:60_000});
 const [pipeline,setPipeline]=useState("both"),[owner,setOwner]=useState(""),[atraso,setAtraso]=useState(""),[fx,setFx]=useState(""),[busca,setBusca]=useState(buscaInicial),[ordem,setOrdem]=useState<Ordem>("tempo");
 const hoje=csDia();
 const lista=useMemo(()=>{
  const rows=(q.data??[]) as Retorno[];
  const idade=(r:Retorno)=>{const base=r.dia??r.inicio?.slice(0,10)??null;return base?Math.floor((Date.parse(hoje+"T12:00:00Z")-Date.parse(base+"T12:00:00Z"))/86400000):null;};
  const t=busca.toLowerCase();
  const vis=rows.filter(r=>(pipeline==="both"||r.pipeline_id===Number(pipeline))&&(!owner||r.owner_nome===owner)&&(!t||r.cliente.toLowerCase().includes(t))&&(!fx||faixa(idade(r))===fx)&&(!atraso||(atraso==="vencidos"?r.dia!==null&&r.dia<hoje:r.dia===null||r.dia>=hoje)));
  const val=(r:Retorno,o:Ordem):number|string=>o==="tempo"?idade(r)??-99999:o==="mrr"?r.valor??-1:o==="responsavel"?r.owner_nome??"~":o==="cliente"?r.cliente.toLowerCase():r.dia??"";
  return [...vis].sort((a,b)=>{const x=val(a,ordem),y=val(b,ordem);return typeof x==="string"?x.localeCompare(String(y),"pt-BR"):(y as number)-(x as number);}).map(r=>({...r,idade:idade(r)}));
 },[q.data,pipeline,owner,atraso,fx,busca,ordem,hoje]);
 if(cs.isPending||q.isPending)return <Pagina larga><PageSkeleton/></Pagina>;
 if(q.error)return <Pagina larga><p role="alert" className="text-destructive">Falha de leitura: {q.error.message}</p></Pagina>;
 const todos=(q.data??[]) as Retorno[];
 const owners=[...new Set(todos.map(r=>r.owner_nome).filter((x):x is string=>!!x))].sort((a,b)=>a.localeCompare(b,"pt-BR"));
 const clientesUnicos=new Set(todos.map(r=>r.deal_id)).size;
 const vencidos=todos.filter(r=>r.dia!==null&&r.dia<hoje).length;
 const mrr=todos.some(r=>r.valor===null)?null:todos.reduce((s,r)=>s+Number(r.valor),0);
 return <Pagina larga><Cabecalho titulo="Retornos pendentes" frase="Tarefas de retorno e follow-up abertas no Pipedrive. Somente consulta: conclua a tarefa no Pipedrive."/>
 <div className="mb-5 border-b border-border pb-4"><UltimaAtualizacao d={cs.data}/></div>
 <section className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
  {[["Retornos pendentes",todos.length],["Clientes com pendência",clientesUnicos],["Vencidos",vencidos],["MRR associado",mrr===null?"parcial (há negócios sem valor)":money(mrr)]].map(([l,v])=><div key={String(l)} className="card-munim p-3.5"><p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{l}</p><p className="mt-1.5 truncate font-display text-xl">{v}</p></div>)}
 </section>
 <div className="mb-3 flex flex-wrap items-center gap-2">
  <div className="relative min-w-48 flex-1 sm:max-w-xs"><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input className="h-9 pl-8" aria-label="Buscar cliente" placeholder="Buscar cliente" value={busca} onChange={e=>setBusca(e.target.value)}/></div>
  <select aria-label="Carteira" className={selectStyle} value={pipeline} onChange={e=>setPipeline(e.target.value)}><option value="both">Todas as carteiras</option><option value="15">Customer Success</option><option value="16">Perfil D</option><option value="1">Onboarding</option></select>
  <select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>setOwner(e.target.value)}><option value="">Todos os responsáveis</option>{owners.map(n=><option key={n} value={n}>{n}</option>)}</select>
  <select aria-label="Vencimento" className={selectStyle} value={atraso} onChange={e=>setAtraso(e.target.value)}><option value="">Vencimento: todos</option><option value="vencidos">Vencidos</option><option value="prazo">No prazo / sem data</option></select>
  <select aria-label="Antiguidade" className={selectStyle} value={fx} onChange={e=>setFx(e.target.value)}><option value="">Antiguidade: todas</option>{FAIXAS.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
  <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground"><ArrowUpDown className="h-3.5 w-3.5"/><select aria-label="Ordenar" className={selectStyle} value={ordem} onChange={e=>setOrdem(e.target.value as Ordem)}><option value="tempo">Maior tempo pendente</option><option value="mrr">Maior MRR</option><option value="responsavel">Responsável</option><option value="cliente">Cliente</option><option value="data">Data da atividade</option></select></label>
 </div>
 <p className="mb-2 text-xs text-muted-foreground">{lista.length} retornos · antiguidade conta da data da atividade; vencimento é a data agendada no Pipedrive.</p>
 <div className="overflow-x-auto rounded-lg border border-border"><table className="w-full text-left text-sm"><thead className="bg-muted/30 text-[11px] uppercase tracking-wide text-muted-foreground"><tr>{["Cliente","Carteira","Responsável","MRR","Tarefa","Data","Tempo pendente","Situação",""].map(t=><th key={t} className="whitespace-nowrap px-3 py-2.5 font-medium">{t}</th>)}</tr></thead>
 <tbody>{lista.map(r=><tr key={r.activity_id} className="border-t border-border hover:bg-accent/40">
  <td className="max-w-52 truncate px-3 py-2.5"><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="font-medium hover:text-primary">{r.cliente}</Link></td>
  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{CS_PIPELINES[r.pipeline_id as 15|16|1]??r.pipeline_id}</td>
  <td className="max-w-32 truncate px-3 py-2.5 text-muted-foreground">{r.owner_nome??"—"}</td>
  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{money(r.valor)}</td>
  <td className="max-w-64 truncate px-3 py-2.5" title={r.assunto}>{r.assunto}</td>
  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{r.dia?r.dia.slice(8,10)+"/"+r.dia.slice(5,7):"sem data"}</td>
  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{r.idade===null?"sem data":r.idade<0?`em ${-r.idade}d`:r.idade===0?"hoje":`há ${r.idade}d`}</td>
  <td className="whitespace-nowrap px-3 py-2.5">{r.dia!==null&&r.dia<hoje?<span className="text-destructive">vencido</span>:<span className="text-muted-foreground">no prazo</span>}</td>
  <td className="px-2"><a className="text-muted-foreground hover:text-primary" href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.cliente} no Pipedrive`}><ExternalLink className="h-4 w-4"/></a></td>
 </tr>)}</tbody></table>
 {!lista.length&&<p className="py-10 text-center text-sm text-muted-foreground">Nenhum retorno pendente nestes filtros.</p>}</div>
</Pagina>;
}
