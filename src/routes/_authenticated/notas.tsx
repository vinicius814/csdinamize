import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Search, StickyNote } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { lerNota, listarNotas } from "@/lib/cerebro.functions";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Notas — Munim" },
      { name: "description", content: "Seu Segundo Cérebro ao vivo: as notas em Markdown do seu Google Drive." },
      { property: "og:title", content: "Notas — Munim" },
      { property: "og:description", content: "Seu Segundo Cérebro ao vivo: as notas em Markdown do seu Google Drive." },
    ],
  }),
  component: Notas,
});

const semFrontmatter = (t: string) => t.replace(/^---[\s\S]*?---\s*/, "");

function Notas() {
  const {session}=useAuth();
  const listar = useServerFn(listarNotas);
  const ler = useServerFn(lerNota);
  const [busca, setBusca] = useState("");
  const [termo, setTermo] = useState("");
  const [sel, setSel] = useState<{ id: string; nome: string } | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ["notas-drive", session?.user.id, termo], queryFn: () => listar({ data: { texto: termo } }) });
  const { data: nota, isLoading: lendo, error:noteError } = useQuery({
    queryKey: ["nota", sel?.id],
    enabled: !!sel,
    queryFn: () => {if(!sel)throw new Error("Nota não selecionada.");return ler({data:{id:sel.id}});},
  });
  const notas = data?.notas ?? [];

  return (
    <Pagina>
      <Cabecalho titulo="Notas" frase="Seu Segundo Cérebro, direto do Google Drive." />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTermo(busca.trim());
        }}
        className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-card px-3"
      >
        <Search className="h-4 w-4 text-muted-foreground" />
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar no título ou no conteúdo" className="h-10 flex-1 bg-transparent text-sm outline-none" />
      </form>
      {(data?.erro||error) && <div role="alert" className="mb-4 text-sm text-warning"><p>{data?.erro??error?.message}</p><Button variant="outline" className="mt-2" asChild><Link to="/conexoes">Conectar Drive</Link></Button></div>}
      {data?.erro||error ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Abrindo seu Segundo Cérebro…</p>
      ) : notas.length === 0 ? (
        <EstadoVazio icon={StickyNote} titulo={termo ? "Nada encontrado" : "Nenhuma nota ainda"} texto="Peça ao Munim para anotar algo e ele guarda na pasta 01 Notas." />
      ) : (
        <ul className="grid gap-2">
          {notas.map((n) => {
            const m = n.nome.match(/^(\d{4}-\d{2}-\d{2})\s+(.*?)(\.md)?$/);
            return (
              <li key={n.id}>
                <button onClick={() => setSel({ id: n.id, nome: n.nome })} className="card-munim flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-accent/40">
                  <span className="text-sm text-foreground">{m ? m[2] : n.nome}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{m ? new Date(m[1] + "T12:00:00").toLocaleDateString("pt-BR") : ""}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSel(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>{sel?.nome.replace(/\.md$/, "")}</SheetTitle>
          </SheetHeader>
          <div className="prose prose-sm mt-4 max-w-none text-foreground dark:prose-invert">
            {noteError ? <p className="text-warning">Não consegui ler esta nota.</p> : lendo ? <p className="text-muted-foreground">Lendo…</p> : <ReactMarkdown>{semFrontmatter(nota?.conteudo ?? "")}</ReactMarkdown>}
          </div>
        </SheetContent>
      </Sheet>
    </Pagina>
  );
}
