import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const carteiraAoVivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const I = await import("./integracoes.server");
    const { data: perf } = await context.supabase.from("profiles").select("pipedrive_user_id").eq("id", context.userId).maybeSingle();
    try {
      const clientes = await I.carteiraPipedrive(perf?.pipedrive_user_id ? Number(perf.pipedrive_user_id) : null);
      return { clientes, erro: null as string | null };
    } catch (e: any) {
      return { clientes: [], erro: "Não consegui falar com o Pipedrive agora." };
    }
  });

export const detalheCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { titulo: string }) => ({ titulo: String(i?.titulo ?? "").slice(0, 120) }))
  .handler(async ({ data }) => {
    const I = await import("./integracoes.server");
    const r = await I.buscarDealPipedrive(data.titulo).catch(() => []);
    return r[0] ?? null;
  });

export const listarNotas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { texto?: string }) => ({ texto: String(i?.texto ?? "").slice(0, 100) }))
  .handler(async ({ data }) => {
    const I = await import("./integracoes.server");
    try {
      return { notas: await I.listarNotasDrive(data.texto || undefined, 100), erro: null as string | null };
    } catch {
      return { notas: [], erro: "Não consegui abrir seu Segundo Cérebro no Drive agora." };
    }
  });

export const lerNota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => {
    if (!/^[\w-]{10,}$/.test(i?.id ?? "")) throw new Error("Nota inválida");
    return i;
  })
  .handler(async ({ data }) => {
    const I = await import("./integracoes.server");
    return { conteudo: await I.lerArquivoDrive(data.id) };
  });
