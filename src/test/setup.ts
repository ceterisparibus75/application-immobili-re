import { vi } from "vitest"
import { prismaMock } from "./mocks/prisma"

process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString("base64")
process.env.DATABASE_URL = "postgresql://test"
process.env.AUTH_SECRET = "test-secret"

// IMPORTANT: auth() est exporte depuis @/lib/auth, pas depuis next-auth
vi.mock("@/lib/auth", () => ({ auth: vi.fn().mockResolvedValue(null) }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))
vi.mock("@/lib/prisma-tenant", () => ({
  createTenantPrisma: vi.fn().mockReturnValue(prismaMock),
}))

// Mock plan-limits — always allowed in tests
vi.mock("@/lib/plan-limits", () => ({
  checkSubscriptionActive: vi.fn().mockResolvedValue({ active: true, status: "ACTIVE" }),
  checkLotLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkSocietyLimit: vi.fn().mockResolvedValue({ allowed: true }),
  checkUserLimit: vi.fn().mockResolvedValue({ allowed: true }),
  requiresTwoFactor: vi.fn().mockResolvedValue(false),
}))
