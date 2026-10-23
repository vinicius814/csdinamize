ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.account_access ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.admin_settings ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS atualizado_em timestamptz NOT NULL DEFAULT now();