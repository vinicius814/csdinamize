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
  type StatusConexao,
} from "@/lib/conexoes.functions";

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

  const atualizar = () => qc.invalidateQueries({ queryKey: ["conexoes"] });

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
    } catch {
      popup.close();
      toast.error(`Não consegui conectar o ${nome}.`);
    } finally {
      setOcupado(null);
    }
  };

  const desconectar = async (s: ServicoGoogle, nome: string) => {
    setOcupado(s);
    await desligar({ data: { servico: s } }).catch(() => null);
    toast.success(`${nome} desconectado.`);
    setOcupado(null);
    atualizar();
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
    <section className="card-munim mb-6 flex flex-col gap-5 p-5">
      <div>
        <h2 className="font-display text-lg text-foreground">Suas contas</h2>
        <p className="text-sm text-muted-foreground">Cada pessoa conecta as próprias contas. Ninguém vê os dados de outra.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {SERVICOS.map((sv) => {
          const st = servicos?.[sv.id];
          const proprio = !!st?.proprio;
          return (
            <div key={sv.id} className="flex flex-col gap-2 rounded-lg border border-border p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${!st ? "bg-muted-foreground" : st.ok && proprio ? "bg-success" : "bg-warning"}`} />
                <span className="font-medium text-foreground">{sv.nome}</span>
              </div>
              <p className="text-xs text-muted-foreground">{sv.papel}</p>
              <p className="text-xs text-foreground">{st?.detalhe ?? "…"}</p>
              <div className="mt-auto flex gap-3 text-sm">
                <button disabled={ocupado === sv.id} onClick={() => conectar(sv.id, sv.nome, proprio)} className="text-primary hover:underline disabled:opacity-50">
                  {ocupado === sv.id ? "Abrindo…" : proprio ? "Reconectar" : "Conectar minha conta"}
                </button>
                {proprio && (
                  <button disabled={ocupado === sv.id} onClick={() => desconectar(sv.id, sv.nome)} className="text-muted-foreground hover:text-foreground">
                    Desconectar
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${pipedrive?.ok && pipedrive.proprio ? "bg-success" : "bg-warning"}`} />
          <span className="font-medium text-foreground">Pipedrive</span>
        </div>
        {pipedrive?.proprio ? (
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="text-foreground">{pipedrive.detalhe} {pipedriveDominio ? `· ${pipedriveDominio}.pipedrive.com` : ""}</span>
            <button onClick={async () => { await desligarPd(); toast.success("Pipedrive desconectado."); atualizar(); }} className="text-muted-foreground hover:text-foreground">
              Desconectar
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">
              No Pipedrive, clique na sua foto › Preferências pessoais › API e copie o seu token. O domínio é o nome antes de .pipedrive.com no endereço.
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input value={dominio} onChange={(e) => setDominio(e.target.value)} placeholder="suaempresa" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" aria-label="Domínio do Pipedrive" />
              <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="Token de API" type="password" autoComplete="off" className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground" aria-label="Token de API do Pipedrive" />
              <button onClick={conectarPd} disabled={!token || !dominio || ocupado === "pd"} className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50">
                {ocupado === "pd" ? "Validando…" : "Conectar"}
              </button>
            </div>
            {pipedrive?.ok && <p className="text-xs text-muted-foreground">Por enquanto você usa a conexão provisória do projeto.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
