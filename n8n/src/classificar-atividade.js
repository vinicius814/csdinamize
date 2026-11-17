// Código do nó "Classificar atividades" (workflow 05). Equivalência com motor.classificarAtividade testada.
function classificarAtividade(a, cov) {
  const temPalavra = (txt, lista) => { const t = txt.toLowerCase(); return (lista || []).some((k) => k && t.includes(String(k).toLowerCase())); };
  const semHtml = (h) => String(h || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
  if (!a || !a.done || a.is_deleted) return "ignorar";
  const subj = String(a.subject || "");
  if (subj.startsWith("CS | Diagnóstico de utilização") || /DZCS-\S+-C\d+/.test(String(a.note || ""))) return "ignorar";
  const mode = cov.modes?.[a.type || ""] || "nao";
  if (mode === "nao") return "ignorar";
  if (mode === "forte") return "efetivo";
  if (mode === "tentativa") return "tentativa";
  const txt = subj + " " + semHtml(a.note);
  if (temPalavra(txt, cov.kwNeg)) return "tentativa";
  if (mode === "sim") return "efetivo";
  return temPalavra(txt, cov.kwPos) ? "efetivo" : "incerto";
}
