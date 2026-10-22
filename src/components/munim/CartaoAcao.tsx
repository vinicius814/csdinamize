import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Calendar, CheckCircle2, ClipboardList, Mail, StickyNote, XCircle } from "lucide-react";
import { decidirAcao } from "@/lib/munim.functions";
import { cn } from "@/lib/utils";

export type Acao = {
  id: string;
  tipo: string;
  resumo: string | null;
  parametros: unknown;
  status: string;
  resultado?: unknown;
  created_at: string;
  decidido_em?: string | null;
};

const ICONES: Record<string, typeof Mail> = {
  atividade_pipedrive: ClipboardList,
  nota_pipedrive: StickyNote,
  rascunho_gmail: Mail,
  evento_agenda: Calendar,
};
const NOMES: Record<string, string> = {
  atividade_pipedrive: "Atividade no Pipedrive",
  nota_pipedrive: "Nota no Pipedrive",
  rascunho_gmail: "Rascunho no Gmail",
  evento_agenda: "Evento na agenda",
};
const ROTULOS: Record<string, string> = {
  deal_id: "Negócio", assunto: "Assunto", data: "Data", tipo: "Tipo", conteudo: "Conteúdo",
  para: "Para", corpo: "Mensagem", titulo: "Título", inicio: "Início", fim: "Fim", convidados: "Convidados",
};
const STATUS: Record<string, { t: string; c: string }> = {
  pendente: { t: "Aguardando você", c: "text-warning" },
  aprovada: { t: "Aprovada, executando…", c: "text-primary" },
  executada: { t: "Feito", c: "text-success" },
  recusada: { t: "Recusada", c: "text-muted-foreground" },
  erro: { t: "Não deu certo", c: "text-destructive" },
};

export function CartaoAcao({ acao }: { acao: Acao }) {
  const decidir = useServerFn(decidirAcao);
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [local, setLocal] = useState<{ status: string; erro?: string | undefined } | null>(null);
  const status = local?.status ?? acao.status;
  const Icon = ICONES[acao.tipo] ?? ClipboardList;
  const params = (acao.parametros ?? {}) as Record<string, unknown>;
  const erro = local?.erro ?? ((acao.resultado as { erro?: string } | null)?.erro);

  const agir = async (decisao: "aprovada" | "recusada") => {
    setOcupado(true);
    try {
      const r = await decidir({ data: { acao_id: acao.id, decisao } });
      setLocal({ status: r.status, erro: (r as { resultado?: { erro?: string } }).resultado?.erro });
    } catch (e) {
      setLocal({ status: "erro", erro: e instanceof Error ? e.message : "Falhou" });
    } finally {
      setOcupado(false);
      qc.invalidateQueries({ queryKey: ["acoes"] });
      qc.invalidateQueries({ queryKey: ["acoes-pendentes"] });
    }
  };

  return (
    <div className="card-munim p-4">
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">{NOMES[acao.tipo] ?? acao.tipo}</p>
          <p className="font-medium text-foreground">{acao.resumo}</p>
          <dl className="mt-2 grid gap-1 text-sm">
            {Object.entries(params).map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-24 shrink-0 text-muted-foreground">{ROTULOS[k] ?? k}</dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words text-foreground">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
              </div>
            ))}
          </dl>
          {status === "pendente" ? (
            <div className="mt-4 flex gap-2">
              <button disabled={ocupado} onClick={() => agir("aprovada")} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-50">
                <CheckCircle2 className="h-4 w-4" /> Aprovar
              </button>
              <button disabled={ocupado} onClick={() => agir("recusada")} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50">
                <XCircle className="h-4 w-4" /> Recusar
              </button>
            </div>
          ) : (
            <p className={cn("mt-3 text-sm", STATUS[status]?.c)}>
              {STATUS[status]?.t ?? status}
              {acao.decidido_em && ` · ${new Date(acao.decidido_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
              {status === "erro" && erro && <span className="block text-xs text-muted-foreground">{erro}</span>}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
