CREATE TABLE public.telegram_notifications(user_id uuid NOT NULL REFERENCES public.profiles(id), notification_key text NOT NULL, status text NOT NULL DEFAULT 'processing', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(user_id,notification_key));
GRANT ALL ON public.telegram_notifications TO service_role;
ALTER TABLE public.telegram_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY telegram_notifications_server_only ON public.telegram_notifications FOR ALL TO service_role USING(true) WITH CHECK(true);
CREATE TRIGGER telegram_notifications_updated BEFORE UPDATE ON public.telegram_notifications FOR EACH ROW EXECUTE FUNCTION public.telegram_touch_updated();