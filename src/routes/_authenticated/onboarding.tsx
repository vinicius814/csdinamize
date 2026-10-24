import {finishPersonalOnboarding} from "@/lib/personal-onboarding.functions";
import {useAuth} from "@/lib/auth";
import {createFileRoute,useNavigate} from "@tanstack/react-router";
import {useState} from "react";
import {useQuery,useQueryClient} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {toast} from "sonner";
import {ConexoesPessoais} from "@/components/munim/ConexoesPessoais";
import {onboardingOptions,saveOnboarding} from "@/lib/onboarding.functions";
import {Button} from "@/components/ui/button";
import {TelegramConnection} from "@/components/munim/TelegramConnection";
import {useConnectionPresence} from "@/lib/connection-presence";
import {Input} from "@/components/ui/input";
import {Pagina,Cabecalho} from "@/components/munim/PaginaVazia";
export const Route=createFileRoute("/_authenticated/onboarding")({head:()=>({meta:[{title:"Seu primeiro acesso — Munin"},{name:"description",content:"Conecte suas contas e escolha suas preferências no Munin."},{property:"og:title",content:"Seu primeiro acesso — Munin"},{property:"og:description",content:"Suas conexões e preferências pessoais."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Onboarding});
function Onboarding(){const {perfil}=useAuth();const [nome,setNome]=useState(perfil?.nome??""),[areas,setAreas]=useState(["Trabalho","Pessoal","Saúde","Finanças","Estudos","Projetos"]),[nivel,setNivel]=useState<"anotar"|"sugerir"|"perguntar">("anotar"),[busy,setBusy]=useState(false);const finish=useServerFn(finishPersonalOnboarding),nav=useNavigate(),qc=useQueryClient();return <Pagina><Cabecalho titulo="Seu Munin" frase="Um espaço pessoal, do seu jeito."/><form className="mb-8 grid max-w-xl gap-5" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await finish({data:{nome,areas,nivel}});await qc.invalidateQueries({queryKey:["account-state"]});await qc.invalidateQueries({queryKey:["personal"]});nav({to:"/"});}catch(e){toast.error(e instanceof Error?e.message:"Não consegui concluir.");}finally{setBusy(false);}}}><label className="text-sm">Como posso chamar você?<Input value={nome} onChange={e=>setNome(e.target.value)} required maxLength={100}/></label><fieldset><legend className="mb-3 text-sm">Áreas da vida</legend><div className="flex flex-wrap gap-3">{["Trabalho","Pessoal","Saúde","Finanças","Estudos","Projetos"].map(a=><label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={areas.includes(a)} onChange={e=>setAreas(e.target.checked?[...areas,a]:areas.filter(v=>v!==a))}/>{a}</label>)}</div></fieldset><label className="text-sm">Como o Munin pode agir?<select className="mt-1 w-full rounded-md border border-input bg-background p-3" value={nivel} onChange={e=>setNivel(e.target.value as "anotar"|"sugerir"|"perguntar")}><option value="anotar">Só anotar</option><option value="sugerir">Sugerir</option><option value="perguntar">Perguntar antes de agir</option></select></label><Button disabled={busy||!areas.length}>{busy?"Preparando…":"Começar"}</Button></form><ConexoesPessoais/><TelegramConnection/></Pagina>;}
