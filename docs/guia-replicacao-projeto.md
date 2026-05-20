# Guia de replicacao do projeto

Este documento explica como recriar, adaptar e operar um checkout completo no
modelo do projeto `admin_destiny`.

Use este guia para entregar o projeto a um novo cliente ou para criar uma nova
instancia do zero, com outra marca, outro dominio, outro catalogo e novas
credenciais. Nao copie credenciais, IDs de producao ou dados pessoais entre
clientes.

Ultima revisao baseada no codigo local: 20 de maio de 2026.

## 1. Visao geral do produto

O sistema e um checkout transparente para venda de ingressos de eventos
presenciais ou digitais. A pessoa chega de uma landing page externa, informa
contato, escolhe turma/produto, paga no checkout e acompanha o status do pedido
na pagina de obrigado.

O projeto tambem inclui um admin interno para configurar catalogo, vendedores,
cupons, webhooks, usuarios administrativos e acompanhar leads/vendas.

Fluxo publico principal:

```text
Landing page externa
  -> /formulario
  -> /checkout
  -> /checkout/cartao ou /checkout/pagarme
  -> /obrigado?orderId=<uuid>
```

Fluxo administrativo:

```text
/admin/login
  -> /admin
  -> turmas, produtos, cupons, vendedores, leads, vendas,
     usuarios, webhooks e UTM Builder
```

## 2. Funcionalidades atuais

### Checkout publico

- Captura de contato em `/formulario`: nome, email e celular.
- Captura de UTMs: `utm_source`, `utm_medium`, `utm_campaign`,
  `utm_content`, `utm_term` e `ref`.
- Captura de vendedor por URL: `seller_id`, `seller_slug` e `seller_name`.
- Persistencia temporaria de tracking em `sessionStorage`.
- Criacao de lead em Supabase via `POST /api/leads`.
- Catalogo publico vindo do Supabase: turmas, produtos, precos, moedas,
  parcelas, metodos de pagamento e limites de quantidade.
- Selecao de turma/produto quando existem varias opcoes ativas.
- Resolucao por URL:
  - `turmaId`
  - `turma`
  - `productId`
  - `produto`
- Cupom calculado no backend.
- Quantidade limitada pelo produto.
- Preco sempre calculado no backend.
- Bloqueio de campos de preco enviados pelo cliente.
- Pagina de obrigado com polling de status do pedido.
- Suporte PT/EN com `next-intl`.

### Pagamentos

- Stripe PaymentIntents para fluxo em USD.
- Stripe card para pagamento unico.
- Stripe Klarna como metodo BNPL, controlado por produto.
- Stripe Afterpay/Clearpay como metodo BNPL, com elegibilidade por pais,
  moeda e valor.
- Stripe Pix legado via `POST /api/checkout/pix`.
- Pagar.me para pagamento em BRL.
- Pagar.me cartao com tokenizacao client-side.
- Pagar.me Pix com QR code, copia e cola e expiracao.
- Conversao USD para BRL usando AwesomeAPI com cache e fallback por env var.
- Juros de parcelamento configuraveis por produto.
- Webhook Stripe como fonte de verdade para Stripe.
- Webhook Pagar.me como fonte de verdade para Pagar.me.
- Persistencia idempotente de eventos Stripe e Pagar.me.
- Registro de falhas de pagamento para exibir mensagens amigaveis.
- Registro operacional de refunds e disputes Stripe.

### Admin

- Login administrativo via Supabase Auth.
- Autorizacao por tabela `admin_users`.
- Roles: `admin` e `operator`.
- Criacao de usuarios administrativos por admins.
- Senha inicial aleatoria exibida uma unica vez.
- Reset administrativo de senha.
- Recuperacao de senha por email.
- Perfil e logout no shell admin.
- Dashboard com metricas:
  - leads
  - vendas pagas
  - receita
  - conversao
  - graficos por periodo
- Listagem e detalhe de leads.
- Listagem e detalhe de vendas.
- Filtros por busca, vendedor, data e status.
- UTM Builder com sugestoes vindas da base de leads.
- CRUD de turmas.
- CRUD de produtos por turma.
- CRUD de cupons.
- CRUD de vendedores.
- Links de vendedor copiaveis com `seller_slug`.
- CRUD de endpoints de webhooks outbound.
- Listagem de entregas outbound e retry manual.
- Tema dark/light no admin.
- Layout responsivo para mobile.

### Integracoes

- Supabase PostgreSQL como banco principal.
- Supabase Auth para usuarios admin.
- Supabase Cron e `pg_net` para jobs recorrentes.
- Stripe para pagamentos USD, Klarna, Afterpay/Clearpay, Pix legado,
  webhooks, refunds e disputes.
- Pagar.me para checkout BRL com cartao e Pix.
- Pipedrive para sincronizar pessoas, leads e deals.
- Webhooks outbound genericos para sistemas terceiros.
- AwesomeAPI para cotacao USD/BRL.
- Vercel como plataforma recomendada de deploy.

## 3. Stack tecnica

| Camada | Tecnologia |
| --- | --- |
| Framework | Next.js 16.2.4 com App Router |
| UI | React 19.2.4 |
| Linguagem | TypeScript |
| Estilo | Tailwind CSS v4 |
| Internacionalizacao | `next-intl` |
| Formularios e mascaras | `react-imask` |
| Pagamentos | Stripe SDK, Stripe.js e Pagar.me Core API |
| Banco | Supabase PostgreSQL |
| Auth admin | Supabase Auth |
| Graficos | Recharts |
| Toasts admin | Sonner |
| Testes browser | Playwright |
| Package manager | pnpm |

Scripts principais:

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
```

## 4. Estrutura do repositorio

Principais pastas:

```text
src/
  app/
    [locale]/
      formulario/
      checkout/
      obrigado/
    admin/
    api/
  components/
    admin/
    brand/
    checkout/
  i18n/
  lib/
    admin/
    catalog/
    checkout/
    fx/
    payments/
    pipedrive/
    supabase/
    webhooks/
messages/
public/
supabase/
  migrations/
