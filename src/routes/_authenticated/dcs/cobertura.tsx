import { ComDica } from "@/components/dcs/Ajuda";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { Search } from "lucide-react";
import { useAcessoDcs, useCarteira, useStatusSync } from "@/lib/dcs/dados";
import type { StatusCobertura } from "@/lib/dcs/motor";
import { cobertura as contarCob, porResponsavel } from "@/lib/dcs/indicadores";
import { paraIndicador } from "@/lib/dcs/dados";
import {
  Barra,
  dataBR,
  dataHoraBR,
  Estado,
  Kpi,
  moeda,
  Painel,
  SeloCobertura,
  Seletor,
  Tabela,
  Titulo,
  Vazio,
} from "@/components/dcs/ui";

type Busca = {
  q?: string | undefined;
  resp?: string | undefined;
  status?: StatusCobertura | undefined;
};
const s = (v: unknown) => (typeof v === "string" && v ? v : undefined);
export const Route = createFileRoute("/_authenticated/dcs/cobertura")({
  validateSearch: (x: Record<string, unknown>): Busca => ({
    q: s(x["q"]),
    resp: s(x["resp"]),
    status: s(x["status"]) as StatusCobertura | undefined,
  }),
  component: Cobertura,
});

const FAIXAS: [StatusCobertura, string, "ok" | "aviso" | "critico" | "neutro" | "info"][] = [
  ["ok", "Em dia", "ok"],
  ["atencao", "Atenção", "aviso"],
  ["pendente", "Pendente", "aviso"],
  ["critico", "Crítico", "critico"],
  ["sem_registro", "Sem registro", "neutro"],
  ["indisp", "Indisponível", "neutro"],
];
const PESO: Record<StatusCobertura, number> = {
  sem_registro: 0,
  critico: 1,
  pendente: 2,
  atencao: 3,
  indisp: 4,
  ok: 5,
};

