import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const DIAS_SEM_CONTATO = 60;

function inicioFimHoje() {
  const a = new Date();
  a.setHours(0, 0, 0, 0);
  const b = new Date(a);
  b.setDate(b.getDate() + 1);
  return [a.toISOString(), b.toISOString()] as const;
}

export function usePendentes() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["acoes-pendentes", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("acoes")
        .select("id, tipo, resumo, created_at")
        .eq("status", "pendente")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useLembretesHoje() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["lembretes-hoje", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const [ini, fim] = inicioFimHoje();
      const { data, error } = await supabase
        .from("notas")
        .select("id, titulo, resumo, lembrete_em")
        .gte("lembrete_em", ini)
        .lt("lembrete_em", fim)
        .order("lembrete_em");
      if (error) throw error;
      return data;
    },
  });
}

export function useUltimoBriefing() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["ultimo-briefing", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, tipo, conteudo_md, enviado_em")
        .order("enviado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function semContatoHaMais(ultimo: string | null, hoje = new Date(), dias = DIAS_SEM_CONTATO) {
  if (!ultimo) return true;
  const diff = (hoje.getTime() - new Date(ultimo + "T00:00:00").getTime()) / 86400000;
  return diff > dias;
}

export function useCarteira() {
  const { session, perfil } = useAuth();
  return useQuery({
    queryKey: ["carteira", session?.user.id, perfil?.papel, perfil?.pipedrive_user_id],
    enabled: !!session,
    queryFn: async () => {
      let q = supabase.from("clientes").select("pipedrive_deal_id, ultimo_contato_efetivo");
      if (perfil?.papel === "cs" && perfil.pipedrive_user_id)
        q = q.eq("owner_pipedrive_id", perfil.pipedrive_user_id);
      const { data, error } = await q;
      if (error) throw error;
      const total = data.length;
      const semContato = data.filter((c) => semContatoHaMais(c.ultimo_contato_efetivo)).length;
      const pct = total ? Math.round(((total - semContato) / total) * 100) : null;
      return { total, semContato, pct };
    },
  });
}
