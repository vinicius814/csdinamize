import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { refreshIntegrations } from "@/lib/integration-cache.functions";

export function RefreshIntegrations() {
  const refresh = useServerFn(refreshIntegrations);
  const qc = useQueryClient();
  const mutation = useMutation({ mutationFn: () => refresh(),
    onSuccess: async () => { await qc.invalidateQueries({ predicate: q => ["connection-presence", "telegram-status", "conexoes", "carteira", "carteira-viva", "cliente-det", "notas-drive", "nota", "pipedrive-options", "onboarding-options"].includes(String(q.queryKey[0])) }); },
    onError: e => toast.error(e.message),
  });
  return <Button variant="outline" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
    <RefreshCw className={mutation.isPending ? "animate-spin" : ""} />{mutation.isPending ? "Atualizando…" : "Atualizar"}
  </Button>;
}