import { test, expect } from "@playwright/test"

test.describe("Protected Route Guards", () => {
  const protectedRoutes = [
    "/dashboard",
    "/patrimoine",
    "/baux",
    "/locataires",
    "/facturation",
    "/charges",
    "/comptabilite",
    "/banque",
    "/emprunts",
    "/contacts",
    "/documents",
    "/relances",
    "/administration/utilisateurs",
    "/rgpd",
    "/notifications",
    "/parametres",
  ]

  for (const route of protectedRoutes) {
    test(`${route} redirects to login when unauthenticated`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/login/)
    })
  }
})

test.describe("Portal Routes", () => {
  test("portal login page loads", async ({ page }) => {
    await page.goto("/portal/login")
    await expect(page.locator("body")).toContainText(/portail|locataire|connexion/i)
  })
})

test.describe("API Health", () => {
  test("auth API responds", async ({ request }) => {
    const response = await request.get("/api/auth/providers")
    expect(response.status()).toBeLessThan(500)
  })
})
