import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Columns3, Download, ExternalLink, Layers, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useAcessoDcs,
  useAnalistas,
  useCarteira,
  type LinhaCarteira,
  type StatusAnalise,
} from "@/lib/dcs/dados";
import { artefato as A, type StatusCobertura } from "@/lib/dcs/motor";
import {
  cx,
  dataBR,
  Estado,
  Indice,
  moeda,
  pipedriveDeal,
  SeloAnalise,
  SeloCobertura,
  SeloPrioridade,
  Seletor,
  Titulo,
} from "@/components/dcs/ui";

type Busca = {
  q?: string | undefined;
  responsavel?: string | undefined;
  status?: StatusAnalise | "" | undefined;
  cobertura?: StatusCobertura | "" | undefined;
  analista?: string | undefined;
  inativos?: boolean | undefined;
};
const ETAPA = A.STAGES as Record<number, string>;
export const Route = createFileRoute("/_authenticated/dcs/carteira")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    responsavel: typeof s["responsavel"] === "string" ? s["responsavel"] : undefined,
    status: typeof s["status"] === "string" ? (s["status"] as StatusAnalise) : undefined,
    cobertura: typeof s["cobertura"] === "string" ? (s["cobertura"] as StatusCobertura) : undefined,
    analista: typeof s["analista"] === "string" ? s["analista"] : undefined,
    inativos: s["inativos"] === true || s["inativos"] === "true" ? true : undefined,
  }),
  component: Carteira,
});

const POR_PAGINA = 50;
const PO = { critica: 0, alta: 1, media: 2, baixa: 3 } as const;
type Ctx = { fin: boolean; nomes: Map<string, string> };
type Coluna = {
  id: string;
  rotulo: string;
  fixa?: boolean;
  fin?: boolean;
  direita?: boolean;
  ordem?: (a: LinhaCarteira, b: LinhaCarteira) => number;
  celula: (l: LinhaCarteira, c: Ctx) => ReactNode;
  csv: (l: LinhaCarteira, c: Ctx) => string | number;
};
const pctAnalisado = (l: LinhaCarteira) => (l.diag?.completude ?? null) as number | null;
const opp = (l: LinhaCarteira) =>
  ((l.diag?.derivado as { opp?: number } | null)?.opp ?? null) as number | null;
