import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAcessoDcs, useCarteira, type LinhaCarteira, type StatusAnalise } from "@/lib/dcs/dados";
import { artefato as A, type StatusCobertura } from "@/lib/dcs/motor";
import {
  dataBR,
  Estado,
  Indice,
  moeda,
  pipedriveDeal,
  SeloAnalise,
  SeloCobertura,
  SeloPrioridade,
  Titulo,
} from "@/components/dcs/ui";

type Busca = {
  q?: string | undefined;
  responsavel?: string | undefined;
  status?: StatusAnalise | "" | undefined;
  cobertura?: StatusCobertura | "" | undefined;
  inativos?: boolean | undefined;
};
const ETAPA = A.STAGES as Record<number, string>;
export const Route = createFileRoute("/_authenticated/dcs/carteira")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    responsavel: typeof s["responsavel"] === "string" ? s["responsavel"] : undefined,
    status: typeof s["status"] === "string" ? (s["status"] as StatusAnalise) : undefined,
    cobertura: typeof s["cobertura"] === "string" ? (s["cobertura"] as StatusCobertura) : undefined,
    inativos: s["inativos"] === true || s["inativos"] === "true" ? true : undefined,
  }),
  component: Carteira,
});

const POR_PAGINA = 50;
type Ordem = "valor" | "nome" | "indice" | "dias" | "prioridade";

