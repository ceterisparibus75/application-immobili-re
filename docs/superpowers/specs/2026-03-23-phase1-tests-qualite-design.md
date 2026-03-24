# Spec — Phase 1 : Tests & Qualité

**Date :** 2026-03-23
**Projet :** Application de gestion immobilière (Next.js 16, Prisma 6, NextAuth v5)
**Approche retenue :** Vitest + vitest-mock-extended + React Testing Library + MSW + Husky

---

## Contexte

L'application est fonctionnelle mais ne dispose d'aucun test. La Phase 1 établit l'infrastructure de tests et les premiers tests unitaires sur les couches les plus critiques (lib, validations, Server Actions). Elle installe aussi la CI/CD et les hooks pre-commit.

---

## Architecture des fichiers

```
src/test/
├── setup.ts              # Config globale : env vars, mocks NextAuth, mock Prisma
├── factories.ts          # Builders typés (User, Society, Building, Lot, Lease, Tenant, Invoice)
├── helpers.tsx           # mockAuthSession(), render() avec providers
└── mocks/
    └── prisma.ts         # mockDeep<PrismaClient>() avec reset beforeEach

src/lib/permissions.test.ts
src/lib/encryption.test.ts
src/lib/utils.test.ts
src/lib/prisma-tenant.test.ts
src/validations/*.test.ts       # Un fichier par module Zod
src/actions/lease.test.ts
src/actions/invoice.test.ts
src/actions/payment.test.ts
src/actions/tenant.test.ts

vitest.config.ts                # Racine du projet
.github/workflows/ci.yml
.husky/pre-commit
```

---

## Dépendances à installer

```bash
npm install -D vitest @vitest/coverage-v8 vitest-mock-extended
npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
npm install -D msw jsdom
npm install -D husky lint-staged
```

---

## vitest.config.ts

```typescript
import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    environmentMatchGlobs: [
      ['src/components/**', 'jsdom'],
      ['src/**', 'node'],
    ],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**', 'src/actions/**', 'src/validations/**'],
      thresholds: { lines: 70, functions: 70 },
    },
    alias: { '@': resolve(__dirname, './src') },
  },
})
```

---

## src/test/mocks/prisma.ts

```typescript
import { mockDeep, mockReset } from 'vitest-mock-extended'
import type { PrismaClient } from '@prisma/client'
import { beforeEach } from 'vitest'

export const prismaMock = mockDeep<PrismaClient>()
beforeEach(() => mockReset(prismaMock))
```

---

## src/test/setup.ts

```typescript
import { vi } from 'vitest'
import { prismaMock } from './mocks/prisma'

process.env.ENCRYPTION_KEY = Buffer.alloc(32).toString('base64')
process.env.DATABASE_URL = 'postgresql://test'
process.env.AUTH_SECRET = 'test-secret'

vi.mock('next-auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
```

---

## src/test/factories.ts

Builders typés avec valeurs par défaut surchargeables :

| Factory | Champs couverts |
|---------|----------------|
| `buildUser()` | id, name, email, password, dates |
| `buildSociety()` | id, name, siret, isActive, dates |
| `buildMembership(role)` | userId, societyId, role |
| `buildBuilding()` | id, societyId, name, address, type |
| `buildLot()` | id, buildingId, societyId, number, surface, type |
| `buildLease()` | id, lotId, tenantId, societyId, startDate, rent, status |
| `buildTenant()` | id, societyId, firstName, lastName, email |
| `buildInvoice()` | id, societyId, leaseId, amount, status, type |

---

## src/test/helpers.tsx

```typescript
export function mockAuthSession(role = 'GESTIONNAIRE', societyId = 'society-1') {
  vi.mocked(auth).mockResolvedValue({ user: { id: 'user-1', ... }, expires: '...' })
  prismaMock.userSociety.findUnique.mockResolvedValue(buildMembership(role, { societyId }))
}
```

---

## Scripts npm

```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage"
```

---

## Tests prioritaires

### src/lib/permissions.test.ts
- `hasMinRole()` : toutes combinaisons (SUPER_ADMIN >= tout, LECTURE < tout)
- `requireSocietyAccess()` : accès OK, pas de membership → ForbiddenError, rôle insuffisant → ForbiddenError
- `requireSuperAdmin()` : SUPER_ADMIN OK, tout autre rôle → ForbiddenError

### src/lib/encryption.test.ts
- Round-trip encrypt/decrypt → texte original récupéré
- Deux chiffrements du même texte → IVs différents (aléatoire AES-GCM)
- Format invalide → throws "Invalid encrypted text format"
- ENCRYPTION_KEY absente → throws "ENCRYPTION_KEY is not defined"

### src/lib/utils.test.ts
- `formatCurrency(1234.5)` → "1 234,50 €"
- `formatDate(new Date('2024-01-15'))` → "15/01/2024"
- `formatDateTime` → "15/01/2024 14:30"
- `getLogoProxyUrl(null)` → null, chemin relatif → "/api/storage/view?path=..."
- `cn('a', 'b', false)` → "a b"

### src/validations/*.test.ts
Pour chaque schéma Zod : 3 cas minimum (valide, champ manquant, type incorrect).

### src/actions/*.test.ts (lease, invoice, payment, tenant)
Pattern systématique pour chaque action :
1. Non authentifié → `{ success: false, error: "Non authentifié" }`
2. LECTURE sur action GESTIONNAIRE → `{ success: false, error: "Permissions insuffisantes..." }`
3. Input invalide (Zod) → `{ success: false, error: "..." }`
4. Succès → `{ success: true, data: { id: "..." } }` + vérification que `prisma.X.create` a bien été appelé

---

## CI/CD — .github/workflows/ci.yml

3 jobs parallèles sur chaque push/PR vers main :

```yaml
jobs:
  quality:   # eslint + tsc --noEmit
  test:      # vitest run --coverage (seuil 70%)
  build:     # prisma generate + next build
```

---

## Husky + lint-staged

```json
"lint-staged": {
  "*.{ts,tsx}": ["eslint --fix", "tsc --noEmit --skipLibCheck"]
}
```

---

## Critères de succès

- `npm test` passe sans erreur
- `npm run test:coverage` atteint >= 70% sur `src/lib/` et `src/actions/`
- `npm run build` passe avec les tests en place
- CI GitHub valide sur chaque push
- Pre-commit hook bloque un commit avec une erreur TypeScript
