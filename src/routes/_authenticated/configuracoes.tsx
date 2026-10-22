import { createFileRoute } from "@tanstack/react-router";
import { Moon, Sun } from "lucide-react";
import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { Switch } from "@/components/ui/switch";
import { useTema } from "@/lib/tema";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Munim" },
      { name: "description", content: "Ajuste o Munim do seu jeito." },
      { property: "og:title", content: "Configurações — Munim" },
      { property: "og:description", content: "Ajuste o Munim do seu jeito." },
    ],
  }),
  component: Configuracoes,
});

function Configuracoes() {
  const { tema, setTema } = useTema();
  return (
    <Pagina>
      <Cabecalho titulo="Configurações" frase="Aparência, horários do briefing, Telegram e Google. O resto chega em breve." />
      <div className="card-munim flex items-center gap-4 p-5">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">
          {tema === "claro" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </div>
        <div className="flex-1">
          <p className="font-medium text-foreground">Tema claro</p>
          <p className="text-sm text-muted-foreground">O escuro é o padrão. Troque quando quiser.</p>
        </div>
        <Switch checked={tema === "claro"} onCheckedChange={(v) => setTema(v ? "claro" : "escuro")} aria-label="Tema claro" />
      </div>
    </Pagina>
  );
}
