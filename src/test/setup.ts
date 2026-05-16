import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"
import { prismaMock } from "./mocks/prisma"

process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString("base64")
process.env.DATABASE_URL = "postgresql://test"
process.env.AUTH_SECRET = "test-secret"

// Polyfill localStorage/sessionStorage — jsdom 29 + Node 24+ ne fournit pas
// systématiquement ces APIs. Les tests de composants (welcome-screen,
// onboarding-wizard, widget-configurator, global-search) en ont besoin.
function createStorage(): Storage {
  const store: Record<string, string> = {}
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      for (const k of Object.keys(store)) delete store[k]
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length
    },
  }
}

if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    value: createStorage(),
    configurable: true,
    writable: true,
  })
}
if (typeof globalThis.sessionStorage === "undefined") {
  Object.defineProperty(globalThis, "sessionStorage", {
    value: createStorage(),
    configurable: true,
    writable: true,
  })
}

// IMPORTANT: auth() est exporte depuis @/lib/auth, pas depuis next-auth
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantPrisma: vi.fn().mockReturnValue(prismaMock),
}))
// Mock plan-limits — toujours autoriser en test
vi.mock("@/lib/plan-limits", () => ({
  checkSubscriptionActive: vi.fn().mockResolvedValue({ active: true }),
  checkLotLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkSocietyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getSocietyPlan: vi.fn().mockResolvedValue("PRO"),
}))
