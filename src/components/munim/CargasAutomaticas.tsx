import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { isAdmin } from "@/lib/access";
import { proximaCargaCS } from "@/lib/cs.functions";

const CHAVE = "munin:cargas-historicas";
const INTERVALO = 30 * 60_000, PASSOS = 12;
const esperar = (ms: number) => new Promise(r => setTimeout(r, ms));

/**
 * Avança as cargas históricas em segundo plano enquanto um administrador usa o Munin (uma etapa por vez, no máximo
 * 12 etapas a cada 30 minutos entre abas). Substitui os cliques repetidos em Análise Gerencial → Qualidade; os botões continuam lá.
 * Somente leitura no Pipedrive. Sem estado no navegador além do horário da última rodada.
 */
export function CargasAutomaticas() {
  const { role } = useAuth();
  const run = useServerFn(proximaCargaCS);
  const qc = useQueryClient();
  useEffect(() => {
    if (!isAdmin(role)) return;
    let vivo = true;
    const marcar = () => { try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento: roda nesta sessão */ } };
    try { if (Date.now() - Number(localStorage.getItem(CHAVE) ?? 0) < INTERVALO) return; } catch { /* segue */ }
    const t = setTimeout(async () => {
      marcar();
      let mudou = false;
      for (let i = 0; i < PASSOS && vivo; i++) {
        try {
          const r = await run(); marcar();
          console.info(`[Munin] cargas históricas · ${r.etapa}: ${r.detalhe}`);
          if (!r.pendente) break;
          if (r.etapa === "aguardando") { await esperar(30_000); continue; }
          mudou = true;
        } catch (e) { console.warn("[Munin] cargas históricas interrompidas:", e instanceof Error ? e.message : e); break; }
      }
      if (mudou) { void qc.invalidateQueries({ queryKey: ["cs-analise"] }); void qc.invalidateQueries({ queryKey: ["cs-audit"] }); }
    }, 15_000);
    return () => { vivo = false; clearTimeout(t); };
  }, [role, run, qc]);
  return null;
}
