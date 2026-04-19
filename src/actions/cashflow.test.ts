import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import { UserRole } from "@/generated/prisma/client";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import {
  getUncategorizedTransactions,
  categorizeTransactions,
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
});
