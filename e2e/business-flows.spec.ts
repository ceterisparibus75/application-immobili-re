import { expect, type Page, test } from "@playwright/test"

const shouldRunBusinessFlows = process.env.E2E_RUN_BUSINESS_FLOWS === "1"
const e2eEmail = process.env.E2E_EMAIL || ""
const e2ePassword = process.env.E2E_PASSWORD || ""

test.skip(
  !shouldRunBusinessFlows,
  "Set E2E_RUN_BUSINESS_FLOWS=1 to run destructive staging business-flow tests."
)
test.skip(
  !e2eEmail || !e2ePassword,
  "Set E2E_EMAIL and E2E_PASSWORD for an account with an active society."
)

function resourceIdFromUrl(url: string, segment: string) {
  const match = new RegExp(`/${segment}/([^/?#]+)`).exec(new URL(url).pathname)
  expect(match?.[1], `Expected URL to contain /${segment}/:id`).toBeTruthy()
  return match![1]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

async function signIn(page: Page) {
  await page.goto("/login")
  await expect(page.getByLabel("Adresse email")).toBeVisible()
  await page.locator("#email").fill(e2eEmail)
  await page.locator("#password").fill(e2ePassword)
  await page.getByRole("button", { name: /se connecter/i }).click()
  await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 })
}

async function createBuilding(page: Page, suffix: string) {
  const buildingName = `E2E Immeuble ${suffix}`

  await page.goto("/patrimoine/immeubles/nouveau")
  await expect(page.getByRole("heading", { name: "Nouvel immeuble" })).toBeVisible()
  await page.locator("#name").fill(buildingName)
  await page.locator("#buildingType").selectOption("BUREAU")
  await page.locator("#addressLine1").fill("1 rue des Tests")
  await page.locator("#postalCode").fill("75001")
  await page.locator("#city").fill("Paris")
  await page.locator("#acquisitionDate").fill(todayISO())
  await page.locator("#acquisitionPrice").fill("1000000")
  await page.locator("#totalArea").fill("120")
  await page.getByRole("button", { name: /créer l'immeuble/i }).click()

  await expect(page).toHaveURL(/\/patrimoine\/immeubles\/[^/]+$/, { timeout: 20_000 })
  await expect(page.getByText(buildingName)).toBeVisible()

  return { id: resourceIdFromUrl(page.url(), "immeubles"), name: buildingName }
}

async function createLot(page: Page, buildingId: string, suffix: string) {
  const lotNumber = `E2E-${suffix}`

  await page.goto(`/patrimoine/immeubles/${buildingId}/lots/nouveau`)
  await expect(page.getByRole("heading", { name: "Nouveau lot" })).toBeVisible()
  await page.locator("#number").fill(lotNumber)
  await page.locator("#lotType").selectOption("BUREAUX")
  await page.locator("#floor").fill("RDC")
  await page.locator("#area").fill("45")
  await page.locator("#marketRentValue").fill("1500")
  await page.getByRole("button", { name: /créer le lot/i }).click()

  await expect(page).toHaveURL(/\/patrimoine\/immeubles\/[^/]+\/lots\/[^/]+$/, { timeout: 20_000 })
  await expect(page.getByText(lotNumber)).toBeVisible()

  return { id: resourceIdFromUrl(page.url(), "lots"), number: lotNumber }
}

async function createTenant(page: Page, suffix: string) {
  const companyName = `E2E Locataire ${suffix}`
  const tenantEmail = `e2e.locataire.${suffix.toLowerCase()}@example.com`

  await page.goto("/locataires/nouveau")
  await expect(page.getByRole("heading", { name: "Nouveau locataire" })).toBeVisible()
  await page.locator("#companyName").fill(companyName)
  await page.locator("#companyLegalForm").selectOption("SAS")
  await page.locator("#companyAddress").fill("10 avenue Scenario, 75002 Paris")
  await page.locator("#email").fill(tenantEmail)
  await page.getByRole("button", { name: /créer le locataire/i }).click()

  await expect(page).toHaveURL(/\/locataires\/[^/]+$/, { timeout: 20_000 })
  await expect(page.getByText(companyName)).toBeVisible()

  return { id: resourceIdFromUrl(page.url(), "locataires"), name: companyName }
}

async function createLease(page: Page, lotId: string, tenantId: string) {
  await page.goto(`/baux/nouveau/rapide?lotId=${lotId}&tenantId=${tenantId}`)
  await expect(page.getByRole("heading", { name: "Bail rapide" })).toBeVisible()
  await expect(page.locator(`input[type="checkbox"]:checked`)).toHaveCount(1)
  await expect(page.locator("#tenantId")).toHaveValue(tenantId)
  await page.locator("#leaseType").selectOption("COMMERCIAL_369")
  await page.locator("#destination").selectOption("BUREAU")
  await page.locator("#startDate").fill(todayISO())
  await page.locator("#durationMonths").fill("108")
  await page.locator("#baseRentHT").fill("1500")
  await page.locator("#depositAmount").fill("3000")
  await page.getByRole("button", { name: /créer le bail/i }).click()

  await expect(page).toHaveURL(/\/baux\/[^/]+$/, { timeout: 20_000 })

  return { id: resourceIdFromUrl(page.url(), "baux") }
}

async function createInvoiceFromLease(page: Page, leaseId: string) {
  const periodMonth = todayISO().slice(0, 7)

  await page.goto("/facturation/nouvelle")
  await expect(page.getByRole("heading", { name: "Nouvelle facture" })).toBeVisible()
  await expect(page.locator("#leaseId").locator(`option[value="${leaseId}"]`)).toHaveCount(1, { timeout: 15_000 })
  await page.locator("#leaseId").selectOption(leaseId)
  await page.locator("#periodMonth").fill(periodMonth)
  await page.getByRole("button", { name: /prévisualiser/i }).click()
  await expect(page.getByRole("heading", { name: "Aperçu de la facture" })).toBeVisible({ timeout: 20_000 })
  await page.getByRole("button", { name: /confirmer et générer/i }).first().click()

  await expect(page).toHaveURL(/\/facturation\/[^/]+$/, { timeout: 20_000 })

  return { id: resourceIdFromUrl(page.url(), "facturation") }
}

test.describe("parcours métier staging", () => {
  test("crée un immeuble, un lot, un locataire, un bail puis une facture", async ({ page }) => {
    const suffix = `${Date.now()}`

    await signIn(page)

    const building = await test.step("créer un immeuble", () => createBuilding(page, suffix))
    const lot = await test.step("créer un lot vacant", () => createLot(page, building.id, suffix))
    const tenant = await test.step("créer un locataire", () => createTenant(page, suffix))
    const lease = await test.step("créer un bail actif", () => createLease(page, lot.id, tenant.id))
    const invoice = await test.step("générer une facture depuis le bail", () =>
      createInvoiceFromLease(page, lease.id)
    )

    expect({ building, lot, tenant, lease, invoice }).toMatchObject({
      building: { name: expect.stringContaining("E2E Immeuble") },
      lot: { number: expect.stringContaining("E2E-") },
      tenant: { name: expect.stringContaining("E2E Locataire") },
      lease: { id: expect.any(String) },
      invoice: { id: expect.any(String) },
    })
  })
})
