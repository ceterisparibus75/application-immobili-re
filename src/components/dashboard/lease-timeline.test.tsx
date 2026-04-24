// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { LeaseTimeline } from "./lease-timeline";
import type { LeaseTimelineItem } from "@/actions/analytics";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

function makeLease(overrides: Partial<LeaseTimelineItem> = {}): LeaseTimelineItem {
  return {
    id: "lease-1",
    tenantName: "Martin Dupont",
    lotRef: "Résidence Les Pins — Lot 3",
    startDate: "01/01/2023",
    endDate: "31/12/2025",
    daysRemaining: 120,
    progressPct: 50,
    ...overrides,
  };
}

describe("LeaseTimeline", () => {
  it("affiche le message vide quand aucun bail", () => {
    render(<LeaseTimeline data={[]} />);
    expect(screen.getByText("Aucun bail actif")).toBeInTheDocument();
  });

  it('affiche "Expiré" pour un bail avec daysRemaining ≤ 0', () => {
    render(<LeaseTimeline data={[makeLease({ daysRemaining: 0 })]} />);
    expect(screen.getByText("Expiré")).toBeInTheDocument();
  });

  it("affiche J-X pour un bail expirant dans ≤ 30 jours", () => {
    render(<LeaseTimeline data={[makeLease({ daysRemaining: 15 })]} />);
    expect(screen.getByText("J-15")).toBeInTheDocument();
  });

  it("affiche J-X pour un bail expirant dans ≤ 90 jours", () => {
    render(<LeaseTimeline data={[makeLease({ daysRemaining: 60 })]} />);
    expect(screen.getByText("J-60")).toBeInTheDocument();
  });

  it("affiche J-X pour un bail expirant dans > 90 jours", () => {
    render(<LeaseTimeline data={[makeLease({ daysRemaining: 200 })]} />);
    expect(screen.getByText("J-200")).toBeInTheDocument();
  });

  it("le lien pointe vers la page du bail", () => {
    render(<LeaseTimeline data={[makeLease({ id: "bail-xyz" })]} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "/baux/bail-xyz");
  });

  it("affiche le nom du locataire et la référence du lot", () => {
    render(<LeaseTimeline data={[makeLease()]} />);
    expect(screen.getByText("Martin Dupont")).toBeInTheDocument();
    expect(screen.getByText("Résidence Les Pins — Lot 3")).toBeInTheDocument();
  });

  it("affiche les dates de début et fin du bail", () => {
    render(<LeaseTimeline data={[makeLease()]} />);
    expect(screen.getByText("01/01/2023")).toBeInTheDocument();
    expect(screen.getByText("31/12/2025")).toBeInTheDocument();
  });

  it("affiche plusieurs baux dans l'ordre", () => {
    const data = [
      makeLease({ id: "1", tenantName: "Alice Martin" }),
      makeLease({ id: "2", tenantName: "Bob Durand" }),
    ];
    render(<LeaseTimeline data={data} />);
    expect(screen.getByText("Alice Martin")).toBeInTheDocument();
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
