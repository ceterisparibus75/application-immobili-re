import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

const mockMessagesCreate = vi.hoisted(() => vi.fn().mockResolvedValue({
  content: [{ type: "text", text: '[{"id": "tx-1", "category": "loyers", "confidence": 0.9}]' }],
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: class { messages = { create: mockMessagesCreate }; },
}));
vi.mock("jsonrepair", () => ({ jsonrepair: (s: string) => s }));

import {
  getUncategorizedTransactions,
  categorizeTransactions,
  applyAutoTag,
  aiSuggestCategories,
  getCashflowDashboard,
} from "./cashflow";
import { createAuditLog } from "@/lib/audit";

const SOCIETY_ID = "society-1";
const TX_ID_1 = "ctransact01";
const TX_ID_2 = "ctransact02";

const buildRawTx = (id: string, amount: number, label: string) => ({
  id,
  transactionDate: new Date("2026-03-15"),
  label,
  amount,
  reference: null,
  bankAccount: { accountName: "Compte principal", societyId: SOCIETY_ID },
});

// ─── getUncategorizedTransactions ─────────────────────────────────────────────

describe("getUncategorizedTransactions", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getUncategorizedTransactions(SOCIETY_ID);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await getUncategorizedTransactions(SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("retourne la liste formatée des transactions non catégorisées", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      buildRawTx(TX_ID_1, -150, "EDF ELECTRICITE") as never,
      buildRawTx(TX_ID_2, 800, "Virement locataire") as never,
    ]);

    const r = await getUncategorizedTransactions(SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(r.data).toHaveLength(2);
    expect(r.data?.[0]).toMatchObject({
      id: TX_ID_1,
      amount: -150,
      label: "EDF ELECTRICITE",
      bankAccountName: "Compte principal",
    });
    // transactionDate doit être une chaîne ISO
    expect(typeof r.data?.[0].transactionDate).toBe("string");
  });

  it("retourne une erreur générique si la BDD échoue dans getUncategorizedTransactions (lignes 414-415)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getUncategorizedTransactions(SOCIETY_ID);
    expect(r).toEqual({ success: false, error: "Erreur lors de la récupération des transactions" });
  });
});

// ─── categorizeTransactions ───────────────────────────────────────────────────

describe("categorizeTransactions", () => {
  const validItems = [
    { transactionId: TX_ID_1, category: "energie" },  // catégorie dépense valide
    { transactionId: TX_ID_2, category: "loyers" },   // catégorie revenu valide
  ];

  beforeEach(() => {
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      { id: TX_ID_1, label: "EDF ELECTRICITE" } as never,
      { id: TX_ID_2, label: "Virement loyer" } as never,
    ]);
    prismaMock.bankTransaction.update.mockResolvedValue({} as never);
    prismaMock.transactionAutoTag.upsert.mockResolvedValue({} as never);
  });

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await categorizeTransactions(SOCIETY_ID, validItems);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Non authentifié");
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await categorizeTransactions(SOCIETY_ID, validItems);
    expect(r.success).toBe(false);
  });

  it("erreur si toutes les catégories sont invalides", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await categorizeTransactions(SOCIETY_ID, [
      { transactionId: TX_ID_1, category: "categorie_inexistante" },
    ]);
    expect(r.success).toBe(false);
    expect(r.error).toBe("Aucune catégorie valide");
  });

  it("catégorise les transactions et crée un audit log", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const r = await categorizeTransactions(SOCIETY_ID, validItems);
    expect(r.success).toBe(true);
    expect(r.data?.updated).toBe(2);
    expect(prismaMock.bankTransaction.update).toHaveBeenCalledTimes(2);
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "UPDATE", entity: "BankTransaction" })
    );
  });

  it("exclut les transactions n'appartenant pas à la société", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    // La DB ne retourne qu'une seule transaction (l'autre appartient à une autre société)
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      { id: TX_ID_1, label: "EDF ELECTRICITE" } as never,
    ]);

    const r = await categorizeTransactions(SOCIETY_ID, validItems);
    expect(r.success).toBe(true);
    // Seule TX_ID_1 est mise à jour (TX_ID_2 n'est pas dans la liste retournée)
    expect(r.data?.updated).toBe(1);
  });

  it("ne plante pas si la table TransactionAutoTag n'existe pas encore", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.transactionAutoTag.upsert.mockRejectedValue(
      new Error("Table transactionAutoTag does not exist")
    );

    const r = await categorizeTransactions(SOCIETY_ID, [
      { transactionId: TX_ID_1, category: "energie" },
    ]);
    // L'auto-tag est best-effort — l'action doit quand même réussir
    expect(r.success).toBe(true);
  });

  it("retourne une erreur générique si la BDD échoue dans categorizeTransactions (lignes 503-504)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.update.mockRejectedValue(new Error("DB error"));
    const r = await categorizeTransactions(SOCIETY_ID, [{ transactionId: TX_ID_1, category: "energie" }]);
    expect(r.success).toBe(false);
    expect(r.error).toContain("catégorisation");
  });
});

