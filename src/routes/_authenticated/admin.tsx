import { createFileRoute, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { adminOverview, adminAction } from "@/lib/admin.functions";
import { accountQueryOptions } from "@/lib/account-query";
import { supabase } from "@/integrations/supabase/client";
import { PageSkeleton } from "@/components/munim/PageSkeleton";
import { canAdminister } from "@/lib/access";
import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {connectionRequestCounts} from "@/lib/connection-requests.functions";
export const Route=createFileRoute("/_authenticated/admin")({
  beforeLoad:async({context})=>{const {data}=await supabase.auth.getSession();if(!data.session)throw redirect({to:"/auth",search:{}});const a=await context.queryClient.ensureQueryData(accountQueryOptions(data.session.user.id)); if(!canAdminister(a.role,a.status)) throw redirect({to:"/"});},
  head:()=>({meta:[{title:"Administração — Munin"},{name:"description",content:"Acessos, custos e metadados de contas do Munin."},{property:"og:title",content:"Administração — Munin"},{property:"og:description",content:"Administração privada de acessos e custos."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Admin,
});
function Admin(){
  const readRequests=useServerFn(connectionRequestCounts);
  const requests=useQuery({queryKey:["admin-connection-requests"],queryFn:()=>readRequests()});
  const read=useServerFn(adminOverview),mutate=useServerFn(adminAction),qc=useQueryClient();
  const query=useQuery({queryKey:["admin-overview"],queryFn:()=>read()});
  const [search,setSearch]=useState(""),[busy,setBusy]=useState(false);
  async function act(data:Parameters<typeof mutate>[0]){setBusy(true);try{await mutate(data);await Promise.all([qc.invalidateQueries({queryKey:["admin-overview"]}),qc.invalidateQueries({queryKey:["account-state"]})]);toast.success("Alteração registrada.");}catch(e){toast.error(e instanceof Error ? e.message : "Não consegui alterar.");}finally{setBusy(false);}}
  const d=query.data;
  return <Pagina><Cabecalho titulo="Administração" frase="Acessos, papéis de CS e custos. Conteúdo privado preservado."/>
    <section className="mb-6 border-b border-border py-5"><h2 className="font-display text-lg">Conexões solicitadas</h2>{requests.error?<p role="alert" className="text-warning">{requests.error.message}</p>:requests.isPending?<p className="text-sm text-muted-foreground">Carregando…</p>:!requests.data?.length?<p className="text-sm text-muted-foreground">Nenhum pedido ainda.</p>:<ul className="mt-3 space-y-2">{requests.data.map(r=><li key={r.ferramenta} className="flex justify-between text-sm"><span>{r.ferramenta}</span><span>{r.quantidade} pedidos</span></li>)}</ul>}</section>
    {query.isError && <p role="alert" className="text-destructive">{query.error.message}<Button variant="outline" onClick={()=>query.refetch()}>Tentar de novo</Button></p>}
    {!d && !query.isError && <PageSkeleton />}
    {d && <><div className="grid grid-cols-2 gap-4 lg:grid-cols-5">{[["Usuários",d.metrics.total],["Ativos · 7 dias",d.metrics.active7],["Ativos · 30 dias",d.metrics.active30],["Pendentes",d.metrics.pending],["IA · mês",`US$ ${d.metrics.cost.toFixed(2)}`]].map(([label,value])=><div key={label} className="border-b border-border py-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 font-display text-2xl">{value}</p></div>)}</div>
    <div className="my-6 flex flex-wrap items-center gap-3"><label className="flex items-center gap-3 text-sm">Aprovação manual<Switch checked={d.manualApproval} disabled={busy} onCheckedChange={value=>act({data:{action:"registration",value}})}/></label><span className="text-xs text-muted-foreground">{d.manualApproval ? "Novas contas aguardam liberação" : "Cadastro livre"}</span><Input className="sm:ml-auto sm:w-72" placeholder="Buscar nome ou e-mail" value={search} onChange={e=>setSearch(e.target.value)}/></div>
    <div className="space-y-0">{d.users.filter(u=>`${u.nome} ${u.email}`.toLowerCase().includes(search.toLowerCase())).map(u=><section key={u.id} className="border-t border-border py-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words font-semibold">{u.nome ?? "Sem nome"}</h2><p className="break-all text-sm text-muted-foreground">{u.email}</p></div><span className="text-sm text-primary">{u.status} · {u.role}</span></div>
    <dl className="my-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><dt className="text-muted-foreground">Cadastro</dt><dd>{new Date(u.created_at).toLocaleDateString("pt-BR")}</dd></div><div><dt className="text-muted-foreground">Último acesso</dt><dd>{u.last_access_at ? new Date(u.last_access_at).toLocaleString("pt-BR") : "Não registrado"}</dd></div><div><dt className="text-muted-foreground">Mensagens · mês</dt><dd>{u.messages}</dd></div><div><dt className="text-muted-foreground">Custo IA · mês</dt><dd>US$ {u.cost.toFixed(2)}</dd></div><div><dt className="text-muted-foreground">Conexões próprias</dt><dd>Pipe {u.pipedrive?"sim":"não"} · Gmail {u.gmail?"sim":"não"}<br/>Agenda {u.agenda?"sim":"não"} · Drive {u.drive?"sim":"não"}</dd></div><div><dt className="text-muted-foreground">Onboarding</dt><dd>{u.onboarded?"Concluído":"Pendente"}</dd></div></dl>
    <form className="mb-4 flex flex-wrap items-end gap-2" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const owner=f.get("owner")?Number(f.get("owner")):null;
      // Vínculo explícito: nunca escolhido por padrão; confirmar quando o responsável já pertence a outra conta ou muda o vínculo atual.
      const outro=owner?d.users.find(x=>x.id!==u.id&&x.owner===owner):null;const nomeOwner=d.owners.find(o=>o.id===owner)?.nome??String(owner);
      if(owner!==u.owner&&!window.confirm(`${outro?`Atenção: ${nomeOwner} (${owner}) já está vinculado a ${outro.email}.\n`:""}Vincular ${u.email} ao responsável ${owner?`${nomeOwner} · ${owner}`:"nenhum (Não atribuído)"}?`))return;
      act({data:{action:"cs_profile",userId:u.id,value:{papel:f.get("papel") as "cs"|"gestor"|"admin",owner}}});}}><label className="grid gap-1 text-xs">Papel CS<select name="papel" defaultValue={u.csRole} className="rounded-md border border-border bg-background p-2"><option value="cs">CS</option><option value="gestor">Gestor</option><option value="admin">Admin CS</option></select></label><label className="grid gap-1 text-xs">Responsável Pipedrive (vínculo da Minha carteira)<select key={`${u.id}:${u.owner??""}`} name="owner" defaultValue={u.owner??""} className="max-w-full rounded-md border border-border bg-background p-2"><option value="">Não atribuído</option>{u.owner&&!d.owners.some(o=>o.id===u.owner)&&<option value={u.owner}>{u.owner} · aguardando sync</option>}{[...d.owners].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")).map(o=><option key={o.id} value={o.id}>{o.nome} · {o.id}{d.users.some(x=>x.id!==u.id&&x.owner===o.id)?" · já vinculado":""}</option>)}</select></label><Button size="sm" variant="outline" disabled={busy}>Salvar papel CS</Button></form>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>act({data:{action:"status",userId:u.id,value:u.status==="ativo"?"suspenso":"ativo"}})}>{u.status==="ativo"?"Suspender":u.status==="pendente"?"Aprovar":"Reativar"}</Button>
    {d.canChangeRoles && <select aria-label={`Papel de ${u.nome}`} className="rounded-md border border-border bg-background p-2 text-sm" value={u.role} disabled={busy} onChange={e=>act({data:{action:"role",userId:u.id,value:e.target.value as "user"|"admin"|"superadmin"}})}><option value="user">Usuário</option><option value="admin">Admin</option><option value="superadmin">Superadmin</option></select>}
    <form className="flex items-center gap-2" onSubmit={e=>{e.preventDefault();const form=new FormData(e.currentTarget);act({data:{action:"limit",userId:u.id,value:Number(form.get("limit"))}});}}><label className="text-xs">Limite mensal US$<Input key={u.limit} name="limit" type="number" min="0" max="100000" step="0.01" defaultValue={u.limit} className="mt-1 w-28" required/></label><Button size="sm" variant="outline" disabled={busy} type="submit">Salvar limite</Button></form></div></section>)}</div></>}
  </Pagina>;
}
