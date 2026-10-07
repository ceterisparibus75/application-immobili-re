import { mockDeep, mockReset } from "vitest-mock-extended"
import type { PrismaClient } from "@/generated/prisma/client"
import { beforeEach } from "vitest"

export const prismaMock = mockDeep<PrismaClient>()

beforeEach(() => {
  mockReset(prismaMock)
  prismaMock.$transaction.mockImplementation(((arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof prismaMock) => unknown)(prismaMock)
    if (Array.isArray(arg)) return Promise.all(arg)
    return Promise.resolve(undefined)
  }) as never)
  // Par defaut, tous les tests disposent d'un exercice fiscal ouvert : les
  // helpers requireOpenFiscalYearIdForDate / resolveOpenFiscalYearIdForDate
  // trouvent toujours un FiscalYear valide. Les tests qui veulent couvrir le
  // cas "aucun exercice ouvert" (NoOpenFiscalYearError) ou "exercice clos"
  // (ClosedFiscalYearError) surchargent explicitement ce mock.
  prismaMock.fiscalYear.findFirst.mockResolvedValue({
    id: "fy-default",
    isClosed: false,
  } as never)
})
