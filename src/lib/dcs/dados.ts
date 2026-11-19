/** Consultas e mutações do Dinamize CS (React Query). Cálculos sempre pelo motor (motor.ts). */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as M from "./motor";
import * as SU from "./semuso";
import {
  dcs,
  type DcsSolicitacao,
  type DcsUsuario,
  type DcsAcao,
  type DcsCliente,
  type DcsCobertura,
  type DcsDiagnostico,
  type DcsPreCadastro,
  type DcsUtilizacao,
  type DcsUtilizacaoEvento,
  type StatusRegistro,
} from "./db";

const hojeSP = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
async function ok<R>(p: PromiseLike<{ data: R | null; error: unknown }>): Promise<R> {
  const { data, error } = await p;
  if (error) throw error;
  return data as R;
}

export type Permissao =
  "concluir" | "planos" | "redistribuir" | "usuarios" | "config" | "integracoes";
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
        pipedrive: a?.pipedrive ?? null,
        trocaSenha: !!a?.troca_senha,
        beta: a?.beta !== false,
        permissoes: (a?.permissoes ?? {}) as Partial<Record<Permissao, boolean>>,
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
        semUso: SU.lerConfig(r?.config ?? null),
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
  /** Ações abertas com prazo vencido, críticas abertas e ganhos rápidos abertos (priorização operacional, D38). */
  acoesAtrasadas: number;
  acoesCriticas: number;
  ganhosRapidos: number;
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
            .select("cliente_key,prioridade,status,obsoleta,prazo,ganho_rapido")
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
      const ac = new Map<
        string,
        { n: number; p: M.Prioridade | null; atr: number; crit: number; gr: number }
      >();
      const ordem: M.Prioridade[] = ["critica", "alta", "media", "baixa"];
      const hojeAc = hojeSP();
      for (const a of acoes) {
        if (a.status === "implementado" || a.status === "nao_aprovado") continue;
        const v = ac.get(a.cliente_key) ?? { n: 0, p: null, atr: 0, crit: 0, gr: 0 };
        v.n++;
        if (a.prazo && a.prazo < hojeAc) v.atr++;
        if (a.prioridade === "critica") v.crit++;
        if (a.ganho_rapido) v.gr++;
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
          acoesAtrasadas: ac.get(c.key)?.atr ?? 0,
          acoesCriticas: ac.get(c.key)?.crit ?? 0,
          ganhosRapidos: ac.get(c.key)?.gr ?? 0,
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

/** Invalida tudo que depende do estado das análises (carteira, ficha, painéis, contadores). */
function invalidarAnalises(qc: ReturnType<typeof useQueryClient>, key?: string) {
  if (key) void qc.invalidateQueries({ queryKey: ["dcs", "cliente", key] });
  for (const k of ["carteira", "historico", "contadores", "planos", "alertas"])
    void qc.invalidateQueries({ queryKey: ["dcs", k] });
}

export function useIniciarAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => ok(dcs.rpc("dcs_iniciar_analise", { p_key: key })),
    onSuccess: (_d, key) => invalidarAnalises(qc, key),
  });
}

/** Admin: atribui uma análise ainda não iniciada a um analista (ou a si mesmo). */
export function useAtribuirAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { key: string; para: string }) =>
      ok(dcs.rpc("dcs_atribuir_analise", { p_key: a.key, p_para: a.para })),
    onSuccess: (_d, a) => invalidarAnalises(qc, a.key),
  });
}

/** Admin: redistribui ou assume (para = próprio usuário) uma análise em andamento. */
export function useTransferirAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; key: string; para: string; motivo: string }) =>
      ok(dcs.rpc("dcs_transferir_analise", { p_id: a.id, p_para: a.para, p_motivo: a.motivo })),
    onSuccess: (_d, a) => invalidarAnalises(qc, a.key),
  });
}

/** Reabre o ciclo mais recente concluído (analista responsável ou admin). */
export function useReabrirAnalise() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { id: string; key: string; motivo: string }) =>
      ok(dcs.rpc("dcs_reabrir_analise", { p_id: a.id, p_motivo: a.motivo })),
    onSuccess: (_d, a) => invalidarAnalises(qc, a.key),
  });
}

