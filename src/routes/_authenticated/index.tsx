import { createFileRoute, redirect } from "@tanstack/react-router";

// A entrada da aplicação é a visão geral do Dinamize CS. A Central de Comando legada continua em
// src/components/munim/CSWorkspace (CSDashboard), sem rota no menu (ver docs/DECISIONS.md, D18).
export const Route = createFileRoute("/_authenticated/")({
  beforeLoad: () => {
    throw redirect({ to: "/dcs", replace: true });
  },
});
