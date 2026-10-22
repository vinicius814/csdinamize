import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, Search } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — Munim" },
      { name: "description", content: "Seus clientes, o último contato com cada um e quem está pedindo atenção." },
      { property: "og:title", content: "Carteira — Munim" },
      { property: "og:description", content: "Seus clientes, o último contato com cada um e quem está pedindo atenção." },
    ],
  }),
  component: Carteira,
});

export function diasDesde(d: string | null, hoje = new Date()) {
  if (!d) return null;
  return Math.floor((hoje.getTime() - new Date(d + "T00:00:00").getTime()) / 86400000);
}
export function faixaDias(n: number | null) {
  if (n === null || n > 120) return "vermelho";
  if (n > 60) return "amarelo";
  return "verde";
}
const COR = { verde: "text-success", amarelo: "text-warning", vermelho: "text-destructive" } as const;
const fmt = (d: string | null) => (d ? new Date(d.length === 10 ? d + "T00:00:00" : d).toLocaleDateString("pt-BR") : "—");

function Carteira() {
  const { session } = useAuth();
  const [busca, setBusca] = useState("");
  const [etapa, setEtapa] = useState("");
  const [faixa, setFaixa] = useState("");
  const [sel, setSel] = useState<number | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["carteira-lista", session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("pipeline_id", 15)
        .neq("stage_id", 105)
        .order("ultimo_contato_efetivo", { ascending: true, nullsFirst: true })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });

  const { data: registros = [] } = useQuery({
    queryKey: ["registros", sel],
    enabled: sel !== null,
    queryFn: async () => {
      const { data } = await supabase.from("registros").select("*").eq("pipedrive_deal_id", sel!).order("data", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const etapas = useMemo(() => [...new Set(data.map((c) => c.etapa).filter(Boolean))] as string[], [data]);
  const lista = data.filter((c) => {
    const nome = (c.nome_curto ?? c.titulo ?? "").toLowerCase();
    if (busca && !nome.includes(busca.toLowerCase())) return false;
    if (etapa && c.etapa !== etapa) return false;
    if (faixa && faixaDias(diasDesde(c.ultimo_contato_efetivo)) !== faixa) return false;
    return true;
  });
  const total = data.length;
  const cobertos = data.filter((c) => faixaDias(diasDesde(c.ultimo_contato_efetivo)) === "verde").length;
  const acima120 = data.filter((c) => faixaDias(diasDesde(c.ultimo_contato_efetivo)) === "vermelho").length;
  const semUso = data.filter((c) => (c.etapa ?? "").toLowerCase().includes("sem uso")).length;
  const cliente = data.find((c) => c.pipedrive_deal_id === sel);

  return (
    <Pagina>
      <Cabecalho titulo="Carteira" frase="Quem está bem cuidado e quem está pedindo atenção." />
      {!isLoading && total === 0 ? (
        <EstadoVazio icon={Briefcase} titulo="Nenhum cliente por aqui ainda" texto="Assim que a carteira for sincronizada com o Pipedrive, seus clientes aparecem aqui." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Clientes", total],
              ["Cobertura 60 dias", total ? `${Math.round((cobertos / total) * 100)}%` : "—"],
              ["Acima de 120 dias", acima120],
              ["Sem uso", semUso],
            ].map(([t, v]) => (
              <div key={t as string} className="card-munim p-4">
                <p className="text-xs text-muted-foreground">{t}</p>
                <p className="mt-1 font-display text-2xl text-foreground">{v}</p>
              </div>
            ))}
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente" className="h-9 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <select value={etapa} onChange={(e) => setEtapa(e.target.value)} className="rounded-lg border border-border bg-card px-3 text-sm">
              <option value="">Todas as etapas</option>
              {etapas.map((e) => <option key={e}>{e}</option>)}
            </select>
            <select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="rounded-lg border border-border bg-card px-3 text-sm">
              <option value="">Todos os prazos</option>
              <option value="verde">Até 60 dias</option>
              <option value="amarelo">61 a 120 dias</option>
              <option value="vermelho">Mais de 120 dias</option>
            </select>
          </div>
          <div className="card-munim overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  {["Cliente", "Etapa", "Último contato", "Dias", "Próxima atividade", "Pendentes", "Último e-mail"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const d = diasDesde(c.ultimo_contato_efetivo);
                  return (
                    <tr key={c.pipedrive_deal_id} onClick={() => setSel(c.pipedrive_deal_id)} className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/40">
                      <td className="px-4 py-3 text-foreground">{c.nome_curto ?? c.titulo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{c.etapa ?? "—"}</td>
                      <td className="px-4 py-3">{fmt(c.ultimo_contato_efetivo)}</td>
                      <td className={cn("px-4 py-3 font-display", COR[faixaDias(d)])}>{d ?? "—"}</td>
                      <td className="px-4 py-3">{fmt(c.proxima_atividade)}</td>
                      <td className="px-4 py-3">{c.atividades_pendentes ?? 0}</td>
                      <td className="px-4 py-3">{fmt(c.ultimo_email_recebido)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      <Sheet open={sel !== null} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="overflow-y-auto">
          {cliente && (
            <>
              <SheetHeader>
                <SheetTitle>{cliente.nome_curto ?? cliente.titulo}</SheetTitle>
              </SheetHeader>
              <dl className="mt-4 grid gap-2 text-sm">
                <div><dt className="text-muted-foreground">Etapa</dt><dd>{cliente.etapa ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Contato</dt><dd>{cliente.contato_nome ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Próxima atividade</dt><dd>{cliente.proxima_atividade_assunto ?? "—"} ({fmt(cliente.proxima_atividade)})</dd></div>
              </dl>
              <Link to="/conversa" search={{ q: `Como está o cliente ${cliente.nome_curto ?? cliente.titulo}?` }} className="mt-5 inline-block rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Perguntar ao Munim
              </Link>
              <h3 className="mt-6 mb-2 text-sm font-medium text-muted-foreground">Registros</h3>
              {registros.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p> : registros.map((r) => (
                <div key={r.id} className="mb-2 rounded-lg border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{fmt(r.data)} · risco {r.risco}</p>
                  <p>{r.resumo}</p>
                </div>
              ))}
            </>
          )}
        </SheetContent>
      </Sheet>
    </Pagina>
  );
}
