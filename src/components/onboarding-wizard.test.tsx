// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OnboardingWizard } from "./onboarding-wizard";

const push = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh }),
}));

vi.mock("@/providers/society-provider", () => ({
  useSociety: () => ({ activeSociety: { id: "society-1" } }),
}));

describe("OnboardingWizard", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    refresh.mockClear();
  });

  it("reste masqué tant que l'écran de bienvenue n'a pas été passé", () => {
    const { container } = render(<OnboardingWizard />);

    expect(container).toBeEmptyDOMElement();
  });

  it("affiche le guide après l'écran de bienvenue", () => {
    localStorage.setItem("mygestia-welcome-seen", "true");

    render(<OnboardingWizard />);

    expect(screen.getByRole("dialog", { name: "Bienvenue sur MyGestia" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fermer le guide de démarrage" })).toBeInTheDocument();
    expect(screen.getByText("Créez votre société")).toBeInTheDocument();
  });

  it("mémorise la fermeture du guide pour la société active", () => {
    localStorage.setItem("mygestia-welcome-seen", "true");
    const { container } = render(<OnboardingWizard />);

    fireEvent.click(screen.getByRole("button", { name: "Passer le guide" }));

    expect(localStorage.getItem("onboarding-wizard-seen-society-1")).toBe("true");
    expect(container).toBeEmptyDOMElement();
  });
});
