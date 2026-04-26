import { expect, test } from "@playwright/test";

const commercialPages = [
  { path: "/pricing", text: /starter|pro|enterprise/i },
  { path: "/aide", text: /centre d'aide|guides|questions/i },
  { path: "/cgu", text: /conditions|utilisation|service/i },
  { path: "/cgv", text: /conditions|vente|abonnement/i },
  { path: "/dpa", text: /traitement|données|rgpd/i },
  { path: "/locaux", text: /locaux|disponibles|surface/i },
  { path: "/blog", text: /blog|articles|immobilier/i },
];

test.describe("Commercial readiness smoke", () => {
  for (const { path, text } of commercialPages) {
    test(`${path} charge sans authentification`, async ({ page }) => {
      await page.goto(path);

      await expect(page).not.toHaveURL(/\/login/);
      await expect(page.locator("body")).toContainText(text);
    });
  }

  test("les PDF de facture restent protégés sans session", async ({ request }) => {
    const pdf = await request.get("/api/invoices/e2e-missing/pdf", { maxRedirects: 0 });
    const facturx = await request.get("/api/invoices/e2e-missing/facturx", { maxRedirects: 0 });

    expect(pdf.status()).toBeGreaterThanOrEqual(300);
    expect(pdf.status()).toBeLessThan(400);
    expect(pdf.headers().location).toContain("/login");
    expect(facturx.status()).toBeGreaterThanOrEqual(300);
    expect(facturx.status()).toBeLessThan(400);
    expect(facturx.headers().location).toContain("/login");
  });
});