/** Ação manual no plano de ação. */
export function useCriarAcao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: {
      key: string;
      categoria: string;
      problema: string;
      acao: string;
      prioridade: string;
      complexidade: string | null;
      responsavel: string | null;
      prazo: string | null;
      ganho_rapido: boolean;
    }) =>
      ok(
        dcs.rpc("dcs_criar_acao", {
          p_key: a.key,
          p_categoria: a.categoria,
          p_problema: a.problema,
          p_acao: a.acao,
          p_prioridade: a.prioridade,
          p_complexidade: a.complexidade,
          p_responsavel: a.responsavel,
          p_prazo: a.prazo,
          p_ganho_rapido: a.ganho_rapido,
        }),
      ),
    onSuccess: (_d, a) => invalidarAnalises(qc, a.key),
  });
}

/** Usuários que podem receber análises (admin): perfil ativo com edição. Master e admins legados incluídos. */
export function useDestinosAnalise(ativo: boolean) {
  const q = useUsuarios(ativo);
  return {
    ...q,
    data: (q.data ?? []).filter(
      (u) => u.status === "ativo" && u.ativo && (u.perfil === "admin" || u.pode_editar),
    ),
  };
}

export function useTiposAtividade(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "tipos-atividade"],
    enabled: ativo,
    queryFn: async () =>
      ok(dcs.from("dcs_tipos_atividade").select("*").order("ocorrencias", { ascending: false })),
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
      campos: Partial<
        Pick<DcsAcao, "status" | "prioridade" | "responsavel" | "prazo" | "observacoes">
      >;
    }) =>
      ok(
        dcs.rpc("dcs_atualizar_acao", {
          p_id: a.id,
          p_versao: a.versao,
          p_campos: a.campos as never,
        }),
      ),
    onSuccess: () => invalidarAnalises(qc, key),
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
    mutationFn: async (x: M.Config | { cfg: M.Config; semUso: SU.ConfigSemUso }) => {
      // A seção semUso não faz parte do Config do artefato: preserva a publicada quando não for alterada.
      const atual =
        qc.getQueryData<{ semUso: SU.ConfigSemUso }>(["dcs", "config"])?.semUso ?? SU.CONFIG_PADRAO;
      const [cfg, semUso] =
        "semUso" in x && "cfg" in x ? [x.cfg, x.semUso] : [x as M.Config, atual];
      return ok(
        dcs.rpc("dcs_publicar_regras", {
          p_config: { ...cfg, semUso } as never,
          p_metodologia: M.REGRAS_VERSAO,
        }),
      );
    },
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

// ---------- Usuários: pré-cadastro, convite, Master ----------
export type NovoUsuario = {
  email: string;
  nome: string;
  perfil: "admin" | "cs" | "contas";
  financeiro: boolean;
  pode_editar: boolean;
  pode_exportar: boolean;
  ativo: boolean;
  carteiras: number[];
  clientes: string[];
  pipedrive_user_id: number | null;
};
export function usePreCadastros(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "pre-cadastros"],
    enabled: ativo,
    queryFn: async () =>
      (await ok(
        dcs.from("dcs_pre_cadastros").select("*").order("criado_em", { ascending: false }),
      )) as DcsPreCadastro[],
  });
}
export function useAcaoPreCadastro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ email, acao }: { email: string; acao: "revogar" | "convite" }) =>
      acao === "revogar"
        ? ok(dcs.rpc("dcs_revogar_pre_cadastro", { p_email: email }))
        : ok(dcs.rpc("dcs_registrar_convite", { p_email: email })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "pre-cadastros"] }),
  });
}
export function useTransferirMaster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (novo: string) => ok(dcs.rpc("dcs_transferir_master", { p_novo: novo })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs"] }),
  });
}

// ---------- Registro do diagnóstico no Pipedrive ----------
export function useStatusRegistro(diagId: string | null | undefined) {
  return useQuery({
    queryKey: ["dcs", "registro", diagId],
    enabled: !!diagId,
    refetchInterval: (q) => {
      const st = (q.state.data as StatusRegistro | null | undefined)?.status;
      return st === "pendente" || st === "processando" ? 15000 : false;
    },
    queryFn: async () =>
      (await ok(
        dcs.rpc("dcs_status_registro", { p_diag: diagId as string }),
      )) as StatusRegistro | null,
  });
}
export function useReprocessarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (diagId: string) =>
      ok(dcs.rpc("dcs_reprocessar_registro", { p_diag: diagId })),
    onSuccess: (_r, id) => void qc.invalidateQueries({ queryKey: ["dcs", "registro", id] }),
  });
}

