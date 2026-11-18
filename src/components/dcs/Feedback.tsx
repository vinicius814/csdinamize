/**
 * Canal de feedback da versão Beta (D36). Registra tipo, descrição, funcionalidade, página (sem parâmetros de URL) e
 * versão. Não captura telas, dados de clientes nem credenciais. Limite de envio aplicado no banco (dcs_enviar_feedback).
 */
import { useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { MessageSquarePlus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useEnviarFeedback } from "@/lib/dcs/dados";
import { mensagemErro } from "@/lib/dcs/db";
import { VERSAO } from "@/lib/versao";
import { NAV, tituloDaRota } from "./navegacao";

export const TIPOS_FEEDBACK = {
  sugestao: "Sugestão",
  dificuldade: "Dificuldade de utilização",
  erro: "Erro",
  informacao_incorreta: "Informação incorreta",
  outro: "Outro",
} as const;

export function Feedback({
  recolhido,
  className,
}: {
  recolhido?: boolean | undefined;
  className?: string;
}) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const enviar = useEnviarFeedback();
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<keyof typeof TIPOS_FEEDBACK>("sugestao");
  const [descricao, setDescricao] = useState("");
  const [func, setFunc] = useState("");
  const abrir = () => {
    setFunc(tituloDaRota(path));
    setAberto(true);
  };
  const ok = descricao.trim().length >= 10;
  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className={className}
        title={recolhido ? "Enviar feedback" : undefined}
      >
        <MessageSquarePlus className="h-4 w-4" /> {!recolhido && "Enviar feedback"}
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="max-w-lg">
          <DialogTitle>Enviar feedback</DialogTitle>
          <DialogDescription>
            Ajude a evoluir a versão Beta. Registramos seu usuário, a data, a página e a versão. Não
            inclua dados de clientes, senhas ou informações sigilosas.
          </DialogDescription>
          <div className="grid gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Tipo
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as keyof typeof TIPOS_FEEDBACK)}
                className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
              >
                {Object.entries(TIPOS_FEEDBACK).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Funcionalidade relacionada
              <select
                value={func}
                onChange={(e) => setFunc(e.target.value)}
                className="h-9 rounded-lg border bg-card px-2 text-sm text-foreground"
              >
                {Array.from(
                  new Set([
                    func,
                    ...NAV.map((n) => n.rotulo),
                    "Diagnóstico do cliente",
                    "Acesso e senha",
                    "Ajuda e tour guiado",
                    "Outra",
                  ]),
                )
                  .filter(Boolean)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Descrição
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value.slice(0, 2000))}
                rows={5}
                className="rounded-lg border bg-card px-2 py-1.5 text-sm text-foreground"
                placeholder="O que aconteceu ou o que poderia melhorar?"
              />
              <span className="text-[11px] font-normal">{descricao.length}/2000</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!ok || enviar.isPending}
              onClick={() =>
                enviar.mutate(
                  {
                    tipo,
                    descricao: descricao.trim(),
                    funcionalidade: func,
                    pagina: path,
                    versao: VERSAO,
                  },
                  {
                    onSuccess: () => {
                      toast.success("Obrigado! Seu feedback foi registrado.");
                      setDescricao("");
                      setAberto(false);
                    },
                    onError: (e) => toast.error(mensagemErro(e)),
                  },
                )
              }
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
            >
              {enviar.isPending ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
