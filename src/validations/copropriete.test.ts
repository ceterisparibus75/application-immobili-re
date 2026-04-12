import { describe, it, expect } from "vitest"
import {
  createCoproprieteSchema,
  updateCoproprieteSchema,
  createCoproLotSchema,
  updateCoproLotSchema,
  createCoproBudgetSchema,
  budgetLineSchema,
  createAssemblySchema,
  updateAssemblySchema,
  createResolutionSchema,
  recordVoteSchema,
} from "@/validations/copropriete"

const VALID_CUID = "clh3x2z4k0000qh8g7z1y2v3t"

/* ─── createCoproprieteSchema ────────────────────────────────────── */

describe("createCoproprieteSchema", () => {
  const valid = {
    name: "Copro Riviera",
    address: "12 avenue du Soleil",
    city: "Nice",
    postalCode: "06000",
    totalTantiemes: 10000,
  }

  it("valide une copropriete correcte", () => {
    const result = createCoproprieteSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("applique le defaut fiscalYearStart a 1", () => {
    const result = createCoproprieteSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.fiscalYearStart).toBe(1)
    }
  })

  it("accepte tous les champs optionnels", () => {
    const result = createCoproprieteSchema.safeParse({
      ...valid,
      fiscalYearStart: 7,
      siret: "12345678901234",
      notes: "Notes importantes",
    })
    expect(result.success).toBe(true)
  })

  it("echoue si name est vide", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, name: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si address est vide", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, address: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si city est vide", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, city: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si postalCode trop court", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, postalCode: "060" })
    expect(result.success).toBe(false)
  })

  it("echoue si totalTantiemes est 0", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, totalTantiemes: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si totalTantiemes est negatif", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, totalTantiemes: -100 })
    expect(result.success).toBe(false)
  })

  it("echoue si totalTantiemes est decimal", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, totalTantiemes: 100.5 })
    expect(result.success).toBe(false)
  })

  it("echoue si fiscalYearStart hors 1-12", () => {
    expect(createCoproprieteSchema.safeParse({ ...valid, fiscalYearStart: 0 }).success).toBe(false)
    expect(createCoproprieteSchema.safeParse({ ...valid, fiscalYearStart: 13 }).success).toBe(false)
  })

  it("echoue si name depasse 200 caracteres", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, name: "x".repeat(201) })
    expect(result.success).toBe(false)
  })

  it("echoue si siret depasse 14 caracteres", () => {
    const result = createCoproprieteSchema.safeParse({ ...valid, siret: "123456789012345" })
    expect(result.success).toBe(false)
  })
})

/* ─── updateCoproprieteSchema ────────────────────────────────────── */

describe("updateCoproprieteSchema", () => {
  it("requiert un id CUID valide", () => {
    const result = updateCoproprieteSchema.safeParse({ id: VALID_CUID })
    expect(result.success).toBe(true)
  })

  it("echoue sans id", () => {
    const result = updateCoproprieteSchema.safeParse({ name: "Nouveau nom" })
    expect(result.success).toBe(false)
  })

  it("echoue avec un id invalide", () => {
    const result = updateCoproprieteSchema.safeParse({ id: "not-a-cuid" })
    expect(result.success).toBe(false)
  })

  it("accepte une mise a jour partielle", () => {
    const result = updateCoproprieteSchema.safeParse({
      id: VALID_CUID,
      name: "Nouveau nom",
    })
    expect(result.success).toBe(true)
  })
})

/* ─── createCoproLotSchema ───────────────────────────────────────── */

describe("createCoproLotSchema", () => {
  const valid = {
    coproprieteId: VALID_CUID,
    lotNumber: "A1",
    ownerName: "Pierre Martin",
    tantiemes: 500,
  }

  it("valide un lot de copropriete correct", () => {
    const result = createCoproLotSchema.safeParse(valid)
    expect(result.success).toBe(true)
  })

  it("accepte tous les champs optionnels", () => {
    const result = createCoproLotSchema.safeParse({
      ...valid,
      ownerEmail: "pierre@test.com",
      description: "RDC gauche",
      floor: "0",
      area: 65.5,
    })
    expect(result.success).toBe(true)
  })

  it("accepte ownerEmail vide (empty string)", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, ownerEmail: "" })
    expect(result.success).toBe(true)
  })

  it("echoue si ownerEmail est invalide", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, ownerEmail: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("echoue si lotNumber est vide", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, lotNumber: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si ownerName est vide", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, ownerName: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si tantiemes est 0", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, tantiemes: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si coproprieteId n'est pas un CUID", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, coproprieteId: "invalid" })
    expect(result.success).toBe(false)
  })

  it("echoue si area est negatif", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, area: -10 })
    expect(result.success).toBe(false)
  })

  it("echoue si area est 0", () => {
    const result = createCoproLotSchema.safeParse({ ...valid, area: 0 })
    expect(result.success).toBe(false)
  })
})

