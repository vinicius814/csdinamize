/** Consultas e mutações do Dinamize CS (React Query). Cálculos sempre pelo motor (motor.ts). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as M from "./motor";
import { dcs, type DcsAcao, type DcsCliente, type DcsCobertura, type DcsDiagnostico } from "./db";

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
async function ok<R>(p: PromiseLike<{ data: R | null; error: unknown }>): Promise<R> {
  const { data, error } = await p;
  if (error) throw error;
  return data as R;
}

export function useAcessoDcs() {
  return useQuery({
    queryKey: ["dcs", "acesso"],
    queryFn: async () => {
      const [perfil, financeiro] = await Promise.all([
        ok(dcs.rpc("dcs_perfil")),
        ok(dcs.rpc("dcs_ve_financeiro")),
      ]);
      return { perfil: perfil as M.Perfil | null, financeiro: !!financeiro };
    },
    staleTime: 5 * 60_000,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ["dcs", "config"],
    queryFn: async () => {
      const r = await ok<{ id: string; versao: string; config: unknown } | null>(
        dcs.from("dcs_regras").select("id,versao,config").eq("ativa", true).maybeSingle(),
      );
      return {
        regrasId: r?.id ?? null,
        versao: r?.versao ?? "1",
        cfg: M.mesclarConfig(r?.config ?? null),
      };
    },
    staleTime: 10 * 60_000,
  });
}

export type StatusAnalise = "aguardando" | "em_andamento" | "concluido" | "concluido_pendencias";
export interface LinhaCarteira {
  c: DcsCliente;
  mrr: number | null;
  cob: DcsCobertura | null;
  cobStatus: ReturnType<typeof M.statusCobertura>;
  divergencia: ReturnType<typeof M.divergenciaContato>;
  diag: DcsDiagnostico | null;
  status: StatusAnalise;
  acoesAbertas: number;
  maxPrioridade: M.Prioridade | null;
}

/** Carteira visível ao usuário (a RLS limita clientes e valores; ~centenas de linhas, filtro no cliente). */
export function useCarteira(incluirInativos = false) {
  const conf = useConfig();
  return useQuery({
    queryKey: ["dcs", "carteira", incluirInativos],
    enabled: !!conf.data,
    queryFn: async (): Promise<LinhaCarteira[]> => {
      let q = dcs.from("dcs_clientes").select("*").order("nome");
      if (!incluirInativos) q = q.eq("ativo", true);
      const [clientes, fin, cob, diags, acoes, syncCob] = await Promise.all([
        ok(q),
        ok(dcs.from("dcs_clientes_financeiro").select("key,mrr")),
        ok(dcs.from("dcs_cobertura").select("*")),
        ok(dcs.from("dcs_diagnosticos").select("*").order("ciclo", { ascending: false })),
        ok(
          dcs
            .from("dcs_acoes")
            .select("cliente_key,prioridade,status,obsoleta")
            .eq("obsoleta", false),
        ),
        ok(
          dcs
            .from("dcs_sync_execucoes")
            .select("status,concluido_em")
            .eq("tipo", "cobertura")
            .eq("status", "sucesso")
            .order("concluido_em", { ascending: false })
            .limit(1),
        ),
      ]);
      const cfg = conf.data!.cfg;
      const mrr = new Map(fin.map((f) => [f.key, f.mrr]));
      const cobBy = new Map(cob.map((x) => [x.key, x]));
      const diagBy = new Map<string, DcsDiagnostico>();
      for (const d of diags) if (!diagBy.has(d.cliente_key)) diagBy.set(d.cliente_key, d);
      const ac = new Map<string, { n: number; p: M.Prioridade | null }>();
      const ordem: M.Prioridade[] = ["critica", "alta", "media", "baixa"];
      for (const a of acoes) {
        if (a.status === "implementado" || a.status === "nao_aprovado") continue;
        const v = ac.get(a.cliente_key) ?? { n: 0, p: null };
        v.n++;
        if (!v.p || ordem.indexOf(a.prioridade) < ordem.indexOf(v.p)) v.p = a.prioridade;
        ac.set(a.cliente_key, v);
      }
      const ultimaCob = syncCob[0]?.concluido_em;
      const sincronizado =
        !!ultimaCob && Date.now() - Date.parse(ultimaCob) < (cfg.cov.staleHours ?? 48) * 3600_000;
      const hoje = hojeSP();
      return clientes.map((c) => {
        const cb = cobBy.get(c.key) ?? null;
        const m = mrr.has(c.key) ? (mrr.get(c.key) ?? null) : null;
        const lim = M.limitesCobertura({ ownerId: c.owner_id, mrr: m }, cfg.cov);
        const d = diagBy.get(c.key) ?? null;
        const pend = (d?.derivado as { pend?: number } | null)?.pend ?? 0;
        const status: StatusAnalise = !d
          ? "aguardando"
          : d.status === "em_analise"
            ? "em_andamento"
            : pend > 0
              ? "concluido_pendencias"
              : "concluido";
        return {
          c,
          mrr: m,
          cob: cb,
          cobStatus: M.statusCobertura(cb?.data_contato_efetivo, lim, hoje, sincronizado && !!cb),
          divergencia: M.divergenciaContato(
            cb?.data_contato_efetivo ?? null,
            cb?.contato_por_atividade?.date ?? null,
          ),
          diag: d,
          status,
          acoesAbertas: ac.get(c.key)?.n ?? 0,
          maxPrioridade: ac.get(c.key)?.p ?? null,
        };
      });
    },
  });
}

