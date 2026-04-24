// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/providers/society-provider", () => ({
  useSociety: vi.fn(),
}));

vi.mock("@/actions/subscription", () => ({
  syncAllAdminSubscriptions: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

import { useSociety } from "@/providers/society-provider";
import { SubscriptionBanner } from "./subscription-banner";

const mockUseSociety = vi.mocked(useSociety);

const SOCIETY = { id: "soc-1", name: "SCI Test", legalForm: "SCI", siret: null, city: "Paris", isActive: true, logoUrl: null, role: "ADMIN_SOCIETE" };

function mockFetch(data: Record<string, unknown>) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

describe("SubscriptionBanner", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.clearAllMocks();
    mockUseSociety.mockReturnValue({
      activeSociety: SOCIETY,
      societies: [SOCIETY],
      setActiveSociety: vi.fn(),
      isLoading: false,
    });
  });

  it("ne rend rien sans societyId", () => {
    mockUseSociety.mockReturnValue({ activeSociety: null, societies: [], setActiveSociety: vi.fn(), isLoading: false });
    const { container } = render(<SubscriptionBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien si le fetch retourne type null", async () => {
    mockFetch({ type: null, message: "" });
    const { container } = render(<SubscriptionBanner />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it('affiche la bannière trial_warning avec le bouton "Souscrire" et le bouton fermer', async () => {
    mockFetch({ type: "trial_warning", message: "Votre essai expire dans 3 jours", daysLeft: 3 });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Votre essai expire dans 3 jours"));
    expect(screen.getByRole("link", { name: /souscrire/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fermer/i })).toBeInTheDocument();
  });

  it('affiche trial_expired avec "Gérer l\'abonnement" sans bouton fermer', async () => {
    mockFetch({ type: "trial_expired", message: "Votre essai a expiré" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Votre essai a expiré"));
    expect(screen.getByRole("link", { name: /gérer l'abonnement/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /fermer/i })).not.toBeInTheDocument();
  });

  it('affiche "Passer au plan supérieur" pour over_limit', async () => {
    mockFetch({ type: "over_limit", message: "Quota de sociétés dépassé" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Quota de sociétés dépassé"));
    expect(screen.getByRole("link", { name: /passer au plan supérieur/i })).toBeInTheDocument();
  });

  it('affiche "Gérer l\'abonnement" pour past_due', async () => {
    mockFetch({ type: "past_due", message: "Paiement en retard" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Paiement en retard"));
    expect(screen.getByRole("link", { name: /gérer l'abonnement/i })).toBeInTheDocument();
  });

  it('affiche "Gérer l\'abonnement" pour canceled', async () => {
    mockFetch({ type: "canceled", message: "Abonnement annulé" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Abonnement annulé"));
    expect(screen.getByRole("link", { name: /gérer l'abonnement/i })).toBeInTheDocument();
  });

  it("le bouton fermer masque la bannière", async () => {
    mockFetch({ type: "trial_warning", message: "Essai bientôt terminé" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Essai bientôt terminé"));
    fireEvent.click(screen.getByRole("button", { name: /fermer/i }));
    expect(screen.queryByText("Essai bientôt terminé")).not.toBeInTheDocument();
  });

  it("le lien de la bannière pointe vers /compte/abonnement", async () => {
    mockFetch({ type: "past_due", message: "Paiement en retard" });
    render(<SubscriptionBanner />);
    await waitFor(() => screen.getByText("Paiement en retard"));
    expect(screen.getByRole("link")).toHaveAttribute("href", "/compte/abonnement");
  });

});
