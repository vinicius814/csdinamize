import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Nucleo, type EstadoNucleo } from "@/components/munim/Nucleo";
import { useAuth } from "@/lib/auth";
import { RESPOSTA_PROVISORIA } from "@/lib/texto";
import { cn } from "@/lib/utils";

type Busca = { q?: string; ouvir?: boolean };

export const Route = createFileRoute("/_authenticated/conversa")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    ouvir: s["ouvir"] === true || s["ouvir"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Conversa — Munim" },
      { name: "description", content: "Converse com o Munim por texto ou voz." },
      { property: "og:title", content: "Conversa — Munim" },
      { property: "og:description", content: "Converse com o Munim por texto ou voz." },
    ],
  }),
  component: Conversa,
});

type Msg = {
  id: number | string;
  autor: "usuario" | "munim" | "sistema";
  canal: "app" | "telegram";
  conteudo: string;
  created_at: string;
  animar?: boolean;
};

function Digitando({ texto }: { texto: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= texto.length) return;
    const t = setTimeout(() => setN((v) => Math.min(texto.length, v + 3)), 12);
    return () => clearTimeout(t);
  }, [n, texto]);
  return <ReactMarkdown>{texto.slice(0, n)}</ReactMarkdown>;
}

type Reconhecedor = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
  onend: () => void;
};

function Conversa() {
  const { q, ouvir } = Route.useSearch();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [texto, setTexto] = useState(q ?? "");
  const [estado, setEstado] = useState<EstadoNucleo>("repouso");
  const [erroVoz, setErroVoz] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<Reconhecedor | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    if (q) setTexto(q);
  }, [q]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("mensagens")
      .select("id, autor, canal, conteudo, created_at")
      .order("created_at", { ascending: true })
      .limit(500)
      .then(({ data }) => data && setMsgs(data));
    const canal = supabase
      .channel(`mensagens-${userId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `user_id=eq.${userId}` },
        (p) => {
          const m = p.new as Msg;
          setMsgs((atual) =>
            atual.some((x) => x.id === m.id) ? atual : [...atual, { ...m, animar: m.autor === "munim" }],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, estado]);

  const alternarMic = () => {
    if (estado === "ouvindo") {
      recRef.current?.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => Reconhecedor; webkitSpeechRecognition?: new () => Reconhecedor };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setErroVoz("Seu navegador não permite ditar por voz. Tente o Chrome.");
      return;
    }
    setErroVoz(null);
    const rec = new Ctor();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    rec.continuous = true;
    baseRef.current = texto ? texto.trimEnd() + " " : "";
    rec.onresult = (e) => {
      let t = "";
      for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript;
      setTexto(baseRef.current + t);
    };
    rec.onend = () => setEstado((s) => (s === "ouvindo" ? "repouso" : s));
    recRef.current = rec;
    rec.start();
    setEstado("ouvindo");
  };

  useEffect(() => {
    if (ouvir) alternarMic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvir]);

  const enviar = async () => {
    const conteudo = texto.trim();
    if (!conteudo || !userId) return;
    recRef.current?.stop();
    setTexto("");
    const { data, error } = await supabase
      .from("mensagens")
      .insert({ user_id: userId, autor: "usuario", canal: "app", conteudo })
      .select("id, autor, canal, conteudo, created_at")
      .single();
    if (error) {
      setTexto(conteudo);
      setErroVoz("Não consegui enviar agora. Tente de novo.");
      return;
    }
    setMsgs((a) => (a.some((x) => x.id === data.id) ? a : [...a, data]));
    setEstado("pensando");
    setTimeout(() => {
      setEstado("repouso");
      setMsgs((a) => [
        ...a,
        { id: `local-${Date.now()}`, autor: "munim", canal: "app", conteudo: RESPOSTA_PROVISORIA, created_at: new Date().toISOString(), animar: true },
      ]);
    }, 2000);
  };

  return (
    <div className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-3xl flex-col px-4 md:h-screen md:px-8">
      <header className="flex items-center gap-3 border-b border-border py-4">
        <Nucleo tamanho={44} estado={estado} />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Munim</h1>
          <p className="text-xs text-muted-foreground">
            {estado === "ouvindo" ? "Ouvindo…" : estado === "pensando" ? "Pensando…" : "Pronto para ajudar"}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <Nucleo tamanho={120} estado={estado} />
            <p className="mt-6 font-display text-xl text-foreground">Em que posso ajudar?</p>
            <p className="mt-1 text-sm text-muted-foreground">Digite ou toque no microfone para falar.</p>
          </div>
        )}
        {msgs.map((m) => {
          const meu = m.autor === "usuario";
          return (
            <div key={m.id} className={cn("flex animate-in fade-in slide-in-from-bottom-1 duration-200", meu ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm",
                  meu ? "bg-primary text-primary-foreground" : "prose-munim border border-border bg-card",
                )}
              >
                {m.canal === "telegram" && (
                  <span className={cn("mb-1 inline-block rounded px-1.5 text-[10px] font-medium", meu ? "bg-background/20" : "bg-primary-soft text-primary")}>
                    Telegram
                  </span>
                )}
                {meu ? (
                  <p className="whitespace-pre-wrap">{m.conteudo}</p>
                ) : m.animar ? (
                  <Digitando texto={m.conteudo} />
                ) : (
                  <ReactMarkdown>{m.conteudo}</ReactMarkdown>
                )}
              </div>
            </div>
          );
        })}
        {estado === "pensando" && (
          <div className="flex gap-1 px-2">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" style={{ animationDelay: `${i * 150}ms` }} />
            ))}
          </div>
        )}
        <div ref={fimRef} />
      </div>

      <div className="pb-4">
        {erroVoz && <p className="mb-2 text-xs text-ember">{erroVoz}</p>}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar();
          }}
          className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 transition-shadow duration-200 focus-within:border-primary/60 focus-within:shadow-glow-sm"
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={1}
            placeholder="Pergunte ou peça algo ao Munim…"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={alternarMic}
            aria-label={estado === "ouvindo" ? "Parar de ouvir" : "Falar"}
            className={cn(
              "grid h-10 w-10 place-items-center rounded-lg transition-colors duration-150",
              estado === "ouvindo" ? "bg-primary-soft text-primary shadow-glow-sm" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            {estado === "ouvindo" ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <button
            type="submit"
            disabled={!texto.trim()}
            aria-label="Enviar"
            className="grid h-10 w-10 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
