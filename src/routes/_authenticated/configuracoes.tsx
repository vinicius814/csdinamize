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
import { Button } from "@/components/ui/button";
import { telegramLink } from "@/lib/telegram.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { title: "Configurações — Munim" },
      { name: "description", content: "Ajuste o Munim do seu jeito: Google, Telegram, rotina e aparência." },
      { property: "og:title", content: "Configurações — Munim" },
      { property: "og:description", content: "Ajuste o Munim do seu jeito." },
    ],
  }),
  component: Configuracoes,
});


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
  const { session, perfil, role, sair } = useAuth();
  const uid = session?.user.id;
  const qc = useQueryClient();
  const openTelegram = useServerFn(telegramLink);

  const { data: p } = useQuery({
    queryKey: ["perfil-config", uid],
    enabled: !!uid,
    queryFn: async () => {
      if(!uid)throw new Error("Sessão ausente.");
      const { data, error } = await supabase
        .from("profiles")
        .select("telegram_chat_id, telegram_codigo, horario_briefing, alertas_ativos, fuso")
        .eq("id", uid)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const [horario, setHorario] = useState("07:30");
  useEffect(() => {
    if (p?.horario_briefing) setHorario(p.horario_briefing.slice(0, 5));
  }, [p?.horario_briefing]);

  const salvar = async (campos: { horario_briefing?: string; alertas_ativos?: boolean; fuso?: string }) => {
    if(!uid)return;
    const { error } = await supabase.from("profiles").update(campos).eq("id", uid);
    if (error) toast.error("Não consegui salvar agora.");
    else toast.success("Salvo.");
    qc.invalidateQueries({ queryKey: ["perfil-config"] });
  };


  return (
    <Pagina>
      <Cabecalho titulo="Configurações" frase="Sua conta, rotina e aparência." />
      <div className="grid gap-4">
        <Bloco icon={<span>◎</span>} titulo="Sua conta">
          <p className="text-sm">{perfil?.nome}</p><p className="mt-1 break-all text-sm text-muted-foreground">{session?.user.email}</p><p className="mt-1 text-xs text-muted-foreground">{role === "superadmin" ? "Superadmin · uso pessoal" : role === "admin" ? "Admin · uso pessoal" : "Conta pessoal"}</p>
          <div className="mt-4 flex flex-wrap gap-3"><Button variant="outline" asChild><Link to="/conexoes">Suas conexões</Link></Button><Button variant="outline" asChild><Link to="/onboarding">Carteira e rotina</Link></Button><Button variant="ghost" onClick={async()=>{await qc.cancelQueries();qc.clear();await sair();window.location.assign("/auth");}}>Sair</Button></div>
        </Bloco>

        <Bloco icon={<Send className="h-5 w-5" />} titulo="Telegram">
          {p?.telegram_chat_id ? <p className="text-sm text-success">Vínculo registrado.</p> : <Button onClick={async()=>{const popup=window.open("","munim-telegram");try{const r=await openTelegram();if(!r.url){popup?.close();toast.info("Bot ainda não configurado. O responsável precisa salvar o token do BotFather.");return;}if(popup)popup.location.href=r.url;}catch(e){popup?.close();toast.error(e instanceof Error?e.message:"Não consegui abrir o bot.");}}}>Ativar Telegram</Button>}
        </Bloco>

        <Bloco icon={<Clock className="h-5 w-5" />} titulo="Rotina">
          <div className="flex flex-col gap-4">
            <label className="flex flex-wrap items-center justify-between gap-4 text-sm"><span>Fuso horário</span><select value={p?.fuso ?? "America/Sao_Paulo"} onChange={e=>salvar({fuso:e.target.value})} className="max-w-full rounded-lg border border-border bg-card px-3 py-2">{["America/Sao_Paulo","America/Manaus","America/Recife","America/Rio_Branco","Europe/Lisbon","UTC"].map(t=><option key={t}>{t}</option>)}</select></label>
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