// ---------- Contas sem utilização ----------
export function useUtilizacao() {
  return useQuery({
    queryKey: ["dcs", "utilizacao"],
    queryFn: async () => {
      const rows = (await ok(dcs.from("dcs_utilizacao").select("*"))) as DcsUtilizacao[];
      return new Map(rows.map((r) => [r.cliente_key, r]));
    },
  });
}
export function useEventosUtilizacao(key: string | null) {
  return useQuery({
    queryKey: ["dcs", "utilizacao-eventos", key],
    enabled: !!key,
    queryFn: async () =>
      (await ok(
        dcs
          .from("dcs_utilizacao_eventos")
          .select("*")
          .eq("cliente_key", key as string)
          .order("em", { ascending: false })
          .limit(50),
      )) as DcsUtilizacaoEvento[],
  });
}
export type MarcacaoSemUso = {
  key: string;
  ultima: string | null;
  desconhecida: boolean;
  motivo: string;
  obs: string;
  evidencias: string;
  responsavel: string | null;
  proxima: string;
  acao: string;
  intervalo: number | null;
};
export function useMarcarSemUso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (m: MarcacaoSemUso) =>
      ok(
        dcs.rpc("dcs_marcar_sem_utilizacao", {
          p_key: m.key,
          p_ultima: m.desconhecida ? null : m.ultima,
          p_desconhecida: m.desconhecida,
          p_motivo: m.motivo,
          p_obs: m.obs || null,
          p_evidencias: m.evidencias || null,
          p_responsavel: m.responsavel,
          p_proxima: m.proxima,
          p_acao: m.acao || null,
          p_intervalo: m.intervalo,
        }),
      ),
    onSuccess: (_r, m) => {
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao-eventos", m.key] });
    },
  });
}
export function useRevisarUtilizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: {
      key: string;
      resultado: "continua" | "parcial" | "retomou" | "nao_validado";
      ultima: string | null;
      obs: string;
      proxima: string | null;
    }) =>
      ok(
        dcs.rpc("dcs_revisar_utilizacao", {
          p_key: r.key,
          p_resultado: r.resultado,
          p_ultima: r.ultima,
          p_obs: r.obs || null,
          p_proxima: r.resultado === "retomou" ? null : r.proxima,
        }),
      ),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao-eventos", v.key] });
    },
  });
}
export function useConfirmarUtilizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, obs }: { key: string; obs: string }) =>
      ok(dcs.rpc("dcs_confirmar_utilizacao", { p_key: key, p_obs: obs || null })),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "utilizacao-eventos", v.key] });
    },
  });
}

/** Gravação real no Pipedrive (dcs_config.pipedrive_escrita): leitura para admins, alteração só pelo Master (banco revalida). */
export function useEscritaPipedrive(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "escrita-pipedrive"],
    enabled: ativo,
    queryFn: async () => {
      const r = await ok<{ valor: { ativa?: boolean } } | null>(
        dcs
          .from("dcs_config" as never)
          .select("valor")
          .eq("chave", "pipedrive_escrita")
          .maybeSingle() as never,
      );
      return !!r?.valor?.ativa;
    },
  });
}
export function useDefinirEscritaPipedrive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ativa: boolean) =>
      ok(dcs.rpc("dcs_definir_escrita_pipedrive", { p_ativa: ativa })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "escrita-pipedrive"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "integracoes"] });
    },
  });
}

export function useEventosUtilizacaoPeriodo(desde: string) {
  return useQuery({
    queryKey: ["dcs", "utilizacao-eventos-periodo", desde],
    queryFn: async () =>
      (await ok(
        dcs
          .from("dcs_utilizacao_eventos")
          .select("*")
          .gte("em", desde)
          .order("em", { ascending: false })
          .limit(2000),
      )) as DcsUtilizacaoEvento[],
  });
}

