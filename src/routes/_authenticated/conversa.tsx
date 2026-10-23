import { createFileRoute,useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { conversarComMunim } from "@/lib/munim.functions";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Mic, MicOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Nucleo, type EstadoNucleo } from "@/components/munim/Nucleo";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {topics,createTopic,editTopic} from "@/lib/topics.functions";
import {createItem,undoItem} from "@/lib/personal.functions";
import {ItemDetail} from "@/components/munim/ItemDetail";
import {Sheet,SheetContent,SheetTitle} from "@/components/ui/sheet";
import {Menu,Plus,Pin,Archive,Pencil} from "lucide-react";
type Busca = { topico?:string|undefined; q?: string | undefined; ouvir?: boolean | undefined };

export const Route = createFileRoute("/_authenticated/conversa")({
  validateSearch: (s: Record<string, unknown>): Busca => ({
    topico:typeof s["topico"]==="string"?s["topico"]:undefined,
    q: typeof s["q"] === "string" ? s["q"] : undefined,
    ouvir: s["ouvir"] === true || s["ouvir"] === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
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
  const { q, ouvir,topico } = Route.useSearch();
  const { session } = useAuth();
  const userId = session?.user.id;
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const qc = useQueryClient();const navigate=useNavigate();const readTopics=useServerFn(topics),newTopic=useServerFn(createTopic),updateTopic=useServerFn(editTopic),undo=useServerFn(undoItem),saveCapture=useServerFn(createItem);
  const topicQuery=useQuery({queryKey:["topics",userId],queryFn:()=>readTopics(),enabled:!!userId});
  const topicId=topico??topicQuery.data?.find(t=>!t.arquivada)?.id;
  const [drawer,setDrawer]=useState(false),[topicSearch,setTopicSearch]=useState(""),[capture,setCapture]=useState<any>(null),[editCapture,setEditCapture]=useState(false);
  const topicList=<div className="flex flex-col gap-2"><Button onClick={async()=>{const t=await newTopic();await qc.invalidateQueries({queryKey:["topics"]});navigate({to:"/conversa",search:{topico:t.id}});setDrawer(false);}}><Plus className="h-4 w-4"/>Nova conversa</Button><input aria-label="Buscar tópicos" placeholder="Buscar tópicos" className="my-2 min-w-0 rounded-md border border-input bg-background p-2 text-sm" value={topicSearch} onChange={e=>setTopicSearch(e.target.value)}/>{topicQuery.data?.filter(t=>!t.arquivada&&t.titulo.toLowerCase().includes(topicSearch.toLowerCase())).map(t=><div key={t.id} className="border-b border-border py-2"><Button variant={t.id===topicId?"secondary":"ghost"} className="h-auto w-full justify-start whitespace-normal text-left" onClick={()=>{navigate({to:"/conversa",search:{topico:t.id}});setDrawer(false);}}>{t.fixada&&<Pin className="h-3 w-3"/>}{t.titulo}</Button><div className="flex"><Button variant="ghost" size="icon" aria-label={`Renomear ${t.titulo}`} onClick={async()=>{const titulo=window.prompt("Novo título",t.titulo);if(titulo){await updateTopic({data:{id:t.id,titulo}});qc.invalidateQueries({queryKey:["topics"]});}}}><Pencil className="h-3 w-3"/></Button><Button variant="ghost" size="icon" aria-label={`Fixar ${t.titulo}`} onClick={async()=>{await updateTopic({data:{id:t.id,fixada:!t.fixada}});qc.invalidateQueries({queryKey:["topics"]});}}><Pin className="h-3 w-3"/></Button><Button variant="ghost" size="icon" aria-label={`Arquivar ${t.titulo}`} onClick={async()=>{await updateTopic({data:{id:t.id,arquivada:true}});qc.invalidateQueries({queryKey:["topics"]});navigate({to:"/conversa",search:{}});}}><Archive className="h-3 w-3"/></Button></div></div>)}</div>;

  const history = useQuery({ queryKey: ["conversation-history", userId,topicId], enabled: !!userId&&!!topicId,
    queryFn: async () => {
      if (!userId) throw new Error("Sessão ausente.");
      const { data, error } = await supabase.from("mensagens").select("id, autor, canal, conteudo, created_at")
         .eq("user_id", userId).eq("conversa_id",topicId??"").order("created_at", { ascending: true }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => { setMsgs(history.data??[]);setCapture(null); }, [history.data,topicId]);
  const [texto, setTexto] = useState(q ?? "");
  const [estado, setEstado] = useState<EstadoNucleo>("repouso");
  const [erroVoz, setErroVoz] = useState<string | null>(null);
  const fimRef = useRef<HTMLDivElement>(null);
  const recRef = useRef<Reconhecedor | null>(null);
  const baseRef = useRef("");
  const conversar = useServerFn(conversarComMunim);

  useEffect(() => {
    if (q) setTexto(q);
  }, [q]);

  useEffect(() => {
    if (!userId) return;
    const canal = supabase
      .channel(`mensagens-${userId}-${topicId??"none"}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens", filter: `user_id=eq.${userId}` },
        (p) => {
          const m = p.new as Msg & {conversa_id:string};
          if(m.conversa_id!==topicId)return;
          setMsgs((atual) =>
            atual.some((x) => x.id === m.id) ? atual : [...atual, { ...m, animar: m.autor === "munim" }],
          );
          qc.setQueryData<Msg[]>(["conversation-history", userId,topicId], current => current?.some(x => x.id === m.id) ? current : [...(current ?? []), m]);
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [userId, qc,topicId]);

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
      for (let i = 0; i < e.results.length; i++) t += e.results[i]?.[0]?.transcript ?? "";
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
    let sendTopic=topicId;if(!sendTopic){const t=await newTopic();sendTopic=t.id;await qc.invalidateQueries({queryKey:["topics"]});navigate({to:"/conversa",search:{topico:t.id}});}
    const { data, error } = await supabase
      .from("mensagens")
      .insert({ user_id: userId, autor: "usuario", canal: "app", conteudo,conversa_id:sendTopic })
      .select("id, autor, canal, conteudo, created_at")
      .single();
    if (error) {
      setTexto(conteudo);
      setErroVoz("Não consegui enviar agora. Tente de novo.");
      return;
    }
    setMsgs((a) => (a.some((x) => x.id === data.id) ? a : [...a, data]));
    setEstado("pensando");
    try {
      const response=await conversar({ data: { conteudo,conversa_id:sendTopic } });
      setCapture(response.captura);qc.invalidateQueries({queryKey:["personal"]});qc.invalidateQueries({queryKey:["topics"]});
      const { data: novas } = await supabase
        .from("mensagens")
        .select("id, autor, canal, conteudo, created_at")
        .eq("user_id",userId).eq("conversa_id",sendTopic).eq("autor", "munim")
        .order("created_at", { ascending: false })
        .limit(1);
      const m = novas?.[0];
      if (m) setMsgs((a) => (a.some((x) => x.id === m.id) ? a : [...a, { ...m, animar: true }]));
    } catch(e) {
      setErroVoz(e instanceof Error?e.message:"Não consegui pensar agora. Tente de novo em instantes.");
    } finally {
      setEstado("repouso");
    }
  };

  return (
    <div className="flex"><aside className="hidden w-60 shrink-0 border-r border-border p-4 lg:block">{topicList}</aside><Sheet open={drawer} onOpenChange={setDrawer}><SheetContent side="left"><SheetTitle>Conversas</SheetTitle><div className="mt-4">{topicList}</div></SheetContent></Sheet><ItemDetail item={editCapture?capture:null} onClose={()=>setEditCapture(false)}/>
    <div className="mx-auto flex h-[calc(100dvh-6rem)] w-full max-w-3xl flex-col px-4 md:h-screen md:px-8">
      <header className="flex items-center gap-3 border-b border-border py-4">
        <Button size="icon" variant="ghost" className="lg:hidden" onClick={()=>setDrawer(true)} aria-label="Abrir tópicos"><Menu className="h-5 w-5"/></Button>
        <Nucleo tamanho={44} estado={estado} />
        <div>
          <h1 className="text-lg font-semibold text-foreground">Munim</h1>
          <p className="text-xs text-muted-foreground">
            {estado === "ouvindo" ? "Ouvindo…" : estado === "pensando" ? "Pensando…" : "Pronto para ajudar"}
          </p>
        </div>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto py-6">
        {history.isPending && <><Skeleton className="h-16 w-2/3" /><Skeleton className="ml-auto h-12 w-1/2" /></>}
        {history.error && <p role="alert" className="text-sm text-warning">Não consegui carregar o histórico. <Button variant="link" onClick={() => history.refetch()}>Tentar de novo</Button></p>}
        {!history.isPending && !history.error && msgs.length === 0 && (
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
        {capture?.suggestion&&<div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">Guardar: {capture.tipo} · {capture.titulo}?<Button size="sm" variant="link" onClick={async()=>{try{const item=await saveCapture({data:{tipo:capture.tipo,titulo:capture.titulo,conteudo:capture.conteudo,area_id:capture.area_id,data_alvo:capture.data_alvo,pessoa:capture.pessoa}});setCapture(item);qc.invalidateQueries({queryKey:["personal"]});}catch(e){setErroVoz(e instanceof Error?e.message:"Não consegui guardar.");}}}>Guardar</Button><Button size="sm" variant="link" onClick={()=>setCapture(null)}>Agora não</Button></div>}{capture&&!capture.suggestion&&<div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-success">Salvei: {capture.tipo} · {capture.titulo}<Button size="sm" variant="link" onClick={()=>setEditCapture(true)}>Editar</Button><Button size="sm" variant="link" onClick={async()=>{await undo({data:{id:capture.id}});setCapture(null);qc.invalidateQueries({queryKey:["personal"]});}}>Desfazer</Button></div>}
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
          <Button
            type="submit"
            disabled={!texto.trim()||estado==="pensando"}
            aria-label="Enviar"
            size="icon"
            className="h-10 w-10"
          >
            <ArrowUp className="h-5 w-5" />
          </Button>
        </form>
      </div>
    </div></div>
  );
}