export function useCliente(key: string) {
  return useQuery({
    queryKey: ["dcs", "cliente", key],
    queryFn: async () => {
      const [c, fin, cob, diags, acoes] = await Promise.all([
        ok<DcsCliente | null>(dcs.from("dcs_clientes").select("*").eq("key", key).maybeSingle()),
        ok<{ mrr: number | null } | null>(
          dcs.from("dcs_clientes_financeiro").select("mrr").eq("key", key).maybeSingle(),
        ),
        ok<DcsCobertura | null>(dcs.from("dcs_cobertura").select("*").eq("key", key).maybeSingle()),
        ok(
          dcs
            .from("dcs_diagnosticos")
            .select("*")
            .eq("cliente_key", key)
            .order("ciclo", { ascending: false }),
        ),
        ok(
          dcs
            .from("dcs_acoes")
            .select("*")
            .eq("cliente_key", key)
            .order("atualizado_em", { ascending: false }),
        ),
      ]);
      return { cliente: c, mrr: fin?.mrr ?? null, cobertura: cob, diagnosticos: diags, acoes };
    },
  });
}

export function useIniciarAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => ok(dcs.rpc("dcs_iniciar_analise", { p_key: key })),
    onSuccess: (_d, key) => {
      void qc.invalidateQueries({ queryKey: ["dcs", "cliente", key] });
      void qc.invalidateQueries({ queryKey: ["dcs", "carteira"] });
    },
  });
}

export interface ConteudoDiag {
  itens: Record<string, M.ItemResp>;
  metricas: Record<string, unknown>;
  resultados: Record<string, unknown>;
  meta: Record<string, unknown>;
}
/** Salva com controle otimista; devolve a nova versão. */
export async function salvarDiagnostico(
  id: string,
  versao: number,
  conteudo: ConteudoDiag,
  cfg: M.Config,
) {
  const derivado = M.derivado(toDiag(conteudo), cfg);
  return ok(
    dcs.rpc("dcs_salvar_diagnostico", {
      p_id: id,
      p_versao: versao,
      p_itens: conteudo.itens as never,
      p_metricas: conteudo.metricas as never,
      p_resultados: conteudo.resultados as never,
      p_meta: conteudo.meta as never,
      p_derivado: derivado as never,
    }),
  );
}
export const toDiag = (c: ConteudoDiag): M.Diagnostico =>
  ({
    items: c.itens,
    metrics: c.metricas,
    res: c.resultados,
    meta: c.meta,
  }) as unknown as M.Diagnostico;

