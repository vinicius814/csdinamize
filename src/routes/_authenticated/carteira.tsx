import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Briefcase, Search } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { carteiraAoVivo, detalheCliente } from "@/lib/cerebro.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/carteira")({
  head: () => ({
    meta: [
      { title: "Carteira — Munim" },
      { name: "description", content: "Seus clientes ao vivo do Pipedrive, o último contato com cada um e quem está pedindo atenção." },
      { property: "og:title", content: "Carteira — Munim" },
      { property: "og:description", content: "Seus clientes ao vivo do Pipedrive, o último contato com cada um e quem está pedindo atenção." },
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
  const buscarCarteira = useServerFn(carteiraAoVivo);
  const buscarDetalhe = useServerFn(detalheCliente);
  const [busca, setBusca] = useState("");
  const [faixa, setFaixa] = useState("");
  const [sel, setSel] = useState<number | null>(null);

  const { data: res, isLoading } = useQuery({ queryKey: ["carteira-viva"], queryFn: () => buscarCarteira(), staleTime: 5 * 60_000 });
  const data = res?.clientes ?? [];
  const cliente = data.find((c) => c.deal_id === sel);
  const { data: det } = useQuery({
    queryKey: ["cliente-det", sel],
    enabled: !!cliente,
    queryFn: () => buscarDetalhe({ data: { titulo: cliente!.titulo } }),
  });

  const lista = data
    .filter((c) => {
      if (busca && !`${c.titulo} ${c.organizacao ?? ""}`.toLowerCase().includes(busca.toLowerCase())) return false;
      if (faixa && faixaDias(c.dias_sem_contato) !== faixa) return false;
      return true;
    })
    .sort((a, b) => (b.dias_sem_contato ?? 9999) - (a.dias_sem_contato ?? 9999));
  const total = data.length;
  const cobertos = data.filter((c) => faixaDias(c.dias_sem_contato) === "verde").length;
  const acima120 = data.filter((c) => faixaDias(c.dias_sem_contato) === "vermelho").length;
  const pendentes = data.reduce((s, c) => s + c.atividades_pendentes, 0);

  return (
    <Pagina>
      <Cabecalho titulo="Carteira" frase="Ao vivo do seu Pipedrive: quem está bem cuidado e quem pede atenção." />
      {res?.erro && <p className="mb-4 text-sm text-warning">{res.erro}</p>}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Consultando seu Pipedrive…</p>
      ) : total === 0 ? (
        <EstadoVazio icon={Briefcase} titulo="Nenhum cliente encontrado" texto="Não achei negócios abertos seus no funil de Customer Success." />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              ["Clientes", total],
              ["Cobertura 60 dias", `${Math.round((cobertos / total) * 100)}%`],
              ["Acima de 120 dias", acima120],
              ["Atividades pendentes", pendentes],
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
            <select value={faixa} onChange={(e) => setFaixa(e.target.value)} className="rounded-lg border border-border bg-card px-3 text-sm">
              <option value="">Todos os prazos</option>
              <option value="verde">Até 60 dias</option>
              <option value="amarelo">61 a 120 dias</option>
              <option value="vermelho">Mais de 120 dias ou sem data</option>
            </select>
          </div>
          <div className="card-munim overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  {["Cliente", "Último contato efetivo", "Dias", "Próxima atividade", "Pendentes"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.deal_id} onClick={() => setSel(c.deal_id)} className="cursor-pointer border-b border-border/60 transition-colors hover:bg-accent/40">
                    <td className="px-4 py-3 text-foreground">{c.titulo}</td>
                    <td className="px-4 py-3">{fmt(c.ultimo_contato)}</td>
                    <td className={cn("px-4 py-3 font-display", COR[faixaDias(c.dias_sem_contato)])}>{c.dias_sem_contato ?? "—"}</td>
                    <td className="px-4 py-3">{fmt(c.proxima_atividade)}</td>
                    <td className="px-4 py-3">{c.atividades_pendentes}</td>
                  </tr>
                ))}
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
                <SheetTitle>{cliente.titulo}</SheetTitle>
              </SheetHeader>
              <dl className="mt-4 grid gap-2 text-sm">
                <div><dt className="text-muted-foreground">Organização</dt><dd>{cliente.organizacao ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Último contato efetivo</dt><dd>{fmt(cliente.ultimo_contato)}</dd></div>
                <div><dt className="text-muted-foreground">Próxima atividade</dt><dd>{fmt(cliente.proxima_atividade)}</dd></div>
              </dl>
              <Link to="/conversa" search={{ q: `Como está o cliente ${cliente.titulo}? Cruze Pipedrive, e-mails e notas.` }} className="mt-5 inline-block rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Perguntar ao Munim
              </Link>
              <h3 className="mt-6 mb-2 text-sm font-medium text-muted-foreground">Notas recentes no Pipedrive</h3>
              {!det ? <p className="text-sm text-muted-foreground">Carregando…</p> : det.notas.length === 0 ? <p className="text-sm text-muted-foreground">Nenhuma nota.</p> : det.notas.map((n: any, i: number) => (
                <div key={i} className="mb-2 rounded-lg border border-border p-3 text-sm">
                  <p className="text-xs text-muted-foreground">{fmt(n.data)}</p>
                  <p>{n.texto}</p>
                </div>
              ))}
            </>
          )}
        </SheetContent>
      </Sheet>
    </Pagina>
  );
}