tests/
.specs/
  features/
docs/
```

Arquivos de referencia:

- `package.json`: dependencias e scripts.
- `.env.example`: variaveis de ambiente esperadas.
- `middleware.ts`: middleware de i18n para rotas publicas.
- `next.config.ts`: plugin `next-intl`.
- `src/i18n/routing.ts`: locales e politica de prefixo.
- `src/lib/env.ts`: leitura server-side de env vars obrigatorias.
- `src/lib/tracking.ts`: UTMs, seller e selecao de catalogo.
- `src/lib/catalog/resolve.ts`: catalogo publico, cupom e precificacao.
- `src/lib/payments/security.ts`: bloqueio de preco vindo do cliente.
- `src/app/api/*`: APIs internas e webhooks.
- `supabase/migrations/*`: schema completo do banco.

## 5. Como recriar o projeto do zero

### 5.1. Criar o app base

Use Node.js 20.9 ou superior.

```bash
pnpm create next-app@latest nome-do-projeto --yes
cd nome-do-projeto
```

O projeto precisa usar:

- TypeScript.
- App Router.
- Tailwind CSS.
- Pasta `src/`.
- Alias `@/*`.

Instale as dependencias:

```bash
pnpm add next-intl react-imask @supabase/supabase-js @supabase/ssr
pnpm add stripe @stripe/stripe-js recharts sonner framer-motion embla-carousel-react
pnpm add -D @playwright/test @tailwindcss/postcss tailwindcss eslint eslint-config-next typescript
```

Alinhe as versoes com o projeto original quando quiser reproduzir o mesmo
comportamento:

```json
{
  "next": "16.2.4",
  "react": "19.2.4",
  "react-dom": "19.2.4"
}
```

Antes de alterar codigo Next.js, leia a documentacao local instalada em
`node_modules/next/dist/docs/`. Neste projeto, os guias mais importantes sao:

- `01-app/01-getting-started/01-installation.md`
- `01-app/01-getting-started/02-project-structure.md`
- `01-app/01-getting-started/15-route-handlers.md`
- `01-app/02-guides/environment-variables.md`

### 5.2. Configurar Tailwind e estilos globais

O checkout publico usa:

- fundo preto;
- imagem de crowd em `public/images/checkout-crowd-bg.jpg`;
- logo em `public/images/logo-destiny.png`;
- CTA magenta `#f318ff`;
- magenta escuro `#c913dd`;
- inputs escuros com borda branca ou translucida;
- fontes Sora e Inter via `next/font/google`.

O admin usa CSS proprio em `src/app/admin/admin.css`, com variaveis para tema:

- `--admin-bg`
- `--admin-fg`
- `--admin-muted`
- `--admin-brand`
- `--admin-border`
- `--admin-surface`
- `--admin-surface-elevated`
- `--admin-input-bg`
- `--admin-danger`

Para outro cliente, troque:

- nome do produto;
- logo;
- fotos;
- cores de marca;
- dominios;
- textos em `messages/pt.json` e `messages/en.json`.

### 5.3. Configurar i18n

Crie:

```text
src/i18n/request.ts
src/i18n/routing.ts
messages/pt.json
messages/en.json
middleware.ts
```

Configuracao usada:

```ts
export const routing = defineRouting({
  locales: ["pt", "en"],
  defaultLocale: "pt",
  localePrefix: "as-needed",
  localeDetection: false,
});
```

Regras importantes:

- PT usa rota sem prefixo em producao:
  - `/formulario`
  - `/checkout`
  - `/obrigado`
- EN usa prefixo:
  - `/en/formulario`
  - `/en/checkout`
  - `/en/obrigado`
- Admin e APIs ficam fora do middleware de i18n.
- Nunca adicione redirects em `next.config.ts` para mapear `/formulario`
  para `/pt/formulario`.

Em desenvolvimento com Next.js 16 e Turbopack, use rotas PT com prefixo:

```text
http://localhost:3000/pt/formulario
http://localhost:3000/pt/checkout
http://localhost:3000/pt/obrigado
```

Em producao, a rota PT correta e sem prefixo.

### 5.4. Criar as paginas publicas

Rotas publicas:

| Rota | Arquivo | Responsabilidade |
| --- | --- | --- |
| `/formulario` | `src/app/[locale]/formulario/page.tsx` | Captura contato, UTMs e seller |
| `/checkout` | `src/app/[locale]/checkout/page.tsx` | Reexporta o checkout principal |
| `/checkout/cartao` | `src/app/[locale]/checkout/cartao/page.tsx` | Stripe USD e selecao USD/BRL |
| `/checkout/pagarme` | `src/app/[locale]/checkout/pagarme/page.tsx` | Pagar.me BRL |
| `/obrigado` | `src/app/[locale]/obrigado/page.tsx` | Status do pedido e comunidade |

Componentes compartilhados:

```text
src/components/checkout/CheckoutLayout.tsx
src/components/checkout/StepIndicator.tsx
src/components/checkout/InputField.tsx
src/components/checkout/MaskedInputField.tsx
src/components/checkout/PhoneInput.tsx
src/components/checkout/Button.tsx
src/components/checkout/PaymentMethodSelector.tsx
src/components/checkout/PaymentStatusIndicator.tsx
src/components/checkout/SellerAttributionBar.tsx
src/components/checkout/LanguageToggle.tsx
```

O frontend nunca envia preco confiavel. Ele envia somente selecoes:

- `leadId`
- `turmaId`
- `productId`
- `quantity`
- `installmentCount`
- `couponCode`
- `sellerId` ou `sellerSlug`
- dados exigidos pelo metodo de pagamento

O backend recalcula tudo.

## 6. Variaveis de ambiente

Crie `.env.local` em desenvolvimento e configure as mesmas variaveis na Vercel.
Nao commite arquivos `.env*` com valores reais.

### 6.1. Supabase

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...
SUPABASE_SECRET_KEY=eyJ...
```

Use a publishable key apenas no client. Use `SUPABASE_SECRET_KEY` somente no
servidor.

### 6.2. Stripe

```bash
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_ACCOUNT_COUNTRY=US
```

`STRIPE_ACCOUNT_COUNTRY` e usado para elegibilidade do Afterpay. Se ausente, o
codigo assume `US`.

### 6.3. Pagar.me

```bash
PAGARME_SECRET_KEY=sk_test_...
NEXT_PUBLIC_PAGARME_PUBLIC_KEY=pk_test_...
PAGARME_BASE_URL=https://sdx-api.pagar.me/core/v5
PAGARME_WEBHOOK_SECRET=...
```

Em producao:

```bash
PAGARME_BASE_URL=https://api.pagar.me/core/v5
```

### 6.4. Dominios publicos

```bash
NEXT_PUBLIC_CHECKOUT_URL=https://checkout.seudominio.com
NEXT_PUBLIC_ADMIN_URL=https://admin.seudominio.com
NEXT_PUBLIC_SITE_URL=https://checkout.seudominio.com
```

`src/lib/public-urls.ts` usa essas variaveis para montar links publicos e para
redirecionar a raiz conforme o host.

### 6.5. Jobs internos

```bash
ADMIN_JOB_SECRET=valor-longo-aleatorio
```

Todos os jobs recorrentes exigem:

```http
Authorization: Bearer ${ADMIN_JOB_SECRET}
```

### 6.6. Webhooks outbound

```bash
OUTBOUND_WEBHOOK_SECRET_ENCRYPTION_KEY=chave-hex-de-32-bytes
```

O codigo atual usa base64 como placeholder para armazenar segredo de endpoint.
Para uma operacao sensivel, troque por AES-GCM usando essa env var.

### 6.7. Pipedrive

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

`PIPEDRIVE_COMPANY_DOMAIN` deve ser apenas o subdominio, sem `.pipedrive.com`.

Exemplo:

```bash
PIPEDRIVE_COMPANY_DOMAIN=minhaempresa
```

`PIPEDRIVE_CUSTOM_FIELDS_JSON` mapeia campos internos para keys de campos
customizados do Pipedrive. Campos internos suportados incluem:

- `utm_source`
- `utm_medium`
- `utm_campaign`
- `utm_content`
- `utm_term`
- `ref`
- `seller_id`
- `seller_slug`
- `seller_name`
- `turma_id`
- `turma_name`
- `product_id`
- `product_name`
- `product_slug`
- `quantity`
- `payment_method`
- `installment_count`
- `coupon_code`
- `total_amount_cents`
- `currency`
- `status`
- `lead_id`
- `order_id`
- `cpf_cnpj`
- `paid_at`

### 6.8. Cambio USD para BRL

```bash
USD_BRL_FALLBACK_RATE=5.80
```

O sistema consulta:

```text
https://economia.awesomeapi.com.br/json/last/USD-BRL
```

Cache:

- dias uteis: 15 minutos;
- fim de semana: 4 horas.

Se a API falhar e `USD_BRL_FALLBACK_RATE` existir, o checkout usa o fallback.
Se falhar sem fallback, retorna erro 503.

## 7. Banco de dados Supabase

Use Supabase PostgreSQL com as migrations em `supabase/migrations`.

Ordem de aplicacao:

1. `20260430185354_checkout_core.sql`
2. `20260430203155_fix_set_updated_at_search_path.sql`
3. `20260430211832_allow_duplicate_lead_submissions.sql`
4. `20260430220000_admin_catalog.sql`
5. `20260430220001_orders_catalog_fields.sql`
6. `20260430230000_products_currency_usd.sql`
7. `20260501090000_pipedrive_sync.sql`
8. `20260501175638_schedule_operational_jobs.sql`
9. demais migrations de metodos, moedas, falhas, refunds, disputes,
   Pagar.me e parcelamento.

Com Supabase CLI:

```bash
supabase link --project-ref <project-ref>
supabase db push
```

### 7.1. Tabelas principais

| Tabela | Finalidade |
| --- | --- |
| `leads` | Contatos capturados no formulario |
| `orders` | Pedidos e snapshots comerciais |
| `stripe_events` | Eventos Stripe idempotentes |
| `stripe_refunds` | Refunds Stripe |
| `stripe_disputes` | Disputas Stripe |
| `stripe_operational_alerts` | Alertas operacionais Stripe |
| `pagarme_events` | Eventos Pagar.me idempotentes |
| `admin_users` | Operadores autorizados no admin |
| `turmas` | Eventos/turmas |
| `products` | Produtos/ingressos por turma |
| `coupons` | Cupons |
| `coupon_turmas` | Escopo de cupom por turma |
| `coupon_products` | Escopo de cupom por produto |
| `sellers` | Vendedores habilitados |
| `seller_turmas` | Escopo de vendedor por turma |
| `seller_products` | Escopo de vendedor por produto |
| `outbound_webhook_endpoints` | Destinos de webhooks |
| `outbound_events` | Eventos outbound idempotentes |
| `outbound_webhook_deliveries` | Entregas e tentativas |
| `pipedrive_sync_jobs` | Fila de sync Pipedrive |

### 7.2. Modelo de leads

Campos essenciais:

- `id`
- `name`
- `email`
- `phone`
- UTMs
- `ref`
- `seller_id`
- `seller_slug`
- `seller_name`
- campos Pipedrive:
  - `pipedrive_person_id`
  - `pipedrive_lead_id`
  - `pipedrive_synced_at`
  - `pipedrive_sync_error`
- `created_at`
- `updated_at`

Leads duplicados sao permitidos. Indices existem para email e telefone, mas nao
como constraint unica.

### 7.3. Modelo de orders

Campos essenciais:

- `lead_id`
- `status`
- `payment_method`
- `quantity`
- `installment_count`
- `unit_amount_cents`
- `subtotal_amount_cents`
- `discount_amount_cents`
- `total_amount_cents`
- `currency`
- `cpf_cnpj`
- `coupon_code`
- `turma_id`
- `product_id`
- `coupon_id`
- `seller_record_id`
- snapshots:
  - `turma_name`
  - `turma_slug`
  - `product_name`
  - `product_slug`
  - `product_description`
  - `coupon_code_snapshot`
  - `coupon_name`
  - `seller_id_snapshot`
  - `seller_slug_snapshot`
  - `seller_name_snapshot`
- Stripe:
  - `stripe_payment_intent_id`
  - `stripe_customer_id`
  - `stripe_decline_code`
  - `stripe_failure_code`
- Pagar.me:
  - `pagarme_order_id`
  - `pagarme_charge_id`
  - `pagarme_decline_code`
  - `pagarme_failure_message`
  - `pix_expires_at`
  - `pix_qr_code`
- cambio/parcelamento:
  - `base_currency`
  - `base_total_amount_cents`
  - `exchange_rate`
  - `installment_rate_pct`
  - `installment_amount_cents`
- Pipedrive:
  - `pipedrive_deal_id`
  - `pipedrive_lead_id`
  - `pipedrive_synced_at`
  - `pipedrive_sync_error`

Status usados:

- `pending_payment`
- `paid`
- `payment_failed`
- `canceled`
- `expired`

Metodos usados:

- `card`
- `pix`
- `klarna`
- `afterpay_clearpay`

### 7.4. Modelo de catalogo

`turmas`:

- `name`
- `slug`
- `starts_at`
- `ends_at`
- `location`
- `status`: `draft`, `active`, `inactive`, `archived`
- `external_metadata`

`products`:

- `turma_id`
- `name`
- `slug`
- `description`
- `unit_amount_cents`
- `currency`: `brl` ou `usd`
- `max_quantity`
- `active`
- `is_default`
- `installment_options`: `1`, `2`, `3`, `6`, `12`
- `payment_methods`: `card`, `pix`, `klarna`, `afterpay_clearpay`
- `installment_rates`: JSONB com taxa por parcela
- `offer_metadata`

Regra importante:

- Uma turma pode ter no maximo um produto default ativo.

### 7.5. Modelo de cupons

`coupons`:

- `code`
- `name`
- `description`
- `discount_type`: `percent` ou `fixed_amount`
- `discount_value`
- `currency`
- `active`
- `starts_at`
- `ends_at`
- `max_redemptions`
- `redeemed_count`
- `minimum_subtotal_cents`
- `max_discount_cents`
- `metadata`

Escopo:

- sem registros em `coupon_turmas` e `coupon_products`: global;
- com turmas: vale so para as turmas selecionadas;
- com produtos: vale so para os produtos selecionados.

### 7.6. Modelo de vendedores

`sellers`:

- `seller_id`: ID externo opcional;
- `slug`: identificador publico canonical;
- `name`;
- `email`;
- `phone`;
- `active`;
- `external_metadata`.

Escopo:

- vazio: vendedor global;
- `seller_turmas`: restringe a turmas;
- `seller_products`: restringe a produtos.

Link publico recomendado:

```text
/formulario?seller_slug=<slug-do-vendedor>
```

Compatibilidade legada:

```text
/formulario?seller_name=<valor-com-formato-de-slug>
```

## 8. Bootstrap do admin

Para entrar no admin pela primeira vez, crie um usuario no Supabase Auth e
adicione o registro correspondente em `admin_users`.

Passos:

1. Crie o usuario em Supabase Auth.
2. Copie o `auth_user_id`.
3. Rode um SQL como este no Supabase SQL Editor:

```sql
insert into public.admin_users (
  auth_user_id,
  email,
  name,
  role,
  active
) values (
  '<uuid-do-supabase-auth-user>',
  'admin@cliente.com',
  'Admin Cliente',
  'admin',
  true
);
```

Depois disso, o proprio admin consegue criar novos usuarios em
`/admin/users`.

## 9. Rotas publicas e comportamento

### 9.1. `/formulario`

Responsabilidades:

- ler query string;
- salvar UTMs e seller em `sessionStorage`;
- salvar selecao de catalogo em `sessionStorage`;
- validar nome, email e celular;
- criar lead em `POST /api/leads`;
- salvar `destiny_lead_id`;
- salvar contato em `destiny_contact` e `destiny_lead_contact`;
- redirecionar para `/checkout`.

Parametros aceitos:

```text
utm_source
utm_medium
utm_campaign
utm_content
utm_term
ref
seller_id
seller_slug
seller_name
turmaId
turma
productId
produto
```

### 9.2. `/checkout`

`src/app/[locale]/checkout/page.tsx` reexporta
`src/app/[locale]/checkout/cartao/page.tsx`.

Na rota `/checkout`, o componente funciona como ponto de decisao:

- se o produto esta em BRL, redireciona para `/checkout/pagarme`;
- se o produto esta em USD, mostra escolha entre pagar em dolar e pagar em
  real;
- ao escolher dolar, usa `/checkout/cartao`;
- ao escolher real, usa `/checkout/pagarme`.

### 9.3. `/checkout/cartao`

Fluxo Stripe:

- carrega catalogo por `GET /api/catalog/options`;
- recalcula cotacao por `POST /api/catalog/quote`;
- mostra turma, produto, preco, cupom, quantidade e parcelas;
- mostra seletor de metodo quando o produto tem mais de um metodo;
- esconde o seletor quando so existe um metodo;
- cria pedido e PaymentIntent em endpoints separados:
  - `POST /api/checkout/card`
  - `POST /api/checkout/pix`
  - `POST /api/checkout/klarna`
  - `POST /api/checkout/afterpay`
- confirma pagamento com Stripe Elements;
- redireciona para `/obrigado?orderId=<id>`.

Regra de UI importante:

- A secao de turma fica protegida por `catalogLoading`.
- Nao remova esse guard, pois ele evita flash de dados antigos antes da API de
  catalogo responder.

### 9.4. `/checkout/pagarme`

Fluxo BRL:

- carrega catalogo;
- calcula cotacao em BRL por `POST /api/catalog/quote`;
- permite `credit_card` e `pix` conforme `products.payment_methods`;
- tokeniza cartao no browser usando a public key do Pagar.me;
- envia somente `cardToken` ao backend;
- para Pix, cria order Pagar.me e exibe QR code;
- faz polling de `/api/orders/:id/status`;
- redireciona quando o pedido fica `paid`;
- exibe erro amigavel quando o pedido falha ou expira.

### 9.5. `/obrigado`

Responsabilidades:

- ler `orderId` da query string;
- buscar pedido publico em `GET /api/orders/:orderId`;
- fazer polling por ate 5 minutos enquanto `pending_payment`;
- exibir status:
  - processando;
  - pago;
  - falhou;
  - cancelado.

Quando pago, exibe CTA para comunidade do WhatsApp configurada no codigo.
Para outro cliente, troque essa URL.

## 10. APIs internas

### 10.1. Leads

`POST /api/leads`

Entrada:

```json
{
  "name": "Cliente",
  "email": "cliente@email.com",
  "phone": "+5511999999999",
  "tracking": {
    "utms": {
      "utm_source": "instagram",
      "utm_medium": "paid",
      "utm_campaign": "lancamento"
    },
    "seller": {
      "slug": "vendedor-1"
    }
  }
}
```

Saida:

```json
{
  "leadId": "<uuid>"
}
```

Efeitos:

- valida contato;
- normaliza email e telefone;
- resolve vendedor quando possivel;
- insere em `leads`;
- enfileira `lead.created` para Pipedrive com atraso de 15 minutos.

### 10.2. Catalogo

| Endpoint | Metodo | Uso |
| --- | --- | --- |
| `/api/catalog/options` | GET | Lista turmas/produtos ativos |
| `/api/catalog/resolve` | GET | Resolve turma/produto por id ou slug |
| `/api/catalog/seller` | GET | Resolve seller para barra de atendimento |
| `/api/catalog/quote` | POST | Calcula subtotal, desconto, total e parcelas |

`POST /api/catalog/quote` recebe selecao, quantidade, parcela e cupom. Retorna:

- turma;
- produto;
- preco base;
- moeda base;
- total;
- moeda cobrada;
- cotacao quando aplicavel;
- breakdown de parcelas;
- resultado do cupom.

### 10.3. Checkout

| Endpoint | Gateway | Metodo de pagamento |
| --- | --- | --- |
| `/api/checkout/card` | Stripe | `card` |
| `/api/checkout/pix` | Stripe | `pix` legado |
| `/api/checkout/klarna` | Stripe | `klarna` |
| `/api/checkout/afterpay` | Stripe | `afterpay_clearpay` |
| `/api/checkout/pagarme` | Pagar.me | `credit_card` e `pix` |

Todos os endpoints:

- rejeitam preco vindo do cliente;
- validam `leadId`;
- validam turma/produto ativos;
- validam metodo permitido por produto;
- validam quantidade;
- validam cupom;
- resolvem vendedor;
- criam `orders`;
- salvam snapshots;
- criam objeto no gateway;
- enfileiram Pipedrive.

### 10.4. Pedidos publicos

`GET /api/orders/:orderId`

Retorna dados publicos do pedido para `/obrigado`.

`GET /api/orders/:orderId/status?leadId=<uuid>`

Retorna status resumido para polling. No fluxo Pagar.me, tambem pode consultar
o provedor para reconciliar pedidos pendentes.

### 10.5. Webhooks

| Endpoint | Origem | Validacao |
| --- | --- | --- |
| `/api/webhooks/stripe` | Stripe | `stripe-signature` |
| `/api/webhooks/pagarme` | Pagar.me | HMAC em `x-hub-signature-256` ou `x-hub-signature` |

Stripe processa:

- `payment_intent.succeeded`;
- `payment_intent.payment_failed`;
- `refund.created`;
- `refund.updated`;
- `refund.failed`;
- `charge.dispute.created`;
- `charge.dispute.updated`;
- `charge.dispute.closed`;
- `charge.dispute.funds_withdrawn`;
- `charge.dispute.funds_reinstated`.

Pagar.me processa:

- `order.paid`;
- `charge.paid`;
- `order.payment_failed`;
- `charge.payment_failed`;
- `order.canceled`;
- `charge.canceled`.

Ambos persistem eventos antes de aplicar efeitos. Duplicatas retornam sucesso
sem reprocessar.

### 10.6. Jobs protegidos

| Endpoint | Funcao |
| --- | --- |
| `/api/jobs/lead-abandonment` | Gera `lead.abandoned` apos 15 minutos sem compra paga |
| `/api/jobs/outbound-webhooks` | Envia deliveries pendentes |
| `/api/jobs/pipedrive-sync` | Processa fila Pipedrive |

Todos exigem:

```http
Authorization: Bearer ${ADMIN_JOB_SECRET}
```

## 11. Pagamentos em detalhe

### 11.1. Stripe card

Use para pagamento em USD por cartao.

Caracteristicas:

- usa Stripe Elements;
- app nao coleta PAN/CVV diretamente;
- server cria PaymentIntent;
- metadata inclui `orderId`, `leadId`, `turmaId`, `productId`,
  `paymentMethod` e seller quando houver;
- webhook Stripe confirma `paid` ou `payment_failed`;
- status final nao depende do redirect do cliente.

### 11.2. Stripe Klarna

Use como BNPL controlado por produto.

Caracteristicas:

- produto precisa conter `klarna` em `payment_methods`;
- pedido salva `payment_method = 'klarna'`;
- exige `return_url`;
- Stripe pode exigir redirect;
- app nao promete numero fixo de parcelas;
- webhook Stripe confirma status final.

### 11.3. Stripe Afterpay/Clearpay

Use como BNPL para paises/moedas suportados.

Caracteristicas:

- produto precisa conter `afterpay_clearpay`;
- comprador precisa estar no mesmo pais da conta Stripe;
- moeda precisa bater com o pais;
- valor precisa respeitar limites do pais;
- para US/USD, limite atual implementado: 1 a 4.000 USD;
- exige endereco de cobranca US no fluxo atual;
- CPF/CNPJ nao e obrigatorio para Afterpay;
- webhook Stripe confirma status final.

### 11.4. Pagar.me cartao BRL

Use para comprador brasileiro pagando em real.

Caracteristicas:

- produto BRL vai direto para Pagar.me;
- produto USD pode ser convertido para BRL;
- conversao usa AwesomeAPI e fallback;
- cartao e tokenizado no frontend;
- backend recebe `cardToken`, nao dados crus do cartao;
- backend cria order Pagar.me;
- se aprovado sincronicamente, marca `paid`;
- se pendente, aguarda webhook ou polling;
- falhas recebem mensagem amigavel.

### 11.5. Pagar.me Pix

Use para Pix em BRL.

Caracteristicas:

- cria order Pagar.me com `payment_method: "pix"`;
- gera QR code e copia e cola;
- expiracao padrao: 60 minutos no fluxo Pagar.me;
- polling detecta pago, expirado ou falho;
- cliente pode gerar novo Pix apos expiracao.

### 11.6. Parcelamento e juros

O produto define:

- parcelas disponiveis;
- taxa mensal por parcela em `installment_rates`.

Formula implementada:

- se taxa ausente ou zero: divide sem juros;
- se taxa maior que zero: usa formula de parcela com juros compostos;
- valores sao arredondados para cima em centavos.

O checkout exibe:

- valor por parcela;
- total;
- indicacao de sem juros quando aplicavel.

## 12. Admin em detalhe

### 12.1. Auth e autorizacao

Arquivos:

- `src/lib/admin/auth.ts`
- `src/lib/supabase/ssr.ts`
- `src/lib/supabase/admin.ts`

Modelo:

- Supabase Auth cria sessao por cookie.
- `admin_users` autoriza acesso.
- `active = true` e obrigatorio.
- `requireOperator()` protege rotas admin.
- `requireAdmin()` protege gestao de usuarios.

### 12.2. Dashboard

Rota:

```text
/admin
```

Exibe:

- total de leads;
- vendas pagas;
- receita;
- conversao;
- receita por dia;
- vendas por dimensoes;
- leads por dimensoes;
- atalhos operacionais.

Periodos:

- hoje;
- ultimos 7 dias;
- ultimos 30 dias;
- todo periodo.

### 12.3. Leads

Rotas:

```text
/admin/leads
/admin/leads/:leadId
```

Funcionalidades:

- busca por nome/email;
- filtro por vendedor;
- filtro por data;
- paginacao de 50 itens;
- flag de conversao quando existe order `paid`;
- detalhe com contato e UTMs.

### 12.4. Vendas

Rotas:

```text
/admin/vendas
/admin/vendas/:orderId
```

Funcionalidades:

- busca por nome/email;
- filtro por vendedor;
- filtro por data;
- filtro por status;
- status visual;
- snapshots de produto, turma, cupom e vendedor;
- detalhes de falha Stripe/Pagar.me quando existirem.

### 12.5. Turmas

Rotas:

```text
/admin/turmas
/admin/turmas/new
/admin/turmas/:turmaId
```

Campos:

- nome;
- slug;
- inicio;
- fim;
- local;
- status;
- metadata externa.

Status recomendado:

- `draft`: em preparacao;
- `active`: visivel no checkout;
- `inactive`: pausada;
- `archived`: historica.

### 12.6. Produtos

Rotas:

```text
/admin/turmas/:turmaId/products/new
/admin/turmas/:turmaId/products/:productId
```

Campos:

- nome;
- slug;
- descricao;
- preco em centavos;
- moeda;
- quantidade maxima;
- ativo;
- default da turma;
- parcelas disponiveis;
- taxa mensal de juros;
- metodos de pagamento;
- metadata de oferta.

Metodos de pagamento por produto:

- `card`
- `pix`
- `klarna`
- `afterpay_clearpay`

O frontend sempre le `product.paymentMethods` da API. Nunca hardcode metodos
de pagamento no checkout.

### 12.7. Cupons

Rotas:

```text
/admin/coupons
/admin/coupons/new
/admin/coupons/:couponId
```

Campos:

- codigo;
- nome interno;
- descricao;
- tipo: percentual ou valor fixo;
- valor;
- validade;
- limite de usos;
- subtotal minimo;
- ativo;
- escopo por turma;
- escopo por produto.

O cupom e sempre validado no backend.

### 12.8. Vendedores

Rotas:

```text
/admin/sellers
/admin/sellers/new
/admin/sellers/:sellerId
```

Campos:

- nome;
- slug publico;
- ID externo/CRM opcional;
- email;
- telefone;
- ativo;
- escopo por turma;
- escopo por produto.

A pagina de detalhe exibe link copiavel para checkout:

```text
https://checkout.seudominio.com/formulario?seller_slug=<slug>
```

### 12.9. Usuarios admin

Rotas:

```text
/admin/users
/admin/users/new
/admin/users/:userId
```

Somente `admin` acessa.

Funcionalidades:

- listar usuarios;
- criar usuario;
- escolher role;
- gerar senha inicial;
- alterar role;
- resetar senha temporaria.

### 12.10. UTM Builder

Rota:

```text
/admin/utm-builder
```

Funcionalidades:

- monta URLs para `/formulario`;
- sugere UTMs mais usadas;
- usa `NEXT_PUBLIC_CHECKOUT_URL` ou fallback de dominio;
- ajuda o time de trafego a padronizar campanhas.

### 12.11. Webhooks outbound

Rotas:

```text
/admin/webhooks
/admin/webhooks/new
/admin/webhooks/:endpointId
/admin/webhooks/deliveries
```

Eventos suportados:

- `lead.abandoned`
- `purchase.approved`

Cada endpoint tem:

- nome;
- URL;
- status ativo/inativo;
- eventos inscritos;
- segredo opcional para assinatura HMAC.

Headers enviados:

```http
Content-Type: application/json
X-Destiny-Event: <event-type>
X-Destiny-Signature: sha256=<assinatura>
```

Payload:

```json
{
  "eventId": "<uuid>",
  "type": "purchase.approved",
  "occurredAt": "2026-05-20T12:00:00.000Z",
  "data": {}
}
```

Retry:

- falhas 400, 401, 403, 404 e 410 viram `dead`;
- outras falhas tentam novamente com backoff;
- maximo de 5 tentativas.

## 13. Pipedrive

O Pipedrive roda de forma assíncrona por fila local.

Eventos enfileirados:

- `lead.created`;
- `order.created`;
- `order.paid`;
- `order.payment_failed`.

Fluxo:

1. App cria lead ou order.
2. App insere job em `pipedrive_sync_jobs`.
3. Supabase Cron chama `/api/jobs/pipedrive-sync`.
4. Worker busca jobs `pending` ou `failed`.
5. Worker cria ou busca pessoa por email.
6. Worker cria lead Pipedrive ou deal Pipedrive.
7. Worker atualiza stage/status conforme pagamento.
8. Worker marca job como `succeeded`, `failed` ou `dead`.

Retry:

- ate 6 tentativas;
- `429` e `5xx` sao retryable;
- erros nao retryable viram `dead`.

Configuracoes importantes:

- labels sao aplicadas em leads, nao em deals;
- deals recebem produto e custom fields;
- `product_name` deve ser mapeado para o campo "Nome do produto" quando o
  cliente usar esse campo no Pipedrive.

## 14. Jobs recorrentes com Supabase Cron

Antes de aplicar a migration de schedule, salve os secrets no Supabase Vault:

```sql
select vault.create_secret(
  'https://checkout.seudominio.com',
  'destiny_app_base_url'
);

select vault.create_secret(
  'mesmo-valor-de-ADMIN_JOB_SECRET',
  'destiny_admin_job_secret'
);
```

A migration agenda chamadas a cada minuto:

- `/api/jobs/lead-abandonment`
- `/api/jobs/outbound-webhooks`
- `/api/jobs/pipedrive-sync`

Consultas uteis:

```sql
select jobname, schedule, command
from cron.job
order by jobname;

select *
from cron.job_run_details
order by start_time desc
limit 20;

select *
from net._http_response
order by created desc
limit 20;
```

## 15. Deploy recomendado

### 15.1. Vercel

1. Crie projeto na Vercel.
2. Conecte o repositorio.
3. Configure framework Next.js.
4. Configure todas as env vars.
5. Configure os dominios:
   - checkout;
   - admin.
6. Rode deploy.
7. Valide `pnpm build` no ambiente.

### 15.2. Supabase

1. Crie projeto Supabase.
2. Aplique migrations.
3. Configure Auth:
   - Site URL do admin;
   - Redirect URLs para recovery:
     - `https://admin.seudominio.com/admin/auth/callback`
     - `https://checkout.seudominio.com/admin/auth/callback` se usar dominio unico.
4. Crie primeiro admin.
5. Configure Vault para cron.
6. Verifique RLS e grants.

### 15.3. Stripe

1. Configure chaves test mode.
2. Crie webhook para:
   - `https://checkout.seudominio.com/api/webhooks/stripe`
3. Assine eventos:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `refund.created`
   - `refund.updated`
   - `refund.failed`
   - `charge.dispute.created`
   - `charge.dispute.updated`
   - `charge.dispute.closed`
   - `charge.dispute.funds_withdrawn`
   - `charge.dispute.funds_reinstated`
4. Salve `STRIPE_WEBHOOK_SECRET`.
5. Habilite Klarna e Afterpay/Clearpay no Dashboard se for usar.
6. Teste pagamentos antes de live mode.

### 15.4. Pagar.me

1. Crie conta Pagar.me.
2. Configure public key e secret key.
3. Configure webhook para:
   - `https://checkout.seudominio.com/api/webhooks/pagarme`
4. Salve segredo do webhook.
5. Teste cartao e Pix em sandbox.
6. Troque `PAGARME_BASE_URL` para producao somente no go-live.

### 15.5. Pipedrive

1. Crie pipeline e stages.
2. Crie campos customizados.
3. Crie labels de lead, se necessario.
4. Gere API token server-side.
5. Configure env vars `PIPEDRIVE_*`.
6. Rode `/api/jobs/pipedrive-sync` com bearer e valide retorno.
7. Confirme pessoas, leads e deals no Pipedrive.

## 16. Ordem recomendada de implementacao para um novo cliente

1. Criar app Next.js e design system base.
2. Configurar i18n PT/EN.
3. Criar layout de checkout e paginas publicas.
4. Criar Supabase e aplicar migrations.
5. Implementar `/api/leads`.
6. Implementar catalogo admin:
   - auth;
   - turmas;
   - produtos;
   - cupons;
   - vendedores.
7. Implementar catalogo publico:
   - options;
   - resolve;
   - quote.
8. Integrar checkout com catalogo.
9. Implementar Stripe card.
10. Implementar webhook Stripe.
11. Implementar Pagar.me BRL.
12. Implementar webhook Pagar.me.
13. Implementar Klarna e Afterpay se o cliente precisar.
14. Implementar dashboard, leads e vendas.
15. Implementar webhooks outbound.
16. Implementar Pipedrive.
17. Configurar jobs recorrentes.
18. Validar sandbox ponta a ponta.
19. Configurar live mode.
20. Rodar checklist de go-live.

## 17. Checklist de validacao

### Local

```bash
pnpm lint
pnpm build
```

Valide manualmente:

- `/pt/formulario` em dev;
- `/pt/checkout` em dev;
- `/pt/checkout/cartao`;
- `/pt/checkout/pagarme`;
- `/pt/obrigado?orderId=<id>`;
- `/admin/login`;
- `/admin`.

### Catalogo

- Criar turma ativa.
- Criar produto ativo default.
- Criar produto USD e produto BRL.
- Habilitar metodos de pagamento por produto.
- Criar cupom global.
- Criar cupom restrito.
- Criar vendedor ativo.
- Abrir link com `seller_slug`.

### Checkout

- Formulario cria lead.
- UTMs aparecem no banco.
- Seller canonical aparece no banco quando valido.
- Checkout lista turmas/produtos ativos.
- Cupom valido aplica desconto.
- Cupom invalido nao aplica desconto.
- Quantidade acima do limite falha.
- Payload com `totalAmountCents` falha.
- Pedido cria snapshot de turma/produto/vendedor/cupom.

### Stripe

- Card aprovado marca order `paid`.
- Card recusado marca `payment_failed`.
- Webhook sem assinatura falha.
- Evento duplicado nao duplica efeitos.
- Klarna aparece so quando habilitado.
- Afterpay aparece so quando elegivel.
- Refund/dispute persiste nas tabelas operacionais.

### Pagar.me

- Produto BRL redireciona para `/checkout/pagarme`.
- Produto USD mostra escolha Dolar/Real.
- Cartao aprovado marca `paid`.
- Cartao recusado exibe mensagem amigavel.
- Pix gera QR code.
- Pix pago marca `paid`.
- Pix expirado vira `expired`.
- Webhook duplicado nao duplica efeitos.

### Admin

- Usuario nao logado vai para `/admin/login`.
- Operator acessa admin, mas nao acessa usuarios.
- Admin acessa usuarios.
- Criacao de usuario gera senha uma vez.
- Reset de senha funciona.
- Tema dark/light persiste.
- Mobile nao tem overflow horizontal.
- Filtros de leads/vendas funcionam.
- UTM Builder gera URL correta.
- Webhook outbound envia e registra tentativa.

### Pipedrive

- `lead.created` cria pessoa e lead.
- `order.created` cria deal.
- `order.paid` move deal para ganho/stage pago.
- `order.payment_failed` move deal para stage de falha.
- Jobs duplicados nao duplicam entidades.
- `dead` jobs ficam auditaveis.

## 18. Regras de seguranca

- Nao exponha secret keys no client.
- Variaveis sem `NEXT_PUBLIC_` devem ser usadas apenas server-side.
- O frontend nunca envia preco confiavel.
- O backend sempre recalcula preco, desconto, moeda e parcelas.
- Card data cru nao passa pelo servidor.
- Webhook e fonte da verdade de pagamento.
- `sessionStorage` e apenas transporte de UX, nao fonte confiavel.
- RLS fica habilitado e tabelas sensiveis sao acessadas via service role no
  servidor.
- Jobs internos exigem bearer.
- Webhooks inbound validam assinatura.
- Webhooks outbound assinam payload quando endpoint tem segredo.
- Nao grave senha inicial em banco, log ou URL.
- Nao use redirects de locale em `next.config.ts`.

## 19. Pontos de customizacao por cliente

Troque sempre:

- nome do produto;
- marca;
- logo;
- favicon;
- imagens de fundo;
- cores;
- textos em PT/EN;
- URL de WhatsApp ou comunidade;
- dominios;
- contas Stripe/Pagar.me/Supabase/Pipedrive;
- pipeline/stages/campos Pipedrive;
- termos legais;
- politica de privacidade;
- regras fiscais;
- limites de quantidade;
- metodos de pagamento por produto.

Reavalie com o cliente:

- se precisa EN;
- se precisa BRL, USD ou ambos;
- se Pix sera Pagar.me, Stripe ou outro gateway;
- se Klarna/Afterpay sao permitidos pelo tipo de produto;
- se vendedor e apenas tracking ou base para comissao;
- se leads abandonados devem ir para CRM, WhatsApp, email ou webhook;
- se precisa exportacao CSV;
- se precisa check-in, QR code real ou envio de ingresso por email.

## 20. Armadilhas conhecidas

### Locale PT sem prefixo

Com `localePrefix: "as-needed"` e `defaultLocale: "pt"`, a producao usa:

```text
/formulario
/checkout
/obrigado
```

Nao crie redirects para `/pt/...`.

### Turbopack em dev

Em dev, acesse:

```text
/pt/formulario
/pt/checkout
/pt/obrigado
```

Isso evita o 404 local conhecido em rotas sem prefixo.

### Metodos de pagamento

Disponibilidade vem de `products.payment_methods`. Nao hardcode no frontend.

Para habilitar Pix em um produto:

```sql
update public.products
set payment_methods = array['card', 'pix']
where id = '<product-id>';
```

### Preco temporario por env

`CHECKOUT_UNIT_AMOUNT_CENTS` e legado/fallback. Nao construa um novo projeto em
cima dele. O modelo correto e catalogo no Supabase.

### Flash de catalogo

No checkout, mantenha o guard `catalogLoading` ao renderizar informacoes de
turma/produto. Sem ele, o usuario pode ver texto antigo por alguns frames.

## 21. Entrega para o cliente

Ao entregar para um novo cliente, inclua:

- acesso ao repositorio;
- acesso Vercel;
- acesso Supabase;
- acesso Stripe;
- acesso Pagar.me;
- acesso Pipedrive, se usado;
- arquivo `.env.example` atualizado;
- lista de dominios configurados;
- primeiro usuario admin criado;
- turmas/produtos iniciais cadastrados;
- webhook Stripe configurado;
- webhook Pagar.me configurado;
- Supabase Cron validado;
- checklist de testes preenchido;
- instrucao de como criar vendedor e link de campanha;
- instrucao de como criar cupom;
- instrucao de como verificar leads e vendas.

## 22. Referencias internas

- Specs: `.specs/features/`
- Checkout UI: `.specs/features/checkout-pages/`
- Admin/catalogo: `.specs/features/admin-catalog/`
- Admin leads/vendas: `.specs/features/admin-leads-vendas/`
- Admin users: `.specs/features/admin-users/`
- Pagar.me BRL: `.specs/features/checkout-pagarme-brl/`
- Pipedrive: `.specs/features/pipedrive-crm-sync/`
- Stripe validation: `.specs/features/stripe-operational-validation/`
- Afterpay: `.specs/features/checkout-bnpl-afterpay/`
- Klarna: `.specs/features/checkout-bnpl-klarna/`
- Seller links: `.specs/features/seller-links-attribution/`
- Migrations: `supabase/migrations/`
- Env vars: `.env.example`
