import { createFileRoute } from "@tanstack/react-router";
import { StickyNote } from "lucide-react";
import { Cabecalho, EstadoVazio, Pagina } from "@/components/munim/PaginaVazia";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Notas — Munim" },
      { name: "description", content: "Seu segundo cérebro: anotações, ideias e lembretes organizados por área." },
      { property: "og:title", content: "Notas — Munim" },
      { property: "og:description", content: "Seu segundo cérebro: anotações, ideias e lembretes organizados por área." },
    ],
  }),
  component: () => (
    <Pagina>
      <Cabecalho titulo="Notas" frase="Seu segundo cérebro: anotações, ideias e lembretes organizados por área." />
      <EstadoVazio icon={StickyNote} titulo="Nenhuma nota ainda" texto="Peça ao Munim para anotar algo e ele guarda aqui para você." />
    </Pagina>
  ),
});
