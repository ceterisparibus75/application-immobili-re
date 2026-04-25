// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BauxViewToggle, type BuildingGroupSummary } from "./baux-view-toggle";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

const groups: BuildingGroupSummary[] = [
  {
    buildingId: "building-1",
    buildingName: "Résidence Les Orchidées",
    buildingCity: "97400 Saint-Denis",
    leases: [
      {
        id: "lease-1",
        tenantName: "Marie Dupont",
        lotNumbers: "Lot 201",
        destination: "Habitation",
        buildingName: "Résidence Les Orchidées",
        buildingCity: "97400 Saint-Denis",
        currentRentHT: 850,
        paymentFrequency: "MENSUEL",
        startDate: "2025-10-01",
        endDate: "2028-09-30",
        status: "EN_COURS",
        statusLabel: "En cours",
        statusVariant: "success",
        leaseTypeLabel: "Habitation",
        isThirdPartyManaged: false,
        indexationStatus: "none",
      },
    ],
  },
];

describe("BauxViewToggle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-25"));
  });

  it("ouvre la vue cartes par défaut sur mobile", () => {
    mockMatchMedia(true);

    render(<BauxViewToggle actifsGrouped={groups} autresGrouped={[]} totalMensuel={850} />);

    expect(screen.getByRole("button", { name: "Cartes" })).toHaveClass("bg-white");
    expect(screen.getByRole("link", { name: /Marie Dupont/i })).toHaveAttribute("href", "/baux/lease-1");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("permet de repasser en vue tableau", () => {
    mockMatchMedia(true);
    render(<BauxViewToggle actifsGrouped={groups} autresGrouped={[]} totalMensuel={850} />);

    fireEvent.click(screen.getByRole("button", { name: "Tableau" }));

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tableau" })).toHaveClass("bg-white");
  });
});
