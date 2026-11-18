import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { accountQueryOptions } from "@/lib/account-query";

/**
 * Aplica o convite do e-mail verificado da sessão (dcs_reivindicar_acesso) quando a conta ainda está pendente e devolve
 * o estado da conta atualizado. Toda a validação (convite válido, não expirado, não revogado) é feita no banco.
 */
export async function aplicarConvite(qc: QueryClient, userId: string) {
  let a = await qc.ensureQueryData(accountQueryOptions(userId));
  if (a.status === "pendente") {
    // O builder do PostgREST é "thenable" mas não tem .catch: envolve em Promise real.
    const r = await Promise.resolve(
      (supabase.rpc as unknown as (f: string) => PromiseLike<{ data: unknown }>)(
        "dcs_reivindicar_acesso",
      ),
    ).catch(() => ({ data: false }));
    if (r.data === true) a = await qc.fetchQuery({ ...accountQueryOptions(userId), staleTime: 0 });
  }
  return a;
}
