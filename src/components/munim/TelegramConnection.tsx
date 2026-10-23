import {useState} from "react";
import {useQuery,useMutation,useQueryClient} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {QRCodeSVG} from "qrcode.react";
import {Send,RefreshCw,Unplug} from "lucide-react";
import {toast} from "sonner";
import {Button} from "@/components/ui/button";
import {telegramLink,telegramStatus,disconnectTelegram} from "@/lib/telegram.functions";
import {useAuth} from "@/lib/auth";
export function TelegramConnection(){
 const {session}=useAuth(),qc=useQueryClient();const read=useServerFn(telegramStatus),generate=useServerFn(telegramLink),disconnect=useServerFn(disconnectTelegram);
 const [link,setLink]=useState<{url:string;expiresAt:string}|null>(null);
 const q=useQuery({queryKey:["telegram-status",session?.user.id],queryFn:()=>read(),refetchInterval:query=>link&&!query.state.data?.connected?3000:false});
 const fresh=useMutation({mutationFn:()=>generate(),onSuccess:r=>{if(r.url&&r.expiresAt)setLink({url:r.url,expiresAt:r.expiresAt});},onError:e=>toast.error(e.message)});
 const off=useMutation({mutationFn:()=>disconnect(),onSuccess:async()=>{setLink(null);await qc.invalidateQueries({queryKey:["telegram-status"]});await qc.invalidateQueries({queryKey:["conexoes"]});toast.success("Telegram desconectado.");},onError:e=>toast.error(e.message)});
 return <section className="card-munim flex flex-col gap-3 p-5"><h2 className="flex items-center gap-2 font-display text-lg"><Send className="h-5 w-5 text-primary"/>Telegram</h2>
 {q.isError?<p role="alert" className="break-words text-sm text-warning">{q.error.message}</p>:!q.data?<p className="text-sm text-muted-foreground">Verificando…</p>:!q.data.configured?<div className="text-sm text-muted-foreground"><p>Bot ainda não configurado.</p><p className="mt-2">No Telegram, abra @BotFather, envie /newbot, escolha um nome e um nome de usuário terminado em bot. Salve o token recebido como TELEGRAM_BOT_TOKEN nas configurações seguras do projeto.</p></div>:q.data.connected?<><p className="text-sm text-success">Conectado{q.data.username?` como @${q.data.username}`:" à sua conta"}.</p><Button variant="outline" className="self-start" onClick={()=>off.mutate()} disabled={off.isPending}><Unplug className="h-4 w-4"/>Desconectar Telegram</Button></>:<><p className="text-sm text-muted-foreground">Não conectado.</p>{link&&<><div className="self-start rounded-md bg-qr-surface p-3"><QRCodeSVG value={link.url} size={160}/></div><a className="text-sm text-primary underline" href={link.url} target="_blank" rel="noreferrer">Abrir no Telegram</a><p className="text-xs text-muted-foreground">Válido por 15 minutos · até {new Date(link.expiresAt).toLocaleTimeString("pt-BR",{hour:"2-digit",minute:"2-digit"})}</p></>}<Button className="self-start" disabled={fresh.isPending} onClick={()=>fresh.mutate()}><RefreshCw className="h-4 w-4"/>{fresh.isPending?"Gerando…":link?"Gerar novo código":"Conectar Telegram"}</Button></>}
 </section>;
}