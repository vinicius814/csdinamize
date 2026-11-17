import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useAcessoDcs, useCarteira } from "@/lib/dcs/dados";
import { artefato as A } from "@/lib/dcs/motor";
import { Estado, Kpi, moeda, Painel, Titulo } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/")({ component: VisaoGeral });

function VisaoGeral() {
  const q = useCarteira();
  const fin = !!useAcessoDcs().data?.financeiro;
  const r = useMemo(() => {
    const l = q.data ?? [];
    const soma = (f: (x: (typeof l)[number]) => boolean) =>
      l.filter(f).reduce((s, x) => s + (x.mrr ?? 0), 0);
    const analisado = (x: (typeof l)[number]) =>
      x.status === "concluido" || x.status === "concluido_pendencias";
    const porResp = new Map<string, { n: number; analisados: number; cobOk: number }>();
    for (const x of l) {
      const k = x.c.owner_nome ?? "—";
      const v = porResp.get(k) ?? { n: 0, analisados: 0, cobOk: 0 };
      v.n++;
      if (analisado(x)) v.analisados++;
      if (x.cobStatus.k === "ok" || x.cobStatus.k === "atencao") v.cobOk++;
      porResp.set(k, v);
    }
    // Adesão por recurso: só diagnósticos concluídos, denominador = itens efetivamente analisados.
    const adesao = new Map<string, { aus: number; base: number }>();
    for (const x of l) {
      if (!x.diag || x.diag.status !== "concluido") continue;
      for (const it of A.MAINS as unknown as { key: string }[]) {
        const s = x.diag.itens[it.key]?.s;
        if (!s || s === "nao_analisado" || s === "na") continue;
        const v = adesao.get(it.key) ?? { aus: 0, base: 0 };
        v.base++;
        if (s === "nao_impl" || s === "nao_funciona") v.aus++;
        adesao.set(it.key, v);
      }
    }
    return {
      total: l.length,
      valor: soma(() => true),
      aguardando: l.filter((x) => x.status === "aguardando").length,
      andamento: l.filter((x) => x.status === "em_andamento").length,
      concluidos: l.filter(analisado).length,
      valorAnalisado: soma(analisado),
      critico: l.filter((x) => x.cobStatus.k === "critico" || x.cobStatus.k === "sem_registro")
        .length,
      emDia: l.filter((x) => x.cobStatus.k === "ok").length,
      acoes: l.reduce((s, x) => s + x.acoesAbertas, 0),
      criticos: l.filter((x) => x.maxPrioridade === "critica").length,
      porResp: [...porResp.entries()].sort((a, b) => b[1].n - a[1].n),
      adesao: [...adesao.entries()]
        .filter(([, v]) => v.base > 0)
        .map(([k, v]) => ({ k, ...v, pct: Math.round((100 * v.aus) / v.base) }))
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 8),
    };
  }, [q.data]);
  const pct = r.total ? Math.round((100 * r.concluidos) / r.total) : 0;
  return (
    <>
      <Titulo
        titulo="Visão geral"
        sub="Carteira e-commerce do funil Customer Success, sincronizada com o Pipedrive."
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
          <Kpi rotulo="Clientes ativos" valor={r.total} to="/dcs/carteira" />
          {fin && (
            <Kpi
              rotulo="Valor da carteira"
              valor={moeda(r.valor)}
              detalhe="campo Valor do Pipedrive"
            />
          )}
          <Kpi
            rotulo="Aguardando análise"
            valor={r.aguardando}
            to="/dcs/carteira"
            search={{ status: "aguardando" }}
          />
          <Kpi
            rotulo="Em análise"
            valor={r.andamento}
            to="/dcs/carteira"
            search={{ status: "em_andamento" }}
          />
          <Kpi
            rotulo="Diagnosticados"
            valor={`${r.concluidos} · ${pct}%`}
            detalhe={
              fin
                ? `${moeda(r.valorAnalisado)} analisado · ${moeda(r.valor - r.valorAnalisado)} pendente`
                : `de ${r.total} clientes`
            }
            to="/dcs/carteira"
            search={{ status: "concluido" }}
          />
          <Kpi
            rotulo="Cobertura em dia"
            valor={r.emDia}
            detalhe={`de ${r.total} (≤30 dias)`}
            to="/dcs/carteira"
            search={{ cobertura: "ok" }}
          />
          <Kpi
            rotulo="Cobertura crítica"
            valor={r.critico}
            detalhe="mais de 60 dias ou sem registro"
            to="/dcs/carteira"
            search={{ cobertura: "critico" }}
          />
          <Kpi rotulo="Ações em aberto" valor={r.acoes} to="/dcs/planos" />
          <Kpi rotulo="Clientes com ação crítica" valor={r.criticos} to="/dcs/planos" />
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Painel titulo="Por responsável">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-1">Responsável</th>
                  <th>Clientes</th>
                  <th>Diagnosticados</th>
                  <th>Cobertura ≤45 dias</th>
                </tr>
              </thead>
              <tbody>
                {r.porResp.map(([nome, v]) => (
                  <tr key={nome} className="border-t">
                    <td className="py-1.5">
                      <Link
                        to="/dcs/carteira"
                        search={{ responsavel: nome }}
                        className="hover:text-primary"
                      >
                        {nome}
                      </Link>
                    </td>
                    <td>{v.n}</td>
                    <td>
                      <Barra v={v.analisados} t={v.n} />
                    </td>
                    <td>
                      <Barra v={v.cobOk} t={v.n} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Painel>
          <Painel titulo="Recursos com menor adesão">
            {r.adesao.length ? (
              <ul className="space-y-2 text-sm">
                {r.adesao.map((x) => (
                  <li key={x.k} className="flex items-center justify-between gap-3">
                    <span>{(A.ITEM_BY as Record<string, { l: string }>)[x.k]?.l}</span>
                    <span className="text-xs text-muted-foreground">
                      {x.aus} de {x.base} clientes analisados ({x.pct}%) sem o recurso ou com falha
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aparece quando houver diagnósticos concluídos.
              </p>
            )}
          </Painel>
        </div>
      </Estado>
    </>
  );
}

function Barra({ v, t }: { v: number; t: number }) {
  const p = t ? Math.round((100 * v) / t) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded bg-muted">
        <span className="block h-full bg-primary" style={{ width: `${p}%` }} />
      </span>
      <span className="tabular-nums text-xs text-muted-foreground">
        {v} ({p}%)
      </span>
    </span>
  );
}
