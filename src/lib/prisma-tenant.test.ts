import { describe, it, expect, vi } from "vitest";

// Override the global mock to test the real implementation
vi.unmock("@/lib/prisma-tenant");

const capturedOp: { cb?: (args: { model?: string; operation: string; args: Record<string, unknown>; query: (a: unknown) => unknown }) => unknown } = {};

vi.mock("./prisma", () => ({
  prisma: {
    $extends: vi.fn().mockImplementation((ext: { query: { $allOperations: typeof capturedOp.cb } }) => {
      capturedOp.cb = ext.query.$allOperations;
      return {};
    }),
  },
}));

import { createTenantPrisma } from "./prisma-tenant";

const SOCIETY_ID = "soc-123";

// Initialise la capture du callback
createTenantPrisma(SOCIETY_ID);

function callOp(model: string | undefined, operation: string, args: Record<string, unknown>) {
  const query = vi.fn().mockResolvedValue({ result: true });
  capturedOp.cb!({ model, operation, args, query });
  return query;
}

describe("createTenantPrisma — $allOperations (B0-B7)", () => {
  it("passe args tels quels si model absent ou non scopé (B0 arm0)", () => {
    const query = callOp("Lot", "findMany", { where: {} });
    expect(query).toHaveBeenCalledWith({ where: {} }); // Lot not in MODELS_WITH_DIRECT_SOCIETY_ID
  });

  it("passe args tels quels si model undefined (B0 arm0)", () => {
    const query = callOp(undefined, "findMany", { where: {} });
    expect(query).toHaveBeenCalledWith({ where: {} });
  });

  it("injecte societyId dans where pour findMany (B1 arm0, B2 arm0)", () => {
    const query = callOp("Tenant", "findMany", { where: { isActive: true } });
    expect(query).toHaveBeenCalledWith({ where: { isActive: true, societyId: SOCIETY_ID } });
  });

  it("injecte societyId dans where pour count (B2 arm0)", () => {
    const query = callOp("Invoice", "count", { where: { status: "EN_RETARD" } });
    expect(query).toHaveBeenCalledWith({ where: { status: "EN_RETARD", societyId: SOCIETY_ID } });
  });

  it("injecte societyId dans data pour create (B3 arm0)", () => {
    const query = callOp("Building", "create", { data: { name: "Bat A" } });
    expect(query).toHaveBeenCalledWith({ data: { name: "Bat A", societyId: SOCIETY_ID } });
  });

  it("injecte societyId dans chaque item pour createMany avec tableau (B4 arm0, B5 arm0)", () => {
    const query = callOp("Charge", "createMany", { data: [{ amount: 100 }, { amount: 200 }] });
    expect(query).toHaveBeenCalledWith({
      data: [
        { amount: 100, societyId: SOCIETY_ID },
        { amount: 200, societyId: SOCIETY_ID },
      ],
    });
  });

  it("injecte societyId dans data pour createMany avec objet (B5 arm1)", () => {
    const query = callOp("Charge", "createMany", { data: { amount: 150 } });
    expect(query).toHaveBeenCalledWith({ data: { amount: 150, societyId: SOCIETY_ID } });
  });

  it("injecte societyId dans where pour updateMany (B6 arm0, B7 arm1)", () => {
    const query = callOp("Invoice", "updateMany", { where: { status: "BROUILLON" }, data: { status: "ENVOYEE" } });
    expect(query).toHaveBeenCalledWith({
      where: { status: "BROUILLON", societyId: SOCIETY_ID },
      data: { status: "ENVOYEE" },
    });
  });

  it("lit les modèles à societyId optionnel dans la société ou en partagé", () => {
    const query = callOp("Contact", "findMany", { where: { isActive: true } });
    expect(query).toHaveBeenCalledWith({
      where: {
        AND: [
          { isActive: true },
          { OR: [{ societyId: SOCIETY_ID }, { societyId: null }] },
        ],
      },
    });
  });

  it("borne les écritures des modèles à societyId optionnel à la société courante", () => {
    const query = callOp("Contact", "upsert", { where: { email: "a@b.com" }, create: { email: "a@b.com" }, update: {} });
    expect(query).toHaveBeenCalledWith({
      where: {
        AND: [
          { email: "a@b.com" },
          { societyId: SOCIETY_ID },
        ],
      },
      create: { email: "a@b.com", societyId: SOCIETY_ID },
      update: {},
    });
  });
});
