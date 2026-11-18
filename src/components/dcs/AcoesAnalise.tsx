import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { mensagemErro, type DcsDiagnostico } from "@/lib/dcs/db";
import {
  useAcessoDcs,
  useAnalistas,
  useAtribuirAnalise,
  useDestinosAnalise,
  useIniciarAnalise,
  useReabrirAnalise,
  useTransferirAnalise,
  type StatusAnalise,
} from "@/lib/dcs/dados";
import { cx } from "./ui";
import { FormSemUso } from "./Utilizacao";
import type { DcsUtilizacao } from "@/lib/dcs/db";

type Props = {
  clienteKey: string;
  clienteNome: string;
  ativo: boolean;
  status: StatusAnalise;
  diag: Pick<DcsDiagnostico, "id" | "status" | "analista_id" | "ciclo"> | null;
  /** Ciclo mais recente? (reabrir só vale para ele) */
  compacto?: boolean;
  /** Quando já está na ficha do cliente, troca de aba em vez de navegar. */
  aoAbrirAba?: (aba: "diagnostico" | "plano" | "historico") => void;
  /** Contas sem utilização: habilita "Marcar sem utilização" e troca a ação principal por "Revisar utilização". */
  utilizacao?:
    | {
        atual: DcsUtilizacao | null;
        ownerId: number | null;
        mrr: number | null;
        criticidade?: "critica" | "alta" | null;
      }
    | undefined;
};

/**
 * Ações de análise conforme o status (carteira e ficha do cliente). Permissões só orientam a interface:
 * o banco revalida cada operação (dcs_iniciar_analise, dcs_atribuir_analise, dcs_transferir_analise, dcs_reabrir_analise).
 */