function Carteira() {
  const busca = Route.useSearch();
  const nav = Route.useNavigate();
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const q = useCarteira(!!busca.inativos);
  // Sem permissão financeira a ordem padrão é alfabética (não permite inferir valores).
  const [ordem, setOrdem] = useState<Ordem>(fin ? "valor" : "nome");
  const [pagina, setPagina] = useState(0);
  const set = (p: Partial<Busca>) => {
    setPagina(0);
    void nav({ search: (s: Busca) => ({ ...s, ...p }), replace: true });
  };
  const responsaveis = useMemo(
    () => [...new Set((q.data ?? []).map((l) => l.c.owner_nome ?? "—"))].sort(),
    [q.data],
  );
  const linhas = useMemo(() => {
    const t = (busca.q ?? "").toLowerCase().trim();
    const PO = { critica: 0, alta: 1, media: 2, baixa: 3 } as const;
    const r = (q.data ?? []).filter(
      (l) =>
        (!t || l.c.nome.toLowerCase().includes(t) || (l.c.codigo ?? "").includes(t)) &&
        (!busca.responsavel || (l.c.owner_nome ?? "—") === busca.responsavel) &&
        (!busca.status || l.status === busca.status) &&
        (!busca.cobertura || l.cobStatus.k === busca.cobertura),
    );
    const cmp: Record<Ordem, (a: LinhaCarteira, b: LinhaCarteira) => number> = {
      valor: (a, b) => (b.mrr ?? -1) - (a.mrr ?? -1),
      nome: (a, b) => a.c.nome.localeCompare(b.c.nome),
      indice: (a, b) => (a.diag?.indice ?? 999) - (b.diag?.indice ?? 999),
      dias: (a, b) => (b.cobStatus.dias ?? 9999) - (a.cobStatus.dias ?? 9999),
      prioridade: (a, b) =>
        (a.maxPrioridade ? PO[a.maxPrioridade] : 9) - (b.maxPrioridade ? PO[b.maxPrioridade] : 9),
    };
    return r.sort((a, b) => cmp[ordem](a, b) || a.c.nome.localeCompare(b.c.nome));
  }, [q.data, busca, ordem]);
  const total = linhas.reduce((s, l) => s + (l.mrr ?? 0), 0);
  const pag = linhas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);

  const exportar = () => {
    const cab = [
      "Cliente",
      "Código",
      "Responsável",
      ...(fin ? ["Valor (Pipedrive)"] : []),
      "Etapa",
      "Status",
      "Índice",
      "Último contato efetivo",
      "Dias",
      "Cobertura",
      "Próximo contato",
      "Ações abertas",
    ];
    const csv = [
      cab,
      ...linhas.map((l) => [
        l.c.nome,
        l.c.codigo ?? "",
        l.c.owner_nome ?? "",
        ...(fin ? [l.mrr ?? ""] : []),
        ETAPA[l.c.stage_id] ?? l.c.stage_id,
        l.status,
        l.diag?.indice ?? "",
        l.cob?.data_contato_efetivo ?? "",
        l.cobStatus.dias ?? "",
        l.cobStatus.k,
        l.cob?.proximo?.date ?? "",
        l.acoesAbertas,
      ]),
    ]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `carteira-dinamize-cs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <>
      <Titulo
        titulo="Carteira de clientes"
        sub={`${linhas.length} cliente(s) e-commerce${fin && linhas.length ? ` · ${moeda(total)} em valor registrado no Pipedrive` : ""}`}
        acao={
          <Button variant="outline" size="sm" onClick={exportar} disabled={!linhas.length}>
            <Download className="mr-1 h-4 w-4" /> Exportar CSV
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar por nome ou código"
            defaultValue={busca.q ?? ""}
            onChange={(e) => set({ q: e.target.value || undefined })}
          />
        </div>
        <Filtro
          valor={busca.responsavel ?? ""}
          onChange={(v) => set({ responsavel: v || undefined })}
          opcoes={[
            ["", "Todos os responsáveis"],
            ...responsaveis.map((r) => [r, r] as [string, string]),
          ]}
        />
        <Filtro
          valor={busca.status ?? ""}
          onChange={(v) => set({ status: (v || undefined) as StatusAnalise | undefined })}
          opcoes={[
            ["", "Todos os status"],
            ["aguardando", "Aguardando"],
            ["em_andamento", "Em andamento"],
            ["concluido", "Concluído"],
            ["concluido_pendencias", "Concluído com pendências"],
          ]}
        />
        <Filtro
          valor={busca.cobertura ?? ""}
          onChange={(v) => set({ cobertura: (v || undefined) as StatusCobertura | undefined })}
          opcoes={[
            ["", "Toda a cobertura"],
            ["ok", "Em dia"],
            ["atencao", "Atenção"],
            ["pendente", "Pendente"],
            ["critico", "Crítico"],
            ["sem_registro", "Sem registro"],
          ]}
        />
        <Filtro
          valor={ordem}
          onChange={(v) => setOrdem(v as Ordem)}
          opcoes={[
            ...(fin ? [["valor", "Maior valor"] as [string, string]] : []),
            ["nome", "Nome"],
            ["prioridade", "Prioridade"],
            ["dias", "Mais dias sem contato"],
            ["indice", "Menor índice"],
          ]}
        />
        <label className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!busca.inativos}
            onChange={(e) => set({ inativos: e.target.checked || undefined })}
          />{" "}
          Incluir inativos
        </label>
      </div>
      <Estado
        carregando={q.isLoading}
        erro={q.error}
        vazio={!q.isLoading && !linhas.length && "Nenhum cliente encontrado com esses filtros."}
      >
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Responsável</th>
                {fin && <th className="px-3 py-2 text-right">Valor</th>}
                <th className="px-3 py-2">Etapa</th>
                <th className="px-3 py-2">Diagnóstico</th>
                <th className="px-3 py-2">Índice</th>
                <th className="px-3 py-2">Último contato efetivo</th>
                <th className="px-3 py-2">Cobertura</th>
                <th className="px-3 py-2">Próximo contato</th>
                <th className="px-3 py-2">Plano</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {pag.map((l) => (
                <tr
                  key={l.c.key}
                  className={`border-t hover:bg-muted/40 ${l.c.ativo ? "" : "opacity-60"}`}
                >
                  <td className="px-3 py-2">
                    <Link
                      to="/dcs/cliente/$key"
                      params={{ key: l.c.key }}
                      className="font-medium hover:text-primary"
                    >
                      {l.c.nome}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {l.c.codigo ? `#${l.c.codigo}` : "sem código"}
                      {!l.c.ativo && " · inativo"}
                    </div>
                  </td>
                  <td className="px-3 py-2">{l.c.owner_nome ?? "—"}</td>
                  {fin && <td className="px-3 py-2 text-right tabular-nums">{moeda(l.mrr)}</td>}
                  <td className="px-3 py-2 text-xs">
                    {ETAPA[l.c.stage_id]?.trim() ?? l.c.stage_id}
                  </td>
                  <td className="px-3 py-2">
                    <SeloAnalise s={l.status} />
                  </td>
                  <td className="px-3 py-2">
                    {l.diag ? (
                      <Indice valor={l.diag.indice} />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {dataBR(l.cob?.data_contato_efetivo)}
                    {l.divergencia && (
                      <div
                        className="text-[11px] text-amber-700"
                        title="A classificação de atividades encontrou contato mais recente que o campo do Pipedrive"
                      >
                        divergência com atividades
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <SeloCobertura k={l.cobStatus.k} dias={l.cobStatus.dias} />
                  </td>
                  <td className="px-3 py-2">{dataBR(l.cob?.proximo?.date)}</td>
                  <td className="px-3 py-2">
                    {l.acoesAbertas ? (
                      <span className="inline-flex items-center gap-1.5">
                        {l.acoesAbertas} <SeloPrioridade p={l.maxPrioridade} />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <a
                      href={pipedriveDeal(l.c.deal_id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-muted-foreground hover:text-primary"
                      title="Abrir no Pipedrive"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {linhas.length > POR_PAGINA && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <Button
              variant="outline"
              size="sm"
              disabled={!pagina}
              onClick={() => setPagina(pagina - 1)}
            >
              Anterior
            </Button>
            <span className="text-muted-foreground">
              Página {pagina + 1} de {Math.ceil(linhas.length / POR_PAGINA)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={(pagina + 1) * POR_PAGINA >= linhas.length}
              onClick={() => setPagina(pagina + 1)}
            >
              Próxima
            </Button>
          </div>
        )}
      </Estado>
    </>
  );
}

export function Filtro({
  valor,
  onChange,
  opcoes,
}: {
  valor: string;
  onChange: (v: string) => void;
  opcoes: [string, string][];
}) {
  return (
    <select
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border bg-card px-2 text-sm"
    >
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );
}