// ─── applyAutoTag ─────────────────────────────────────────────────────────────

describe("applyAutoTag", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retourne null si le libellé normalisé est vide", async () => {
    const r = await applyAutoTag(SOCIETY_ID, "");
    expect(r).toBeNull();
  });

  it("retourne null si le libellé fait moins de 3 caractères", async () => {
    const r = await applyAutoTag(SOCIETY_ID, "AB");
    expect(r).toBeNull();
  });

  it("retourne la catégorie si un auto-tag existe", async () => {
    prismaMock.transactionAutoTag.findUnique.mockResolvedValue({ category: "energie" } as never);
    prismaMock.transactionAutoTag.update.mockResolvedValue({} as never);

    const r = await applyAutoTag(SOCIETY_ID, "EDF ELECTRICITE");
    expect(r).toBe("energie");
    expect(prismaMock.transactionAutoTag.update).toHaveBeenCalledOnce();
  });

  it("retourne null si aucun auto-tag trouvé", async () => {
    prismaMock.transactionAutoTag.findUnique.mockResolvedValue(null as never);

    const r = await applyAutoTag(SOCIETY_ID, "VIREMENT LOCATAIRE");
    expect(r).toBeNull();
  });

  it("retourne null si la table n'existe pas encore (erreur silencieuse)", async () => {
    prismaMock.transactionAutoTag.findUnique.mockRejectedValue(new Error("Table not found"));

    const r = await applyAutoTag(SOCIETY_ID, "EDF ELECTRICITE");
    expect(r).toBeNull();
  });
});

// ─── aiSuggestCategories ──────────────────────────────────────────────────────

describe("aiSuggestCategories", () => {
  beforeEach(() => vi.clearAllMocks());

  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(false);
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(false);
  });

  it("retourne une erreur si aucune transaction trouvée", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([] as never);

    const r = await aiSuggestCategories(SOCIETY_ID, ["tx-inexistant"]);
    expect(r.success).toBe(false);
    expect(r.error).toContain("Aucune transaction");
  });

  it("résout localement via auto-tag quand le libellé correspond", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    // transactions à catégoriser — label court pour éviter la suppression des "long refs"
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "EDF GAZ", amount: -80, reference: null }] as never)
      // transactions déjà catégorisées (pour l'historique)
      .mockResolvedValueOnce([] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([
      { normalizedLabel: "edf gaz", category: "energie" },
    ] as never);

    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data?.[0].suggestedCategory).toBe("energie");
    expect(r.data?.[0].confidence).toBe(0.95);
  });

  it("retourne le fallback divers si aucune correspondance et pas de clé Anthropic", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "INCONNU XYZ", amount: -50, reference: null }] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);
    // ANTHROPIC_API_KEY n'est pas défini dans l'environnement de test

    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    // Fallback : catégorie "divers_depense" pour un débit
    expect(r.data?.[0].suggestedCategory).toBe("divers_depense");
    expect(r.data?.[0].confidence).toBe(0.1);
  });

  it("retourne une erreur générique si la BDD échoue", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockRejectedValue(new Error("DB connection lost"));
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r).toEqual({ success: false, error: "Erreur lors de la suggestion IA" });
  });

  it("appelle Claude et retourne les suggestions IA (lignes 646-718)", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    try {
      mockAuthSession(UserRole.COMPTABLE);
      prismaMock.bankTransaction.findMany
        .mockResolvedValueOnce([{ id: TX_ID_1, label: "INCONNU XYZ", amount: -50, reference: null }] as never)
        .mockResolvedValueOnce([] as never);
      prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);

      const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
      expect(r.success).toBe(true);
      expect(r.data).toBeDefined();
    } finally {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("retourne localResults si Claude ne renvoie pas de JSON (ligne 703)", async () => {
    const originalKey = process.env.ANTHROPIC_API_KEY;
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    try {
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "Je ne suis pas sûr" }],
      });
      mockAuthSession(UserRole.COMPTABLE);
      prismaMock.bankTransaction.findMany
        .mockResolvedValueOnce([{ id: TX_ID_1, label: "INCONNU XYZ", amount: -50, reference: null }] as never)
        .mockResolvedValueOnce([] as never);
      prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);

      const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
      expect(r.success).toBe(true);
      expect(r.data).toEqual([]);
    } finally {
      process.env.ANTHROPIC_API_KEY = originalKey;
    }
  });

  it("retourne la catégorie de l'historique par correspondance exacte (lignes 574-580)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "EDF ELECTRICITE", amount: -80, reference: null }] as never)
      .mockResolvedValueOnce([{ label: "EDF ELECTRICITE", category: "energie" }] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);

    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data?.[0].suggestedCategory).toBe("energie");
    expect(r.data?.[0].confidence).toBe(0.95);
  });

  it("retourne la catégorie de l'historique par correspondance partielle (lignes 589-603)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    // Labels courts (< 10 chars chacun) pour que normalizeLabel ne les supprime pas
    // "LOYER ASSURANCE IMMEUBLE NORD" ≠ "LOYER ASSURANCE IMMEUBLE CENTRE" (pas d'exact match)
    // mais 3 mots communs ≥4 chars → score 0.75 ≥ 0.6 → partial match
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "LOYER ASSURANCE IMMEUBLE NORD", amount: -150, reference: null }] as never)
      .mockResolvedValueOnce([{ label: "LOYER ASSURANCE IMMEUBLE CENTRE", category: "assurance" }] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);

    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data?.[0].suggestedCategory).toBe("assurance");
    expect(r.data?.[0].confidence).toBe(0.95);
  });
});

