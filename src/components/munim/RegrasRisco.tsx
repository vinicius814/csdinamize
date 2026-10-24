import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Thermometer } from "lucide-react";
import { readRegrasCS, saveRegrasCS } from "@/lib/cs.functions";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

type R={sem_proxima_atividade_e_atencao:boolean;analista_aguardando_dias:number;prazo_onboarding_dias:number;prazo_por_etapa_dias:number;dias_atencao:number;dias_risco:number;vencidas_atencao:number;vencidas_risco:number;considerar_sem_uso_como_risco:boolean;retorno_pendente_dias:number};
const CAMPOS:[Exclude<keyof R,"considerar_sem_uso_como_risco"|"sem_proxima_atividade_e_atencao">,string][]=[["dias_atencao","Dias sem contato efetivo para atenção"],["dias_risco","Dias sem contato efetivo para risco alto"],["retorno_pendente_dias","Dias para e-mail \"aguardando resposta\""],["analista_aguardando_dias","Dias para \"analista aguardando cliente\""],["prazo_onboarding_dias","Prazo total de onboarding (dias)"],["prazo_por_etapa_dias","Prazo por etapa de onboarding (dias)"]];
export function RegrasRisco() {
 const {session}=useAuth();const read=useServerFn(readRegrasCS),save=useServerFn(saveRegrasCS),qc=useQueryClient();
 const q=useQuery({queryKey:["cs-regras",session?.user.id],queryFn:()=>read()});
 const [f,setF]=useState<R|null>(null);const [busy,setBusy]=useState(false);
 useEffect(()=>{if(q.data?.regras)setF(q.data.regras as R);},[q.data]);
 if(!q.data?.podeEditar||!f)return null;
 async function salvar(){if(!f)return;setBusy(true);try{await save({data:f});toast.success("Regras de risco salvas.");await qc.invalidateQueries({queryKey:["cs-regras"]});await qc.invalidateQueries({queryKey:["cs-data"]});await qc.invalidateQueries({queryKey:["cs-metrics"]});}catch(e){toast.error(e instanceof Error?e.message:"Não consegui salvar.");}finally{setBusy(false);}}
 return <section className="card-munim p-5"><div className="mb-4 flex items-center gap-3"><Thermometer className="h-5 w-5 text-primary"/><h2 className="font-display text-lg text-foreground">Termômetro de risco</h2></div>
 <div className="grid gap-3 sm:grid-cols-2">{CAMPOS.map(([k,label])=><label key={k} className="grid gap-1 text-xs text-muted-foreground">{label}<Input type="number" min={0} value={String(f[k])} onChange={e=>setF({...f,[k]:Number(e.target.value)})}/></label>)}
 <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2"><span>Considerar etapa "Sem uso" como risco</span><Switch checked={f.considerar_sem_uso_como_risco} onCheckedChange={v=>setF({...f,considerar_sem_uso_como_risco:v})} aria-label="Considerar Sem uso como risco"/></label>
 <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2"><span>"Sem próxima atividade agendada" deixa o cliente em atenção</span><Switch checked={f.sem_proxima_atividade_e_atencao} onCheckedChange={v=>setF({...f,sem_proxima_atividade_e_atencao:v})} aria-label="Sem próxima atividade gera atenção"/></label></div>
 <Button className="mt-4" onClick={salvar} disabled={busy}>{busy?"Salvando…":"Salvar regras"}</Button></section>;
}
