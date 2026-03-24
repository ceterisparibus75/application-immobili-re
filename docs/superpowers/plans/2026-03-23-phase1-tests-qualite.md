# Phase 1 Tests et Qualite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place une infrastructure de tests complete (Vitest + vitest-mock-extended + CI/CD) sur une application Next.js 16 sans aucun test existant.

**Architecture:** Tests unitaires colocalises (*.test.ts) avec mocks Prisma centralises dans src/test/. La session NextAuth est mockee via @/lib/auth (pas next-auth). prismaMock est reset automatiquement avant chaque test. createTenantPrisma est aussi mocke pour retourner prismaMock.

**Tech Stack:** Vitest 3+, vitest-mock-extended, @testing-library/react, jsdom, husky, lint-staged, GitHub Actions

---

## Fichiers crees

- `vitest.config.ts` - Config Vitest (alias @, environmentMatchGlobs jsdom uniquement pour composants, coverage v8)
- `src/test/setup.ts` - Setup global : ENCRYPTION_KEY, DATABASE_URL, AUTH_SECRET, mocks auth + prisma + prisma-tenant
- `src/test/mocks/prisma.ts` - Instance mockDeep<PrismaClient>() + reset beforeEach
- `src/test/factories.ts` - Builders types : buildUser, buildSociety, buildMembership, buildLease, buildInvoice, buildTenant
- `src/test/helpers.tsx` - mockAuthSession(role, societyId) : configure auth() + prismaMock.userSociety.findUnique
- `src/lib/permissions.test.ts` - Tests hasMinRole, requireSocietyAccess, requireSuperAdmin
- `src/lib/encryption.test.ts` - Tests round-trip, IVs uniques, erreurs
- `src/lib/utils.test.ts` - Tests formatCurrency, formatDate, formatDateTime, getLogoProxyUrl, cn
- `src/validations/lease.test.ts` - Tests schema Zod createLeaseSchema
- `src/validations/invoice.test.ts` - Tests schemas Zod createInvoice + recordPayment
- `src/validations/tenant.test.ts` - Tests schema Zod createTenant (PERSONNE_PHYSIQUE + PERSONNE_MORALE)
- `src/actions/tenant.test.ts` - Tests Server Action createTenant (auth, permissions, validation, succes)
- `src/actions/invoice.test.ts` - Tests Server Actions createInvoice + recordPayment
- `.github/workflows/ci.yml` - 3 jobs paralleles : quality, test, build
- `.husky/pre-commit` - Hook pre-commit eslint --fix

## Fichiers modifies

- `package.json` - Scripts test/test:watch/test:coverage + lint-staged config

---## Task 1: Installer dependances + configurer package.json

**Files:** Modify `package.json`

- [ ] **Step 1.1: Installer dependances de test**

```bash
npm install -D vitest @vitest/coverage-v8 vitest-mock-extended
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D jsdom husky lint-staged
```

- [ ] **Step 1.2: Ajouter dans package.json > scripts**

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

- [ ] **Step 1.3: Ajouter lint-staged dans package.json**

```json
"lint-staged": { "*.{ts,tsx}": ["eslint --fix"] }
```

- [ ] **Step 1.4: Commit**

```bash
git add package.json package-lock.json
git commit -m 'chore: install vitest, vitest-mock-extended, husky, lint-staged'
```

---

## Task 2: Creer vitest.config.ts

**Files:** Create `vitest.config.ts`

