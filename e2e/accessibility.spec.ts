import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const publicPages = [
  { path: "/", name: "landing" },
  { path: "/login", name: "login" },
  { path: "/contact", name: "contact" },
  { path: "/mentions-legales", name: "mentions legales" },
  { path: "/politique-confidentialite", name: "politique confidentialite" },
  { path: "/portal/login", name: "portail locataire" },
];

async function expectNoSeriousA11yViolations(page: Page, name: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blockingViolations = results.violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious"
  );

  expect(blockingViolations, `${name} accessibility violations`).toEqual([]);
}

test.describe("Accessibility baseline", () => {
  for (const { path, name } of publicPages) {
    test(`${name} has no serious automated accessibility violation`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("body")).toBeVisible();
      await expectNoSeriousA11yViolations(page, name);
    });
  }

  test("protected app shell redirect remains accessible", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
    await expectNoSeriousA11yViolations(page, "protected app shell redirect");
  });
});
