/** Consultas e mutações do Dinamize CS (React Query). Cálculos sempre pelo motor (motor.ts). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as M from "./motor";
import {
  dcs,
  type DcsSolicitacao,
  type DcsUsuario,
  type DcsAcao,
  type DcsCliente,
  type DcsCobertura,
  type DcsDiagnostico,
} from "./db";

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
      // Apenas para exibição: o banco revalida perfil, financeiro e edição em cada operação.
      const a = await ok(dcs.rpc("dcs_meu_acesso"));
      return {
        perfil: (a?.perfil ?? null) as M.Perfil | null,
        master: !!a?.master,
        financeiro: !!a?.financeiro,
        editar: !!a?.editar,
        exportar: !!a?.exportar,
        modulos: a?.modulos ?? null,
      };
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

/** Nomes dos analistas (perfis da aplicação) por id. */
export function useAnalistas() {
  return useQuery({
    queryKey: ["dcs", "analistas"],
    queryFn: async () => {
      const r = await ok(dcs.rpc("dcs_analistas"));
      return new Map((r ?? []).map((x) => [x.user_id, x.nome]));
    },
    staleTime: 10 * 60_000,
  });
}

export type EstadoSync = "sincronizado" | "sincronizando" | "pendente" | "falha" | "indisponivel";
/** Estado real das integrações a partir das execuções registradas (nunca presume conexão). */
export function useStatusSync() {
  const conf = useConfig();
  return useQuery({
    queryKey: ["dcs", "status-sync"],
    enabled: !!conf.data,
    queryFn: async () => {
      const [syncs, pedidos] = await Promise.all([
        ok(
          dcs
            .from("dcs_sync_execucoes")
            .select("tipo,status,iniciado_em,concluido_em,lidos,erro")
            .order("iniciado_em", { ascending: false })
            .limit(40),
        ),
        ok(
          dcs
            .from("dcs_solicitacoes_sync")
            .select("*")
            .order("solicitado_em", { ascending: false })
            .limit(10),
        ),
      ]);
      const limiteH = conf.data!.cfg.cov.staleHours ?? 48;
      const porTipo = (tipo: string) => {
        const doTipo = syncs.filter((x) => x.tipo === tipo);
        const ultima = doTipo[0] ?? null;
        const sucesso =
          doTipo.find((x) => x.status === "sucesso" || x.status === "parcial") ?? null;
        const pedido = pedidos.find((p) => p.tipo === tipo) ?? null;
        let estado: EstadoSync;
        if (!ultima) estado = "indisponivel";
        else if (ultima.status === "executando" || pedido?.status === "em_execucao")
          estado = "sincronizando";
        else if (pedido?.status === "pendente") estado = "pendente";
        else if (ultima.status === "falha") estado = "falha";
        else if (
          !sucesso?.concluido_em ||
          Date.now() - Date.parse(sucesso.concluido_em) > limiteH * 3600_000
        )
          estado = "pendente";
        else estado = "sincronizado";
        return { estado, ultima, sucesso, pedido };
      };
      const carteira = porTipo("carteira"),
        cobertura = porTipo("cobertura");
      const ordem: EstadoSync[] = [
        "falha",
        "sincronizando",
        "pendente",
        "indisponivel",
        "sincronizado",
      ];
      const geral =
        ordem.find((e) => carteira.estado === e || cobertura.estado === e) ?? "indisponivel";
      return { carteira, cobertura, geral, pedidos: pedidos as DcsSolicitacao[] };
    },
    refetchInterval: (q) =>
      q.state.data?.geral === "sincronizando" || q.state.data?.geral === "pendente"
        ? 15_000
        : 120_000,
  });
}

/** Botão "Atualizar carteira": registra o pedido; o n8n executa (nenhum segredo no navegador). */
export function useSolicitarSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await ok(dcs.rpc("dcs_solicitar_sync", { p_tipo: "carteira" }));
      return ok(dcs.rpc("dcs_solicitar_sync", { p_tipo: "cobertura" }));
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "status-sync"] }),
  });
}

