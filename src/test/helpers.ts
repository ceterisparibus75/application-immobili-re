import { vi } from "vitest"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prismaMock } from "./mocks/prisma"
import { buildMembership } from "./factories"
import { UserRole } from "@/generated/prisma/client"

export function mockAuthSession(
  role: UserRole = UserRole.GESTIONNAIRE,
  societyId = "society-1"
) {
  const session: Session = {
    user: { id: "user-1", email: "test@example.com", name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue(session)
  prismaMock.userSociety.findUnique.mockResolvedValue(
    buildMembership(role, { societyId })
  )
  // Mock active subscription so checkSubscriptionActive() passes
  prismaMock.subscription.findUnique.mockResolvedValue({
    id: "sub-1",
    societyId,
    plan: "PRO",
    status: "ACTIVE",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    stripePriceId: "price_test",
    currentPeriodStart: new Date(),
    currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
    trialEnd: null,
    cancelAt: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as never)
}

export function mockUnauthenticated() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(auth as any).mockResolvedValue(null)
}
