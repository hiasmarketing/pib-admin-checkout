import { test, expect } from "@playwright/test";

test("checkout: skeleton aparece e desaparece sem stutter de conteúdo", async ({ page }) => {
  await page.addInitScript(() => {
    sessionStorage.setItem("destiny_lead_id", "test-lead-123");
    sessionStorage.setItem("destiny_catalog_selection", JSON.stringify({}));
  });

  const calls: string[] = [];
  page.on("request", (req) => {
    if (req.url().includes("/api/catalog")) calls.push(`→ ${req.url()}`);
  });
  page.on("response", (res) => {
    if (res.url().includes("/api/catalog"))
      calls.push(`← ${res.url()} ${res.status()}`);
  });

  await page.goto("/pt/checkout/cartao");

  // Skeleton deve aparecer imediatamente após o mount
  await expect(page.locator(".animate-pulse").first()).toBeVisible();

  // Skeleton deve sumir quando o catálogo carregar (max 8s)
  await expect(page.locator(".animate-pulse").first()).not.toBeVisible({
    timeout: 8000,
  });

  console.log("Chamadas de rede:\n" + calls.join("\n"));
});
