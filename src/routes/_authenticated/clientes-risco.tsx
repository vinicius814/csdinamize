import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { useCSData, UltimaAtualizacao, money, selectStyle } from "@/components/munim/CSWorkspace";
import { RiscoBadge } from "@/components/munim/RiscoBadge";
import { Pagina, Cabecalho } from "@/components/munim/PaginaVazia";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { Button } from "@/components/ui/button";
import { CS_PIPELINES, csClientes, csResponsaveisAtivos } from "@/lib/cs-rules";

export const Route=createFileRoute("/_authenticated/clientes-risco")({validateSearch:(s:Record<string,unknown>):{pipeline?:string|undefined;owner?:string|undefined;cor?:"vermelho"|"amarelo"|undefined}=>({pipeline:["15","16","both"].includes(String(s["pipeline"]))?String(s["pipeline"]):undefined,owner:/^\d+$/.test(String(s["owner"]??""))?String(s["owner"]):undefined,cor:s["cor"]==="vermelho"||s["cor"]==="amarelo"?s["cor"]:undefined}),head:()=>({meta:[{title:"Clientes em risco — Dinamize CS"},{name:"description",content:"Clientes em risco e em atenção da Central CS Dinamize, ordenados por MRR."},{property:"og:title",content:"Clientes em risco — Dinamize CS"},{property:"og:description",content:"Clientes em risco na Central de Comando CS."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:ClientesRisco});

function ClientesRisco(){
 const q=useCSData();const ctx=Route.useSearch();const navigate=useNavigate({from:Route.fullPath});
 // Filtros vivem na URL: o atalho do Dashboard abre exatamente o universo do card (carteira, responsável e classificação).
 const pipeline=ctx.pipeline??"both",owner=ctx.owner??"",cor=ctx.cor??"";
 const set=(p:Partial<typeof ctx>)=>navigate({search:prev=>({...prev,...p})});
 if(q.isPending)return <Pagina><PageSkeleton/></Pagina>;
 if(q.error)return <Pagina><p role="alert" className="text-destructive">{q.error.message}</p></Pagina>;
 const rows=(q.data?.rows??[]).filter(r=>pipeline==="both"?[15,16].includes(r.pipeline_id):r.pipeline_id===Number(pipeline));
 const owners=csResponsaveisAtivos(rows);
 const clientes=csClientes(rows.filter(r=>!owner||r.owner_id===Number(owner))).filter(c=>cor?c.cor===cor:c.cor==="vermelho"||c.cor==="amarelo").sort((a,b)=>(a.cor===b.cor?0:a.cor==="vermelho"?-1:1)||(b.mrr??0)-(a.mrr??0));
 return <Pagina><Cabecalho titulo="Clientes em risco" frase={cor==="vermelho"?"Somente risco alto (vermelho), por MRR.":cor==="amarelo"?"Somente atenção (amarelo), por MRR.":"Vermelhos e amarelos, por MRR em risco."}/>
 <div className="mb-5 border-b border-border pb-4"><UltimaAtualizacao d={q.data}/></div>
 <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="grid gap-1 text-xs text-muted-foreground">Carteira<select aria-label="Carteira" className={selectStyle} value={pipeline} onChange={e=>set({pipeline:e.target.value==="both"?undefined:e.target.value,owner:undefined})}><option value="both">Ambas · separadas</option><option value="15">Customer Success</option><option value="16">Perfil D</option></select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Responsável<select aria-label="Responsável" className={selectStyle} value={owner} onChange={e=>set({owner:e.target.value||undefined})}><option value="">Todos os permitidos</option>{owners.map(([id,n])=><option key={id} value={id}>{n}</option>)}</select></label>
 <label className="grid gap-1 text-xs text-muted-foreground">Classificação<select aria-label="Classificação" className={selectStyle} value={cor} onChange={e=>set({cor:(e.target.value||undefined) as "vermelho"|"amarelo"|undefined})}><option value="">Vermelho e amarelo</option><option value="vermelho">Somente risco alto</option><option value="amarelo">Somente atenção</option></select></label></div>
 <div className="overflow-x-auto border-y border-border"><table className="w-full text-left text-sm"><thead className="text-xs text-muted-foreground"><tr>{["Cliente","Risco","Carteira","Responsável","MRR","Fatores",""].map(t=><th key={t} className="px-3 py-3 font-medium">{t}</th>)}</tr></thead><tbody>{clientes.map(c=>{const r=c.rows[0]!;return <tr key={c.key} className="border-t border-border align-top hover:bg-accent/40">
 <td className="px-3 py-3"><Link to="/cliente/$dealId" params={{dealId:String(r.deal_id)}} className="text-primary hover:underline">{r.org_nome??r.titulo}</Link></td><td className="whitespace-nowrap px-3 py-3"><RiscoBadge cor={c.cor} fatores={c.fatores}/></td><td className="whitespace-nowrap px-3 py-3">{CS_PIPELINES[c.pipeline_id as 15|16]}</td><td className="whitespace-nowrap px-3 py-3">{r.owner_nome??"sem dados"}</td><td className="whitespace-nowrap px-3 py-3">{money(c.mrr)}</td><td className="px-3 py-3 text-xs text-muted-foreground">{c.fatores.join(" · ")}</td>
 <td className="px-3 py-3"><Button asChild variant="ghost" size="icon"><a href={`https://cs-dinamize.pipedrive.com/deal/${r.deal_id}`} target="_blank" rel="noreferrer" aria-label={`Abrir ${r.titulo} no Pipedrive`}><ExternalLink/></a></Button></td></tr>;})}</tbody></table>{!clientes.length&&<p className="py-10 text-center text-sm text-muted-foreground">{q.data?.lastSuccess?"Nenhum cliente em risco ou atenção nestes filtros.":"sem dados"}</p>}</div>
 <p className="mt-3 text-xs text-muted-foreground">{clientes.length} clientes · {clientes.reduce((n,c)=>n+c.rows.length,0)} negócios</p></Pagina>;
}
