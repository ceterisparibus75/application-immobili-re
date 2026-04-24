// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

import { prismaMock } from "@/test/mocks/prisma";
import { EcheancesPanel } from "./echeances-panel";

// Helpers pour construire des données prisma cohérentes
function msFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 3600 * 1000);
}

function makeLease(overrides: Record<string, unknown> = {}) {
  return {
    id: "lease-1",
    endDate: msFromNow(20),
    tenant: { firstName: "Alice", lastName: "Martin", companyName: null, entityType: "PERSONNE_PHYSIQUE" },
    lot: { number: "3", building: { name: "Résidence Les Pins" } },
    ...overrides,
  };
}

function makeDiagnostic(overrides: Record<string, unknown> = {}) {
  return {
    id: "diag-1",
    type: "DPE",
    expiresAt: msFromNow(15),
    building: { id: "building-1", name: "Immeuble Alpha" },
    ...overrides,
  };
}

function makeRevision(overrides: Record<string, unknown> = {}) {
  return {
    id: "rev-1",
    effectiveDate: msFromNow(10),
    newRentHT: 850,
    lease: {
      id: "lease-1",
      tenant: { firstName: "Alice", lastName: "Martin", companyName: null, entityType: "PERSONNE_PHYSIQUE" },
    },
    ...overrides,
  };
}

// Rendu d'un async Server Component : on l'appelle comme une fonction async
async function renderPanel(props: { societyId?: string; societyIds?: string[] } = {}) {
  const element = await EcheancesPanel(props);
  return render(<React.Fragment>{element}</React.Fragment>);
}

describe("EcheancesPanel", () => {
  beforeEach(() => {
    prismaMock.lease.findMany.mockResolvedValue([]);
    prismaMock.diagnostic.findMany.mockResolvedValue([]);
    prismaMock.rentRevision.findMany.mockResolvedValue([]);
  });

  it("retourne null si aucun societyId fourni", async () => {
    const { container } = await renderPanel({});
    expect(container).toBeEmptyDOMElement();
  });

  it("retourne null si societyIds est un tableau vide", async () => {
    const { container } = await renderPanel({ societyIds: [] });
    expect(container).toBeEmptyDOMElement();
  });

  it("retourne null si tous les tableaux sont vides", async () => {
    const { container } = await renderPanel({ societyId: "soc-1" });
    expect(container).toBeEmptyDOMElement();
  });

  it("affiche la section Urgent pour un bail expirant dans ≤30 jours", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease({ id: "l1" })] as never);
    await renderPanel({ societyId: "soc-1" });
    expect(screen.getByText(/Urgent/i)).toBeInTheDocument();
    // Le label du bail est "Bail — Alice Martin" → cherche la sous-chaîne
    expect(screen.getByText(/Alice Martin/)).toBeInTheDocument();
  });

  it("affiche la section À venir pour un bail expirant dans >30 jours", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease({ id: "l2", endDate: msFromNow(60) })] as never);
    await renderPanel({ societyId: "soc-1" });
    expect(screen.getByText(/À venir/i)).toBeInTheDocument();
  });

  it("affiche le nom du locataire dans le label du bail", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease()] as never);
    await renderPanel({ societyId: "soc-1" });
    // Label: "Bail — Alice Martin"
    expect(screen.getByText(/Alice Martin/)).toBeInTheDocument();
  });

  it("affiche le nom de la société (personne morale) dans le label", async () => {
    prismaMock.lease.findMany.mockResolvedValue([
      makeLease({ tenant: { firstName: null, lastName: null, companyName: "SCI Bellevue", entityType: "PERSONNE_MORALE" } }),
    ] as never);
    await renderPanel({ societyId: "soc-1" });
    // Label: "Bail — SCI Bellevue"
    expect(screen.getByText(/SCI Bellevue/)).toBeInTheDocument();
  });

  it("le lien du bail pointe vers /baux/[id]", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease({ id: "lease-xyz" })] as never);
    await renderPanel({ societyId: "soc-1" });
    const links = screen.getAllByRole("link");
    const bauxLink = links.find((l) => l.getAttribute("href")?.startsWith("/baux/"));
    expect(bauxLink).toBeDefined();
    expect(bauxLink!.getAttribute("href")).toBe("/baux/lease-xyz");
  });

  it("affiche le type de diagnostic et le nom de l'immeuble", async () => {
    prismaMock.diagnostic.findMany.mockResolvedValue([makeDiagnostic()] as never);
    await renderPanel({ societyId: "soc-1" });
    expect(screen.getByText(/Diagnostic DPE/)).toBeInTheDocument();
    expect(screen.getByText(/Immeuble Alpha/)).toBeInTheDocument();
  });

  it("le lien du diagnostic pointe vers /patrimoine/immeubles/[buildingId]", async () => {
    prismaMock.diagnostic.findMany.mockResolvedValue([makeDiagnostic({ building: { id: "bld-42", name: "Immeuble A" } })] as never);
    await renderPanel({ societyId: "soc-1" });
    const links = screen.getAllByRole("link");
    const diagLink = links.find((l) => l.getAttribute("href")?.includes("bld-42"));
    expect(diagLink).toBeDefined();
    expect(diagLink!.getAttribute("href")).toBe("/patrimoine/immeubles/bld-42");
  });

  it("affiche la révision avec le nom du locataire dans le label", async () => {
    prismaMock.rentRevision.findMany.mockResolvedValue([makeRevision()] as never);
    await renderPanel({ societyId: "soc-1" });
    // Label: "Révision à valider — Alice Martin"
    expect(screen.getByText(/Révision à valider — Alice Martin/)).toBeInTheDocument();
  });

  it("le lien de révision pointe vers /baux/[leaseId]#loyer", async () => {
    prismaMock.rentRevision.findMany.mockResolvedValue([
      makeRevision({ lease: { id: "lease-rev-1", tenant: { firstName: "Alice", lastName: "Martin", companyName: null, entityType: "PERSONNE_PHYSIQUE" } } }),
    ] as never);
    await renderPanel({ societyId: "soc-1" });
    const links = screen.getAllByRole("link");
    const revLink = links.find((l) => l.getAttribute("href")?.includes("#loyer"));
    expect(revLink).toBeDefined();
    expect(revLink!.getAttribute("href")).toBe("/baux/lease-rev-1#loyer");
  });

  it("affiche le badge J-Xj pour le nombre de jours restants", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease({ endDate: msFromNow(15) })] as never);
    await renderPanel({ societyId: "soc-1" });
    expect(screen.getByText("J-15j")).toBeInTheDocument();
  });

  it("accepte societyIds[] et affiche les items", async () => {
    prismaMock.lease.findMany.mockResolvedValue([makeLease()] as never);
    await renderPanel({ societyIds: ["soc-1", "soc-2"] });
    expect(screen.getByText(/Alice Martin/)).toBeInTheDocument();
  });
});