/* ─── updateCoproLotSchema ───────────────────────────────────────── */

describe("updateCoproLotSchema", () => {
  it("requiert un id CUID valide", () => {
    const result = updateCoproLotSchema.safeParse({ id: VALID_CUID })
    expect(result.success).toBe(true)
  })

  it("echoue sans id", () => {
    const result = updateCoproLotSchema.safeParse({ lotNumber: "B2" })
    expect(result.success).toBe(false)
  })
})

/* ─── budgetLineSchema ───────────────────────────────────────────── */

describe("budgetLineSchema", () => {
  it("valide une ligne de budget correcte", () => {
    const result = budgetLineSchema.safeParse({
      category: "Entretien",
      label: "Nettoyage parties communes",
      amount: 3500,
    })
    expect(result.success).toBe(true)
  })

  it("echoue si category est vide", () => {
    const result = budgetLineSchema.safeParse({
      category: "",
      label: "Test",
      amount: 100,
    })
    expect(result.success).toBe(false)
  })

  it("echoue si label est vide", () => {
    const result = budgetLineSchema.safeParse({
      category: "Cat",
      label: "",
      amount: 100,
    })
    expect(result.success).toBe(false)
  })

  it("echoue si amount est negatif", () => {
    const result = budgetLineSchema.safeParse({
      category: "Cat",
      label: "Test",
      amount: -50,
    })
    expect(result.success).toBe(false)
  })

  it("accepte description optionnelle", () => {
    const result = budgetLineSchema.safeParse({
      category: "Cat",
      label: "Test",
      amount: 100,
      description: "Details",
    })
    expect(result.success).toBe(true)
  })
})

/* ─── createCoproBudgetSchema ────────────────────────────────────── */

describe("createCoproBudgetSchema", () => {
  const validBudget = {
    coproprieteId: VALID_CUID,
    year: 2025,
    totalAmount: 50000,
    lines: [{ category: "Entretien", label: "Nettoyage", amount: 5000 }],
  }

  it("valide un budget correct", () => {
    const result = createCoproBudgetSchema.safeParse(validBudget)
    expect(result.success).toBe(true)
  })

  it("echoue si lines est vide", () => {
    const result = createCoproBudgetSchema.safeParse({ ...validBudget, lines: [] })
    expect(result.success).toBe(false)
  })

  it("echoue si year est hors limites", () => {
    expect(createCoproBudgetSchema.safeParse({ ...validBudget, year: 2019 }).success).toBe(false)
    expect(createCoproBudgetSchema.safeParse({ ...validBudget, year: 2051 }).success).toBe(false)
  })

  it("echoue si totalAmount est negatif", () => {
    const result = createCoproBudgetSchema.safeParse({ ...validBudget, totalAmount: -1 })
    expect(result.success).toBe(false)
  })

  it("accepte notes optionnelles", () => {
    const result = createCoproBudgetSchema.safeParse({ ...validBudget, notes: "Budget prévisionnel" })
    expect(result.success).toBe(true)
  })

  it("echoue si notes depasse 5000 caracteres", () => {
    const result = createCoproBudgetSchema.safeParse({
      ...validBudget,
      notes: "x".repeat(5001),
    })
    expect(result.success).toBe(false)
  })
})

/* ─── createAssemblySchema ───────────────────────────────────────── */

