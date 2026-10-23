ALTER FUNCTION public.has_role(uuid,public.app_role) SECURITY INVOKER;
ALTER FUNCTION public.account_active() SECURITY INVOKER;
CREATE POLICY admin_settings_server_only ON public.admin_settings FOR ALL TO authenticated USING(false) WITH CHECK(false);
CREATE POLICY audit_log_server_only ON public.audit_log FOR ALL TO authenticated USING(false) WITH CHECK(false);