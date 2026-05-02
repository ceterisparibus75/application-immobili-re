import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { prismaMock } from "@/test/mocks/prisma";
import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { createFixedAsset, postFixedAssetDepreciation } from "./fixed-asset";

const SOCIETY_ID = "clh3x2z4k0000qh8g7z1y2v3t";
const ASSET_ID = "clh3x2z4k0001qh8g7z1y2v3u";
const BUILDING_ID = "clh3x2z4k0002qh8g7z1y2v3v";
const ACCOUNT_213 = "clh3x2z4k0003qh8g7z1y2v3w";
const ACCOUNT_281 = "clh3x2z4k0004qh8g7z1y2v3x";
const ACCOUNT_681 = "clh3x2z4k0005qh8g7z1y2v3y";

const validInput = {
  name: "Rénovation toiture",
  category: "FACADE_TOITURE",
  buildingId: BUILDING_ID,
  assetAccountId: ACCOUNT_213,
  depreciationAccountId: ACCOUNT_281,
  expenseAccountId: ACCOUNT_681,
  acquisitionDate: new Date("2026-02-01"),
  serviceStartDate: new Date("2026-03-01"),
  depreciableBase: 12000,
  residualValue: 0,
  durationMonths: 24,
} as const;

describe("createFixedAsset", () => {
  it("retourne une erreur si l'utilisateur n'est pas authentifié", async () => {
    mockUnauthenticated();

    const result = await createFixedAsset(SOCIETY_ID, validInput);

    expect(result.success).toBe(false);
  });

  it("crée une immobilisation avec son plan d'amortissement", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.building.findFirst.mockResolvedValue({ id: BUILDING_ID } as never);
    prismaMock.accountingAccount.findMany.mockResolvedValue([
      { id: ACCOUNT_213, code: "213100", type: "2" },
      { id: ACCOUNT_281, code: "281310", type: "2" },
      { id: ACCOUNT_681, code: "681100", type: "6" },
    ] as never);
    prismaMock.fixedAsset.create.mockResolvedValue({ id: ASSET_ID } as never);

    const result = await createFixedAsset(SOCIETY_ID, validInput);

    expect(result.success).toBe(true);
    const createCall = prismaMock.fixedAsset.create.mock.calls[0][0];
    expect(createCall.data.depreciationLines?.create).toHaveLength(3);
    expect(createCall.data.category).toBe("FACADE_TOITURE");
  });
});

describe("postFixedAssetDepreciation", () => {
  it("génère l'écriture OD de dotation et marque la ligne comme comptabilisée", async () => {
    mockAuthSession("COMPTABLE", SOCIETY_ID);
    prismaMock.fixedAsset.findFirst.mockResolvedValue({
      id: ASSET_ID,
      societyId: SOCIETY_ID,
      name: "Rénovation toiture",
      expenseAccountId: ACCOUNT_681,
      depreciationAccountId: ACCOUNT_281,
      expenseAccount: { id: ACCOUNT_681, code: "681100", label: "Dotations" },
      depreciationAccount: { id: ACCOUNT_281, code: "281310", label: "Amortissements" },
      depreciationLines: [
        {
          id: "line-1",
          fiscalYear: 2026,
          periodEnd: new Date("2026-12-31"),
          amount: 5000,
          status: "PLANNED",
        },
      ],
    } as never);
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => Promise<unknown>) => fn(prismaMock));
    prismaMock.fiscalYear.findFirst.mockResolvedValue(null);
    prismaMock.journalEntry.create.mockResolvedValue({ id: "entry-1" } as never);
    prismaMock.fixedAssetDepreciationLine.count.mockResolvedValue(1);

    const result = await postFixedAssetDepreciation(SOCIETY_ID, { fixedAssetId: ASSET_ID, fiscalYear: 2026 });

    expect(result.success).toBe(true);
    expect(prismaMock.journalEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          journalType: "OD",
          lines: expect.objectContaining({
            create: expect.arrayContaining([
              expect.objectContaining({ accountId: ACCOUNT_681, debit: 5000 }),
              expect.objectContaining({ accountId: ACCOUNT_281, credit: 5000 }),
            ]),
          }),
        }),
      })
    );
    expect(prismaMock.fixedAssetDepreciationLine.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "POSTED", journalEntryId: "entry-1" } })
    );
  });
});
