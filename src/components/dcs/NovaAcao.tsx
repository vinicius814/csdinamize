import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { mensagemErro } from "@/lib/dcs/db";
import { useCarteira, useCriarAcao } from "@/lib/dcs/dados";
import { CATEGORIAS } from "@/lib/dcs/indicadores";

/** Cria uma ação manual no plano (dcs_criar_acao). Sem `clienteKey`, permite escolher o cliente. */
export function NovaAcao({ clienteKey }: { clienteKey?: string }) {
  const [aberto, setAberto] = useState(false);
  const criar = useCriarAcao();
  const carteira = useCarteira();
  const vazio = {
    key: clienteKey ?? "",
    busca: "",
    categoria: "aut",
    problema: "",
    acao: "",
    prioridade: "media",
    complexidade: "",
    responsavel: "",
    prazo: "",
    ganho: false,
  };
  const [f, setF] = useState(vazio);
  const candidatos =
    !clienteKey && f.busca.trim().length >= 2
      ? (carteira.data ?? [])
          .filter((l) => l.c.nome.toLowerCase().includes(f.busca.toLowerCase()))
          .slice(0, 6)
      : [];
  const nomeSel = (carteira.data ?? []).find((l) => l.c.key === f.key)?.c.nome;
  const salvar = () =>
    criar.mutate(
      {
        key: f.key,
        categoria: f.categoria,
        problema: f.problema.trim(),
        acao: f.acao.trim(),
        prioridade: f.prioridade,
        complexidade: f.complexidade || null,
        responsavel: f.responsavel.trim() || null,
        prazo: f.prazo || null,
        ganho_rapido: f.ganho,
      },
      {
        onSuccess: () => (toast.success("Ação criada no plano."), setAberto(false), setF(vazio)),
        onError: (e) => toast.error(mensagemErro(e)),
      },
    );
  const campo = "h-9 w-full rounded-lg border bg-card px-2 text-sm";
  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      >
        <Plus className="h-4 w-4" /> Nova ação
      </button>
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-lg">
          <DialogTitle>Nova ação no plano</DialogTitle>
          <DialogDescription>
            Ação manual: é preservada nas próximas conclusões de diagnóstico.
          </DialogDescription>
          <div className="mt-2 grid gap-3 text-sm">
            {!clienteKey && (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Cliente</span>
                {f.key ? (
                  <span className="flex items-center justify-between rounded-lg border bg-surface-2 px-2 py-1.5">
                    {nomeSel}
                    <button
                      type="button"
                      className="text-xs text-primary"
                      onClick={() => setF({ ...f, key: "" })}
                    >
                      trocar
                    </button>
                  </span>
                ) : (
                  <>
                    <input
                      value={f.busca}
                      onChange={(e) => setF({ ...f, busca: e.target.value })}
                      placeholder="Buscar cliente"
                      className={campo}
                    />
                    {candidatos.length > 0 && (
                      <ul className="rounded-lg border">
                        {candidatos.map((l) => (
                          <li key={l.c.key}>
                            <button
                              type="button"
                              onClick={() => setF({ ...f, key: l.c.key, busca: "" })}
                              className="block w-full px-2 py-1.5 text-left hover:bg-surface-2"
                            >
                              {l.c.nome}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </label>
            )}
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                Problema identificado
              </span>
              <input
                value={f.problema}
                onChange={(e) => setF({ ...f, problema: e.target.value })}
                className={campo}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-muted-foreground">Ação recomendada</span>
              <textarea
                rows={3}
                value={f.acao}
                onChange={(e) => setF({ ...f, acao: e.target.value })}
                className="w-full rounded-lg border bg-card p-2"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Categoria</span>
                <select
                  value={f.categoria}
                  onChange={(e) => setF({ ...f, categoria: e.target.value })}
                  className={campo}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.curto}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Prioridade</span>
                <select
                  value={f.prioridade}
                  onChange={(e) => setF({ ...f, prioridade: e.target.value })}
                  className={campo}
                >
                  <option value="critica">Crítica</option>
                  <option value="alta">Alta</option>
                  <option value="media">Média</option>
                  <option value="baixa">Baixa</option>
                </select>
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Responsável</span>
                <input
                  value={f.responsavel}
                  onChange={(e) => setF({ ...f, responsavel: e.target.value })}
                  className={campo}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Prazo</span>
                <input
                  type="date"
                  value={f.prazo}
                  onChange={(e) => setF({ ...f, prazo: e.target.value })}
                  className={campo}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-xs font-medium text-muted-foreground">Complexidade</span>
                <select
                  value={f.complexidade}
                  onChange={(e) => setF({ ...f, complexidade: e.target.value })}
                  className={campo}
                >
                  <option value="">—</option>
                  <option value="baixa">Baixa</option>
                  <option value="media">Média</option>
                  <option value="alta">Alta</option>
                </select>
              </label>
              <label className="flex items-end gap-2 pb-2">
                <input
                  type="checkbox"
                  checked={f.ganho}
                  onChange={(e) => setF({ ...f, ganho: e.target.checked })}
                  className="accent-[var(--primary)]"
                />{" "}
                Ganho rápido
              </label>
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="h-9 rounded-lg border px-3 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={!f.key || !f.problema.trim() || !f.acao.trim() || criar.isPending}
              onClick={salvar}
              className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-60"
            >
              {criar.isPending ? "Salvando…" : "Criar ação"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