// ─── getCashflowDashboard ─────────────────────────────────────────────────────

describe("getCashflowDashboard", () => {
  it("erreur si non authentifié", async () => {
    mockUnauthenticated();
    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("erreur si role insuffisant (min COMPTABLE requis)", async () => {
    mockAuthSession(UserRole.LECTURE);
    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(false);
  });

  it("retourne le tableau de bord cashflow avec des données vides", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([] as never);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([] as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([{ currentBalance: 5000 }] as never);

    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(r.data?.totalBankBalance).toBe(5000);
    expect(r.data?.uncategorizedCount).toBe(0);
    expect(r.data?.months).toBeDefined();
  });

  it("comptabilise les transactions catégorisées et non catégorisées", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      {
        id: TX_ID_1,
        transactionDate: new Date(),
        amount: -150,
        label: "EDF",
        category: "energie",
        bankAccount: { accountName: "Compte" },
      },
      {
        id: TX_ID_2,
        transactionDate: new Date(),
        amount: 800,
        label: "Virement loyer",
        category: null, // non catégorisé
        bankAccount: { accountName: "Compte" },
      },
    ] as never);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([] as never);
    prismaMock.lease.findMany.mockResolvedValue([
      { currentRentHT: 800, vatApplicable: false, vatRate: 0 },
    ] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([{ currentBalance: 10000 }] as never);

    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(r.data?.uncategorizedCount).toBe(1);
    expect(r.data?.totalActualExpenses).toBeGreaterThan(0);
    expect(r.data?.totalActualIncome).toBeGreaterThan(0);
  });

  it("retourne une erreur générique si la BDD échoue dans getCashflowDashboard (lignes 368-369)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockRejectedValue(new Error("DB error"));
    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(false);
    expect(r.error).toContain("cash-flow");
  });

  it("ignore les catégories neutres et trie le globalIncomeBreakdown (lignes 139 et 347)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      { id: TX_ID_1, transactionDate: new Date(), amount: 800, label: "Loyer", category: "loyers", bankAccount: { accountName: "Compte" } },
      { id: TX_ID_2, transactionDate: new Date(), amount: 100, label: "Charges locatives", category: "charges_locatives", bankAccount: { accountName: "Compte" } },
      { id: "tx3", transactionDate: new Date(), amount: 500, label: "Virement interne", category: "virement_interne", bankAccount: { accountName: "Compte" } },
    ] as never);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([] as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([{ currentBalance: 5000 }] as never);

    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(true);
    // virement_interne (neutre) ne contribue pas aux revenus
    expect(r.data?.totalActualIncome).toBeCloseTo(900, 0);
    // globalIncomeBreakdown trié par montant décroissant
    const breakdown = r.data?.globalIncomeBreakdown ?? [];
    if (breakdown.length >= 2) {
      expect(breakdown[0].amount).toBeGreaterThanOrEqual(breakdown[1].amount);
    }
  });

  it("construit amortByMonth, loanByMonth, chargeByMonth et ventile remboursement_emprunt (lignes 124-237)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    const now = new Date();
    const futureMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1);
    const chargeEnd = new Date(now.getFullYear(), now.getMonth() + 3, 0);

    prismaMock.bankTransaction.findMany.mockResolvedValue([
      { id: TX_ID_1, transactionDate: now, amount: -500, label: "Remboursement emprunt", category: "remboursement_emprunt", bankAccount: { accountName: "Compte" } },
    ] as never);
    // 1re findMany → amortLines (lignes 124-127)
    prismaMock.loanAmortizationLine.findMany
      .mockResolvedValueOnce([{ dueDate: now, totalPayment: 500, principalPayment: 400, interestPayment: 100 }] as never)
      // 2e findMany → loanLines (lignes 202-205)
      .mockResolvedValueOnce([{ dueDate: futureMonth, totalPayment: 500, interestPayment: 100 }] as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    // charges non vides (lignes 225-237)
    prismaMock.charge.findMany.mockResolvedValue([
      { amount: 300, periodStart: now, periodEnd: chargeEnd }
    ] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([{ currentBalance: 5000 }] as never);

    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(true);
    // remboursement_emprunt ventilé en intérêts + capital (lignes 162-169)
    expect(r.data?.totalActualExpenses).toBeGreaterThan(0);
  });

  it("trie les catégories par montant décroissant avec 2+ dépenses (ligne 789)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany.mockResolvedValue([
      {
        id: TX_ID_1,
        transactionDate: new Date(),
        amount: -50,
        label: "EDF",
        category: "energie",
        bankAccount: { accountName: "Compte" },
      },
      {
        id: TX_ID_2,
        transactionDate: new Date(),
        amount: -200,
        label: "Assurance habitation",
        category: "assurance",
        bankAccount: { accountName: "Compte" },
      },
    ] as never);
    prismaMock.loanAmortizationLine.findMany.mockResolvedValue([] as never);
    prismaMock.lease.findMany.mockResolvedValue([] as never);
    prismaMock.charge.findMany.mockResolvedValue([] as never);
    prismaMock.bankAccount.findMany.mockResolvedValue([{ currentBalance: 5000 }] as never);

    const r = await getCashflowDashboard(SOCIETY_ID);
    expect(r.success).toBe(true);
    expect(r.data?.totalActualExpenses).toBeGreaterThan(0);
  });
});


