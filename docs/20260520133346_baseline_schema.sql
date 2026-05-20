-- Baseline schema for a new Supabase project.
-- Copy this file to supabase/migrations/ in the new project and apply it there.
-- Do not apply this baseline to the existing admin_destiny project, because the
-- existing project already has the incremental migrations that created these objects.

create schema if not exists extensions;

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault;

alter database postgres
set timezone to 'America/Sao_Paulo';

create type public.order_status as enum (
  'pending_payment',
  'paid',
  'payment_failed',
  'canceled',
  'expired'
);

create type public.turma_status as enum (
  'draft',
  'active',
  'inactive',
  'archived'
);

create type public.admin_role as enum (
  'admin',
  'operator'
);

create type public.coupon_discount_type as enum (
  'percent',
  'fixed_amount'
);

create type public.outbound_webhook_event_type as enum (
  'lead.abandoned',
  'purchase.approved'
);

create type public.outbound_webhook_delivery_status as enum (
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead'
);

create type public.pipedrive_sync_job_type as enum (
  'lead.created',
  'order.created',
  'order.paid',
  'order.payment_failed'
);

create type public.pipedrive_sync_job_status as enum (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'dead'
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text not null,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  ref text,
  seller_id text,
  seller_slug text,
  seller_name text,
  pipedrive_person_id bigint,
  pipedrive_lead_id uuid,
  pipedrive_synced_at timestamptz,
  pipedrive_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_email_idx on public.leads (lower(email));
create index leads_phone_idx on public.leads (phone);

create trigger leads_set_updated_at
before update on public.leads
for each row execute function public.set_updated_at();

create table public.admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique,
  email text not null unique,
  name text not null,
  role public.admin_role not null default 'operator',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger admin_users_set_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

create table public.turmas (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  starts_at timestamptz,
  ends_at timestamptz,
  location text,
  status public.turma_status not null default 'draft',
  external_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint turmas_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint turmas_date_order_check check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create trigger turmas_set_updated_at
before update on public.turmas
for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  turma_id uuid not null references public.turmas(id) on delete restrict,
  name text not null,
  slug text not null,
  description text,
  unit_amount_cents integer not null,
  currency text not null default 'brl',
  max_quantity integer not null default 5,
  active boolean not null default false,
  is_default boolean not null default false,
  installment_options integer[] not null default array[1],
  payment_methods text[] not null default array['card'],
  installment_rates jsonb not null default '{}'::jsonb,
  installment_amounts jsonb not null default '{}'::jsonb,
  offer_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_unique_per_turma unique (turma_id, slug),
  constraint products_amount_check check (unit_amount_cents > 0),
  constraint products_currency_check check (currency in ('brl', 'usd')),
  constraint products_max_quantity_check check (max_quantity between 1 and 10),
  constraint products_installments_check check (
    installment_options <@ array[1,2,3,6,12]
    and cardinality(installment_options) >= 1
  )
);

create unique index products_one_default_per_turma_idx
  on public.products (turma_id)
  where is_default = true and active = true;

comment on column public.products.payment_methods is
  'Payment methods enabled for this product. Values: card, pix, klarna, afterpay_clearpay. Defaults to card-only.';

comment on column public.products.installment_rates is
  'Monthly interest rate percentage by installment count for pagar.me BRL checkout using Price formula. Example: {"6": 2.5}.';

comment on column public.products.installment_amounts is
  'Deprecated legacy fixed per-installment BRL amount configuration. Kept for compatibility.';

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  discount_type public.coupon_discount_type not null,
  discount_value integer not null,
  currency text not null default 'brl',
  active boolean not null default false,
  starts_at timestamptz,
  ends_at timestamptz,
  max_redemptions integer,
  redeemed_count integer not null default 0,
  minimum_subtotal_cents integer,
  max_discount_cents integer,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_format_check check (
    code = upper(code) and code ~ '^[A-Z0-9][A-Z0-9_-]{1,48}$'
  ),
  constraint coupons_discount_value_check check (discount_value > 0),
  constraint coupons_percent_value_check check (
    discount_type <> 'percent' or discount_value between 1 and 100
  ),
  constraint coupons_currency_check check (currency = 'brl'),
  constraint coupons_redemption_limit_check check (
    max_redemptions is null or max_redemptions > 0
  ),
  constraint coupons_redeemed_count_check check (redeemed_count >= 0),
  constraint coupons_redeemed_limit_check check (
    max_redemptions is null or redeemed_count <= max_redemptions
  ),
  constraint coupons_minimum_subtotal_check check (
    minimum_subtotal_cents is null or minimum_subtotal_cents > 0
  ),
  constraint coupons_max_discount_check check (
    max_discount_cents is null or max_discount_cents > 0
  ),
  constraint coupons_date_order_check check (
    ends_at is null or starts_at is null or ends_at >= starts_at
  )
);

