// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { TodayTasks } from "./today-tasks";

function msFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000);
}
function msAgo(days: number) {
  return new Date(Date.now() - days * 24 * 3600 * 1000);
}

function makeTenant(overrides: Partial<{ firstName: string | null; lastName: string | null; companyName: string | null; entityType: string }> = {}) {
  return { firstName: "Bob", lastName: "Durand", companyName: null, entityType: "PERSONNE_PHYSIQUE", ...overrides };
}

function makeOverdueInvoice(overrides: Record<string, unknown> = {}) {
  return {
    id: "inv-1",
    invoiceNumber: "FAC-2024-001",
    totalTTC: 1200,
    dueDate: msAgo(45),
    lease: { tenant: makeTenant() },
    ...overrides,
  };
}

function makePendingRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: "rev-1",
    effectiveDate: msFromNow(10),
    newRentHT: 900,
    lease: { id: "lease-1", tenant: makeTenant() },
    ...overrides,
  };
}

function makeExpiringLease(overrides: Record<string, unknown> = {}) {
  return {
    id: "lease-2",
    endDate: msFromNow(20),
    lot: { number: "5", building: { name: "Résidence Lumière" } },
    tenant: makeTenant({ firstName: "Claire", lastName: "Blanc" }),
    ...overrides,
  };
}

function makeExpiringDiagnostic(overrides: Record<string, unknown> = {}) {
  return {
    id: "diag-1",
    type: "DPE",
    expiresAt: msFromNow(12),
    building: { id: "bld-1", name: "Tour Central" },
    ...overrides,
  };
}

async function renderTasks(props: { societyId?: string; societyIds?: string[] } = {}) {
  const element = await TodayTasks(props);
  return render(<React.Fragment>{element}</React.Fragment>);
}

describe("TodayTasks", () => {
  beforeEach(() => {
    prismaMock.diagnostic.findMany.mockResolvedValue([]);
    prismaMock.lease.findMany.mockResolvedValue([]);
    prismaMock.invoice.findMany.mockResolvedValue([]);
    prismaMock.rentRevision.findMany.mockResolvedValue([]);
  });

  it("retourne null si aucun societyId fourni", async () => {
    const { container } = await renderTasks({});
    expect(container).toBeEmptyDOMElement();
  });

  it("retourne null si societyIds est un tableau vide", async () => {
    const { container } = await renderTasks({ societyIds: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("retourne null si toutes les listes sont vides (totalTasks = 0)", async () => {
    const { container } = await renderTasks({ societyId: "soc-1" });
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche la section Impayés anciens", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeOverdueInvoice()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText(/Impayés anciens/)).toBeInTheDocument();
  });

  it("affiche le nom du locataire et le numéro de facture pour un impayé", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeOverdueInvoice()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
    expect(screen.getByText(/FAC-2024-001/)).toBeInTheDocument();
  });

  it("le lien de la facture impayée pointe vers /facturation/[id]", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeOverdueInvoice({ id: "inv-xyz" })] as never);
    await renderTasks({ societyId: "soc-1" });
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href")?.includes("inv-xyz"));
    expect(link).toBeDefined();
    expect(link!.getAttribute("href")).toBe("/facturation/inv-xyz");
  });

  it("affiche la section Révisions à valider", async () => {
    prismaMock.rentRevision.findMany.mockResolvedValue([makePendingRevision()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText(/Révisions à valider/)).toBeInTheDocument();
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
  });

  it("le lien de la révision pointe vers /baux/[leaseId]#loyer", async () => {
    prismaMock.rentRevision.findMany.mockResolvedValue([
      makePendingRevision({ lease: { id: "lease-rev-99", tenant: makeTenant() } }),
    ] as never);
    await renderTasks({ societyId: "soc-1" });
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href")?.includes("#loyer"));
    expect(link).toBeDefined();
    expect(link!.getAttribute("href")).toBe("/baux/lease-rev-99#loyer");
  });

  it("affiche la section Baux à renouveler", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeExpiringLease()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText(/Baux à renouveler/)).toBeInTheDocument();
    expect(screen.getByText("Claire Blanc")).toBeInTheDocument();
  });

  it("le lien du bail à renouveler pointe vers /baux/[id]", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeExpiringLease({ id: "bail-999" })] as never);
    await renderTasks({ societyId: "soc-1" });
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/baux/bail-999");
    expect(link).toBeDefined();
  });

  it("affiche la section Diagnostics à renouveler", async () => {
    prismaMock.diagnostic.findMany.mockResolvedValue([makeExpiringDiagnostic()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText(/Diagnostics à renouveler/)).toBeInTheDocument();
    expect(screen.getByText(/Diagnostic DPE/)).toBeInTheDocument();
  });

  it("le lien du diagnostic pointe vers /patrimoine/immeubles/[buildingId]", async () => {
    prismaMock.diagnostic.findMany.mockResolvedValue([makeExpiringDiagnostic({ building: { id: "bld-diag", name: "Tour" } })] as never);
    await renderTasks({ societyId: "soc-1" });
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href")?.includes("bld-diag"));
    expect(link).toBeDefined();
    expect(link!.getAttribute("href")).toBe("/patrimoine/immeubles/bld-diag");
  });

  it("affiche le nom de la société pour un locataire personne morale", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([
      makeOverdueInvoice({ lease: { tenant: makeTenant({ firstName: null, lastName: null, companyName: "SCI Atlas", entityType: "PERSONNE_MORALE" }) } }),
    ] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText("SCI Atlas")).toBeInTheDocument();
  });

  it("affiche plusieurs sections simultanément", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeOverdueInvoice()] as never);
    prismaMock.lease.findMany.mockResolvedValue([makeExpiringLease()] as never);
    await renderTasks({ societyId: "soc-1" });
    expect(screen.getByText(/Impayés anciens/)).toBeInTheDocument();
    expect(screen.getByText(/Baux à renouveler/)).toBeInTheDocument();
  });

  it("accepte societyIds[] et affiche les items", async () => {
    prismaMock.invoice.findMany.mockResolvedValue([makeOverdueInvoice()] as never);
    await renderTasks({ societyIds: ["soc-1", "soc-2"] });
    expect(screen.getByText(/Impayés anciens/)).toBeInTheDocument();
  });
});
