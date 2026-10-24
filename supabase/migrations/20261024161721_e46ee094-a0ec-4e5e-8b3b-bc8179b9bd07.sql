-- Server-only role used by the central sync: bounded 60s limit (API roles keep their own 3s/8s limits).
ALTER ROLE service_role SET statement_timeout = '60s';
NOTIFY pgrst, 'reload config';