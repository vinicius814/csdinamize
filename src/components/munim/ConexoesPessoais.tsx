import { Button } from "@/components/ui/button";
import { PipedriveConfig } from "./PipedriveConfig";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  concluirGoogle,
  desconectarGoogle,
  desconectarPipedrive,
  iniciarGoogle,
  salvarPipedrive,
  type ServicoGoogle,
  statusCorporativo,
  type StatusConexao,
} from "@/lib/conexoes.functions";
import { ROTULO_ESTADO, type EstadoConexao } from "@/lib/connection-rules";
import { useQuery } from "@tanstack/react-query";

const COR: Record<EstadoConexao, string> = { validado: "bg-success", aguardando: "bg-muted-foreground", sem_permissao: "bg-warning", expirada: "bg-warning", erro_autenticacao: "bg-destructive", desconectado: "bg-muted-foreground", erro: "bg-warning" };
const hora = (d?: string | null) => d ? new Date(d).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }) : "—";
function Estado({ st }: { st?: StatusConexao }) {
  const e = st?.estado ?? (st ? (st.ok ? "validado" : st.proprio ? "erro" : "desconectado") : "aguardando");
  return <div className="flex flex-col gap-1 text-xs">
    <span className="flex items-center gap-2 font-medium text-foreground"><span className={`h-2.5 w-2.5 rounded-full ${COR[e]}`} />{st ? ROTULO_ESTADO[e] : "Verificando…"}</span>
    {st?.conta && <span className="break-all text-muted-foreground">Conta: {st.conta}</span>}
    {st?.leitura && <span className="text-muted-foreground">Leitura: {st.leitura}</span>}
    {st && e !== "validado" && <span className="break-words text-foreground">{st.detalhe}</span>}
    {st?.verificadoEm && <span className="text-muted-foreground">Verificado em {hora(st.verificadoEm)}</span>}
    {st?.tecnico && <details className="text-muted-foreground"><summary className="cursor-pointer">Detalhe técnico</summary><span className="break-words">{st.tecnico}</span></details>}
  </div>;
}

function Corporativo() {
  const read = useServerFn(statusCorporativo);
  const { data } = useQuery({ queryKey: ["conexoes", "corporativo"], queryFn: () => read() });
  if (!data) return null;
  return <div className="rounded-lg border border-border p-4">
    <span className="font-medium text-foreground">Integração corporativa Pipedrive</span>
    <p className="mb-2 text-xs text-muted-foreground">Fonte compartilhada das carteiras e indicadores. Independe das contas pessoais.</p>
    <Estado st={{ ok: data.estado === "validado", estado: data.estado, detalhe: ROTULO_ESTADO[data.estado], conta: data.conta ? `${data.conta}${data.dominio ? ` · ${data.dominio}.pipedrive.com` : ""}` : null, verificadoEm: data.verificadoEm, leitura: `última sincronização ${hora(data.ultimaLeitura)}`, tecnico: data.tecnico }} />
  </div>;
}

const SERVICOS: { id: ServicoGoogle; nome: string; papel: string }[] = [
  { id: "google_mail", nome: "Gmail", papel: "Ler e-mails e criar rascunhos." },
  { id: "google_calendar", nome: "Google Agenda", papel: "Ver e criar compromissos." },
  { id: "google_drive", nome: "Google Drive", papel: "Ler e gravar o Segundo Cérebro." },
];

function esperarPopup(popup: Window, servico: ServicoGoogle) {
  return new Promise<string | null>((resolve, reject) => {
    const limpar = () => {
      window.removeEventListener("message", onMsg);
      window.clearInterval(poll);
    };
    const onMsg = (e: MessageEvent) => {
      const t = e.data?.type;
      if (e.origin !== window.location.origin || e.source !== popup || e.data?.connectorId !== servico) return;
      if (t !== "appUserConnectorOAuthComplete" && t !== "appUserConnectorOAuthFailed") return;
      limpar();
      if (t === "appUserConnectorOAuthComplete") resolve(typeof e.data?.code === "string" ? e.data.code : null);
      else reject(new Error("falhou"));
    };
    window.addEventListener("message", onMsg);
    const poll = window.setInterval(() => {
      if (popup.closed) {
        limpar();
        reject(new Error("fechada"));
      }
    }, 500);
  });
}

type Props = {
  servicos?: Record<ServicoGoogle, StatusConexao> | undefined;
  pipedrive?: StatusConexao | undefined;
  pipedriveDominio?: string | null | undefined;
};

