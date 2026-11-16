# Publicação, recuperação e manutenção

## Ponto de recuperação do código
- Tag `backup/munin-pre-dcs-2026-11-16` aponta para o último commit do Munin antes do Dinamize CS (`3455efe`).
- O trabalho fica na branch `dinamize-cs/fase-0`; `main` só recebe merge após homologação (o Lovable publica a partir de `main`).

## Banco
1. Antes de aplicar: backup do Supabase (painel → Database → Backups, ou `pg_dump` das tabelas `cs_*`, `profiles`, `user_roles`, `account_access`).
2. Aplicar as migrations `20261116230000_*` e `20261116231000_*` (são aditivas; não alteram objetos existentes).
3. Rollback: `supabase/rollback/20261116230000_dcs_fundacao.down.sql` (remove somente `dcs_*`; exportar antes se houver dados).

## n8n
Importar os JSON de `n8n/workflows`, criar as credenciais (N8N_WORKFLOWS.md), ativar na ordem 04 → 01 → 05 → 08 → 02/03 → 07/07b → 06.
O 06 só grava no Pipedrive depois que um admin ligar `dcs_config.pipedrive_escrita` e liberar jobs.

## Produção
Publicação definitiva somente após homologação aprovada pelo responsável (Fase 7).
