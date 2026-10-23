import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, History } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";
import { CartaoAcao, type Acao } from "@/components/munim/CartaoAcao";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Aprovações — Munim" },
      { name: "description", content: "As ações que o Munim preparou para você aprovar: atividades, notas, rascunhos e eventos." },
      { property: "og:title", content: "Aprovações — Munim" },
      { property: "og:description", content: "As ações que o Munim preparou para você aprovar." },
    ],
  }),
  component: Aprovacoes,
});

function Aprovacoes() {
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const [aba, setAba] = useState<"pendentes" | "historico">("pendentes");
  const { data = [], isLoading } = useQuery({
    queryKey: ["acoes", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from("acoes").select("*").order("created_at", { ascending: false }).limit(200);
      if (error) throw error;
      return data as Acao[];
    },
  });

  useEffect(() => {
    if (!uid) return;
    const c = supabase
      .channel(`acoes-${uid}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "acoes", filter: `user_id=eq.${uid}` }, () => {
        qc.invalidateQueries({ queryKey: ["acoes"] });
        qc.invalidateQueries({ queryKey: ["acoes-pendentes"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(c);
    };
  }, [uid, qc]);

  const lista = data.filter((a) => (aba === "pendentes" ? a.status === "pendente" : a.status !== "pendente"));

  return (
    <Pagina>
      <Cabecalho titulo="Aprovações" frase="Nada sai sem o seu ok. Revise e decida com um toque." />
      <div className="mb-6 inline-flex rounded-lg border border-border p-1">
        {(["pendentes", "historico"] as const).map((k) => (
          <button key={k} onClick={() => setAba(k)} className={cn("rounded-md px-4 py-1.5 text-sm transition-colors", aba === k ? "bg-primary-soft text-primary" : "text-muted-foreground hover:text-foreground")}>
            {k === "pendentes" ? `Pendentes (${data.filter((a) => a.status === "pendente").length})` : "Histórico"}
          </button>
        ))}
      </div>
      {isLoading ? null : lista.length === 0 ? (
        aba === "pendentes" ? (
          <EstadoVazio icon={CheckCircle2} titulo="Nada esperando por você" texto="Quando o Munim preparar algo, aparece aqui para você aprovar com um toque." />
        ) : (
          <EstadoVazio icon={History} titulo="Sem histórico ainda" texto="Suas decisões ficam guardadas aqui." />
        )
      ) : (
        <div className="grid gap-3">
          {lista.map((a) => (
            <CartaoAcao key={a.id + a.status} acao={a} />
          ))}
        </div>
      )}
    </Pagina>
  );
}