export function useUsuarios(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "usuarios"],
    enabled: ativo,
    queryFn: async () => (await ok(dcs.rpc("dcs_listar_usuarios"))) as DcsUsuario[],
  });
}
export function useResponsaveisPD(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "responsaveis-admin"],
    enabled: ativo,
    queryFn: async () => ok(dcs.rpc("dcs_responsaveis_admin")),
  });
}
export function useSalvarPermissoes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (u: {
      user_id: string;
      perfil: "admin" | "cs" | "contas";
      financeiro: boolean;
      pode_editar: boolean;
      pode_exportar: boolean;
      ativo: boolean;
      carteiras: number[];
      clientes: string[];
    }) =>
      ok(
        dcs.rpc("dcs_salvar_permissoes", {
          p_user: u.user_id,
          p_perfil: u.perfil,
          p_financeiro: u.financeiro,
          p_editar: u.pode_editar,
          p_exportar: u.pode_exportar,
          p_ativo: u.ativo,
          p_carteiras: u.carteiras,
          p_clientes: u.clientes,
          p_modulos: null,
        }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "usuarios"] }),
  });
}
export function useAuditoria(entidade: string, ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "auditoria", entidade],
    enabled: ativo,
    queryFn: async () =>
      ok(
        dcs
          .from("dcs_auditoria")
          .select("*")
          .eq("entidade", entidade)
          .order("em", { ascending: false })
          .limit(50),
      ),
  });
}

export function useVersoesRegras(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "regras-versoes"],
    enabled: ativo,
    queryFn: async () =>
      ok(
        dcs
          .from("dcs_regras")
          .select("id,versao,ativa,metodologia,criado_em,criado_por")
          .order("criado_em", { ascending: false }),
      ),
  });
}
export function usePublicarRegras() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: M.Config) =>
      ok(
        dcs.rpc("dcs_publicar_regras", { p_config: cfg as never, p_metodologia: M.REGRAS_VERSAO }),
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs"] });
    },
  });
}

/** Todos os ciclos de diagnóstico visíveis (histórico global e evolução). */
export function useHistorico() {
  return useQuery({
    queryKey: ["dcs", "historico"],
    queryFn: async () => {
      const [diags, clientes] = await Promise.all([
        ok(
          dcs
            .from("dcs_diagnosticos")
            .select(
              "id,cliente_key,ciclo,status,analista_id,indice,completude,derivado,resumo,iniciado_em,salvo_em,concluido_em,proxima_revisao",
            )
            .order("iniciado_em", { ascending: false }),
        ),
        ok(dcs.from("dcs_clientes").select("key,nome,owner_nome,owner_id")),
      ]);
      const nome = new Map(clientes.map((c) => [c.key, c]));
      return diags.map((d) => ({ ...d, cliente: nome.get(d.cliente_key) }));
    },
  });
}

export { hojeSP };

/** Adapta a linha da carteira para os indicadores puros (indicadores.ts). */
export const paraIndicador = (x: LinhaCarteira) => ({
  key: x.c.key,
  nome: x.c.nome,
  responsavel: x.c.owner_nome ?? "Sem responsável",
  ownerId: x.c.owner_id,
  mrr: x.mrr,
  status: x.status,
  cob: x.cobStatus.k,
  dias: x.cobStatus.dias,
  diag: x.diag
    ? {
        status: x.diag.status,
        analista_id: x.diag.analista_id,
        itens: x.diag.itens as Record<
          string,
          { s?: string; sub?: Record<string, unknown> } | undefined
        >,
        derivado: x.diag.derivado,
        concluido_em: x.diag.concluido_em,
      }
    : null,
  acoesAbertas: x.acoesAbertas,
  maxPrioridade: x.maxPrioridade,
});