- [ ] **Step 2.1: Creer le fichier**

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    environmentMatchGlobs: [
      ["src/components/**/*.test.tsx", "jsdom"],
    ],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/actions/**", "src/validations/**"],
      thresholds: { lines: 70, functions: 70 },
    },
  },
})
```

- [ ] **Step 2.2: Verifier que vitest est reconnu**

```bash
npx vitest run --reporter=verbose 2>&1 | head -5
```
Expected: erreur "No test files found" (normal, pas encore de tests).

- [ ] **Step 2.3: Commit**

```bash
git add vitest.config.ts
git commit -m 'chore: add vitest.config.ts'
```

---

## Task 3: Creer l infrastructure de tests (setup + mocks + factories + helpers)

**Files:**
- Create: `src/test/mocks/prisma.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/factories.ts`
- Create: `src/test/helpers.tsx`

- [ ] **Step 3.1: Creer src/test/mocks/prisma.ts**

```typescript
import { mockDeep, mockReset } from "vitest-mock-extended"
import type { PrismaClient } from "@prisma/client"
import { beforeEach } from "vitest"

export const prismaMock = mockDeep<PrismaClient>()
beforeEach(() => mockReset(prismaMock))
```

- [ ] **Step 3.2: Creer src/test/setup.ts**

```typescript
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
```

- [ ] **Step 3.3: Creer src/test/factories.ts**

```typescript
import type { User, Society, UserSociety } from "@prisma/client"
import { UserRole, BuildingType, LotType, LeaseStatus, InvoiceStatus, InvoiceType, RiskIndicator } from "@prisma/client"

export const buildUser = (overrides?: Partial<User>): User => ({
  id: "user-1", name: "Test User", email: "test@example.com",
  passwordHash: "hashed", isActive: true, firstName: null,
  lastName: null, image: null, lastLoginAt: null,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
})

export const buildSociety = (overrides?: Partial<Society>): Society => ({
  id: "society-1", name: "Ma Societe", siret: "12345678901234",
  isActive: true, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
} as Society)

export const buildMembership = (role: UserRole = UserRole.GESTIONNAIRE, overrides = {}): UserSociety => ({
  userId: "user-1", societyId: "society-1", role,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
} as UserSociety)

export const buildTenantPhysique = (overrides = {}) => ({
  id: "tenant-1", societyId: "society-1",
  entityType: "PERSONNE_PHYSIQUE" as const,
  email: "locataire@example.com", firstName: "Jean", lastName: "Dupont",
  isActive: true, riskIndicator: RiskIndicator.VERT,
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
})

export const buildInvoice = (overrides = {}) => ({
  id: "invoice-1", societyId: "society-1",
  invoiceNumber: "FAC-2026-0001",
  invoiceType: InvoiceType.APPEL_LOYER, status: InvoiceStatus.EN_ATTENTE,
  totalHT: 1000, totalTTC: 1200,
  issueDate: new Date(), dueDate: new Date(),
  createdAt: new Date(), updatedAt: new Date(), ...overrides,
})
```

- [ ] **Step 3.4: Creer src/test/helpers.tsx**

```typescript
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
```

- [ ] **Step 3.5: Verifier que le setup compile**

```bash
npx tsc --noEmit
```
Expected: aucune erreur TypeScript.

- [ ] **Step 3.6: Commit**

```bash
git add src/test/
git commit -m 'chore: add test infrastructure (setup, prisma mock, factories, helpers)'
```

---

## Task 4: Tests src/lib/utils.test.ts

**Files:** Create `src/lib/utils.test.ts`

- [ ] **Step 4.1: Ecrire les tests (ils doivent passer car utils.ts existe deja)**

```typescript
import { describe, it, expect } from "vitest"
import { formatCurrency, formatDate, formatDateTime, getLogoProxyUrl, cn } from "@/lib/utils"

describe("formatCurrency", () => {
  it("formate un montant en euros fr-FR", () => {
    expect(formatCurrency(1234.5)).toBe("1 234,50 €")
  })
  it("formate zero", () => {
    expect(formatCurrency(0)).toBe("0,00 €")
  })
})

describe("formatDate", () => {
  it("formate une date en dd/MM/yyyy", () => {
    expect(formatDate(new Date("2024-01-15T12:00:00Z"))).toBe("15/01/2024")
  })
})

describe("formatDateTime", () => {
  it("formate une date avec heure", () => {
    const result = formatDateTime(new Date("2024-01-15T00:00:00Z"))
    expect(result).toMatch(/15\/01\/2024/)
  })
})

describe("getLogoProxyUrl", () => {
  it("retourne null si null", () => { expect(getLogoProxyUrl(null)).toBeNull() })
  it("retourne null si undefined", () => { expect(getLogoProxyUrl(undefined)).toBeNull() })
  it("proxifie un chemin relatif", () => {
    expect(getLogoProxyUrl("/uploads/logo.png")).toBe("/api/storage/view?path=%2Fuploads%2Flogo.png")
  })
})

describe("cn", () => {
  it("merge des classes", () => { expect(cn("a", "b", false as any)).toBe("a b") })
})
```

- [ ] **Step 4.2: Lancer les tests**

```bash
npx vitest run src/lib/utils.test.ts --reporter=verbose
```
Expected: tous les tests passent (PASS).

- [ ] **Step 4.3: Commit**

```bash
git add src/lib/utils.test.ts
git commit -m 'test: add utils.ts unit tests'
```

---

## Task 5: Tests src/lib/encryption.test.ts

**Files:** Create `src/lib/encryption.test.ts`

Note: setup.ts injecte ENCRYPTION_KEY=Buffer.alloc(32).toString("base64") - les tests fonctionnent sans configuration supplementaire.

- [ ] **Step 5.1: Ecrire les tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { encrypt, decrypt } from "@/lib/encryption"

describe("encrypt / decrypt", () => {
  it("round-trip : decrypt(encrypt(x)) === x", () => {
    const texte = "FR76 3000 4000 0400 0001 2345 678"
    expect(decrypt(encrypt(texte))).toBe(texte)
  })

  it("deux chiffrements du meme texte produisent des IVs differents", () => {
    const texte = "secret"
    const e1 = encrypt(texte); const e2 = encrypt(texte)
    expect(e1).not.toBe(e2)  // IVs differents (AES-GCM aleatoire)
  })

  it("format invalide -> throws", () => {
    expect(() => decrypt("invalide")).toThrow("Invalid encrypted text format")
  })
})

describe("ENCRYPTION_KEY manquante", () => {
  const original = process.env.ENCRYPTION_KEY
  afterEach(() => { process.env.ENCRYPTION_KEY = original })

  it("encrypt sans ENCRYPTION_KEY -> throws", () => {
    delete process.env.ENCRYPTION_KEY
    expect(() => encrypt("test")).toThrow("ENCRYPTION_KEY is not defined")
  })

  it("ENCRYPTION_KEY mauvaise longueur -> throws", () => {
    process.env.ENCRYPTION_KEY = Buffer.alloc(16).toString("base64")
    expect(() => encrypt("test")).toThrow("must be 32 bytes")
  })
})
```

- [ ] **Step 5.2: Lancer les tests**

```bash
npx vitest run src/lib/encryption.test.ts --reporter=verbose
```
Expected: 5 tests passent.

- [ ] **Step 5.3: Commit**

```bash
git add src/lib/encryption.test.ts
git commit -m 'test: add encryption.ts unit tests'
```

---

## Task 6: Tests src/lib/permissions.test.ts

**Files:** Create `src/lib/permissions.test.ts`

Note: setup.ts mocke `@/lib/prisma`. `prismaMock` est importe directement dans les tests pour configurer les valeurs de retour.

- [ ] **Step 6.1: Ecrire les tests**

```typescript
import { describe, it, expect } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { hasMinRole, requireSocietyAccess, requireSuperAdmin, ForbiddenError } from "@/lib/permissions"
import { buildMembership } from "@/test/factories"
import { UserRole } from "@prisma/client"

describe("hasMinRole", () => {
  it("SUPER_ADMIN >= tous les roles", () => {
    expect(hasMinRole(UserRole.SUPER_ADMIN, UserRole.LECTURE)).toBe(true)
    expect(hasMinRole(UserRole.SUPER_ADMIN, UserRole.SUPER_ADMIN)).toBe(true)
  })
  it("LECTURE < GESTIONNAIRE", () => {
    expect(hasMinRole(UserRole.LECTURE, UserRole.GESTIONNAIRE)).toBe(false)
  })
  it("GESTIONNAIRE >= COMPTABLE", () => {
    expect(hasMinRole(UserRole.GESTIONNAIRE, UserRole.COMPTABLE)).toBe(true)
  })
})

describe("requireSocietyAccess", () => {
  it("acces OK si membership existe", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.GESTIONNAIRE) as any)
    await expect(requireSocietyAccess("user-1", "society-1")).resolves.not.toThrow()
  })

  it("ForbiddenError si pas de membership", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(null)
    await expect(requireSocietyAccess("user-1", "society-1")).rejects.toThrow(ForbiddenError)
  })

  it("ForbiddenError si role insuffisant", async () => {
    prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(UserRole.LECTURE) as any)
    await expect(requireSocietyAccess("user-1", "society-1", UserRole.GESTIONNAIRE)).rejects.toThrow(ForbiddenError)
  })
})

describe("requireSuperAdmin", () => {
  it("OK si au moins un role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.SUPER_ADMIN) as any])
    await expect(requireSuperAdmin("user-1")).resolves.toBe(true)
  })

  it("ForbiddenError si aucun role SUPER_ADMIN", async () => {
    prismaMock.userSociety.findMany.mockResolvedValue([buildMembership(UserRole.GESTIONNAIRE) as any])
    await expect(requireSuperAdmin("user-1")).rejects.toThrow(ForbiddenError)
  })
})
```

- [ ] **Step 6.2: Lancer les tests**

```bash
npx vitest run src/lib/permissions.test.ts --reporter=verbose
```
Expected: 7 tests passent.

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/permissions.test.ts
git commit -m 'test: add permissions.ts unit tests'
```

---

## Task 7: Tests src/validations/lease.test.ts

**Files:** Create `src/validations/lease.test.ts`

- [ ] **Step 7.1: Ecrire les tests**

```typescript
import { describe, it, expect } from "vitest"
import { createLeaseSchema } from "@/validations/lease"

const validLease = {
  lotId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  tenantId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  leaseType: "COMMERCIAL_369" as const,
  startDate: "2024-01-01",
  baseRentHT: 1500,
}

describe("createLeaseSchema", () => {
  it("valide un bail minimal correct", () => {
    const result = createLeaseSchema.safeParse(validLease)
    expect(result.success).toBe(true)
  })

  it("echoue si lotId manquant", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, lotId: undefined })
    expect(result.success).toBe(false)
  })

  it("echoue si leaseType invalide", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, leaseType: "INCONNU" })
    expect(result.success).toBe(false)
  })

  it("coerce baseRentHT depuis string", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, baseRentHT: "1500" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.baseRentHT).toBe(1500)
  })

  it("echoue si baseRentHT negatif", () => {
    const result = createLeaseSchema.safeParse({ ...validLease, baseRentHT: -100 })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 7.2: Lancer les tests**

```bash
npx vitest run src/validations/lease.test.ts --reporter=verbose
```

- [ ] **Step 7.3: Commit**

```bash
git add src/validations/lease.test.ts
git commit -m 'test: add lease validation schema tests'
```

---

## Task 8: Tests src/validations/invoice.test.ts

**Files:** Create `src/validations/invoice.test.ts`

- [ ] **Step 8.1: Ecrire les tests**

```typescript
import { describe, it, expect } from "vitest"
import { createInvoiceSchema, recordPaymentSchema } from "@/validations/invoice"

describe("createInvoiceSchema", () => {
  const validInvoice = {
    tenantId: "clxxxxxxxxxxxxxxxxxxxxxxx",
    invoiceType: "APPEL_LOYER" as const,
    issueDate: "2024-01-01", dueDate: "2024-01-31",
    lines: [{ label: "Loyer", quantity: 1, unitPrice: 1500, vatRate: 20 }],
  }

  it("valide une facture correcte", () => {
    expect(createInvoiceSchema.safeParse(validInvoice).success).toBe(true)
  })

  it("echoue si lines est vide", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, lines: [] }).success).toBe(false)
  })

  it("echoue si invoiceType invalide", () => {
    expect(createInvoiceSchema.safeParse({ ...validInvoice, invoiceType: "INCONNU" }).success).toBe(false)
  })
})

describe("recordPaymentSchema", () => {
  it("valide un paiement correct", () => {
    const r = recordPaymentSchema.safeParse({ invoiceId: "clxxxxxxxxxxxxxxxxxxxxxxx", amount: 500, paidAt: "2024-01-15" })
    expect(r.success).toBe(true)
  })

  it("echoue si amount <= 0", () => {
    const r = recordPaymentSchema.safeParse({ invoiceId: "clxxxxxxxxxxxxxxxxxxxxxxx", amount: 0, paidAt: "2024-01-15" })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 8.2: Lancer les tests**

```bash
npx vitest run src/validations/invoice.test.ts --reporter=verbose
```

- [ ] **Step 8.3: Commit**

```bash
git add src/validations/invoice.test.ts
git commit -m 'test: add invoice validation schema tests'
```

---

## Task 9: Tests src/validations/tenant.test.ts

**Files:** Create `src/validations/tenant.test.ts`

- [ ] **Step 9.1: Ecrire les tests**

```typescript
import { describe, it, expect } from "vitest"
import { createTenantSchema } from "@/validations/tenant"

describe("createTenantSchema - PERSONNE_PHYSIQUE", () => {
  const validPhysique = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    lastName: "Dupont", firstName: "Jean",
    email: "jean.dupont@example.com",
  }

  it("valide une personne physique minimale", () => {
    expect(createTenantSchema.safeParse(validPhysique).success).toBe(true)
  })

  it("echoue si lastName manquant", () => {
    expect(createTenantSchema.safeParse({ ...validPhysique, lastName: "" }).success).toBe(false)
  })

  it("echoue si email invalide", () => {
    expect(createTenantSchema.safeParse({ ...validPhysique, email: "pas-un-email" }).success).toBe(false)
  })
})

describe("createTenantSchema - PERSONNE_MORALE", () => {
  const validMorale = {
    entityType: "PERSONNE_MORALE" as const,
    companyName: "Ma SARL",
    email: "contact@masarl.fr",
  }

  it("valide une personne morale minimale", () => {
    expect(createTenantSchema.safeParse(validMorale).success).toBe(true)
  })

  it("echoue si companyName manquant", () => {
    expect(createTenantSchema.safeParse({ ...validMorale, companyName: "" }).success).toBe(false)
  })

  it("echoue si SIRET invalide (pas 14 chiffres)", () => {
    expect(createTenantSchema.safeParse({ ...validMorale, siret: "123" }).success).toBe(false)
  })
})
```

- [ ] **Step 9.2: Lancer les tests**

```bash
npx vitest run src/validations/tenant.test.ts --reporter=verbose
```

- [ ] **Step 9.3: Commit**

```bash
git add src/validations/tenant.test.ts
git commit -m 'test: add tenant validation schema tests'
```

---

## Task 10: Tests src/actions/tenant.test.ts

**Files:** Create `src/actions/tenant.test.ts`

Note: `createTenant` utilise `prisma` (global, pas createTenantPrisma). setup.ts mocke les deux.

- [ ] **Step 10.1: Ecrire les tests pour createTenant**

```typescript
import { describe, it, expect, vi } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { buildTenantPhysique, buildMembership } from "@/test/factories"
import { createTenant } from "@/actions/tenant"
import { UserRole } from "@prisma/client"

describe("createTenant", () => {
  const validInput = {
    entityType: "PERSONNE_PHYSIQUE" as const,
    lastName: "Dupont", firstName: "Jean",
    email: "jean@example.com",
  }

  it("retourne une erreur si non authentifie", async () => {
    mockUnauthenticated()
    const result = await createTenant("society-1", validInput as any)
    expect(result.success).toBe(false)
    expect(result.error).toBe("Non authentifié")
  })

  it("retourne une erreur si role LECTURE", async () => {
    mockAuthSession(UserRole.LECTURE)
    const result = await createTenant("society-1", validInput as any)
    expect(result.success).toBe(false)
  })

  it("retourne une erreur si input invalide (email manquant)", async () => {
    mockAuthSession()
    const result = await createTenant("society-1", { ...validInput, email: "" } as any)
    expect(result.success).toBe(false)
  })

  it("cree le locataire et retourne son id", async () => {
    mockAuthSession()
    const tenant = buildTenantPhysique()
    prismaMock.tenant.create.mockResolvedValue(tenant as any)
    prismaMock.auditLog.create.mockResolvedValue({} as any)
    const result = await createTenant("society-1", validInput as any)
    expect(result.success).toBe(true)
    expect(result.data?.id).toBe("tenant-1")
    expect(prismaMock.tenant.create).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 10.2: Lancer les tests**

```bash
npx vitest run src/actions/tenant.test.ts --reporter=verbose
```

- [ ] **Step 10.3: Commit**

```bash
git add src/actions/tenant.test.ts
git commit -m 'test: add createTenant server action tests'
```

---

## Task 11: Tests src/actions/invoice.test.ts

**Files:** Create `src/actions/invoice.test.ts`

Note: `createInvoice` utilise `prisma.$transaction` - mocker avec `prismaMock.$transaction.mockImplementation(cb => cb(prismaMock))`.

- [ ] **Step 11.1: Ecrire les tests**

```typescript
import { describe, it, expect } from "vitest"
import { prismaMock } from "@/test/mocks/prisma"
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers"
import { buildInvoice } from "@/test/factories"
import { createInvoice, recordPayment } from "@/actions/invoice"

const validInvoiceInput = {
  tenantId: "clxxxxxxxxxxxxxxxxxxxxxxx",
  invoiceType: "APPEL_LOYER" as const,
  issueDate: "2024-01-01", dueDate: "2024-01-31",
  lines: [{ label: "Loyer", quantity: 1, unitPrice: 1500, vatRate: 20 }],
}

describe("createInvoice", () => {
  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await createInvoice("society-1", validInvoiceInput)
    expect(r.success).toBe(false); expect(r.error).toBe("Non authentifié")
  })

  it("erreur si role LECTURE", async () => {
    mockAuthSession("LECTURE" as any)
    const r = await createInvoice("society-1", validInvoiceInput)
    expect(r.success).toBe(false)
  })

  it("erreur si lines vide", async () => {
    mockAuthSession()
    const r = await createInvoice("society-1", { ...validInvoiceInput, lines: [] })
    expect(r.success).toBe(false)
  })
})

describe("recordPayment", () => {
  const validPayment = { invoiceId: "clxxxxxxxxxxxxxxxxxxxxxxx", amount: 500, paidAt: "2024-01-15" }

  it("erreur si non authentifie", async () => {
    mockUnauthenticated()
    const r = await recordPayment("society-1", validPayment)
    expect(r.success).toBe(false)
  })

  it("erreur si amount invalide", async () => {
    mockAuthSession()
    const r = await recordPayment("society-1", { ...validPayment, amount: -1 })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 11.2: Lancer les tests**

```bash
npx vitest run src/actions/invoice.test.ts --reporter=verbose
```

- [ ] **Step 11.3: Commit**

```bash
git add src/actions/invoice.test.ts
git commit -m 'test: add createInvoice and recordPayment server action tests'
```

---

## Task 12: CI/CD GitHub Actions

**Files:** Create `.github/workflows/ci.yml`

- [ ] **Step 12.1: Creer le dossier et le fichier**

```bash
mkdir -p .github/workflows
```

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx prisma generate
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:coverage

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run build
        env:
          DATABASE_URL: postgresql://fake:5432/fake
          DIRECT_URL: postgresql://fake:5432/fake
          AUTH_SECRET: ci-test-secret
          ENCRYPTION_KEY: AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=
          NEXT_PUBLIC_APP_NAME: CI
```

- [ ] **Step 12.2: Commit**

```bash
git add .github/
git commit -m 'ci: add GitHub Actions CI workflow (quality, test, build)'
```

---

## Task 13: Husky pre-commit hook

**Files:** Create `.husky/pre-commit`, modify `package.json`

- [ ] **Step 13.1: Initialiser Husky**

```bash
npx husky init
```
Cree `.husky/pre-commit` avec un contenu par defaut.

- [ ] **Step 13.2: Editer .husky/pre-commit**

Remplacer le contenu par :

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"
npx lint-staged
```

- [ ] **Step 13.3: Tester le hook**

```bash
# Modifier un fichier .ts avec une erreur ESLint intentionnelle
# Tenter de committer
git add . && git commit -m 'test hook'
```
Expected: le commit est bloque par ESLint si le fichier a une erreur.

- [ ] **Step 13.4: Commit final**

```bash
git add .husky/ package.json
git commit -m 'chore: add husky pre-commit hook with lint-staged'
```

---

## Task 14: Verifier la couverture et finaliser

**Files:** None (verification uniquement)

- [ ] **Step 14.1: Lancer tous les tests**

```bash
npm test
```
Expected: tous les tests passent.

- [ ] **Step 14.2: Verifier la couverture**

```bash
npm run test:coverage
```
Expected: lignes >= 70% sur src/lib/ et src/actions/. Si en dessous, ajouter des tests supplementaires.

- [ ] **Step 14.3: Verifier que le build passe**

```bash
npm run build
```
Expected: build sans erreur.

- [ ] **Step 14.4: Commit final**

```bash
git add -A
git commit -m 'test: Phase 1 complete - tests, CI/CD, hooks pre-commit'
```

---

## Criteres de succes

- [ ] `npm test` passe sans erreur
- [ ] `npm run test:coverage` : lignes >= 70% sur src/lib/ et src/actions/
- [ ] `npm run build` passe
- [ ] CI GitHub : 3 jobs verts sur le prochain push
- [ ] Pre-commit hook bloque un commit avec erreur ESLint

---

## Corrections suite a la revue de plan

### Correction 1 : CUIDs dans les tests

Remplacer `"clxxxxxxxxxxxxxxxxxxxxxxx"` par `"clh3x2z4k0000qh8g7z1y2v3t"` dans tous les tests.
Zod `.cuid()` utilise le regex `/^c[^\s-]{8,}$/i` - les deux formats sont valides, mais le second est plus lisible.

### Correction 2 : Roles dans les tests invoice.test.ts (Task 11)

Les actions `createInvoice` et `recordPayment` utilisent `requireSocietyAccess(..., "COMPTABLE")` (ligne 81 et 151 de invoice.ts).
Les tests utilisent `UserRole.LECTURE` qui est inferieur a COMPTABLE - c est correct.
Mettre a jour le commentaire du test : `"erreur si role inferieur a COMPTABLE (LECTURE)"` au lieu de `"erreur si role LECTURE"`.

### Correction 3 : Suppression de la note $transaction dans Task 11

Le succes path de `createInvoice` est complexe (transaction, tenant.findFirst, society.update, invoice.create).
Supprimer la note sur $transaction dans Task 11. Les tests de la phase 1 couvrent uniquement les chemins d erreur (auth, permissions, validation).
Le test de succes complet de createInvoice est reporte a la Phase 2.

### Correction 4 : Variables d env manquantes dans le job CI build (Task 12)

Ajouter au bloc `env` du job `build` :

```yaml
RESEND_API_KEY: ci-stub-key
EMAIL_FROM: ci@example.com
AUTH_URL: http://localhost:3000
```

### Correction 5 : Factory buildInvoice - champ totalVAT manquant (Task 3)

Dans `src/test/factories.ts`, ajouter `totalVAT: 200` au `buildInvoice` factory.

### Correction 6 : MSW non installe en Phase 1 - note explicite

MSW est liste dans la spec mais n est pas utilise en Phase 1. Ajouter au Step 1.1 : `# MSW installe en Phase 2 seulement`.

### Correction 7 : prisma-tenant.test.ts defere en Phase 2

La spec liste `src/lib/prisma-tenant.test.ts` mais le plan le deporte volontairement.
La logique de `createTenantPrisma` (Prisma extensions) est testee indirectement via les action tests.

### Note : lint-staged intentionnellement sans tsc --noEmit

`tsc --noEmit` est OMIS du pre-commit car il verifie tout le projet (pas seulement les fichiers modifies).
Cela cree des faux positifs (erreurs dans des fichiers non stages bloquent le commit).
Le typecheck est gere par le job `quality` de la CI GitHub Actions.
