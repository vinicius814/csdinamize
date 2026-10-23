import {useState,useEffect} from "react";
import {useMutation,useQueryClient} from "@tanstack/react-query";
import {useServerFn} from "@tanstack/react-start";
import {toast} from "sonner";
import {Sheet,SheetContent,SheetHeader,SheetTitle} from "@/components/ui/sheet";
import {Button} from "@/components/ui/button";
import {Input} from "@/components/ui/input";
import {changeItem} from "@/lib/personal.functions";
export function ItemDetail({item,onClose}:{item:{id:string;titulo:string;conteudo:string;status:string;data_alvo:string|null}|null;onClose:()=>void}){
 const [title,setTitle]=useState(""),[content,setContent]=useState("");useEffect(()=>{setTitle(item?.titulo??"");setContent(item?.conteudo??"");},[item]);const save=useServerFn(changeItem),qc=useQueryClient();const m=useMutation({mutationFn:save,onSuccess:()=>{qc.invalidateQueries({queryKey:["personal"]});onClose();toast.success("Salvo.");},onError:e=>toast.error(e.message)});
 return <Sheet open={!!item} onOpenChange={open=>{if(!open)onClose();}}><SheetContent className="overflow-y-auto"><SheetHeader><SheetTitle>{item?.titulo}</SheetTitle></SheetHeader>{item&&<form className="mt-6 grid gap-4" onSubmit={e=>{e.preventDefault();m.mutate({data:{id:item.id,titulo:title,conteudo:content}});}}><label className="text-sm">Título<Input value={title} onChange={e=>setTitle(e.target.value)} maxLength={200}/></label><label className="text-sm">Conteúdo<textarea value={content} onChange={e=>setContent(e.target.value)} className="mt-1 min-h-48 w-full rounded-md border border-input bg-background p-3"/></label><p className="text-xs text-muted-foreground">{item.status}{item.data_alvo?` · ${new Date(item.data_alvo).toLocaleString("pt-BR")}`:""}</p><Button disabled={m.isPending}>Salvar</Button><Button type="button" variant="outline" disabled={m.isPending} onClick={()=>m.mutate({data:{id:item.id,status:"arquivado"}})}>Arquivar</Button></form>}</SheetContent></Sheet>;
}