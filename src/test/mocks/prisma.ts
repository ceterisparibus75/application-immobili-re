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
})
