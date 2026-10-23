import {useState} from "react";
import {useMutation} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {Plus,Send} from "lucide-react";
import {toast} from "sonner";
import {requestConnection} from "@/lib/connection-requests.functions";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
export function ConnectionRequest(){const [open,setOpen]=useState(false);const send=useServerFn(requestConnection);const m=useMutation({mutationFn:send,onSuccess:()=>{setOpen(false);toast.success("Pedido registrado.");},onError:e=>toast.error(e.message)});
 return <section className="card-munim p-5"><h2 className="font-display text-lg">Não encontrou sua ferramenta?</h2>{!open?<Button variant="outline" className="mt-3" onClick={()=>setOpen(true)}><Plus className="h-4 w-4"/>Peça uma conexão</Button>:<form className="mt-4 grid gap-3" onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);m.mutate({data:{ferramenta:String(f.get("ferramenta")),descricao:String(f.get("descricao"))}});}}><label className="text-sm">Ferramenta<Input className="mt-1" name="ferramenta" maxLength={100} required/></label><label className="text-sm">O que gostaria de fazer?<textarea name="descricao" maxLength={2000} required className="mt-1 min-h-24 w-full rounded-md border border-input bg-background p-3"/></label><div className="flex gap-2"><Button disabled={m.isPending} type="submit"><Send className="h-4 w-4"/>Enviar pedido</Button><Button variant="ghost" type="button" onClick={()=>setOpen(false)}>Cancelar</Button></div></form>}</section>;
}