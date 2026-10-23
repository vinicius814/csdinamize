import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {QRCodeSVG} from "qrcode.react";
import {Send,RefreshCw,Unplug,Copy,ExternalLink,Repeat} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {telegramLink,telegramStatus,disconnectTelegram,connectTelegramBot,testTelegram} from "@/lib/telegram.functions";
import {botSuggestions,validTokenFormat} from "@/lib/telegram-rules";
import {useAuth} from "@/lib/auth";

function Passo({n,titulo,children,ativo}:{n:number;titulo:string;children:React.ReactNode;ativo:boolean}){
  return <div className={`flex gap-3 ${ativo?"":"opacity-50"}`}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-sm text-primary-foreground">{n}</span><div className="flex min-w-0 flex-1 flex-col gap-2"><h3 className="font-semibold">{titulo}</h3>{ativo&&children}</div></div>;
}
export function TelegramConnection(){
  const {session,perfil}=useAuth(),qc=useQueryClient();
  const read=useServerFn(telegramStatus),generate=useServerFn(telegramLink),disconnect=useServerFn(disconnectTelegram),connect=useServerFn(connectTelegramBot),test=useServerFn(testTelegram);
  const [link,setLink]=useState<{url:string;expiresAt:string}|null>(null),[token,setToken]=useState(""),[trocar,setTrocar]=useState(false);
  const sug=botSuggestions(perfil?.nome);
  const q=useQuery({queryKey:["telegram-status",session?.user.id],queryFn:()=>read(),refetchInterval:query=>link&&!query.state.data?.connected?3000:false});
  const refresh=async()=>{await qc.invalidateQueries({queryKey:["telegram-status"]});await qc.invalidateQueries({queryKey:["conexoes"]});};
  const fresh=useMutation({mutationFn:()=>generate(),onSuccess:r=>setLink(r),onError:e=>toast.error(e.message)});
  const save=useMutation({mutationFn:()=>connect({data:{token}}),onSuccess:async r=>{setToken("");setTrocar(false);setLink(null);toast.success(`Bot @${r.bot_username} conectado`);await refresh();fresh.mutate();},onError:e=>toast.error(e.message)});
  const off=useMutation({mutationFn:()=>disconnect(),onSuccess:async()=>{setLink(null);await refresh();toast.success("Telegram desconectado.");},onError:e=>toast.error(e.message)});
  const ping=useMutation({mutationFn:()=>test(),onSuccess:()=>toast.success("Mensagem de teste enviada."),onError:async e=>{toast.error(e.message);await refresh();}});
  const copy=(t:string)=>{void navigator.clipboard.writeText(t);toast.success("Copiado.");};
  const d=q.data;const tokenOk=validTokenFormat(token);
  const step=!d?0:!d.configured||trocar?1:d.connected?4:3;
  return <section id="telegram" className="card-munim flex flex-col gap-4 p-5 sm:col-span-2"><h2 className="flex items-center gap-2 font-display text-lg"><Send className="h-5 w-5 text-primary"/>Telegram</h2>
  {q.isError?<p role="alert" className="break-words text-sm text-warning">{q.error.message}</p>:!d?<p className="text-sm text-muted-foreground">Verificando…</p>:step===4?<>
    <p className="text-sm text-success">Conectado pelo seu bot @{d.bot}.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href={`https://t.me/${d.bot}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Abrir meu bot</a></Button><Button variant="outline" disabled={ping.isPending} onClick={()=>ping.mutate()}><Send className="h-4 w-4"/>Enviar mensagem de teste</Button><Button variant="outline" onClick={()=>setTrocar(true)}><Repeat className="h-4 w-4"/>Trocar bot</Button><Button variant="outline" disabled={off.isPending} onClick={()=>off.mutate()}><Unplug className="h-4 w-4"/>Desconectar</Button></div>
  </>:<>
    {d.status==="erro"&&d.ultimo_erro&&<p role="alert" className="text-sm text-warning">{d.ultimo_erro}</p>}
    <p className="text-sm text-muted-foreground">Seu Munim no Telegram usa um bot só seu. Leva uns dois minutos.</p>
    <Passo n={1} titulo="Crie seu bot" ativo={step===1}>
      <Button className="self-start" asChild><a href="https://t.me/BotFather" target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Abrir o BotFather</a></Button>
      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground"><li>Envie <code>/newbot</code>.</li><li>Nome do bot: <strong className="text-foreground">{sug.nome}</strong></li><li>Usuário (precisa terminar em “bot”): <strong className="text-foreground">{sug.usuario}</strong> <Button size="sm" variant="ghost" onClick={()=>copy(sug.usuario)} aria-label="Copiar usuário sugerido"><Copy className="h-3 w-3"/></Button></li></ol>
      <div className="rounded-md border border-border bg-muted/40 p-3 text-xs text-muted-foreground"><p>O BotFather responde algo assim:</p><p className="mt-1">Done! Congratulations on your new bot. … Use this token to access the HTTP API:</p><p className="mt-1 break-all font-mono text-primary">7123456789:AAH4kZ…seu-token…x9Q</p><p className="mt-1">Copie essa linha destacada: é o token.</p></div>
    </Passo>
    <Passo n={2} titulo="Cole o token" ativo={step===1}>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={e=>{e.preventDefault();if(tokenOk)save.mutate();}}><Input value={token} onChange={e=>setToken(e.target.value)} placeholder="1234567890:AA…" autoComplete="off" spellCheck={false} aria-label="Token do bot"/><Button disabled={!tokenOk||save.isPending}>{save.isPending?"Conferindo…":"Conectar bot"}</Button></form>
      {token&&!tokenOk&&<p className="text-xs text-warning">Formato esperado: números, dois-pontos e uma sequência de letras.</p>}
      {trocar&&<Button variant="ghost" className="self-start" onClick={()=>setTrocar(false)}>Cancelar troca</Button>}
    </Passo>
    <Passo n={3} titulo="Vincule seu chat" ativo={step===3}>
      {d.bot&&<p className="text-sm text-success">Bot @{d.bot} conectado.</p>}
      {link?<><Button className="self-start" asChild><a href={link.url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4"/>Abrir meu bot</a></Button><p className="text-xs text-muted-foreground">No computador? Aponte a câmera do celular:</p><div className="self-start rounded-md bg-qr-surface p-3"><QRCodeSVG value={link.url} size={160}/></div><p className="text-xs text-muted-foreground">Toque em Iniciar no Telegram. Válido até {new Date(link.expiresAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}. Esta tela atualiza sozinha.</p></>:null}
      <div className="flex flex-wrap gap-2"><Button variant={link?"outline":"default"} disabled={fresh.isPending} onClick={()=>fresh.mutate()}><RefreshCw className="h-4 w-4"/>{fresh.isPending?"Gerando…":link?"Gerar novo código":"Gerar link de vínculo"}</Button><Button variant="outline" onClick={()=>setTrocar(true)}><Repeat className="h-4 w-4"/>Trocar bot</Button><Button variant="outline" disabled={off.isPending} onClick={()=>off.mutate()}><Unplug className="h-4 w-4"/>Desconectar</Button></div>
    </Passo>
  </>}
  </section>;
}