export function AcoesAnalise({
  clienteKey,
  clienteNome,
  ativo,
  status,
  diag,
  compacto,
  aoAbrirAba,
  utilizacao,
}: Props) {
  const [formUso, setFormUso] = useState(false);
  const semUso = utilizacao?.atual?.status === "sem_uso";
  const { session } = useAuth();
  const eu = session?.user.id;
  const acesso = useAcessoDcs().data;
  const admin = acesso?.perfil === "admin";
  const editar = !!acesso?.editar;
  const nomes = useAnalistas().data;
  const nav = useNavigate();
  const iniciar = useIniciarAnalise();
  const atribuir = useAtribuirAnalise();
  const transferir = useTransferirAnalise();
  const reabrir = useReabrirAnalise();
  const [dialogo, setDialogo] = useState<null | "atribuir" | "redistribuir" | "reabrir">(null);
  const ocupado =
    iniciar.isPending || atribuir.isPending || transferir.isPending || reabrir.isPending;

  const abrir = (aba: "diagnostico" | "plano" | "historico" = "diagnostico") => {
    if (aoAbrirAba) return aoAbrirAba(aba);
    void nav({
      to: "/dcs/cliente/$key",
      params: { key: clienteKey },
      search: { aba: aba === "diagnostico" ? undefined : aba } as never,
    });
  };
  const comecar = () =>
    iniciar.mutate(clienteKey, {
      onSuccess: (d) => {
        toast.success(
          d.ciclo > 1
            ? `Ciclo ${d.ciclo} iniciado e vinculado a você.`
            : "Análise iniciada e vinculada a você.",
        );
        abrir("diagnostico");
      },
      onError: (e) => toast.error(mensagemErro(e)),
    });
  const assumir = () =>
    diag &&
    eu &&
    transferir.mutate(
      { id: diag.id, key: clienteKey, para: eu, motivo: "Assumida por administrador" },
      {
        onSuccess: () => (toast.success("Você assumiu a análise."), abrir("diagnostico")),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );

  const mine = !!diag && diag.analista_id === eu;
  const responsavel = diag ? (nomes?.get(diag.analista_id) ?? "outro analista") : null;
  type Item = { rotulo: string; fazer: () => void; perigo?: boolean };
  let principal: { rotulo: string; fazer: () => void; destaque: boolean } | null = null;
  const extras: Item[] = [];
  if (status === "aguardando") {
    if (ativo && editar) principal = { rotulo: "Iniciar análise", fazer: comecar, destaque: true };
    if (ativo && admin)
      extras.push({ rotulo: "Atribuir a um analista…", fazer: () => setDialogo("atribuir") });
    extras.push({ rotulo: "Abrir ficha do cliente", fazer: () => abrir("diagnostico") });
  } else if (status === "em_andamento") {
    principal =
      mine || admin
        ? {
            rotulo: mine ? "Continuar análise" : "Editar análise",
            fazer: () => abrir("diagnostico"),
            destaque: true,
          }
        : { rotulo: "Visualizar", fazer: () => abrir("diagnostico"), destaque: false };
    if (admin && !mine) extras.push({ rotulo: "Assumir análise", fazer: assumir });
    if (admin) extras.push({ rotulo: "Redistribuir…", fazer: () => setDialogo("redistribuir") });
    if (!mine)
      extras.push({ rotulo: "Visualizar (somente leitura)", fazer: () => abrir("diagnostico") });
  } else {
    principal = { rotulo: "Ver diagnóstico", fazer: () => abrir("diagnostico"), destaque: false };
    extras.push({ rotulo: "Plano de ação", fazer: () => abrir("plano") });
    extras.push({ rotulo: "Histórico", fazer: () => abrir("historico") });
    if (ativo && editar) extras.push({ rotulo: "Iniciar nova rodada", fazer: comecar });
    if (admin || mine)
      extras.push({ rotulo: "Reabrir análise…", fazer: () => setDialogo("reabrir"), perigo: true });
  }

  if (utilizacao && ativo && editar && status !== "em_andamento") {
    if (semUso) {
      principal = {
        rotulo: "Revisar utilização",
        fazer: () => abrir("diagnostico"),
        destaque: true,
      };
      extras.unshift({ rotulo: "Editar acompanhamento…", fazer: () => setFormUso(true) });
    } else extras.push({ rotulo: "Marcar sem utilização…", fazer: () => setFormUso(true) });
  }

  return (
    <div className={cx("inline-flex items-center", compacto ? "gap-1" : "gap-2")}>
      {utilizacao && (
        <FormSemUso
          aberto={formUso}
          fechar={() => setFormUso(false)}
          cliente={{
            key: clienteKey,
            nome: clienteNome,
            ownerId: utilizacao.ownerId,
            mrr: utilizacao.mrr,
            criticidade: utilizacao.criticidade ?? null,
          }}
          atual={utilizacao.atual}
        />
      )}
      {principal && (
        <button
          type="button"
          onClick={principal.fazer}
          disabled={ocupado}
          className={cx(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border font-medium transition-colors disabled:opacity-60",
            compacto ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm",
            principal.destaque
              ? "border-primary bg-primary text-primary-foreground hover:bg-primary-hover"
              : "bg-card hover:border-primary hover:text-primary",
          )}
        >
          {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {principal.rotulo}
        </button>
      )}
      {extras.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cx(
              "grid place-items-center rounded-lg border bg-card text-muted-foreground hover:border-primary hover:text-primary",
              compacto ? "h-8 w-8" : "h-9 w-9",
            )}
            aria-label={`Mais ações para ${clienteNome}`}
          >
            <ChevronDown className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {status === "em_andamento" && responsavel && (
              <>
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  Com {mine ? "você" : responsavel}
                </p>
                <DropdownMenuSeparator />
              </>
            )}
            {extras.map((x) => (
              <DropdownMenuItem
                key={x.rotulo}
                onClick={x.fazer}
                className={cx(x.perigo && "text-red-700 focus:text-red-700")}
              >
                {x.rotulo}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      <DialogoAnalista
        aberto={dialogo === "atribuir" || dialogo === "redistribuir"}
        titulo={dialogo === "atribuir" ? "Atribuir análise" : "Redistribuir análise"}
        descricao={
          dialogo === "atribuir"
            ? `Cria o ciclo de análise de ${clienteNome} e vincula ao analista escolhido.`
            : `Transfere a análise em andamento de ${clienteNome}. O histórico registra a mudança.`
        }
        atual={diag?.analista_id ?? null}
        fechar={() => setDialogo(null)}
        confirmar={(para) => {
          if (dialogo === "atribuir")
            atribuir.mutate(
              { key: clienteKey, para },
              {
                onSuccess: () => (toast.success("Análise atribuída."), setDialogo(null)),
                onError: (e) => toast.error(mensagemErro(e)),
              },
            );
          else if (diag)
            transferir.mutate(
              { id: diag.id, key: clienteKey, para, motivo: "Redistribuída" },
              {
                onSuccess: () => (toast.success("Análise redistribuída."), setDialogo(null)),
                onError: (e) => toast.error(mensagemErro(e)),
              },
            );
        }}
        ocupado={atribuir.isPending || transferir.isPending}
      />
      <DialogoReabrir
        aberto={dialogo === "reabrir"}
        fechar={() => setDialogo(null)}
        ocupado={reabrir.isPending}
        confirmar={(motivo) =>
          diag &&
          reabrir.mutate(
            { id: diag.id, key: clienteKey, motivo },
            {
              onSuccess: () => (
                toast.success("Análise reaberta para edição."),
                setDialogo(null),
                abrir("diagnostico")
              ),
              onError: (e) => toast.error(mensagemErro(e)),
            },
          )
        }
      />
    </div>
  );
}

function DialogoAnalista(p: {
  aberto: boolean;
  titulo: string;
  descricao: string;
  atual: string | null;
  fechar: () => void;
  confirmar: (para: string) => void;
  ocupado: boolean;
}) {
  const destinos = useDestinosAnalise(p.aberto);
  const [para, setPara] = useState("");
  return (
    <Dialog open={p.aberto} onOpenChange={(o) => !o && p.fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>{p.titulo}</DialogTitle>
        <DialogDescription>{p.descricao}</DialogDescription>
        <label className="mt-2 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Analista</span>
          <select
            value={para}
            onChange={(e) => setPara(e.target.value)}
            className="h-9 rounded-lg border bg-card px-2"
          >
            <option value="">Selecione…</option>
            {destinos.data
              .filter((u) => u.user_id !== p.atual)
              .map((u) => (
                <option key={u.user_id} value={u.user_id}>
                  {u.nome || u.email}{" "}
                  {u.papel === "superadmin"
                    ? "(Master)"
                    : u.perfil === "admin"
                      ? "(Administrador)"
                      : ""}
                </option>
              ))}
          </select>
          <span className="text-xs text-muted-foreground">
            Só aparecem usuários ativos com permissão de edição; o banco confere o acesso ao
            cliente.
          </span>
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={p.fechar} className="h-9 rounded-lg border px-3 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={!para || p.ocupado}
            onClick={() => p.confirmar(para)}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {p.ocupado ? "Salvando…" : "Confirmar"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DialogoReabrir(p: {
  aberto: boolean;
  fechar: () => void;
  confirmar: (motivo: string) => void;
  ocupado: boolean;
}) {
  const [motivo, setMotivo] = useState("");
  return (
    <Dialog open={p.aberto} onOpenChange={(o) => !o && p.fechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>Reabrir análise</DialogTitle>
        <DialogDescription>
          O ciclo volta para edição. O resumo e o índice anteriores ficam registrados no histórico
          de eventos.
        </DialogDescription>
        <label className="mt-2 grid gap-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Motivo (obrigatório)</span>
          <textarea
            rows={3}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="rounded-lg border bg-card p-2"
          />
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={p.fechar} className="h-9 rounded-lg border px-3 text-sm">
            Cancelar
          </button>
          <button
            type="button"
            disabled={motivo.trim().length < 5 || p.ocupado}
            onClick={() => p.confirmar(motivo.trim())}
            className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
          >
            {p.ocupado ? "Reabrindo…" : "Reabrir"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
