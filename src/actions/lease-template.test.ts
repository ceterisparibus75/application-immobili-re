import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/audit", () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));

import { mockAuthSession, mockUnauthenticated } from "@/test/helpers";
import { prismaMock } from "@/test/mocks/prisma";
import {
  createLeaseTemplate,
  updateLeaseTemplate,
  deleteLeaseTemplate,
  getLeaseTemplates,
  getLeaseTemplateById,
} from "./lease-template";

const SOCIETY_ID = "clh3x2z4k0001qh8g7z1y2v3t";
const TEMPLATE_ID = "clh3x2z4k0002qh8g7z1y2v3t";

const VALID_CREATE_INPUT = {
  name: "Bail résidentiel standard",
  leaseType: "HABITATION" as const,
  content: "Contenu du modèle...",
  isDefault: false,
  isActive: true,
};

beforeEach(() => {
  mockAuthSession("GESTIONNAIRE", SOCIETY_ID);
});

// ── createLeaseTemplate ───────────────────────────────────────────

describe("createLeaseTemplate", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await createLeaseTemplate(SOCIETY_ID, VALID_CREATE_INPUT);
    expect(result.success).toBe(false);
  });

  it("crée un modèle avec succès", async () => {
    prismaMock.leaseTemplate.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.leaseTemplate.create.mockResolvedValue({
      id: TEMPLATE_ID,
      name: "Bail résidentiel standard",
    } as never);

    const result = await createLeaseTemplate(SOCIETY_ID, VALID_CREATE_INPUT);
    expect(result.success).toBe(true);
    expect(result.data?.id).toBe(TEMPLATE_ID);
  });

  it("retire le flag isDefault des autres modèles si isDefault=true", async () => {
    prismaMock.leaseTemplate.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.leaseTemplate.create.mockResolvedValue({ id: TEMPLATE_ID } as never);

    await createLeaseTemplate(SOCIETY_ID, { ...VALID_CREATE_INPUT, isDefault: true });

    expect(prismaMock.leaseTemplate.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isDefault: false } })
    );
  });
});

// ── updateLeaseTemplate ───────────────────────────────────────────

describe("updateLeaseTemplate", () => {
  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await updateLeaseTemplate(SOCIETY_ID, { id: TEMPLATE_ID, name: "Nouveau nom" });
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le modèle est introuvable", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue(null);
    const result = await updateLeaseTemplate(SOCIETY_ID, { id: TEMPLATE_ID, name: "Nouveau nom" });
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("met à jour un modèle avec succès", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue({
      id: TEMPLATE_ID,
      isDefault: false,
      leaseType: "HABITATION",
    } as never);
    prismaMock.leaseTemplate.update.mockResolvedValue({ id: TEMPLATE_ID } as never);

    const result = await updateLeaseTemplate(SOCIETY_ID, { id: TEMPLATE_ID, name: "Nouveau nom" });
    expect(result.success).toBe(true);
  });
});

// ── deleteLeaseTemplate ───────────────────────────────────────────

describe("deleteLeaseTemplate", () => {
  beforeEach(() => {
    mockAuthSession("ADMIN_SOCIETE", SOCIETY_ID);
  });

  it("retourne une erreur si non authentifié", async () => {
    mockUnauthenticated();
    const result = await deleteLeaseTemplate(SOCIETY_ID, TEMPLATE_ID);
    expect(result.success).toBe(false);
  });

  it("retourne une erreur si le modèle est introuvable", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue(null);
    const result = await deleteLeaseTemplate(SOCIETY_ID, TEMPLATE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain("introuvable");
  });

  it("désactive le modèle si des baux y sont rattachés", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue({
      id: TEMPLATE_ID,
      _count: { leases: 3 },
    } as never);
    prismaMock.leaseTemplate.update.mockResolvedValue({ id: TEMPLATE_ID } as never);

    const result = await deleteLeaseTemplate(SOCIETY_ID, TEMPLATE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.leaseTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false, isDefault: false } })
    );
    expect(prismaMock.leaseTemplate.delete).not.toHaveBeenCalled();
  });

  it("supprime le modèle si aucun bail n'y est rattaché", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue({
      id: TEMPLATE_ID,
      _count: { leases: 0 },
    } as never);
    prismaMock.leaseTemplate.delete.mockResolvedValue({ id: TEMPLATE_ID } as never);

    const result = await deleteLeaseTemplate(SOCIETY_ID, TEMPLATE_ID);
    expect(result.success).toBe(true);
    expect(prismaMock.leaseTemplate.delete).toHaveBeenCalled();
  });
});

// ── getLeaseTemplates ─────────────────────────────────────────────

describe("getLeaseTemplates", () => {
  it("retourne un tableau vide si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseTemplates(SOCIETY_ID);
    expect(result).toEqual([]);
  });

  it("retourne les modèles actifs de la société", async () => {
    prismaMock.leaseTemplate.findMany.mockResolvedValue([
      { id: TEMPLATE_ID, name: "Bail standard" },
    ] as never);
    const result = await getLeaseTemplates(SOCIETY_ID);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(TEMPLATE_ID);
  });

  it("filtre par type de bail si leaseType est fourni", async () => {
    prismaMock.leaseTemplate.findMany.mockResolvedValue([]);
    await getLeaseTemplates(SOCIETY_ID, "HABITATION");
    expect(prismaMock.leaseTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leaseType: "HABITATION" }),
      })
    );
  });
});

// ── getLeaseTemplateById ──────────────────────────────────────────

describe("getLeaseTemplateById", () => {
  it("retourne null si non authentifié", async () => {
    mockUnauthenticated();
    const result = await getLeaseTemplateById(SOCIETY_ID, TEMPLATE_ID);
    expect(result).toBeNull();
  });

  it("retourne le modèle si trouvé", async () => {
    prismaMock.leaseTemplate.findFirst.mockResolvedValue({
      id: TEMPLATE_ID,
      name: "Bail standard",
    } as never);
    const result = await getLeaseTemplateById(SOCIETY_ID, TEMPLATE_ID);
    expect(result?.id).toBe(TEMPLATE_ID);
  });
});
