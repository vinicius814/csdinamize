import { Copy } from "lucide-react";
import { toast } from "sonner";
import type { DcsAcao, DcsDiagnostico } from "@/lib/dcs/db";
import { resumoEvolucao } from "@/lib/dcs/evolucao";
import { Dica } from "./Ajuda";
import { Painel, Selo } from "./ui";

/** Aba "Evolução" da ficha do cliente (D39): apoio a reuniões, sem resultados financeiros atribuídos ao CS. */
export function Evolucao({
  nome,
  diags,
  acoes,
}: {
  nome: string;
  diags: DcsDiagnostico[];
  acoes: DcsAcao[];
}) {
  const r = resumoEvolucao(nome, diags, acoes);
  if (!r.atual)
    return (
      <p className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        A evolução aparece depois do primeiro diagnóstico concluído. Nenhum dado é estimado.
      </p>
    );
  const blocos: [string, DcsAcao[], string, "ok" | "info" | "aviso" | "neutro"][] = [
    [
      "Resolvido e confirmado",
      r.confirmadas,
      "O problema não apareceu no diagnóstico mais recente.",
      "ok",
    ],
    [
      "Implementado, a confirmar",
      r.implementadas,
      "Marcado como implementado; será confirmado no próximo diagnóstico.",
      "info",
    ],
    [
      "Ainda precisa de atenção",
      r.pendentes,
      "Ações abertas do plano, críticas e ganhos rápidos primeiro.",
      "aviso",
    ],
    ["Novas oportunidades", r.novas, "Identificadas no ciclo mais recente.", "neutro"],
  ];
  return (
    <div className="space-y-4">
      <Painel
        titulo="Resumo de evolução"
        acao={
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard
                .writeText(r.texto)
                .then(() => toast.success("Resumo copiado."))
            }
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs hover:border-primary"
          >
            <Copy className="h-3.5 w-3.5" /> Copiar para a reunião
          </button>
        }
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="flex items-center gap-1 text-xs text-muted-foreground">
              Índice de aproveitamento <Dica termo="indice" rotulo="Índice" />
            </dt>
            <dd className="text-lg font-semibold tabular-nums">
              {r.anterior
                ? `${r.indice.antes ?? "—"} → ${r.indice.depois ?? "—"}`
                : (r.indice.depois ?? "—")}
              {r.indice.delta != null && (
                <span
                  className={
                    r.indice.delta >= 0
                      ? "ml-2 text-sm text-emerald-700"
                      : "ml-2 text-sm text-red-700"
                  }
                >
                  {r.indice.delta >= 0 ? "+" : ""}
                  {r.indice.delta}
                </span>
              )}
            </dd>
            {r.anterior && !r.indice.comparavel && (
              <p className="text-[11px] text-muted-foreground">
                Metodologias diferentes: sem comparação direta.
              </p>
            )}
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ciclos comparados</dt>
            <dd>
              {r.anterior
                ? `Ciclo ${r.anterior.ciclo} → ciclo ${r.atual.ciclo}`
                : `Ciclo ${r.atual.ciclo} (primeiro)`}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Reincidências em aberto</dt>
            <dd>{r.reincidentes.length}</dd>
          </div>
        </dl>
      </Painel>
      <div className="grid gap-4 lg:grid-cols-2">
        {blocos.map(([t, xs, sub, tom]) => (
          <Painel key={t} titulo={t} sub={sub}>
            {!xs.length ? (
              <p className="text-sm text-muted-foreground">Nenhum item.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {xs.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex items-start justify-between gap-2">
                    <span>{a.acao}</span>
                    <Selo tom={tom}>{a.categoria}</Selo>
                  </li>
                ))}
                {xs.length > 8 && (
                  <li className="text-xs text-muted-foreground">e mais {xs.length - 8}</li>
                )}
              </ul>
            )}
          </Painel>
        ))}
      </div>
    </div>
  );
}
