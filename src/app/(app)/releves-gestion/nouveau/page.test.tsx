// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPush, getThirdPartyManagedLeases, createStatement, useSociety } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  getThirdPartyManagedLeases: vi.fn(),
  createStatement: vi.fn(),
  useSociety: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("@/providers/society-provider", () => ({ useSociety }));

vi.mock("@/actions/third-party-statement", () => ({
  createStatement,
  getThirdPartyManagedLeases,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import NouveauDecompteGestionPage from "./page";

const SOCIETY = {
  id: "society-1",
  name: "SCI Test",
  legalForm: "SCI",
  siret: null,
  city: "Paris",
  isActive: true,
  logoUrl: null,
  role: "ADMIN_SOCIETE",
};

describe("NouveauDecompteGestionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
    useSociety.mockReturnValue({
      activeSociety: SOCIETY,
      societies: [SOCIETY],
      setActiveSociety: vi.fn(),
      isLoading: false,
    });
    getThirdPartyManagedLeases.mockResolvedValue({ success: true, data: { leases: [] } });
  });

  it("monte la page sans boucle de rendu quand aucun bail tiers n'existe", async () => {
    render(<NouveauDecompteGestionPage />);

    expect(screen.getByRole("heading", { name: /nouveau décompte de gestion/i })).toBeInTheDocument();
    await waitFor(() => expect(getThirdPartyManagedLeases).toHaveBeenCalledWith("society-1"));
    expect(await screen.findByText(/Aucun bail géré par un tiers trouvé/i)).toBeInTheDocument();
  });

  it("monte la page sans boucle de rendu avec des baux tiers", async () => {
    getThirdPartyManagedLeases.mockResolvedValue({
      success: true,
      data: {
        leases: [
          {
            id: "lease-1",
            leaseNumber: "B-001",
            currentRentHT: 900,
            vatApplicable: false,
            vatRate: null,
            managementFeeType: "POURCENTAGE",
            managementFeeValue: 6,
            managementFeeBasis: "LOYER_HT",
            managementFeeVatRate: 20,
            lot: {
              id: "lot-1",
              number: "A101",
              lotType: "APPARTEMENT",
              building: { id: "building-1", name: "Immeuble A", addressLine1: "1 rue Test" },
            },
            tenant: {
              id: "tenant-1",
              firstName: "Marie",
              lastName: "Dupont",
              companyName: null,
            },
            chargeProvisions: [{ id: "provision-1", label: "Charges", monthlyAmount: 80 }],
          },
        ],
      },
    });

    render(<NouveauDecompteGestionPage />);

    expect(await screen.findByText("Marie Dupont")).toBeInTheDocument();
    expect(screen.getByText("Bail B-001")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /sélectionner le bail marie dupont/i }));
    expect(screen.getByText(/1 bail sélectionné/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /générer les lignes/i }));
    expect(screen.getByDisplayValue("Loyers encaissés")).toBeInTheDocument();
  });
});
