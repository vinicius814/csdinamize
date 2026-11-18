/**
 * Onboarding guiado (D36): boas-vindas, tours sobre elementos reais e persistência por usuário (dcs_onboarding).
 * Não altera dados, não registra nada no Pipedrive e não envia convites: apenas navega e destaca elementos.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAcessoDcs, useOnboarding, useSalvarOnboarding } from "@/lib/dcs/dados";
import { MODULOS_POR_PERFIL } from "@/lib/dcs/motor";
import { etapasVisiveis, TOURS, VERSAO_TOUR, type Tour } from "@/lib/dcs/tours";
import { Marca } from "./Marca";

type Ctx = { iniciar: (tour: string, reiniciar?: boolean) => void; tours: Tour[] };
const TourCtx = createContext<Ctx>({ iniciar: () => {}, tours: [] });
export const useTour = () => useContext(TourCtx);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const acesso = useAcessoDcs();
  const perfil = acesso.data?.perfil ?? null;
  const estado = useOnboarding(!!perfil);
  const salvar = useSalvarOnboarding();
  const nav = useNavigate();
  const busca = useRouterState({ select: (s) => s.location.search as Record<string, unknown> });
  const [ativo, setAtivo] = useState<{ tour: string; i: number } | null>(null);
  const [boasVindas, setBoasVindas] = useState(false);

  const ctx = useMemo(
    () => ({
      modulos: perfil ? (acesso.data?.modulos ?? MODULOS_POR_PERFIL[perfil]) : [],
      permissoes: acesso.data?.permissoes ?? {},
      master: !!acesso.data?.master,
    }),
    [perfil, acesso.data],
  );
  const tours = useMemo(
    () =>
      TOURS.map((t) => ({ ...t, etapas: etapasVisiveis(t, ctx) })).filter((t) => t.etapas.length),
    [ctx],
  );

  // Boas-vindas: só na primeira vez (sem registro) ou logo após configurar a senha. Não reaparece a cada login.
  useEffect(() => {
    if (!perfil || estado.isLoading || !estado.data) return;
    if (busca["boasvindas"] === "1" || !estado.data.has("geral")) setBoasVindas(true);
  }, [perfil, estado.isLoading, estado.data, busca]);

  const gravar = useCallback(
    (
      tour: string,
      est: "em_andamento" | "pausado" | "concluido" | "dispensado",
      etapa: string | null,
      concluidas: string[],
    ) => salvar.mutate({ tour, versao: VERSAO_TOUR, estado: est, etapa, concluidas }),
    [salvar],
  );
  const iniciar = useCallback(
    (id: string, reiniciar = false) => {
      const t = tours.find((x) => x.id === id);
      if (!t) return;
      const salvo = estado.data?.get(id);
      const i =
        !reiniciar && salvo?.estado !== "concluido" && salvo?.etapa_atual
          ? Math.max(
              0,
              t.etapas.findIndex((e) => e.id === salvo.etapa_atual),
            )
          : 0;
      setBoasVindas(false);
      setAtivo({ tour: id, i });
      gravar(
        id,
        "em_andamento",
        t.etapas[i]?.id ?? null,
        reiniciar ? [] : (salvo?.etapas_concluidas ?? []),
      );
    },
    [tours, estado.data, gravar],
  );

  const tour = ativo ? tours.find((t) => t.id === ativo.tour) : null;
  const etapa = tour?.etapas[ativo!.i];
  // Navega até a tela da etapa (sem alterar dados).
  useEffect(() => {
    if (!etapa?.rota) return;
    void nav({ to: etapa.rota as never, search: (etapa.busca ?? {}) as never });
  }, [etapa?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const ir = (d: number) => {
    if (!tour || !ativo) return;
    const prox = ativo.i + d;
    const feitas = Array.from(
      new Set([...(estado.data?.get(tour.id)?.etapas_concluidas ?? []), tour.etapas[ativo.i]!.id]),
    );
    if (prox >= tour.etapas.length) {
      gravar(tour.id, "concluido", null, feitas);
      setAtivo(null);
      return;
    }
    if (prox < 0) return;
    gravar(tour.id, "em_andamento", tour.etapas[prox]!.id, feitas);
    setAtivo({ tour: tour.id, i: prox });
  };
  const parar = (est: "pausado" | "dispensado") => {
    if (tour && ativo)
      gravar(
        tour.id,
        est,
        tour.etapas[ativo.i]!.id,
        estado.data?.get(tour.id)?.etapas_concluidas ?? [],
      );
    setAtivo(null);
  };

  return (
    <TourCtx.Provider value={{ iniciar, tours }}>
      {children}
      <Dialog
        open={boasVindas}
        onOpenChange={(o) => !o && (setBoasVindas(false), gravar("geral", "pausado", null, []))}
      >
        <DialogContent className="max-w-lg">
          <Marca />
          <DialogTitle className="mt-2 text-xl">Bem-vindo ao Dinamize CS</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-foreground">
            O Dinamize CS foi desenvolvido para facilitar a análise da utilização das plataformas
            pelos nossos clientes, identificar oportunidades de melhoria e organizar o
            acompanhamento da equipe de Customer Success.
          </DialogDescription>
          <ul className="grid gap-1.5 text-sm text-muted-foreground">
            <li>• Diagnósticos com índice de aproveitamento, recomendações e plano de ação.</li>
            <li>• Rotina organizada: fila de trabalho, revisões, alertas e cobertura.</li>
            <li>• Contas sem utilização acompanhadas até a retomada.</li>
            <li>• Registro automático no Pipedrive, sem retrabalho.</li>
          </ul>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="h-9 rounded-lg px-3 text-sm text-muted-foreground hover:text-foreground"
              onClick={() => (setBoasVindas(false), gravar("geral", "pausado", null, []))}
            >
              Ver mais tarde
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border px-3 text-sm hover:border-primary"
              onClick={() => (setBoasVindas(false), gravar("geral", "dispensado", null, []))}
            >
              Começar a utilizar
            </button>
            <button
              type="button"
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
              onClick={() => iniciar("geral", true)}
            >
              Conhecer a ferramenta
            </button>
          </div>
        </DialogContent>
      </Dialog>
      {tour && etapa && (
        <Destaque
          key={etapa.id}
          alvo={etapa.alvo}
          titulo={etapa.titulo}
          texto={etapa.texto}
          passo={ativo!.i + 1}
          total={tour.etapas.length}
          voltar={() => ir(-1)}
          avancar={() => ir(1)}
          pausar={() => parar("pausado")}
          pular={() => parar("dispensado")}
        />
      )}
    </TourCtx.Provider>
  );
}

/** Cartão do tour posicionado junto ao elemento real (ou centralizado, quando não há elemento). */
function Destaque(p: {
  alvo?: string | undefined;
  titulo: string;
  texto: string;
  passo: number;
  total: number;
  voltar: () => void;
  avancar: () => void;
  pausar: () => void;
  pular: () => void;
}) {
  const [r, setR] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    let n = 0;
    let t: ReturnType<typeof setTimeout>;
    const achar = () => {
      const el = p.alvo ? document.querySelector(p.alvo) : null;
      if (el) {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
        setTimeout(() => setR(el.getBoundingClientRect()), 350);
      } else if (n++ < 12) t = setTimeout(achar, 250);
      else setR(null);
    };
    achar();
    const re = () => {
      const el = p.alvo ? document.querySelector(p.alvo) : null;
      if (el) setR(el.getBoundingClientRect());
    };
    window.addEventListener("resize", re);
    return () => (clearTimeout(t), window.removeEventListener("resize", re));
  }, [p.alvo]);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") p.pausar();
      if (e.key === "ArrowRight") p.avancar();
      if (e.key === "ArrowLeft") p.voltar();
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [p]);
  const largura = Math.min(360, window.innerWidth - 24);
  const pos = r
    ? {
        top: r.bottom + 12 + 220 < window.innerHeight ? r.bottom + 12 : Math.max(12, r.top - 232),
        left: Math.min(Math.max(12, r.left), window.innerWidth - largura - 12),
      }
    : { top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - largura / 2 };
  return (
    <div
      className="fixed inset-0 z-[60]"
      role="dialog"
      aria-modal="false"
      aria-labelledby="tour-titulo"
    >
      <div className="pointer-events-none absolute inset-0 bg-black/30" />
      {r && (
        <div
          className="pointer-events-none absolute rounded-lg ring-4 ring-[var(--brand)] ring-offset-2"
          style={{
            top: r.top - 4,
            left: r.left - 4,
            width: r.width + 8,
            height: r.height + 8,
            boxShadow: "0 0 0 9999px rgb(0 0 0 / 0.25)",
          }}
        />
      )}
      <div
        className="absolute rounded-xl border bg-card p-4 shadow-xl"
        style={{ ...pos, width: largura }}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">
            Etapa {p.passo} de {p.total}
          </p>
          <button
            type="button"
            onClick={p.pausar}
            aria-label="Pausar tour"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <h2 id="tour-titulo" className="mt-1 text-base font-semibold">
          {p.titulo}
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.texto}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={p.pular}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Pular tour
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={p.passo === 1}
              onClick={p.voltar}
              className="h-8 rounded-lg border px-3 text-xs disabled:opacity-40"
            >
              Voltar
            </button>
            <button
              type="button"
              onClick={p.avancar}
              className="h-8 rounded-lg bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary-hover"
              autoFocus
            >
              {p.passo === p.total ? "Concluir" : "Avançar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
