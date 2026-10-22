import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";

export const Route = createFileRoute("/_authenticated/aprovacoes")({
  head: () => ({
    meta: [
      { title: "Aprovações — Munim" },
      { name: "description", content: "Aqui o Munim vai trazer as ações que preparou para você aprovar: atividades, notas, rascunhos e eventos." },
      { property: "og:title", content: "Aprovações — Munim" },
      { property: "og:description", content: "Aqui o Munim vai trazer as ações que preparou para você aprovar: atividades, notas, rascunhos e eventos." },
    ],
  }),
  component: () => (
    <Pagina>
      <Cabecalho titulo="Aprovações" frase="Aqui o Munim vai trazer as ações que preparou para você aprovar: atividades, notas, rascunhos e eventos." />
      <EstadoVazio icon={CheckCircle2} titulo="Nada esperando por você" texto="Quando o Munim preparar algo, aparece aqui para você aprovar com um toque." />
    </Pagina>
  ),
});
