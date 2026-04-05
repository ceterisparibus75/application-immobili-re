import { test, expect } from "@playwright/test"

test.describe("Authentication", () => {
  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login")
    await expect(page.locator("input[type='email'], input[name='email']")).toBeVisible()
    await expect(page.locator("input[type='password']")).toBeVisible()
    await expect(page.getByRole("button", { name: /connexion|se connecter/i })).toBeVisible()
  })

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login")
    await page.fill("input[type='email'], input[name='email']", "invalid@example.com")
    await page.fill("input[type='password']", "wrongpassword123")
    await page.getByRole("button", { name: /connexion|se connecter/i }).click()
    await expect(page.locator("text=/erreur|invalide|incorrect/i")).toBeVisible({ timeout: 5000 })
  })
})

test.describe("Public Pages", () => {
  test("landing page loads", async ({ page }) => {
    await page.goto("/")
    await expect(page).toHaveTitle(/.+/)
    expect(page.url()).not.toContain("/login")
  })

  test("mentions legales loads", async ({ page }) => {
    await page.goto("/mentions-legales")
    await expect(page.locator("body")).toContainText(/mentions légales/i)
  })

  test("politique de confidentialite loads", async ({ page }) => {
    await page.goto("/politique-confidentialite")
    await expect(page.locator("body")).toContainText(/confidentialit/i)
  })

  test("contact page loads", async ({ page }) => {
    await page.goto("/contact")
    await expect(page.locator("body")).toContainText(/contact/i)
  })
})