function Cobertura() {
  const b = Route.useSearch();
  const nav = Route.useNavigate();
  const set = (p: Partial<Busca>) =>
    void nav({ search: (x: Busca) => ({ ...x, ...p }), replace: true });
  const q = useCarteira();
  const fin = !!useAcessoDcs().data?.financeiro;
  const st = useStatusSync();
  const ultima = st.data?.cobertura.sucesso?.concluido_em;
  const r = useMemo(() => {
    const l = q.data ?? [];
    const filtrada = l.filter((x) => !b.resp || (x.c.owner_nome ?? "Sem responsável") === b.resp);
    const t = (b.q ?? "").toLowerCase().trim();
    const lista = filtrada
      .filter(
        (x) =>
          (!b.status || x.cobStatus.k === b.status) && (!t || x.c.nome.toLowerCase().includes(t)),
      )
      .sort(
        (a, c) =>
          PESO[a.cobStatus.k] - PESO[c.cobStatus.k] ||
          (c.cobStatus.dias ?? 9999) - (a.cobStatus.dias ?? 9999),
      );
    return {
      total: filtrada.length,
      cont: contarCob(filtrada.map(paraIndicador)),
      lista,
      div: filtrada.filter((x) => x.divergencia),
      resp: porResponsavel(l.map(paraIndicador)),
      respOpcoes: [...new Set(l.map((x) => x.c.owner_nome ?? "Sem responsável"))]
        .sort()
        .map((v) => [v, v] as const),
    };
  }, [q.data, b]);
  return (
    <>
      <Titulo
        titulo="Cobertura de CS"
        sub={
          <>
            Contato efetivo pelo campo “Data do último contato efetivo” do Pipedrive · atualizado em{" "}
            {dataHoraBR(ultima)}.
          </>
        }
      />
      <Estado carregando={q.isLoading} erro={q.error}>
        <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {FAIXAS.map(([k, rot, tom]) => (
            <button
              key={k}
              type="button"
              onClick={() => set({ status: b.status === k ? undefined : k })}
              className="h-full text-left"
              aria-pressed={b.status === k}
            >
              <Kpi
                rotulo={rot}
                valor={r.cont[k]}
                detalhe={
                  r.total ? `${Math.round((100 * r.cont[k]) / r.total)}% da carteira` : undefined
                }
                tom={tom}
              />
            </button>
          ))}
        </div>
        <div className="mb-4 grid grid-cols-1 gap-3 rounded-xl border bg-card p-3 shadow-[var(--glow-sm)] sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Cliente
            <span className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4" />
              <input
                value={b.q ?? ""}
                onChange={(e) => set({ q: e.target.value || undefined })}
                placeholder="Buscar"
                className="h-9 w-full rounded-lg border bg-card pl-8 pr-2 text-sm font-normal text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </span>
          </label>
          <Seletor
            rotulo="Responsável"
            valor={b.resp}
            opcoes={r.respOpcoes}
            onChange={(v) => set({ resp: v || undefined })}
          />
          <Seletor
            rotulo="Situação"
            valor={b.status}
            opcoes={FAIXAS.map(([k, rot]) => [k, rot] as const)}
            onChange={(v) => set({ status: v || undefined })}
          />
        </div>
        <div className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0">
            {r.lista.length ? (
              <Tabela className="max-h-[70dvh]">
                <thead className="bg-surface-2">
                  <tr>
                    <th>Cliente</th>
                    <th>Responsável</th>
                    {fin && <th className="text-right">Valor</th>}
                    <th>Último contato efetivo</th>
                    <th className="text-right">Dias</th>
                    <th>Situação</th>
                    <th>Última tentativa</th>
                    <th>Próximo agendado</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lista.map((l) => (
                    <tr key={l.c.key}>
                      <td>
                        <Link
                          to="/dcs/cliente/$key"
                          params={{ key: l.c.key }}
                          className="font-medium hover:text-primary"
                        >
                          {l.c.nome}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{l.c.owner_nome ?? "—"}</td>
                      {fin && (
                        <td className="whitespace-nowrap text-right tabular-nums">
                          {moeda(l.mrr)}
                        </td>
                      )}
                      <td className="whitespace-nowrap tabular-nums">
                        {dataBR(l.cob?.data_contato_efetivo)}
                        {l.divergencia && (
                          <span className="block text-[11px] text-amber-700">
                            divergência com atividades
                          </span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">{l.cobStatus.dias ?? "—"}</td>
                      <td>
                        <SeloCobertura k={l.cobStatus.k} />
                      </td>
                      <td className="min-w-[200px] text-xs text-muted-foreground">
                        {l.cob?.ultima_tentativa
                          ? `${dataBR(l.cob.ultima_tentativa.date)} · ${l.cob.ultima_tentativa.subject}`
                          : "—"}
                      </td>
                      <td className="whitespace-nowrap tabular-nums">
                        {dataBR(l.cob?.proximo?.date)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            ) : (
              <Vazio titulo="Nenhum cliente nesta situação" />
            )}
          </div>
          <div className="space-y-4">
            <Painel
              titulo={<ComDica termo="cobertura">Cobertura por responsável</ComDica>}
              sub="Em dia + atenção"
            >
              <ul className="space-y-2.5 text-sm">
                {r.resp.map((x) => (
                  <li key={x.nome} className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => set({ resp: x.nome })}
                      className="min-w-0 truncate text-left hover:text-primary"
                    >
                      {x.nome}
                    </button>
                    <span className="flex shrink-0 items-center gap-2">
                      <Barra v={x.cobOk} t={x.n} cor="bg-emerald-500" largura="w-20" />
                      <span className="w-14 text-right text-xs text-red-700">
                        {x.criticos ? `${x.criticos} crít.` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </Painel>
            <Painel
              titulo={`Divergências com atividades (${r.div.length})`}
              sub="Contato por atividade mais de 7 dias mais recente que o campo do Pipedrive (ou campo vazio)."
            >
              {r.div.length ? (
                <ul className="max-h-[360px] divide-y overflow-y-auto text-sm">
                  {r.div.map((l) => (
                    <li key={l.c.key} className="py-2">
                      <Link
                        to="/dcs/cliente/$key"
                        params={{ key: l.c.key }}
                        className="hover:text-primary"
                      >
                        {l.c.nome}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        Campo: {dataBR(l.cob?.data_contato_efetivo)} · Atividade:{" "}
                        {dataBR(l.cob?.contato_por_atividade?.date)}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Vazio titulo="Sem divergências" />
              )}
            </Painel>
          </div>
        </div>
      </Estado>
    </>
  );
}
