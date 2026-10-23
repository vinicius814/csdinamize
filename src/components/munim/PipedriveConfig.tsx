import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { onboardingOptions, saveOnboarding } from "@/lib/onboarding.functions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function PipedriveConfig() {
  const options = useServerFn(onboardingOptions), save = useServerFn(saveOnboarding), qc = useQueryClient();
  const { data, error } = useQuery({ queryKey: ["pipedrive-options"], queryFn: () => options() });
  const [pipeline, setPipeline] = useState(""), [field, setField] = useState(""), [busy, setBusy] = useState(false);
  useEffect(() => { setPipeline(String(data?.config?.pipeline_id ?? "")); setField(data?.config?.campo_ultimo_contato ?? ""); }, [data]);
  const saveConfig = async () => {
    if (!data) return;
    setBusy(true);
    try {
      await save({data:{pipeline_id:Number(pipeline), campo_ultimo_contato:field, dias_alerta:data.config?.dias_alerta ?? 60, fuso:data.profile?.fuso ?? "America/Sao_Paulo", horario_briefing:(data.profile?.horario_briefing ?? "07:30").slice(0,5), concluir:data.config?.onboarding_concluido ?? false}});
      await Promise.all([qc.invalidateQueries({queryKey:["pipedrive-options"]}), qc.invalidateQueries({queryKey:["carteira-viva"]})]);
      toast.success("Carteira configurada.");
    } catch(e) { toast.error(e instanceof Error ? e.message : "Não consegui salvar."); } finally {setBusy(false);}
  };
  return <div className="mt-4 border-t border-border pt-4">
    <h3 className="mb-3 text-sm font-medium">Sua carteira</h3>
    {(data?.erro || error) ? <p role="alert" className="break-words text-sm text-warning">{data?.erro ?? error?.message}</p> : !data ? <p className="text-sm text-muted-foreground">Consultando pipelines e campos…</p> : <div className="grid gap-3 sm:grid-cols-2">
      <label className="min-w-0 text-sm">Pipeline<select aria-label="Pipeline" value={pipeline} onChange={e=>setPipeline(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2"><option value="">Escolha o pipeline</option>{data.pipelines.map((p:{id:number;name:string})=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="min-w-0 text-sm">Último contato<select aria-label="Campo de data" value={field} onChange={e=>setField(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-card p-2"><option value="">Escolha o campo de data</option>{data.fields.map((f:{key:string;name:string})=><option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
      <Button disabled={!pipeline || !field || busy} onClick={saveConfig} className="justify-self-start disabled:bg-secondary disabled:text-secondary-foreground disabled:opacity-100">{busy ? "Salvando…" : "Salvar carteira"}</Button>
    </div>}
  </div>;
}