/** Conclusão: congela o ciclo, mescla o plano (motor.mesclarPlano) e enfileira a atividade do Pipedrive. */
export async function concluirAnalise(args: {
  diag: DcsDiagnostico;
  versao: number;
  conteudo: ConteudoDiag;
  cfg: M.Config;
  acoesAtuais: DcsAcao[];
  resumo: string;
  proximaRevisao: string;
}) {
  const { diag, conteudo, cfg } = args;
  const hoje = hojeSP();
  const antigo: Record<string, M.RecPlano> = {};
  for (const a of args.acoesAtuais) {
    antigo[a.rec_id] = {
      id: a.rec_id,
      cat: a.categoria,
      ref: a.rec_id,
      problem: a.problema,
      action: a.acao,
      benefit: a.beneficio ?? "",
      priority: a.prioridade,
      complexity: a.complexidade ?? "media",
      who: a.quem ?? "ambos",
      days: 0,
      quick: a.ganho_rapido,
      state: "nao_impl",
      source: a.manual ? "manual" : "item",
      ...(a.manual ? { manual: true } : {}),
      ...(a.obsoleta ? { obsolete: true, obsoleteAt: a.obsoleta_em ?? hoje } : {}),
      firstCycle: a.primeiro_ciclo,
      lastCycle: a.ultimo_ciclo,
      recur: a.reincidencias,
      impl: {
        status: a.status,
        owner: a.responsavel ?? "",
        due: a.prazo ?? "",
        notes: a.observacoes ?? "",
        at: a.atualizado_em,
      },
    };
  }
  const plano = M.mesclarPlano(antigo, M.recomendacoes(toDiag(conteudo), cfg), diag.ciclo, hoje);
  const acoes = Object.values(plano).map((r) => ({
    rec_id: r.id,
    categoria: r.cat,
    problema: r.problem,
    acao: r.action,
    beneficio: r.benefit,
    prioridade: r.priority,
    complexidade: r.complexity,
    quem: r.who,
    ganho_rapido: r.quick,
    status: r.impl.status,
    prazo: r.impl.due || null,
    observacoes: r.impl.notes || null,
    manual: !!r.manual,
    obsoleta: !!r.obsolete,
    obsoleta_em: r.obsoleteAt ?? null,
    reincidencias: r.recur,
    primeiro_ciclo: r.firstCycle,
    ultimo_ciclo: r.lastCycle,
  }));
  return ok(
    dcs.rpc("dcs_concluir_analise", {
      p_id: diag.id,
      p_versao: args.versao,
      p_resumo: args.resumo,
      p_derivado: M.derivado(toDiag(conteudo), cfg) as never,
      p_acoes: acoes as never,
      p_proxima_revisao: args.proximaRevisao,
      p_registrar_pipedrive: true,
    }),
  );
}

export function useAtualizarAcao(key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      id: string;
      versao: number;
      campos: Partial<Pick<DcsAcao, "status" | "responsavel" | "prazo" | "observacoes">>;
    }) =>
      ok(
        dcs.rpc("dcs_atualizar_acao", {
          p_id: a.id,
          p_versao: a.versao,
          p_campos: a.campos as never,
        }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "cliente", key] });
      void qc.invalidateQueries({ queryKey: ["dcs", "planos"] });
    },
  });
}

export function usePlanos() {
  return useQuery({
    queryKey: ["dcs", "planos"],
    queryFn: async () => {
      const [acoes, clientes] = await Promise.all([
        ok(
          dcs
            .from("dcs_acoes")
            .select("*")
            .eq("obsoleta", false)
            .order("prazo", { ascending: true, nullsFirst: false }),
        ),
        ok(dcs.from("dcs_clientes").select("key,nome,owner_nome")),
      ]);
      const nome = new Map(clientes.map((c) => [c.key, c]));
      return acoes.map((a) => ({ ...a, cliente: nome.get(a.cliente_key) }));
    },
  });
}

export function useAlertas() {
  return useQuery({
    queryKey: ["dcs", "alertas"],
    queryFn: async () => {
      const [alertas, clientes] = await Promise.all([
        ok(dcs.from("dcs_alertas").select("*").order("tipo")),
        ok(dcs.from("dcs_clientes").select("key,nome,owner_nome")),
      ]);
      const nome = new Map(clientes.map((c) => [c.key, c]));
      return alertas.map((a) => ({ ...a, cliente: nome.get(a.cliente_key) }));
    },
  });
}

export function useIntegracoes() {
  return useQuery({
    queryKey: ["dcs", "integracoes"],
    queryFn: async () => {
      const [syncs, jobs, logs] = await Promise.all([
        ok(
          dcs
            .from("dcs_sync_execucoes")
            .select("*")
            .order("iniciado_em", { ascending: false })
            .limit(30),
        ),
        ok(
          dcs
            .from("dcs_jobs")
            .select("id,tipo,chave,status,tentativas,erro,resultado,criado_em,atualizado_em")
            .order("criado_em", { ascending: false })
            .limit(50),
        ),
        ok(
          dcs
            .from("dcs_integracao_logs")
            .select("id,em,origem,nivel,mensagem")
            .order("em", { ascending: false })
            .limit(50),
        ),
      ]);
      return { syncs, jobs, logs };
    },
    refetchInterval: 60_000,
  });
}

export { hojeSP };
