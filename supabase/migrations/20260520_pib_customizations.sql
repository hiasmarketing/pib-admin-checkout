-- Migration registrada localmente. Aplicada no Supabase PIB (sdyncwziefmismsfpngm) via
-- mcp__supabase__apply_migration com nome `pib_0009_pib_customizations`.

-- 1. WhatsApp group url por turma
alter table public.turmas add column whatsapp_group_url text;
comment on column public.turmas.whatsapp_group_url is
  'URL pública do grupo WhatsApp da turma. Exibida em /obrigado após compra aprovada.';

-- 2. Apertar payment_method (card + pix apenas)
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('card', 'pix'));

-- 3. Apertar currency (BRL apenas)
alter table public.orders drop constraint orders_currency_check;
alter table public.orders add constraint orders_currency_check
  check (currency = 'brl');

alter table public.products drop constraint products_currency_check;
alter table public.products add constraint products_currency_check
  check (currency = 'brl');

-- 4. Drop colunas FX (orders)
alter table public.orders
  drop column base_currency,
  drop column base_total_amount_cents,
  drop column exchange_rate;

-- 5. Drop colunas e tabelas Pipedrive
alter table public.leads
  drop column pipedrive_person_id,
  drop column pipedrive_lead_id,
  drop column pipedrive_synced_at,
  drop column pipedrive_sync_error;

alter table public.orders
  drop column pipedrive_deal_id,
  drop column pipedrive_lead_id,
  drop column pipedrive_synced_at,
  drop column pipedrive_sync_error;

drop table public.pipedrive_sync_jobs;
drop type public.pipedrive_sync_job_status;
drop type public.pipedrive_sync_job_type;

-- 6. Drop colunas e tabelas Stripe
alter table public.orders
  drop column stripe_payment_intent_id,
  drop column stripe_customer_id,
  drop column stripe_decline_code,
  drop column stripe_failure_code;

drop table public.stripe_operational_alerts;
drop table public.stripe_disputes;
drop table public.stripe_refunds;
drop table public.stripe_events;
