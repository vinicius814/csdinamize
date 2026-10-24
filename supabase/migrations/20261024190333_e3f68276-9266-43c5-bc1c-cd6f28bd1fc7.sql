CREATE TABLE public.cs_cancelamentos (
 deal_id bigint PRIMARY KEY,
 org_id bigint,
 pipeline_id integer NOT NULL,
 owner_id integer NOT NULL,
 stage_id integer NOT NULL,
 dia date NOT NULL,
 valor numeric,
 moeda text,
 motivo text,
 revertido boolean NOT NULL DEFAULT false,
 origem text NOT NULL DEFAULT 'pipedrive_lost_time',
 consultado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cs_cancelamentos TO authenticated;
GRANT ALL ON public.cs_cancelamentos TO service_role;
ALTER TABLE public.cs_cancelamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cancelamentos pelo escopo CS" ON public.cs_cancelamentos FOR SELECT TO authenticated USING (public.cs_pode_ver(owner_id, pipeline_id));
CREATE INDEX cs_cancelamentos_dia ON public.cs_cancelamentos(dia);

CREATE TABLE public.cs_historico_execucoes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tipo text NOT NULL,
 actor uuid,
 iniciado_em timestamptz NOT NULL DEFAULT now(),
 concluido_em timestamptz,
 status text NOT NULL DEFAULT 'executando',
 consultas integer NOT NULL DEFAULT 0,
 registros integer NOT NULL DEFAULT 0,
 desde date,
 erro text
);
GRANT ALL ON public.cs_historico_execucoes TO service_role;
ALTER TABLE public.cs_historico_execucoes ENABLE ROW LEVEL SECURITY;