const COLUNAS: Coluna[] = [
  {
    id: "cliente",
    rotulo: "Cliente",
    fixa: true,
    ordem: (a, b) => a.c.nome.localeCompare(b.c.nome),
    celula: (l) => (
      <>
        <Link
          to="/dcs/cliente/$key"
          params={{ key: l.c.key }}
          className="font-medium hover:text-primary"
        >
          {l.c.nome}
        </Link>
        {!l.c.ativo && <span className="ml-1 text-xs text-muted-foreground">(inativo)</span>}
      </>
    ),
    csv: (l) => l.c.nome,
  },
  {
    id: "codigo",
    rotulo: "Código",
    celula: (l) => l.c.codigo ?? "—",
    csv: (l) => l.c.codigo ?? "",
  },
  {
    id: "responsavel",
    rotulo: "Responsável",
    ordem: (a, b) => (a.c.owner_nome ?? "").localeCompare(b.c.owner_nome ?? ""),
    celula: (l) => l.c.owner_nome ?? "—",
    csv: (l) => l.c.owner_nome ?? "",
  },
  {
    id: "valor",
    rotulo: "Valor",
    fin: true,
    direita: true,
    ordem: (a, b) => (b.mrr ?? -1) - (a.mrr ?? -1),
    celula: (l) => moeda(l.mrr),
    csv: (l) => l.mrr ?? "",
  },
  {
    id: "etapa",
    rotulo: "Etapa",
    celula: (l) => ETAPA[l.c.stage_id]?.trim() ?? l.c.stage_id,
    csv: (l) => ETAPA[l.c.stage_id]?.trim() ?? l.c.stage_id,
  },
  {
    id: "status",
    rotulo: "Status",
    ordem: (a, b) => a.status.localeCompare(b.status),
    celula: (l) => <SeloAnalise s={l.status} />,
    csv: (l) => l.status,
  },
  {
    id: "analista",
    rotulo: "Analista",
    celula: (l, c) => (l.diag ? (c.nomes.get(l.diag.analista_id) ?? "—") : "—"),
    csv: (l, c) => (l.diag ? (c.nomes.get(l.diag.analista_id) ?? "") : ""),
  },
  {
    id: "indice",
    rotulo: "Índice",
    ordem: (a, b) => (a.diag?.indice ?? 999) - (b.diag?.indice ?? 999),
    celula: (l) =>
      l.diag?.status === "concluido" ? (
        <Indice valor={l.diag.indice} />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csv: (l) => (l.diag?.status === "concluido" ? (l.diag.indice ?? "") : ""),
  },
  {
    id: "analisado",
    rotulo: "% analisado",
    direita: true,
    ordem: (a, b) => (pctAnalisado(b) ?? -1) - (pctAnalisado(a) ?? -1),
    celula: (l) => (pctAnalisado(l) != null ? `${pctAnalisado(l)}%` : "—"),
    csv: (l) => pctAnalisado(l) ?? "",
  },
  {
    id: "contato",
    rotulo: "Último contato",
    celula: (l) => (
      <>
        {dataBR(l.cob?.data_contato_efetivo)}
        {l.divergencia && (
          <span
            className="block text-[11px] text-amber-700"
            title="As atividades indicam contato mais recente que o campo do Pipedrive"
          >
            divergência com atividades
          </span>
        )}
      </>
    ),
    csv: (l) => l.cob?.data_contato_efetivo ?? "",
  },
  {
    id: "dias",
    rotulo: "Dias",
    direita: true,
    ordem: (a, b) => (b.cobStatus.dias ?? 9999) - (a.cobStatus.dias ?? 9999),
    celula: (l) => l.cobStatus.dias ?? "—",
    csv: (l) => l.cobStatus.dias ?? "",
  },
  {
    id: "cobertura",
    rotulo: "Cobertura",
    celula: (l) => <SeloCobertura k={l.cobStatus.k} />,
    csv: (l) => l.cobStatus.k,
  },
  {
    id: "proximo",
    rotulo: "Próximo contato",
    celula: (l) => dataBR(l.cob?.proximo?.date),
    csv: (l) => l.cob?.proximo?.date ?? "",
  },
  {
    id: "oportunidades",
    rotulo: "Oportunidades",
    direita: true,
    ordem: (a, b) => (opp(b) ?? -1) - (opp(a) ?? -1),
    celula: (l) => opp(l) ?? "—",
    csv: (l) => opp(l) ?? "",
  },
  {
    id: "prioridade",
    rotulo: "Prioridade",
    ordem: (a, b) =>
      (a.maxPrioridade ? PO[a.maxPrioridade] : 9) - (b.maxPrioridade ? PO[b.maxPrioridade] : 9),
    celula: (l) =>
      l.acoesAbertas ? (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <SeloPrioridade p={l.maxPrioridade} />
          <span className="text-xs text-muted-foreground">{l.acoesAbertas} ações</span>
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
    csv: (l) => l.maxPrioridade ?? "",
  },
  {
    id: "pipedrive",
    rotulo: "Pipedrive",
    celula: (l) => (
      <a
        href={pipedriveDeal(l.c.deal_id)}
        target="_blank"
        rel="noreferrer"
        className="inline-flex text-muted-foreground hover:text-primary"
        aria-label={`Abrir ${l.c.nome} no Pipedrive`}
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    ),
    csv: (l) => pipedriveDeal(l.c.deal_id),
  },
];
const PADRAO = [
  "cliente",
  "responsavel",
  "valor",
  "status",
  "analista",
  "indice",
  "analisado",
  "contato",
  "dias",
  "cobertura",
  "proximo",
  "oportunidades",
  "prioridade",
  "pipedrive",
];
const CHAVE_COLS = "dcs:carteira-colunas";

function Carteira() {
  const busca = Route.useSearch();
  const nav = Route.useNavigate();
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const nomes = useAnalistas();
  const q = useCarteira(!!busca.inativos);
  const ctx: Ctx = { fin, nomes: nomes.data ?? new Map() };
  // Sem permissão financeira a ordem padrão é alfabética (não permite inferir valores).
  const [ordem, setOrdem] = useState<{ id: string; inv: boolean }>({ id: "valor", inv: false });
  const [visiveis, setVisiveis] = useState<string[]>(PADRAO);
  const [agrupar, setAgrupar] = useState(false);
  const [pagina, setPagina] = useState(0);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(CHAVE_COLS) ?? "null");
      if (Array.isArray(v)) setVisiveis(v);
    } catch {
      /* padrão */
    }
  }, []);
  const ordemEfetiva = !fin && ordem.id === "valor" ? { id: "cliente", inv: false } : ordem;
  const cols = COLUNAS.filter((c) => (c.fixa || visiveis.includes(c.id)) && (!c.fin || fin));
  const set = (p: Partial<Busca>) => {
    setPagina(0);
    void nav({ search: (s: Busca) => ({ ...s, ...p }), replace: true });
  };
  const alternarCol = (id: string) => {
    const n = visiveis.includes(id) ? visiveis.filter((x) => x !== id) : [...visiveis, id];
    setVisiveis(n);
    try {
      localStorage.setItem(CHAVE_COLS, JSON.stringify(n));
    } catch {
      /* sem armazenamento */
    }
  };
  const responsaveis = useMemo(
    () =>
      [...new Set((q.data ?? []).map((l) => l.c.owner_nome ?? "—"))]
        .sort()
        .map((r) => [r, r] as const),
    [q.data],
  );
  const analistas = useMemo(
    () =>
      [
        ...new Set((q.data ?? []).map((l) => l.diag?.analista_id).filter((v): v is string => !!v)),
      ].map((id) => [id, nomes.data?.get(id) ?? "Usuário sem nome"] as const),
    [q.data, nomes.data],
  );
  const linhas = useMemo(() => {
    const t = (busca.q ?? "").toLowerCase().trim();
    const r = (q.data ?? []).filter(
      (l) =>
        (!t ||
          l.c.nome.toLowerCase().includes(t) ||
          (l.c.codigo ?? "").toLowerCase().includes(t)) &&
        (!busca.responsavel || (l.c.owner_nome ?? "—") === busca.responsavel) &&
        (!busca.status ||
          l.status === busca.status ||
          (busca.status === "concluido" && l.status === "concluido_pendencias")) &&
        (!busca.cobertura || l.cobStatus.k === busca.cobertura) &&
        (!busca.analista || l.diag?.analista_id === busca.analista),
    );
    const col = COLUNAS.find((c) => c.id === ordemEfetiva.id);
    const cmp = col?.ordem ?? COLUNAS[0]!.ordem!;
    const sinal = ordemEfetiva.inv ? -1 : 1;
    r.sort((a, b) => sinal * cmp(a, b) || a.c.nome.localeCompare(b.c.nome));
    if (agrupar) r.sort((a, b) => (a.c.owner_nome ?? "").localeCompare(b.c.owner_nome ?? ""));
    return r;
  }, [q.data, busca, ordemEfetiva.id, ordemEfetiva.inv, agrupar]);
  const total = linhas.reduce((s, l) => s + (l.mrr ?? 0), 0);
  const pag = agrupar ? linhas : linhas.slice(pagina * POR_PAGINA, (pagina + 1) * POR_PAGINA);
  const grupos = useMemo(() => {
    const m = new Map<string, { n: number; valor: number }>();
    for (const l of linhas) {
      const k = l.c.owner_nome ?? "—";
      const v = m.get(k) ?? { n: 0, valor: 0 };
      v.n++;
      v.valor += l.mrr ?? 0;
      m.set(k, v);
    }
    return m;
  }, [linhas]);

  const exportar = () => {
    const ex = cols;
    const csv = [ex.map((c) => c.rotulo), ...linhas.map((l) => ex.map((c) => c.csv(l, ctx)))]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = `carteira-dinamize-cs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };
  const ordenar = (id: string) => setOrdem((o) => ({ id, inv: o.id === id ? !o.inv : false }));

  return (
    <>
      <Titulo
        titulo="Carteira de clientes"
        sub={`${linhas.length} cliente(s) e-commerce${fin && linhas.length ? ` · ${moeda(total)} em valor registrado no Pipedrive` : ""}`}
        acao={
          <>
            <button
              type="button"
              onClick={() => setAgrupar(!agrupar)}
              aria-pressed={agrupar}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm",
                agrupar
                  ? "border-primary bg-primary-soft text-primary"
                  : "bg-card hover:border-primary/40",
              )}
            >
              <Layers className="h-4 w-4" /> Agrupar por responsável
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm hover:border-primary/40">
                <Columns3 className="h-4 w-4" /> Colunas
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Colunas visíveis</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {COLUNAS.filter((c) => !c.fixa && (!c.fin || fin)).map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={visiveis.includes(c.id)}
                    onCheckedChange={() => alternarCol(c.id)}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.rotulo}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {acesso.data?.exportar && (
              <button
                type="button"
                onClick={exportar}
                disabled={!linhas.length}
                className="inline-flex h-9 items-center gap-2 rounded-lg border bg-card px-3 text-sm hover:border-primary/40 disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> Exportar CSV
              </button>
            )}
          </>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] md:grid-cols-3 xl:grid-cols-6">
        <label className="col-span-2 flex flex-col gap-1 text-xs font-medium text-muted-foreground md:col-span-1 xl:col-span-2">
          Cliente ou código
          <span className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
            <input
              defaultValue={busca.q ?? ""}
              onChange={(e) => set({ q: e.target.value || undefined })}
              placeholder="Buscar"
              className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </span>
        </label>
        <Seletor
          rotulo="Responsável"
          valor={busca.responsavel}
          opcoes={responsaveis}
          onChange={(v) => set({ responsavel: v || undefined })}
        />
        <Seletor
          rotulo="Analista"
          valor={busca.analista}
          opcoes={analistas}
          onChange={(v) => set({ analista: v || undefined })}
        />
        <Seletor
          rotulo="Status"
          valor={busca.status ?? ""}
          opcoes={
            [
              ["aguardando", "Aguardando análise"],
              ["em_andamento", "Em análise"],
              ["concluido", "Concluída"],
              ["concluido_pendencias", "Concluída com pendências"],
            ] as const
          }
          onChange={(v) => set({ status: (v || undefined) as StatusAnalise | undefined })}
        />
        <Seletor
          rotulo="Cobertura"
          valor={busca.cobertura ?? ""}
          opcoes={
            [
              ["ok", "Em dia"],
              ["atencao", "Atenção"],
              ["pendente", "Pendente"],
              ["critico", "Crítico"],
              ["sem_registro", "Sem registro"],
              ["indisp", "Indisponível"],
            ] as const
          }
          onChange={(v) => set({ cobertura: (v || undefined) as StatusCobertura | undefined })}
        />
        <label className="col-span-full flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!busca.inativos}
            onChange={(e) => set({ inativos: e.target.checked || undefined })}
            className="accent-[var(--primary)]"
          />
          Incluir clientes inativos
        </label>
      </div>
      <Estado
        carregando={q.isLoading}
        erro={q.error}
        vazio={!q.isLoading && !linhas.length && "Nenhum cliente encontrado com esses filtros."}
      >
        <div className="dcs-tabela max-h-[calc(100dvh-220px)] rounded-xl border bg-card shadow-[var(--glow-sm)]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={
                      ordemEfetiva.id === c.id
                        ? ordemEfetiva.inv
                          ? "descending"
                          : "ascending"
                        : undefined
                    }
                    className={cx(
                      "whitespace-nowrap border-b px-3 py-2.5 text-xs font-semibold text-muted-foreground",
                      c.direita ? "text-right" : "text-left",
                    )}
                  >
                    {c.ordem ? (
                      <button
                        type="button"
                        onClick={() => ordenar(c.id)}
                        className="inline-flex items-center gap-1 hover:text-foreground"
                      >
                        {c.rotulo}
                        {ordemEfetiva.id === c.id &&
                          (ordemEfetiva.inv ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          ))}
                      </button>
                    ) : (
                      c.rotulo
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pag.map((l, i) => {
                const grupo = l.c.owner_nome ?? "—";
                const novo = agrupar && (i === 0 || (pag[i - 1]!.c.owner_nome ?? "—") !== grupo);
                const g = grupos.get(grupo);
                return (
                  <FragmentoGrupo key={l.c.key}>
                    {novo && (
                      <tr className="bg-surface-2">
                        <td
                          colSpan={cols.length}
                          className="border-t px-3 py-2 text-xs font-semibold"
                        >
                          {grupo} · {g?.n} cliente(s){fin ? ` · ${moeda(g?.valor ?? 0)}` : ""}
                        </td>
                      </tr>
                    )}
                    <tr className={cx("hover:bg-surface-2", !l.c.ativo && "opacity-60")}>
                      {cols.map((c) => (
                        <td
                          key={c.id}
                          className={cx(
                            "border-t px-3 py-2.5",
                            c.direita && "text-right tabular-nums",
                            c.id !== "cliente" && "whitespace-nowrap",
                          )}
                        >
                          {c.celula(l, ctx)}
                        </td>
                      ))}
                    </tr>
                  </FragmentoGrupo>
                );
              })}
            </tbody>
          </table>
        </div>
        {!agrupar && linhas.length > POR_PAGINA && (
          <div className="mt-3 flex items-center justify-end gap-2 text-sm">
            <button
              type="button"
              disabled={!pagina}
              onClick={() => setPagina(pagina - 1)}
              className="h-8 rounded-lg border bg-card px-3 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-muted-foreground">
              Página {pagina + 1} de {Math.ceil(linhas.length / POR_PAGINA)}
            </span>
            <button
              type="button"
              disabled={(pagina + 1) * POR_PAGINA >= linhas.length}
              onClick={() => setPagina(pagina + 1)}
              className="h-8 rounded-lg border bg-card px-3 disabled:opacity-50"
            >
              Próxima
            </button>
          </div>
        )}
      </Estado>
    </>
  );
}
const FragmentoGrupo = ({ children }: { children: ReactNode }) => <>{children}</>;

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
      className="h-9 rounded-lg border bg-card px-2 text-sm"
    >
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );
}
