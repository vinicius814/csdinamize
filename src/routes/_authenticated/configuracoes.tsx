import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Moon, Send, Sun } from "lucide-react";
import { toast } from "sonner";
import { Cabecalho, Pagina } from "@/components/munim/PaginaVazia";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useTema } from "@/lib/tema";
import { useServerFn } from "@tanstack/react-start";
import { statusConexoes } from "@/lib/conexoes.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações — Munim" },
      { name: "description", content: "Ajuste o Munim do seu jeito: Google, Telegram, rotina e aparência." },
      { property: "og:title", content: "Configurações — Munim" },
      { property: "og:description", content: "Ajuste o Munim do seu jeito." },
    ],
  }),
  component: Configuracoes,
});

const NOME_DO_BOT = "MunimWojtecBot";

const HORARIOS = Array.from({ length: 17 }, (_, i) => {
  const m = 6 * 60 + i * 15;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

function Bloco({ icon, titulo, children }: { icon: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <section className="card-munim p-5">
      <div className="mb-4 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-lg bg-primary-soft text-primary">{icon}</div>
        <h2 className="font-display text-lg text-foreground">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Configuracoes() {
  const { tema, setTema } = useTema();
  const { session } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const buscarStatus = useServerFn(statusConexoes);
  const { data: st } = useQuery({ queryKey: ["conexoes"], queryFn: () => buscarStatus() });
  const { data: p } = useQuery({
    queryKey: ["perfil-config", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("google_conectado, telegram_chat_id, telegram_codigo, horario_briefing, alertas_ativos")
        .eq("id", uid!)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [horario, setHorario] = useState("07:30");
  useEffect(() => {
    if (p?.horario_briefing) setHorario(p.horario_briefing.slice(0, 5));
  }, [p?.horario_briefing]);

  const salvar = async (campos: { horario_briefing?: string; alertas_ativos?: boolean; telegram_chat_id?: null }) => {
    const { error } = await supabase.from("profiles").update(campos).eq("id", uid!);
    if (error) toast.error("Não consegui salvar agora.");
    else toast.success("Salvo.");
    qc.invalidateQueries({ queryKey: ["perfil-config"] });
  };

  const linkTelegram = `https://t.me/${NOME_DO_BOT}?start=${p?.telegram_codigo ?? ""}`;

  return (
    <Pagina>
      <Cabecalho titulo="Configurações" frase="Conecte suas ferramentas e ajuste a rotina do Munim." />
      <div className="grid gap-4">
        {(["google", "pipedrive"] as const).map((k) => {
          const s = st?.[k];
          return (
            <Bloco key={k} icon={<span className="font-display text-base font-semibold">{k === "google" ? "G" : "P"}</span>} titulo={k === "google" ? "Google Agenda e Gmail" : "Pipedrive"}>
              <p className="text-sm text-muted-foreground">
                {k === "google" ? "O Munim lê sua agenda e seus e-mails e só cria rascunhos e eventos depois da sua aprovação." : "Clientes, negócios e atividades. Nada é gravado sem sua aprovação."}
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className={`h-2.5 w-2.5 rounded-full ${!s ? "bg-muted-foreground" : s.ok ? "bg-success" : "bg-warning"}`} />
                <span className={s?.ok ? "text-success" : "text-foreground"}>{s?.detalhe ?? "Verificando…"}</span>
              </div>
              <Link to="/conexoes" className="mt-3 inline-block text-sm text-primary hover:underline">Ver todas as conexões</Link>
            </Bloco>
          );
        })}

        <Bloco icon={<Send className="h-5 w-5" />} titulo="Telegram">
          {p?.telegram_chat_id ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-success">Conectado</span>
              <button onClick={() => salvar({ telegram_chat_id: null })} className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground">
                Desconectar
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="rounded-lg bg-foreground p-2">
                <QRCodeSVG value={linkTelegram} size={120} />
              </div>
              <div className="text-sm">
                <p className="text-foreground">Abra e toque em Iniciar.</p>
                <a href={linkTelegram} target="_blank" rel="noreferrer" className="mt-1 block break-all text-primary hover:underline">
                  {linkTelegram}
                </a>
              </div>
            </div>
          )}
        </Bloco>

        <Bloco icon={<Clock className="h-5 w-5" />} titulo="Rotina">
          <div className="flex flex-col gap-4">
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Horário do briefing da manhã</span>
              <select
                value={horario}
                onChange={(e) => {
                  setHorario(e.target.value);
                  salvar({ horario_briefing: e.target.value });
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-foreground"
              >
                {HORARIOS.map((h) => (
                  <option key={h} value={h}>{h.replace(":", "h")}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span className="text-foreground">Receber alertas durante o dia</span>
              <Switch checked={p?.alertas_ativos ?? true} onCheckedChange={(v) => salvar({ alertas_ativos: v })} aria-label="Receber alertas durante o dia" />
            </label>
          </div>
        </Bloco>

        <Bloco icon={tema === "claro" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />} titulo="Aparência">
          <label className="flex items-center justify-between gap-4 text-sm">
            <span className="text-foreground">Tema claro</span>
            <Switch checked={tema === "claro"} onCheckedChange={(v) => setTema(v ? "claro" : "escuro")} aria-label="Tema claro" />
          </label>
        </Bloco>
      </div>
    </Pagina>
  );
}
