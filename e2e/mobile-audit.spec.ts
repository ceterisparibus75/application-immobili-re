import { devices, expect, test, type Page } from "@playwright/test";

test.use({
  ...devices["Pixel 5"],
});

const publicRoutes = [
  { path: "/", text: /mygestia|gestion immobili/i },
  { path: "/login", text: /se connecter|connexion/i },
  { path: "/contact", text: /contact/i },
  { path: "/mentions-legales", text: /mentions légales/i },
  { path: "/politique-confidentialite", text: /confidentialit/i },
  { path: "/portal/login", text: /portail|locataire|connexion/i },
];

const protectedRoutes = ["/dashboard", "/facturation", "/baux"];

async function expectNoHorizontalOverflow(page: Page, context: string) {
  const metrics = await page.evaluate(() => ({
    htmlClientWidth: document.documentElement.clientWidth,
    htmlScrollWidth: document.documentElement.scrollWidth,
    bodyClientWidth: document.body.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.htmlScrollWidth, `${context}: html horizontal overflow`).toBeLessThanOrEqual(
    metrics.htmlClientWidth + 1
  );
  expect(metrics.bodyScrollWidth, `${context}: body horizontal overflow`).toBeLessThanOrEqual(
    metrics.bodyClientWidth + 1
  );
}

test.describe("Mobile visual audit baseline", () => {
  for (const { path, text } of publicRoutes) {
    test(`${path} fits a phone viewport`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).toContainText(text);
      await expectNoHorizontalOverflow(page, path);
    });
  }

  test("landing mobile menu is reachable and does not overflow", async ({ page }) => {
    await page.goto("/");
    await expectNoHorizontalOverflow(page, "landing before menu");

    await page.getByRole("button", { name: "Ouvrir le menu" }).click();

    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("link", { name: "Solutions" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Se connecter" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Essai gratuit/ })).toBeVisible();
    await expectNoHorizontalOverflow(page, "landing mobile menu");
  });

  for (const route of protectedRoutes) {
    test(`${route} redirects cleanly on mobile when unauthenticated`, async ({ page }) => {
      await page.goto(route);

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByRole("button", { name: /connexion|se connecter/i })).toBeVisible();
      await expectNoHorizontalOverflow(page, `${route} redirect`);
    });
  }
});
