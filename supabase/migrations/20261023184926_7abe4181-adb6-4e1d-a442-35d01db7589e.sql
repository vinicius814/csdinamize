CREATE TABLE public.telegram_bots (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 bot_id bigint NOT NULL UNIQUE,
 bot_username text NOT NULL,
 bot_nome text NOT NULL,
 token_cifrado text NOT NULL,
 webhook_secret text NOT NULL,
 chat_id bigint UNIQUE,
 codigo_vinculo text,
 expira_em timestamptz,
 status text NOT NULL DEFAULT 'pendente_vinculo' CHECK (status IN ('pendente_vinculo','ativo','erro','desconectado')),
 ultimo_erro text,
 conectado_em timestamptz NOT NULL DEFAULT now(),
 atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.telegram_bots TO service_role;
ALTER TABLE public.telegram_bots ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_bots_server_only ON public.telegram_bots FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE TRIGGER telegram_bots_tocar BEFORE UPDATE ON public.telegram_bots FOR EACH ROW EXECUTE FUNCTION public.tocar_atualizado_em();

CREATE TABLE public.telegram_bot_updates (
 bot_id bigint NOT NULL,
 update_id bigint NOT NULL,
 status text NOT NULL DEFAULT 'processing',
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (bot_id, update_id)
);
GRANT ALL ON public.telegram_bot_updates TO service_role;
ALTER TABLE public.telegram_bot_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_bot_updates_server_only ON public.telegram_bot_updates FOR ALL TO service_role USING (true) WITH CHECK (true);

ALTER TABLE public.entradas_telegram ADD COLUMN bot_id bigint;
ALTER TABLE public.entradas_telegram DROP CONSTRAINT IF EXISTS entradas_telegram_update_id_key;
CREATE UNIQUE INDEX entradas_telegram_bot_update ON public.entradas_telegram (bot_id, update_id);

CREATE FUNCTION public.vincular_bot_telegram(bot bigint, code text, chat bigint) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid; BEGIN
 SELECT b.user_id INTO uid FROM public.telegram_bots b JOIN public.account_access a ON a.user_id=b.user_id
  WHERE b.bot_id=bot AND b.chat_id IS NULL AND b.codigo_vinculo=code AND b.expira_em>now() AND a.status='ativo' AND a.terms_accepted_at IS NOT NULL FOR UPDATE OF b;
 IF uid IS NULL THEN RAISE EXCEPTION 'Código inválido ou expirado. Gere outro no Munim.'; END IF;
 UPDATE public.telegram_bots SET chat_id=chat,status='ativo',ultimo_erro=NULL,codigo_vinculo=NULL,expira_em=NULL WHERE user_id=uid;
 UPDATE public.profiles SET telegram_chat_id=chat WHERE id=uid;
 RETURN uid; END $$;
REVOKE ALL ON FUNCTION public.vincular_bot_telegram(bigint,text,bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vincular_bot_telegram(bigint,text,bigint) TO service_role;

UPDATE public.profiles SET telegram_chat_id=NULL, telegram_username=NULL WHERE telegram_chat_id IS NOT NULL;