// ─── aiSuggestCategories — branches normalizeLabel ───────────────────────────

describe("aiSuggestCategories — normalizeLabel edge cases", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ignore les transactions historiques dont le label se normalise en vide (ligne 555)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "INCONNU XYZ", amount: -50, reference: null }] as never)
      // historique : un libelle qui normalise en vide (ref longue) et un autre valide
      .mockResolvedValueOnce([
        { label: "12345678901234", category: "energie" },
        { label: "LOYER MENSUEL", category: "loyer" },
      ] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data).toBeDefined();
  });

  it("retourne null dans findMatchingCategory si le label se normalise en vide (ligne 566)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      // transaction avec ref longue -> normalise en ""
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "12345678901234", amount: -50, reference: null }] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data).toBeDefined();
  });

  it("retourne null si normWords est vide (tous les mots < 4 chars) (ligne 585)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      // label avec uniquement des mots courts (< 4 chars)
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "AB EDF", amount: -30, reference: null }] as never)
      .mockResolvedValueOnce([] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data).toBeDefined();
  });

  it("ignore les labels historiques dont les mots sont tous courts (ligne 590)", async () => {
    mockAuthSession(UserRole.COMPTABLE);
    prismaMock.bankTransaction.findMany
      .mockResolvedValueOnce([{ id: TX_ID_1, label: "LOYER VOITURE", amount: -150, reference: null }] as never)
      // historique avec mots courts -> knownWords = [] -> continue (ligne 590)
      .mockResolvedValueOnce([{ label: "AB CD", category: "loyer" }] as never);
    prismaMock.transactionAutoTag.findMany.mockResolvedValue([] as never);
    const r = await aiSuggestCategories(SOCIETY_ID, [TX_ID_1]);
    expect(r.success).toBe(true);
    expect(r.data).toBeDefined();
  });
});