describe("createAssemblySchema", () => {
  const validAssembly = {
    coproprieteId: VALID_CUID,
    title: "AG annuelle 2025",
    date: "2025-06-15",
  }

  it("valide une assemblee correcte", () => {
    const result = createAssemblySchema.safeParse(validAssembly)
    expect(result.success).toBe(true)
  })

  it("applique les defauts type, isOnline, quorumRequired", () => {
    const result = createAssemblySchema.safeParse(validAssembly)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe("ORDINAIRE")
      expect(result.data.isOnline).toBe(false)
      expect(result.data.quorumRequired).toBe(0.5)
    }
  })

  it("accepte les 3 types d'assemblee", () => {
    for (const type of ["ORDINAIRE", "EXTRAORDINAIRE", "MIXTE"]) {
      const result = createAssemblySchema.safeParse({ ...validAssembly, type })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si type invalide", () => {
    const result = createAssemblySchema.safeParse({ ...validAssembly, type: "INVALID" })
    expect(result.success).toBe(false)
  })

  it("echoue si title est vide", () => {
    const result = createAssemblySchema.safeParse({ ...validAssembly, title: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si date est vide", () => {
    const result = createAssemblySchema.safeParse({ ...validAssembly, date: "" })
    expect(result.success).toBe(false)
  })

  it("accepte quorumRequired entre 0 et 1", () => {
    expect(createAssemblySchema.safeParse({ ...validAssembly, quorumRequired: 0 }).success).toBe(true)
    expect(createAssemblySchema.safeParse({ ...validAssembly, quorumRequired: 1 }).success).toBe(true)
    expect(createAssemblySchema.safeParse({ ...validAssembly, quorumRequired: 0.33 }).success).toBe(true)
  })

  it("echoue si quorumRequired > 1", () => {
    const result = createAssemblySchema.safeParse({ ...validAssembly, quorumRequired: 1.1 })
    expect(result.success).toBe(false)
  })

  it("echoue si quorumRequired < 0", () => {
    const result = createAssemblySchema.safeParse({ ...validAssembly, quorumRequired: -0.1 })
    expect(result.success).toBe(false)
  })
})

/* ─── updateAssemblySchema ───────────────────────────────────────── */

describe("updateAssemblySchema", () => {
  it("requiert un id CUID valide", () => {
    const result = updateAssemblySchema.safeParse({ id: VALID_CUID })
    expect(result.success).toBe(true)
  })

  it("echoue sans id", () => {
    const result = updateAssemblySchema.safeParse({ title: "Nouveau titre" })
    expect(result.success).toBe(false)
  })
})

/* ─── createResolutionSchema ─────────────────────────────────────── */

describe("createResolutionSchema", () => {
  const validResolution = {
    assemblyId: VALID_CUID,
    number: 1,
    title: "Approbation des comptes",
  }

  it("valide une resolution correcte", () => {
    const result = createResolutionSchema.safeParse(validResolution)
    expect(result.success).toBe(true)
  })

  it("applique le defaut majority a SIMPLE", () => {
    const result = createResolutionSchema.safeParse(validResolution)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.majority).toBe("SIMPLE")
    }
  })

  it("accepte les 4 types de majorite", () => {
    for (const majority of ["SIMPLE", "ABSOLUE", "DOUBLE", "UNANIMITE"]) {
      const result = createResolutionSchema.safeParse({ ...validResolution, majority })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si title est vide", () => {
    const result = createResolutionSchema.safeParse({ ...validResolution, title: "" })
    expect(result.success).toBe(false)
  })

  it("echoue si number est 0", () => {
    const result = createResolutionSchema.safeParse({ ...validResolution, number: 0 })
    expect(result.success).toBe(false)
  })

  it("echoue si assemblyId invalide", () => {
    const result = createResolutionSchema.safeParse({ ...validResolution, assemblyId: "bad" })
    expect(result.success).toBe(false)
  })
})

/* ─── recordVoteSchema ───────────────────────────────────────────── */

describe("recordVoteSchema", () => {
  const validVote = {
    resolutionId: VALID_CUID,
    lotId: VALID_CUID,
    vote: "POUR",
  }

  it("valide un vote correct", () => {
    const result = recordVoteSchema.safeParse(validVote)
    expect(result.success).toBe(true)
  })

  it("applique le defaut proxy a false", () => {
    const result = recordVoteSchema.safeParse(validVote)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.proxy).toBe(false)
    }
  })

  it("accepte les 3 types de vote", () => {
    for (const vote of ["POUR", "CONTRE", "ABSTENTION"]) {
      const result = recordVoteSchema.safeParse({ ...validVote, vote })
      expect(result.success).toBe(true)
    }
  })

  it("echoue si vote est invalide", () => {
    const result = recordVoteSchema.safeParse({ ...validVote, vote: "MAYBE" })
    expect(result.success).toBe(false)
  })

  it("echoue si resolutionId invalide", () => {
    const result = recordVoteSchema.safeParse({ ...validVote, resolutionId: "bad" })
    expect(result.success).toBe(false)
  })

  it("echoue si lotId invalide", () => {
    const result = recordVoteSchema.safeParse({ ...validVote, lotId: "bad" })
    expect(result.success).toBe(false)
  })

  it("accepte proxy et proxyName", () => {
    const result = recordVoteSchema.safeParse({
      ...validVote,
      proxy: true,
      proxyName: "Marie Delegue",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.proxy).toBe(true)
      expect(result.data.proxyName).toBe("Marie Delegue")
    }
  })
})
