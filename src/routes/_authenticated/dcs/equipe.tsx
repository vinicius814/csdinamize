/**
 * Gestão da equipe (Prioridade 3) — visão operacional por colaborador, agregada a partir dos
 * mesmos dados reais da Carteira (RLS já limita o que cada perfil vê; Master/admin vê tudo).
 * "Ações" aqui são itens do plano de ação (dcs_acoes) — não atividades do Pipedrive (isso é a
 * central de Atividades e pendências, Prioridade 4, ainda não construída). Rotulado como tal
 * para não confundir os dois conceitos.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  useAcessoDcs,
  useAlertas,
  useCarteira,
  usePipelineOnboarding,
  usePlanos,
} from "@/lib/dcs/dados";
import { Estado, Tabela, Titulo, moeda } from "@/components/dcs/ui";

export const Route = createFileRoute("/_authenticated/dcs/equipe")({
  component: Equipe,
});

type Linha = {
  nome: string;
  clientesAtivos: number;
  valor: number;
  valorParcial: boolean;
  comRegistro: number;
  emDia: number;
  acoesAbertas: number;
  acoesAtrasadas: number;
  clientesEmRisco: number;
  semProximoContato: number;
  onboardingsAtivos: number;
  implementacoesAndamento: number;
  diagAguardando: number;
  diagAndamento: number;
  diagConcluido: number;
};

function Equipe() {
  const acesso = useAcessoDcs();
  const fin = !!acesso.data?.financeiro;
  const carteira = useCarteira(false);
  const alertas = useAlertas();
  const planos = usePlanos();
  const onb = usePipelineOnboarding();

  const linhas = useMemo((): Linha[] => {
    const m = new Map<string, Linha>();
    const pega = (nome: string) => {
      let l = m.get(nome);
      if (!l) {
        l = {
          nome,
          clientesAtivos: 0,
          valor: 0,
          valorParcial: false,
          comRegistro: 0,
          emDia: 0,
          acoesAbertas: 0,
          acoesAtrasadas: 0,
          clientesEmRisco: 0,
          semProximoContato: 0,
          onboardingsAtivos: 0,
          implementacoesAndamento: 0,
          diagAguardando: 0,
          diagAndamento: 0,
          diagConcluido: 0,
        };
        m.set(nome, l);
      }
      return l;
    };
    for (const c of carteira.data ?? []) {
      const nome = c.c.owner_nome ?? "Sem responsável";
      const l = pega(nome);
      l.clientesAtivos++;
      if (c.mrr != null) l.valor += c.mrr;
      else l.valorParcial = true;
      if (c.cobStatus.k !== "sem_registro" && c.cobStatus.k !== "indisp") {
        l.comRegistro++;
        if (c.cobStatus.k === "ok") l.emDia++;
      }
      l.acoesAbertas += c.acoesAbertas;
      l.acoesAtrasadas += c.acoesAtrasadas;
      if (!c.cob?.proximo) l.semProximoContato++;
      if (c.status === "aguardando") l.diagAguardando++;
      else if (c.status === "em_andamento") l.diagAndamento++;
      else if (c.status === "concluido" || c.status === "concluido_pendencias") l.diagConcluido++;
    }
    // Clientes em risco: contagem de clientes distintos com pelo menos 1 alerta (não o total de alertas).
    const riscoPorNome = new Map<string, Set<string>>();
    for (const a of alertas.data ?? []) {
      const nome = a.cliente?.owner_nome ?? "Sem responsável";
      const set = riscoPorNome.get(nome) ?? new Set<string>();
      set.add(a.cliente_key);
      riscoPorNome.set(nome, set);
    }
    for (const [nome, set] of riscoPorNome) pega(nome).clientesEmRisco = set.size;
    // Implementações em andamento: ações em execução ou aguardando ativação pelo cliente.
    for (const a of planos.data ?? []) {
      if (a.obsoleta) continue;
      if (a.status === "em_implementacao" || a.status === "aguardando_ativacao") {
        const nome = a.cliente?.owner_nome ?? "Sem responsável";
        pega(nome).implementacoesAndamento++;
      }
    }
    // Onboardings: dimensão separada (responsável no funil Pipedrive id 1, pode ser outra pessoa).
    for (const negocios of onb.data?.values() ?? []) {
      for (const n of negocios) {
        const nome = n.owner_nome ?? "Sem responsável";
        pega(nome).onboardingsAtivos++;
      }
    }
    return [...m.values()].sort((a, b) => b.clientesAtivos - a.clientesAtivos);
  }, [carteira.data, alertas.data, planos.data, onb.data]);

  const carregando = carteira.isLoading || alertas.isLoading || planos.isLoading || onb.isLoading;

  return (
    <>
      <Titulo
        titulo="Gestão da equipe"
        sub="Agregado a partir da carteira visível ao seu acesso (administradores veem toda a operação)."
      />
      <Estado
        carregando={carregando}
        erro={carteira.error}
        vazio={!carregando && !linhas.length && "Nenhum colaborador com clientes na carteira."}
      >
        <Tabela className="overflow-x-auto">
          <thead className="bg-surface-2">
            <tr>
              <th>Colaborador</th>
              <th className="text-right">Clientes ativos</th>
              {fin && <th className="text-right">Valor autorizado</th>}
              <th className="text-right">Cobertura em dia</th>
              <th className="text-right">Ações abertas</th>
              <th className="text-right">Ações atrasadas</th>
              <th className="text-right">Clientes em risco</th>
              <th className="text-right">Sem próximo contato</th>
              <th className="text-right">Onboardings ativos</th>
              <th className="text-right">Implementações em andamento</th>
              <th>Diagnósticos (aguard./andam./concl.)</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.nome} className="border-t">
                <td className="font-medium">{l.nome}</td>
                <td className="text-right tabular-nums">{l.clientesAtivos}</td>
                {fin && (
                  <td className="text-right tabular-nums">
                    {moeda(l.valor)}
                    {l.valorParcial && (
                      <span className="block text-[11px] text-muted-foreground">parcial</span>
                    )}
                  </td>
                )}
                <td className="text-right tabular-nums">
                  {l.comRegistro ? `${Math.round((l.emDia / l.comRegistro) * 100)}%` : "—"}
                  <span className="block text-[11px] text-muted-foreground">
                    {l.emDia}/{l.comRegistro}
                  </span>
                </td>
                <td className="text-right tabular-nums">{l.acoesAbertas}</td>
                <td
                  className={
                    "text-right tabular-nums" +
                    (l.acoesAtrasadas ? " font-medium text-red-700" : "")
                  }
                >
                  {l.acoesAtrasadas}
                </td>
                <td className="text-right tabular-nums">{l.clientesEmRisco}</td>
                <td className="text-right tabular-nums">{l.semProximoContato}</td>
                <td className="text-right tabular-nums">{l.onboardingsAtivos || "—"}</td>
                <td className="text-right tabular-nums">{l.implementacoesAndamento}</td>
                <td className="text-xs text-muted-foreground">
                  {l.diagAguardando} / {l.diagAndamento} / {l.diagConcluido}
                </td>
                <td>
                  <Link
                    to="/dcs/carteira"
                    search={{ responsavel: l.nome === "Sem responsável" ? undefined : l.nome }}
                    className="whitespace-nowrap text-xs text-primary hover:underline"
                  >
                    Ver carteira
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </Tabela>
      </Estado>
    </>
  );
}
