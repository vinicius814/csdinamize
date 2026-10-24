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

type R={dias_atencao:number;dias_risco:number;vencidas_atencao:number;vencidas_risco:number;considerar_sem_uso_como_risco:boolean;retorno_pendente_dias:number};
const CAMPOS:[keyof R,string][]=[["dias_atencao","Dias sem contato para atenção"],["dias_risco","Dias sem contato para risco"],["vencidas_atencao","Atividades vencidas para atenção"],["vencidas_risco","Atividades vencidas para risco"],["retorno_pendente_dias","Dias de retorno pendente para risco"]];
export function RegrasRisco() {
 const {session}=useAuth();const read=useServerFn(readRegrasCS),save=useServerFn(saveRegrasCS),qc=useQueryClient();
 const q=useQuery({queryKey:["cs-regras",session?.user.id],queryFn:()=>read()});
 const [f,setF]=useState<R|null>(null);const [busy,setBusy]=useState(false);
 useEffect(()=>{if(q.data?.regras)setF(q.data.regras);},[q.data]);
 if(!q.data?.podeEditar||!f)return null;
 async function salvar(){if(!f)return;setBusy(true);try{await save({data:f});toast.success("Regras de risco salvas.");await qc.invalidateQueries({queryKey:["cs-regras"]});await qc.invalidateQueries({queryKey:["cs-data"]});await qc.invalidateQueries({queryKey:["cs-metrics"]});}catch(e){toast.error(e instanceof Error?e.message:"Não consegui salvar.");}finally{setBusy(false);}}
 return <section className="card-munim p-5"><div className="mb-4 flex items-center gap-3"><Thermometer className="h-5 w-5 text-primary"/><h2 className="font-display text-lg text-foreground">Termômetro de risco</h2></div>
 <div className="grid gap-3 sm:grid-cols-2">{CAMPOS.map(([k,label])=><label key={k} className="grid gap-1 text-xs text-muted-foreground">{label}<Input type="number" min={0} value={String(f[k])} onChange={e=>setF({...f,[k]:Number(e.target.value)})}/></label>)}
 <label className="flex items-center justify-between gap-3 text-sm sm:col-span-2"><span>Considerar etapa "Sem uso" como risco</span><Switch checked={f.considerar_sem_uso_como_risco} onCheckedChange={v=>setF({...f,considerar_sem_uso_como_risco:v})} aria-label="Considerar Sem uso como risco"/></label></div>
 <Button className="mt-4" onClick={salvar} disabled={busy}>{busy?"Salvando…":"Salvar regras"}</Button></section>;
}