// ---------- Beta: convites, credenciais, logs, feedback, onboarding, configurações da versão ----------
type RpcLivre = (
  f: string,
  a?: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: unknown }>;
const rpc = <R>(f: string, a?: Record<string, unknown>) =>
  ok((dcs.rpc as unknown as RpcLivre)(f, a)) as Promise<R>;

export type FormAcesso = {
  email: string;
  nome: string;
  perfil: "admin" | "cs" | "contas";
  financeiro: boolean;
  editar: boolean;
  carteiras: number[];
  clientes: string[];
  modulos: string[] | null;
  permissoes: Partial<Record<Permissao, boolean>>;
  pipedrive: number | null;
  metodo: "google" | "email" | "senha";
  validade_dias: number;
  ativo: boolean;
};
export function useSalvarAcesso() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (f: FormAcesso) =>
      rpc<{ modo: "aplicado" | "convite"; user_id?: string; email?: string; expira_em?: string }>(
        "dcs_salvar_acesso",
        { p: f },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "usuarios"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "pre-cadastros"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "logs-seguranca"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "vinculos-pd"] });
    },
  });
}
export function useDefinirStatusUsuario() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { user: string; ativo: boolean }) =>
      rpc("dcs_definir_status_usuario", { p_user: a.user, p_ativo: a.ativo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "usuarios"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "logs-seguranca"] });
    },
  });
}
export type LogSeguranca = {
  em: string;
  ator: string | null;
  entidade: string;
  entidade_id: string | null;
  acao: string;
  dados: Record<string, unknown> | null;
};
export function useLogsSeguranca(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "logs-seguranca"],
    enabled: ativo,
    queryFn: () => rpc<LogSeguranca[]>("dcs_logs_seguranca", { p_limite: 300 }),
  });
}
export type Feedback = {
  id: number;
  user_id: string;
  criado_em: string;
  tipo: string;
  descricao: string;
  funcionalidade: string | null;
  pagina: string | null;
  versao: string | null;
  status: "novo" | "analisado" | "resolvido";
};
export function useFeedbacks(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "feedbacks"],
    enabled: ativo,
    queryFn: async () =>
      (await ok(
        (
          dcs.from("dcs_feedback" as never) as unknown as {
            select: (c: string) => {
              order: (
                c: string,
                o: object,
              ) => { limit: (n: number) => PromiseLike<{ data: unknown; error: unknown }> };
            };
          }
        )
          .select("*")
          .order("criado_em", { ascending: false })
          .limit(500),
      )) as Feedback[],
  });
}
export function useEnviarFeedback() {
  return useMutation({
    mutationFn: (f: {
      tipo: string;
      descricao: string;
      funcionalidade: string;
      pagina: string;
      versao: string;
    }) =>
      rpc<number>("dcs_enviar_feedback", {
        p_tipo: f.tipo,
        p_descricao: f.descricao,
        p_funcionalidade: f.funcionalidade,
        p_pagina: f.pagina,
        p_versao: f.versao,
      }),
  });
}
export function useAtualizarFeedback() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: number; status: string }) =>
      rpc("dcs_atualizar_feedback", { p_id: a.id, p_status: a.status }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "feedbacks"] }),
  });
}
export type EstadoTour = {
  tour: string;
  versao: number;
  etapas_concluidas: string[];
  etapa_atual: string | null;
  estado: "em_andamento" | "pausado" | "concluido" | "dispensado";
  concluido_em: string | null;
};
export function useOnboarding(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "onboarding"],
    enabled: ativo,
    queryFn: async () => {
      const rows = (await ok(
        (
          dcs.from("dcs_onboarding" as never) as unknown as {
            select: (c: string) => PromiseLike<{ data: unknown; error: unknown }>;
          }
        ).select("*"),
      )) as EstadoTour[];
      return new Map(rows.map((r) => [r.tour, r]));
    },
  });
}
export function useSalvarOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (t: {
      tour: string;
      versao: number;
      estado: EstadoTour["estado"];
      etapa: string | null;
      concluidas: string[];
    }) =>
      rpc("dcs_salvar_onboarding", {
        p_tour: t.tour,
        p_versao: t.versao,
        p_estado: t.estado,
        p_etapa: t.etapa,
        p_concluidas: t.concluidas,
        p_prefs: {},
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "onboarding"] }),
  });
}
export type ConfigProduto = {
  beta: { ativo: boolean } | null;
  acesso: { validade_convite_dias: number; senha_provisoria_horas: number } | null;
};
export function useConfigProduto(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "config-produto"],
    enabled: ativo,
    queryFn: () => rpc<ConfigProduto | null>("dcs_config_produto"),
  });
}
export function useDefinirConfigProduto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { chave: "beta" | "acesso"; valor: Record<string, unknown> }) =>
      rpc("dcs_definir_config_produto", { p_chave: a.chave, p_valor: a.valor }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "config-produto"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "acesso"] });
    },
  });
}

