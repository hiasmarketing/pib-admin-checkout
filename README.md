This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Pipedrive CRM Sync

The Pipedrive integration runs server-side through an internal job queue. Configure these environment variables only on the server:

```bash
PIPEDRIVE_COMPANY_DOMAIN=
PIPEDRIVE_API_TOKEN=
PIPEDRIVE_OWNER_ID=
PIPEDRIVE_PIPELINE_ID=
PIPEDRIVE_PENDING_STAGE_ID=
PIPEDRIVE_PAID_STAGE_ID=
PIPEDRIVE_FAILED_STAGE_ID=
PIPEDRIVE_LEAD_LABEL_IDS=
PIPEDRIVE_PAYMENT_METHOD_OPTION_MAP={}
PIPEDRIVE_CUSTOM_FIELDS_JSON={}
```

`PIPEDRIVE_LEAD_LABEL_IDS` is an optional comma-separated list of Pipedrive lead label IDs. Use it for lead-only labels such as `ABANDONO` and `BOSTON`. Deals are not labeled by this integration.

`PIPEDRIVE_PAYMENT_METHOD_OPTION_MAP` maps local checkout values to Pipedrive option IDs for the "Forma de pagamento" field, for example `{"card":17,"pix":15}`.

`PIPEDRIVE_CUSTOM_FIELDS_JSON` maps local keys to Pipedrive custom field keys. Supported local keys include `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `ref`, `seller_id`, `seller_slug`, `seller_name`, `turma_id`, `turma_name`, `product_id`, `product_name`, `quantity`, `payment_method`, `installment_count`, `coupon_code`, `total_amount_cents`, `currency`, `status`, `lead_id`, and `order_id`. Map `product_name` to the Pipedrive field "Nome do produto". The full payload contract is documented in `.specs/features/pipedrive-crm-sync/payload-contract.md`.

Run the worker by calling `GET /api/jobs/pipedrive-sync` with:

```http
Authorization: Bearer ${ADMIN_JOB_SECRET}
```

The endpoint returns `{ "processed": number, "failed": number, "dead": number }`. Production schedulers must send the bearer header; unauthenticated requests return `401`.

## Operational Jobs

Production recurring jobs are scheduled with Supabase Cron (`pg_cron`) and HTTP calls through `pg_net`. Store these secrets in Supabase Vault before applying the schedule migration:

```sql
select vault.create_secret('https://your-production-domain.com', 'destiny_app_base_url');
select vault.create_secret('same-value-as-ADMIN_JOB_SECRET', 'destiny_admin_job_secret');
```

The schedule migration calls these protected endpoints every minute:

- `/api/jobs/lead-abandonment`
- `/api/jobs/outbound-webhooks`
- `/api/jobs/pipedrive-sync`

Inspect runs in Supabase with:

```sql
select jobname, schedule, command from cron.job order by jobname;
select * from cron.job_run_details order by start_time desc limit 20;
select * from net._http_response order by created desc limit 20;
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
