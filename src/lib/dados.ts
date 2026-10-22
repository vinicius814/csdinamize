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

export type Rotina = "manha" | "riscos" | "fechamento" | "semana";
const ROTINA_DO_BANCO: Record<string, Rotina> = { manha: "manha", alerta: "riscos", rodada: "fechamento", leitura_cs: "semana" };

/** Última edição de cada rotina (manhã, riscos, fechamento, semana). */
export function useRotinas() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["rotinas", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("briefings")
        .select("id, tipo, conteudo_md, enviado_em")
        .order("enviado_em", { ascending: false })
        .limit(40);
      if (error) throw error;
      const out: Partial<Record<Rotina, { conteudo_md: string; enviado_em: string }>> = {};
      for (const b of data ?? []) {
        const r = ROTINA_DO_BANCO[b.tipo];
        if (r && !out[r]) out[r] = b;
      }
      return out;
    },
  });
}

/** Ideias e projetos do Segundo Cérebro, ordenados por pontuação. */
export function useRadarIdeias() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ["radar-ideias", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { pontuacao, lerTag } = await import("@/lib/ideias");
      const { data, error } = await supabase
        .from("notas")
        .select("id, titulo, subcategoria, tags, resumo, created_at")
        .in("subcategoria", ["ideia", "projeto"])
        .order("created_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return (data ?? [])
        .map((n) => ({ ...n, pontuacao: pontuacao(n.tags), status: lerTag(n.tags, "status") }))
        .filter((n) => n.pontuacao > 0)
        .sort((a, b) => b.pontuacao - a.pontuacao);
    },
  });
}