create trigger coupons_set_updated_at
before update on public.coupons
for each row execute function public.set_updated_at();

create table public.coupon_turmas (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  primary key (coupon_id, turma_id)
);

create table public.coupon_products (
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (coupon_id, product_id)
);

create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  seller_id text unique,
  slug text not null unique,
  name text not null,
  email text,
  phone text,
  active boolean not null default true,
  external_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sellers_slug_format_check check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
  )
);

create trigger sellers_set_updated_at
before update on public.sellers
for each row execute function public.set_updated_at();

create table public.seller_turmas (
  seller_id uuid not null references public.sellers(id) on delete cascade,
  turma_id uuid not null references public.turmas(id) on delete cascade,
  primary key (seller_id, turma_id)
);

create table public.seller_products (
  seller_id uuid not null references public.sellers(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  primary key (seller_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id),
  status public.order_status not null default 'pending_payment',
  payment_method text not null default 'card',
  quantity integer not null,
  installment_count integer not null,
  unit_amount_cents integer not null,
  total_amount_cents integer not null,
  currency text not null default 'brl',
  coupon_code text,
  cpf_cnpj text,
  stripe_payment_intent_id text unique,
  stripe_customer_id text,
  turma_id uuid references public.turmas(id),
  product_id uuid references public.products(id),
  coupon_id uuid references public.coupons(id),
  seller_record_id uuid references public.sellers(id),
  turma_name text,
  turma_slug text,
  product_name text,
  product_slug text,
  product_description text,
  coupon_code_snapshot text,
  coupon_name text,
  seller_id_snapshot text,
  seller_slug_snapshot text,
  seller_name_snapshot text,
  discount_amount_cents integer not null default 0,
  subtotal_amount_cents integer,
  pipedrive_deal_id bigint,
  pipedrive_lead_id uuid,
  pipedrive_synced_at timestamptz,
  pipedrive_sync_error text,
  stripe_decline_code text,
  stripe_failure_code text,
  base_currency text,
  base_total_amount_cents integer,
  exchange_rate numeric(10,4),
  pagarme_order_id text,
  pagarme_charge_id text,
  pagarme_decline_code text,
  pagarme_failure_message text,
  pix_expires_at timestamptz,
  pix_qr_code text,
  installment_rate_pct numeric(5,2),
  installment_amount_cents integer,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_quantity_check check (quantity between 1 and 10),
  constraint orders_installment_count_check check (installment_count in (1, 2, 3, 6, 12)),
  constraint orders_amounts_check check (unit_amount_cents > 0 and total_amount_cents > 0),
  constraint orders_currency_check check (currency in ('brl', 'usd')),
  constraint orders_payment_method_check check (
    payment_method in ('card', 'pix', 'klarna', 'afterpay_clearpay')
  )
);

create index orders_lead_id_idx on public.orders (lead_id);
create index orders_status_idx on public.orders (status);
create index orders_turma_id_idx on public.orders (turma_id);
create index orders_product_id_idx on public.orders (product_id);
create index orders_coupon_id_idx on public.orders (coupon_id);
create index orders_seller_record_id_idx on public.orders (seller_record_id);

comment on column public.orders.installment_rate_pct is
  'Monthly interest rate percentage applied at purchase time for pagar.me BRL credit card installments using Price formula.';

comment on column public.orders.installment_amount_cents is
  'Per-installment amount charged/displayed at purchase time, derived from total and interest rate.';

create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table public.stripe_events (
  id text primary key,
  type text not null,
  payment_intent_id text,
  order_id uuid references public.orders(id),
  payload jsonb not null,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index stripe_events_payment_intent_id_idx on public.stripe_events (payment_intent_id);
create index stripe_events_order_id_idx on public.stripe_events (order_id);

create table public.stripe_refunds (
  id text primary key,
  order_id uuid references public.orders(id),
  payment_intent_id text,
  charge_id text,
  status text,
  amount_cents integer,
  currency text,
  reason text,
  failure_reason text,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_refunds_order_id_idx on public.stripe_refunds (order_id);
create index stripe_refunds_payment_intent_id_idx on public.stripe_refunds (payment_intent_id);
create index stripe_refunds_charge_id_idx on public.stripe_refunds (charge_id);

create trigger stripe_refunds_set_updated_at
before update on public.stripe_refunds
for each row execute function public.set_updated_at();

create table public.stripe_disputes (
  id text primary key,
  order_id uuid references public.orders(id),
  payment_intent_id text,
  charge_id text,
  status text,
  reason text,
  amount_cents integer,
  currency text,
  evidence_due_by timestamptz,
  last_event_type text,
  funds_withdrawn_at timestamptz,
  funds_reinstated_at timestamptz,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_disputes_order_id_idx on public.stripe_disputes (order_id);
create index stripe_disputes_payment_intent_id_idx on public.stripe_disputes (payment_intent_id);
create index stripe_disputes_charge_id_idx on public.stripe_disputes (charge_id);
create index stripe_disputes_status_idx on public.stripe_disputes (status);

create trigger stripe_disputes_set_updated_at
before update on public.stripe_disputes
for each row execute function public.set_updated_at();

create table public.stripe_operational_alerts (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  status text not null default 'pending',
  order_id uuid references public.orders(id),
  stripe_event_id text references public.stripe_events(id),
  stripe_dispute_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_operational_alerts_status_check
    check (status in ('pending', 'acknowledged', 'resolved')),
  constraint stripe_operational_alerts_unique_event unique (type, stripe_event_id)
);

create index stripe_operational_alerts_status_idx
  on public.stripe_operational_alerts (status, created_at);
create index stripe_operational_alerts_order_id_idx
  on public.stripe_operational_alerts (order_id);

create trigger stripe_operational_alerts_set_updated_at
before update on public.stripe_operational_alerts
for each row execute function public.set_updated_at();

create table public.pagarme_events (
  id text primary key,
  type text not null,
  order_id uuid references public.orders(id),
  pagarme_order_id text,
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index pagarme_events_order_id_idx
  on public.pagarme_events (order_id);

create index pagarme_events_pagarme_order_id_idx
  on public.pagarme_events (pagarme_order_id);

create table public.pipedrive_sync_jobs (
  id uuid primary key default gen_random_uuid(),
  type public.pipedrive_sync_job_type not null,
  status public.pipedrive_sync_job_status not null default 'pending',
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  succeeded_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pipedrive_sync_jobs_attempt_count_check check (attempt_count >= 0),
  constraint pipedrive_sync_jobs_unique_event unique (type, aggregate_type, aggregate_id)
);

create index pipedrive_sync_jobs_due_idx
  on public.pipedrive_sync_jobs (status, next_attempt_at);

create trigger pipedrive_sync_jobs_set_updated_at
before update on public.pipedrive_sync_jobs
for each row execute function public.set_updated_at();

create table public.outbound_webhook_endpoints (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  url text not null,
  active boolean not null default true,
  subscribed_events public.outbound_webhook_event_type[] not null,
  secret_encrypted text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_webhook_events_check check (
    cardinality(subscribed_events) >= 1
  )
);

create trigger outbound_webhook_endpoints_set_updated_at
before update on public.outbound_webhook_endpoints
for each row execute function public.set_updated_at();

create table public.outbound_events (
  id uuid primary key default gen_random_uuid(),
  type public.outbound_webhook_event_type not null,
  aggregate_type text not null,
  aggregate_id uuid not null,
  payload jsonb not null,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint outbound_events_unique_aggregate unique (type, aggregate_type, aggregate_id)
);

create table public.outbound_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.outbound_events(id) on delete cascade,
  endpoint_id uuid not null references public.outbound_webhook_endpoints(id) on delete cascade,
  status public.outbound_webhook_delivery_status not null default 'pending',
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  last_status_code integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint outbound_deliveries_unique unique (event_id, endpoint_id),
  constraint outbound_deliveries_attempt_count_check check (attempt_count >= 0)
);

create trigger outbound_webhook_deliveries_set_updated_at
before update on public.outbound_webhook_deliveries
for each row execute function public.set_updated_at();

alter table public.leads enable row level security;
alter table public.admin_users enable row level security;
alter table public.turmas enable row level security;
alter table public.products enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_turmas enable row level security;
alter table public.coupon_products enable row level security;
alter table public.sellers enable row level security;
alter table public.seller_turmas enable row level security;
alter table public.seller_products enable row level security;
alter table public.orders enable row level security;
alter table public.stripe_events enable row level security;
alter table public.stripe_refunds enable row level security;
alter table public.stripe_disputes enable row level security;
alter table public.stripe_operational_alerts enable row level security;
alter table public.pagarme_events enable row level security;
alter table public.pipedrive_sync_jobs enable row level security;
alter table public.outbound_webhook_endpoints enable row level security;
alter table public.outbound_events enable row level security;
alter table public.outbound_webhook_deliveries enable row level security;

revoke all on table public.leads from anon, authenticated;
revoke all on table public.admin_users from anon, authenticated;
revoke all on table public.turmas from anon, authenticated;
revoke all on table public.products from anon, authenticated;
revoke all on table public.coupons from anon, authenticated;
revoke all on table public.coupon_turmas from anon, authenticated;
revoke all on table public.coupon_products from anon, authenticated;
revoke all on table public.sellers from anon, authenticated;
revoke all on table public.seller_turmas from anon, authenticated;
revoke all on table public.seller_products from anon, authenticated;
revoke all on table public.orders from anon, authenticated;
revoke all on table public.stripe_events from anon, authenticated;
revoke all on table public.stripe_refunds from anon, authenticated;
revoke all on table public.stripe_disputes from anon, authenticated;
revoke all on table public.stripe_operational_alerts from anon, authenticated;
revoke all on table public.pagarme_events from anon, authenticated;
revoke all on table public.pipedrive_sync_jobs from anon, authenticated;
revoke all on table public.outbound_webhook_endpoints from anon, authenticated;
revoke all on table public.outbound_events from anon, authenticated;
revoke all on table public.outbound_webhook_deliveries from anon, authenticated;

grant usage on schema public to service_role;
grant usage on type public.order_status to service_role;
grant usage on type public.turma_status to service_role;
grant usage on type public.admin_role to service_role;
grant usage on type public.coupon_discount_type to service_role;
grant usage on type public.outbound_webhook_event_type to service_role;
grant usage on type public.outbound_webhook_delivery_status to service_role;
grant usage on type public.pipedrive_sync_job_type to service_role;
grant usage on type public.pipedrive_sync_job_status to service_role;

grant select, insert, update, delete on table public.leads to service_role;
grant select, insert, update, delete on table public.admin_users to service_role;
grant select, insert, update, delete on table public.turmas to service_role;
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.coupons to service_role;
grant select, insert, update, delete on table public.coupon_turmas to service_role;
grant select, insert, update, delete on table public.coupon_products to service_role;
grant select, insert, update, delete on table public.sellers to service_role;
grant select, insert, update, delete on table public.seller_turmas to service_role;
grant select, insert, update, delete on table public.seller_products to service_role;
grant select, insert, update, delete on table public.orders to service_role;
grant select, insert, update, delete on table public.stripe_events to service_role;
grant select, insert, update, delete on table public.stripe_refunds to service_role;
grant select, insert, update, delete on table public.stripe_disputes to service_role;
grant select, insert, update, delete on table public.stripe_operational_alerts to service_role;
grant select, insert, update, delete on table public.pagarme_events to service_role;
grant select, insert, update, delete on table public.pipedrive_sync_jobs to service_role;
grant select, insert, update, delete on table public.outbound_webhook_endpoints to service_role;
grant select, insert, update, delete on table public.outbound_events to service_role;
grant select, insert, update, delete on table public.outbound_webhook_deliveries to service_role;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'destiny-lead-abandonment') then
    perform cron.unschedule('destiny-lead-abandonment');
  end if;

  if exists (select 1 from cron.job where jobname = 'destiny-outbound-webhooks') then
    perform cron.unschedule('destiny-outbound-webhooks');
  end if;

  if exists (select 1 from cron.job where jobname = 'destiny-pipedrive-sync') then
    perform cron.unschedule('destiny-pipedrive-sync');
  end if;
end $$;

select cron.schedule(
  'destiny-lead-abandonment',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_app_base_url') || '/api/jobs/lead-abandonment',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_admin_job_secret')
    ),
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);

select cron.schedule(
  'destiny-outbound-webhooks',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_app_base_url') || '/api/jobs/outbound-webhooks',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_admin_job_secret')
    ),
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);

select cron.schedule(
  'destiny-pipedrive-sync',
  '* * * * *',
  $$
  select net.http_get(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_app_base_url') || '/api/jobs/pipedrive-sync',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'destiny_admin_job_secret')
    ),
    timeout_milliseconds := 10000
  ) as request_id;
  $$
);
