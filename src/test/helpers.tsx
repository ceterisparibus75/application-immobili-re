import { vi } from "vitest"
import { auth } from "@/lib/auth"
import { prismaMock } from "./mocks/prisma"
import { buildMembership } from "./factories"
import { UserRole } from "@prisma/client"

export function mockAuthSession(
  role: UserRole = UserRole.GESTIONNAIRE,
  societyId = "society-1"
) {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-1", email: "test@example.com", name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  } as any)
  prismaMock.userSociety.findUnique.mockResolvedValue(
    buildMembership(role, { societyId }) as any
  )
}

export function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null as any)
}