export function ConexoesPessoais({ servicos, pipedrive, pipedriveDominio }: Props) {
  const qc = useQueryClient();
  const iniciar = useServerFn(iniciarGoogle);
  const concluir = useServerFn(concluirGoogle);
  const desligar = useServerFn(desconectarGoogle);
  const salvarPd = useServerFn(salvarPipedrive);
  const desligarPd = useServerFn(desconectarPipedrive);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [dominio, setDominio] = useState("");

  const atualizar = () => qc.invalidateQueries({ predicate: q => ["connection-presence", "conexoes", "carteira-viva", "cliente-det", "notas-drive", "nota", "onboarding-options"].includes(String(q.queryKey[0])) });

  const conectar = async (s: ServicoGoogle, nome: string, reconectar: boolean) => {
    const popup = window.open("", "munim-google", "width=560,height=720");
    if (!popup) { toast.error("Libere as janelas pop-up e tente de novo."); return; }
    setOcupado(s);
    try {
      const { authorizationUrl } = await iniciar({ data: { servico: s } });
      const espera = esperarPopup(popup, s);
      popup.location.href = authorizationUrl;
      const code = await espera;
      if (code) await concluir({ data: { servico: s, code } });
      toast.success(reconectar ? `${nome} reconectado.` : `${nome} conectado.`);
      atualizar();
    } catch(e) {
      popup.close();
      toast.error(e instanceof Error?e.message:`Não consegui conectar o ${nome}.`);
    } finally {
      setOcupado(null);
    }
  };

  const desconectar = async (s: ServicoGoogle, nome: string) => {
    setOcupado(s);
    try {await desligar({ data: { servico: s } });toast.success(`${nome} desconectado.`);atualizar();}
    catch(e){toast.error(e instanceof Error?e.message:"Não consegui desconectar.");}
    finally{setOcupado(null);}
  };

  const conectarPd = async () => {
    setOcupado("pd");
    const r = await salvarPd({ data: { token, dominio } }).catch(() => ({ ok: false, erro: "Não consegui salvar agora." }));
    setOcupado(null);
    if (!r.ok) { toast.error(r.erro ?? "Não consegui conectar."); return; }
    setToken("");
    toast.success("Pipedrive conectado.");
    atualizar();
  };

  return (
    <section className="mb-6 flex flex-col gap-5">
      <div>
        <h2 className="font-display text-lg text-foreground">Suas contas</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICOS.map((sv) => {
          const st = servicos?.[sv.id];
          const proprio = !!st?.proprio;
          return (
            <div key={sv.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <span className="font-medium text-foreground">{sv.nome}</span>
              <p className="text-xs text-muted-foreground">{sv.papel}</p>
              <Estado st={st} />
               <div className="mt-auto flex flex-wrap gap-2 text-sm">
                 <Button disabled={ocupado !== null} onClick={() => conectar(sv.id, sv.nome, proprio)} className="max-w-full">
                  {ocupado === sv.id ? "Abrindo…" : proprio ? "Reconectar" : "Conectar minha conta"}
                </Button>
                {proprio && (
                   <Button variant="outline" disabled={ocupado !== null} onClick={() => desconectar(sv.id, sv.nome)}>
                    Desconectar
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border p-4">
        <span className="font-medium text-foreground">Minha conta Pipedrive</span>
        <div className="mt-2"><Estado st={pipedrive} /></div>
        {pipedrive?.proprio && (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-muted-foreground">{pipedriveDominio ? `· ${pipedriveDominio}.pipedrive.com` : ""}</span>
             <Button variant="outline" onClick={async () => { try {await desligarPd(); toast.success("Pipedrive desconectado."); atualizar();} catch(e) {toast.error(e instanceof Error ? e.message : "Não consegui desconectar.");} }}>
              Desconectar
            </Button>
          </div>
        )}
        {!pipedrive?.ok && (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              No Pipedrive, clique na sua foto › Preferências pessoais › API e copie o seu token. O domínio é o nome antes de .pipedrive.com no endereço.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="suaempresa" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" aria-label="Domínio do Pipedrive" />
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de API" type="password" autoComplete="off" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" aria-label="Token de API do Pipedrive" />
               <Button onClick={conectarPd} disabled={!token || !dominio || ocupado !== null}>
                {ocupado === "pd" ? "Validando…" : pipedrive?.proprio ? "Reconectar" : "Conectar"}
              </Button>
       </div>
          </div>
        )}
        {pipedrive?.ok && <PipedriveConfig />}
      </div>
      <Corporativo />
    </section>
  );
}
