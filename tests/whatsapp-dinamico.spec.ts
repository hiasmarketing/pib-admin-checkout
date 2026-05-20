import { test, expect } from "@playwright/test";

const ORDER_ID = "11111111-1111-1111-1111-111111111111";

test.describe("/obrigado: CTA WhatsApp dinâmico por turma", () => {
  test("turma com whatsapp_group_url → mostra botão com href correto", async ({ page }) => {
    await page.route(`**/api/orders/${ORDER_ID}`, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: ORDER_ID,
          status: "paid",
          quantity: 1,
          totalAmountCents: 349700,
          currency: "brl",
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          turmaName: "Turma A",
          productName: "Ingresso A",
          couponCode: null,
          pagarmeDeclineCode: null,
          pagarmeFailureMessage: null,
          whatsappGroupUrl: "https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAA",
        }),
      });
    });

    await page.goto(`/obrigado?orderId=${ORDER_ID}`);
    const cta = page.getByRole("link", { name: /WhatsApp/i });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute(
      "href",
      "https://chat.whatsapp.com/AAAAAAAAAAAAAAAAAA"
    );
  });

  test("turma sem whatsapp_group_url → mostra fallback sem botão morto", async ({ page }) => {
    await page.route(`**/api/orders/${ORDER_ID}`, async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          id: ORDER_ID,
          status: "paid",
          quantity: 1,
          totalAmountCents: 349700,
          currency: "brl",
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
          turmaName: "Turma B",
          productName: "Ingresso B",
          couponCode: null,
          pagarmeDeclineCode: null,
          pagarmeFailureMessage: null,
          whatsappGroupUrl: null,
        }),
      });
    });

    await page.goto(`/obrigado?orderId=${ORDER_ID}`);
    await expect(page.getByText(/em breve enviaremos/i)).toBeVisible();
    await expect(page.getByRole("link", { name: /WhatsApp/i })).toHaveCount(0);
  });
});
