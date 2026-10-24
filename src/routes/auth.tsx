import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import { Nucleo } from "@/components/munim/Nucleo";
import { accountState, acceptTerms } from "@/lib/account.functions";
import { destination } from "@/lib/access";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { accountQueryOptions } from "@/lib/account-query";
export const Route=createFileRoute("/auth")({validateSearch:(s:Record<string,unknown>):{erro?:string}=>typeof s["erro"]==="string"?{erro:s["erro"]}:{},head:()=>({meta:[{title:"Entrar ou criar conta — Munin"},{name:"description",content:"Acesse a Central de Comando CS da Dinamize com Google ou e-mail."},{property:"og:title",content:"Entrar ou criar conta — Munin"},{property:"og:description",content:"Central de Customer Success da Dinamize, com acesso protegido."},{property:"og:type",content:"website"},{name:"twitter:card",content:"summary"}]}),component:Login});
function Login(){
  const {erro}=Route.useSearch(),{session}=useAuth(),navigate=useNavigate();
  const qc=useQueryClient(),accept=useServerFn(acceptTerms);
  const [mode,setMode]=useState<"login"|"signup"|"forgot">("login"),[busy,setBusy]=useState(false),[accepted,setAccepted]=useState(false),[message,setMessage]=useState<string|null>(erro ?? null);
  useEffect(()=>{if(!session)return;let live=true;(async()=>{try{if(sessionStorage.getItem("munim-terms-accepted")==="yes"){await accept({data:{accepted:true}});sessionStorage.removeItem("munim-terms-accepted");await qc.invalidateQueries({queryKey:["account-state",session.user.id]});}const a=await qc.ensureQueryData(accountQueryOptions(session.user.id));if(live)navigate({to:destination(a.status,a.accepted,a.onboarded,a.role),replace:true});}catch{if(live)setMessage("Não consegui verificar sua conta. Tente novamente.");}})();return()=>{live=false;};},[session?.user.id]);
  async function google(){if(mode==="signup"&&!accepted){setMessage("Aceite os Termos e a Política de Privacidade.");return;}setBusy(true);setMessage(null);if(mode==="signup")sessionStorage.setItem("munim-terms-accepted","yes");const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:window.location.origin,queryParams:{prompt:"select_account"}}});if(error){setMessage(error.message);setBusy(false);}}
  async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget),email=String(f.get("email")??"").trim(),password=String(f.get("password")??"");setMessage(null);setBusy(true);try{
    if(mode==="signup"){if(!accepted)throw new Error("Aceite os Termos e a Política de Privacidade.");sessionStorage.setItem("munim-terms-accepted","yes");const {data,error}=await supabase.auth.signUp({email,password,options:{emailRedirectTo:window.location.origin}});if(error)throw error;if(!data.session)setMessage("Confira seu e-mail para confirmar o cadastro. Depois, entre no Munin.");}
    else if(mode==="forgot"){const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:`${window.location.origin}/reset-password`});if(error)throw error;setMessage("Se houver uma conta, você receberá o link para redefinir a senha.");}
    else {const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;}
  }catch(e){setMessage(e instanceof Error?e.message:"Não foi possível entrar agora.");}finally{setBusy(false);}}
  return <main className="flex min-h-dvh items-center justify-center bg-background px-6 py-10"><div className="w-full max-w-sm text-center"><Nucleo tamanho={100} estado={busy?"pensando":"repouso"}/><h1 className="mt-5 font-display text-4xl font-semibold">Munin</h1><p className="mt-1 text-xs text-muted-foreground">por Wojtec</p><p className="mt-4 text-muted-foreground">Central de Comando CS · Dinamize</p>
  <div className="my-6 grid grid-cols-2 gap-2"><Button variant={mode==="login"?"secondary":"ghost"} onClick={()=>{setMode("login");setMessage(null);}}>Entrar</Button><Button variant={mode==="signup"?"secondary":"ghost"} onClick={()=>{setMode("signup");setMessage(null);}}>Criar conta</Button></div>
  {mode==="forgot"?<h2 className="mb-4 text-lg">Redefinir senha</h2>:<Button className="w-full" disabled={busy||(mode==="signup"&&!accepted)} onClick={google}>{mode==="signup"?"Criar conta com Google":"Entrar com Google"}</Button>}
  {mode!=="forgot"&&<div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/>ou com e-mail<span className="h-px flex-1 bg-border"/></div>}
  <form onSubmit={submit} className="space-y-3 text-left"><label className="block text-sm">E-mail<Input name="email" type="email" autoComplete="email" required className="mt-1" placeholder="voce@exemplo.com"/></label>{mode!=="forgot"&&<label className="block text-sm">Senha<Input name="password" type="password" minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} required className="mt-1"/></label>}
  {mode==="signup"&&<label className="flex items-start gap-2 text-xs leading-5"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} className="mt-1" required/><span>Li e aceito os <Link className="text-primary underline" to="/termos" target="_blank">Termos de Uso</Link> e a <Link className="text-primary underline" to="/privacidade" target="_blank">Política de Privacidade</Link>.</span></label>}
  <Button type="submit" variant="outline" className="w-full" disabled={busy}>{busy?"Aguarde…":mode==="signup"?"Criar conta":mode==="forgot"?"Enviar link":"Entrar com e-mail"}</Button></form>
  {mode==="login"&&<Button variant="link" className="mt-2" onClick={()=>{setMode("forgot");setMessage(null);}}>Esqueci minha senha</Button>}
  {message&&<p role="alert" className="mt-4 break-words rounded-lg border border-border p-3 text-sm">{message}</p>}
  <footer className="mt-6 flex justify-center gap-4 text-xs text-muted-foreground"><Link to="/termos">Termos</Link><Link to="/privacidade">Privacidade</Link></footer></div></main>;
}
