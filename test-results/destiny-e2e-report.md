# Destiny checkout E2E report

Base URL: https://admin-destiny.vercel.app
Run date: 2026-05-05

| Cenário | orderId | /obrigado ok | Admin status ok | Admin mostra erro Stripe | UTMs ok | Seller ok | Pipedrive ok | Screenshot |
|---------|---------|--------------|-----------------|--------------------------|---------|-----------|--------------|------------|
| 1 - Aprovada sem UTMs/seller | 27954871-8b10-496c-add1-53d5b913a2e7 | Sim | Sim | N/A | Sim | Sim | N/A | test-results/cenario-1-aprovado.png |
| 2 - Aprovada com UTMs/seller | eb155b79-831a-43db-a450-6413eb83f037 | Sim | Sim | N/A | Sim | Nao | Parcial/Nao | test-results/cenario-2-aprovado.png |
| 3 - Recusa generica | 3ba92b9a-6d1a-4584-8519-8c7e00408202 | Nao | Sim | Nao | N/A | N/A | N/A | test-results/cenario-3-gap.png |
| 4 - Fundos insuficientes | 069d6fc1-705c-490c-8c95-886419ecdbbb | Nao | Sim | Nao | N/A | N/A | N/A | test-results/cenario-4-gap.png |
| 5 - Cartao vencido | 3a267c5b-37b9-4ed3-a47a-78a0387b00ef | Nao | Sim | Nao | N/A | N/A | N/A | test-results/cenario-5-gap.png |
| 6 - CVV incorreto | N/A | Nao | N/A | N/A | N/A | N/A | N/A | test-results/cenario-6-gap.png |

## Findings

1. Admin detail does not render `stripe_decline_code` or `stripe_failure_code`.
   - DB has failure codes for scenarios 3-5.
   - `src/app/admin/(protected)/vendas/[orderId]/page.tsx` does not display those fields.

2. Failed payments create `payment_failed` orders, but the checkout does not navigate to `/obrigado?orderId=...`.
   - Scenarios 3-5 stayed on `/checkout` with generic message: `Nao foi possivel preparar o pagamento agora.`
   - The backend-created order IDs were recovered from Supabase by lead email.

3. UTMs are captured correctly.
   - Scenario 2 lead has `instagram`, `stories`, `lancamento2026`, `carrossel-beneficios`, `imersao`.
   - Scenario 1 lead has all UTM fields empty.

4. Seller is not attached to the paid order in scenario 2.
   - Lead stores raw `seller_id=2293e141-eeef-461d-873d-d6a0d3b430f2`.
   - Seller row exists with `id=2293e141-eeef-461d-873d-d6a0d3b430f2`, `seller_id=guilherme`, `slug=gui-vendedor`, `name=Guilherme`.
   - Resolver currently matches incoming `seller_id` against `sellers.seller_id`, not `sellers.id`, so the UUID does not resolve.

5. Pipedrive scenario 2:
   - Person exists: `Teste E2E`, personId `282079`.
   - Deal exists: dealId `7146`, title `Teste E2E deal`.
   - Deal stage is paid: stageId `2`, expected paid stageId `2`.
   - Owner is the default owner: ownerId `22614470`, expected `22614470`.
   - Seller field was not found in the deal payload, consistent with missing seller snapshot on the order.

## Fix validation - 2026-05-05

- Local endpoint validation on `http://localhost:3001/api/catalog/seller?seller_id=2293e141-eeef-461d-873d-d6a0d3b430f2` now resolves `{ sellerId: "guilherme", slug: "gui-vendedor", name: "Guilherme" }`.
- Compatibility checks also pass for `seller_id=guilherme` and `seller_slug=gui-vendedor`.
- Created local API test lead `35bc7584-423a-4612-acda-9a135edee994` using the UUID seller link attribution.
- Created card checkout order `f6a48dcf-c43f-46a3-aec5-fe30987a3521`; PaymentIntent returned `requires_payment_method`, and the order was inserted with:
  - `seller_record_id=2293e141-eeef-461d-873d-d6a0d3b430f2`
  - `seller_id_snapshot=guilherme`
  - `seller_slug_snapshot=gui-vendedor`
  - `seller_name_snapshot=Guilherme`

## Payment failure retest - 2026-05-05

Scope: local retest after applying the synchronous declined-payment fix. Pipedrive was intentionally not retested in this pass.

| Scenario | Test card | orderId | API response | Redirect | /obrigado message | WhatsApp CTA |
|----------|-----------|---------|--------------|----------|-------------------|--------------|
| generic_decline | 4000 0000 0000 0002 | a2731bfe-3cee-4fed-b17a-f34d75f294e5 | 402 with `orderId`, `generic_decline`, `card_declined` | `/obrigado?orderId=...` | Pagamento recusado / Cartão recusado | Hidden |
| insufficient_funds | 4000 0000 0000 9995 | a28a070d-f128-4bae-ac5e-071ca7f1f6f4 | 402 with `orderId`, `insufficient_funds`, `card_declined` | `/obrigado?orderId=...` | Pagamento recusado / Saldo insuficiente | Hidden |
| expired_card | 4000 0000 0000 0069 | d445f45e-5b6c-47ff-8920-7e6c0852b62c | 402 with `orderId`, `expired_card`, `expired_card` | `/obrigado?orderId=...` | Pagamento recusado / vencido | Hidden |

Screenshots:
- `test-results/reteste-generic_decline.png`
- `test-results/reteste-insufficient_funds.png`
- `test-results/reteste-expired_card.png`

## Failure-code data recovered from Supabase

| Scenario | orderId | status | stripe_decline_code | stripe_failure_code |
|----------|---------|--------|---------------------|---------------------|
| 3 | 3ba92b9a-6d1a-4584-8519-8c7e00408202 | payment_failed | generic_decline | card_declined |
| 4 | 069d6fc1-705c-490c-8c95-886419ecdbbb | payment_failed | insufficient_funds | card_declined |
| 5 | 3a267c5b-37b9-4ed3-a47a-78a0387b00ef | payment_failed | expired_card | expired_card |
