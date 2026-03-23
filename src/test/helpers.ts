import { vi } from "vitest"
import type { Session } from "next-auth"
import { auth } from "@/lib/auth"
import { prismaMock } from "./mocks/prisma"
import { buildMembership } from "./factories"
import { UserRole } from "@prisma/client"

export function mockAuthSession(
  role: UserRole = UserRole.GESTIONNAIRE,
  societyId = "society-1"
) {
  const session: Session = {
    user: { id: "user-1", email: "test@example.com", name: "Test User" },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
  vi.mocked(auth).mockResolvedValue(session)
  prismaMock.userSociety.findUnique.mockResolvedValue(
    buildMembership(role, { societyId })
  )
}

export function mockUnauthenticated() {
  vi.mocked(auth).mockResolvedValue(null)
}