/* ---------------- Central de conexão com o Pipedrive (D40) ---------------- */
export type CheckConexao = {
  chave: string;
  rotulo: string;
  status: "ok" | "falha" | "sem_permissao" | "nao_testado";
  detalhe: string | null;
};
export type TesteConexao = {
  id: string;
  status: "pendente" | "em_execucao" | "concluido" | "falha";
  solicitado_em: string;
  concluido_em: string | null;
  erro: string | null;
  resultado: {
    checks: CheckConexao[];
    conta: { empresa: string | null; usuario: string | null } | null;
    falhas: number;
  } | null;
};
export type StatusConexao = {
  metodo: string;
  escrita_ativa: boolean;
  ultimo_teste: TesteConexao | null;
  sincronizacoes: {
    tipo: "carteira" | "cobertura" | "responsaveis";
    ultimo_status: string;
    ultima_execucao: string | null;
    ultimo_sucesso: string | null;
    ultimo_completo: boolean | null;
    falhas_7d: number;
  }[];
  pedidos_abertos: string[];
  registros: Record<
    | "aguardando_autorizacao"
    | "pendentes"
    | "falha_recuperavel"
    | "falha_definitiva"
    | "aguardando_conferencia"
    | "confirmados",
    number
  >;
  erros_recentes: { em: string; origem: string; mensagem: string }[];
};
export function useStatusConexao(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "status-conexao"],
    enabled: ativo,
    queryFn: () => rpc<StatusConexao>("dcs_status_conexao"),
    // Enquanto há teste ou pedido aberto, acompanha a cada 5 s.
    refetchInterval: (q) => {
      const d = q.state.data;
      return d &&
        (d.pedidos_abertos.length ||
          ["pendente", "em_execucao"].includes(d.ultimo_teste?.status ?? ""))
        ? 5000
        : false;
    },
  });
}
export function useTestarConexao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => rpc<string>("dcs_solicitar_teste_conexao"),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["dcs", "status-conexao"] }),
  });
}
export function useSolicitarAtualizacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tipo: "carteira" | "cobertura" | "responsaveis") =>
      rpc<string>("dcs_solicitar_sync", { p_tipo: tipo }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["dcs", "status-conexao"] });
      void qc.invalidateQueries({ queryKey: ["dcs", "status-sync"] });
    },
  });
}
export type MinhaConexao = {
  vinculado: boolean;
  conexao: "institucional";
  pipedrive_user_id?: number;
  nome?: string | null;
  email?: string | null;
  ativo_no_pipedrive?: boolean | null;
  visto_em?: string | null;
  metodo?: "email" | "email_dominio" | "manual";
  compartilhado?: boolean;
} | null;
export function useMinhaConexao() {
  return useQuery({
    queryKey: ["dcs", "minha-conexao"],
    queryFn: () => rpc<MinhaConexao>("dcs_minha_conexao_pipedrive"),
  });
}
export type VinculoPD = {
  user_id: string;
  pipedrive_user_id: number | null;
  nome_pipedrive: string | null;
  metodo: "email" | "email_dominio" | "manual" | "sem_vinculo";
  compartilhado: boolean;
  ativo_no_pipedrive: boolean | null;
};
export function useVinculosPD(ativo: boolean) {
  return useQuery({
    queryKey: ["dcs", "vinculos-pd"],
    enabled: ativo,
    queryFn: async () =>
      new Map((await rpc<VinculoPD[]>("dcs_vinculos_pipedrive")).map((v) => [v.user_id, v])),
  });
}
