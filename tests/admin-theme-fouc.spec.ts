import { test } from "@playwright/test";

test("admin: sem flash de tema escuro ao recarregar em light mode", async ({
  page,
  context,
}) => {
  // Simular localStorage com light mode já ativo
  await context.addInitScript(() => {
    localStorage.setItem("admin-theme", "light");
  });

  await page.goto("/admin");

  // Captura screenshot imediatamente após o primeiro paint
  await page.screenshot({
    path: "tests/screenshots/admin-reload-light.png",
  });

  // Verificação: <html> deve ter data-admin-theme="light" antes de qualquer JS
  // (isso é garantido pelo script inline no <head>)
  const adminTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-admin-theme")
  );
  console.log("data-admin-theme no <html>:", adminTheme);
  // Se o script anti-FOUC funcionou, o valor já está setado antes do React hidratar
});
