CREATE TABLE public.entradas_telegram (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  update_id bigint NOT NULL UNIQUE,
  chat_id bigint NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('texto','comando','voz','audio','video','foto','documento')),
  texto text,
  legenda text,
  arquivo jsonb,
  extracao_erro text,
  status text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida','processada','erro')),
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX entradas_telegram_user_idx ON public.entradas_telegram(user_id, created_at DESC);
GRANT SELECT ON public.entradas_telegram TO authenticated;
GRANT ALL ON public.entradas_telegram TO service_role;
ALTER TABLE public.entradas_telegram ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuário lê as próprias entradas do Telegram" ON public.entradas_telegram FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER entradas_telegram_atualizado_em BEFORE UPDATE ON public.entradas_telegram FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();