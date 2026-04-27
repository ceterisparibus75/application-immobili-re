// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WelcomeScreen } from "./welcome-screen";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("WelcomeScreen", () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
  });

  it("affiche un dialogue de choix de profil accessible au premier affichage", () => {
    render(<WelcomeScreen userName="Maxime" />);

    expect(screen.getByRole("dialog", { name: "Bonjour Maxime !" })).toBeInTheDocument();
    expect(screen.getByRole("radiogroup", { name: "Type de gestionnaire" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /SCI \/ patrimoine direct/i })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("button", { name: "Continuer" })).toBeDisabled();
  });

  it("mémorise le profil choisi et envoie vers le dashboard", () => {
    render(<WelcomeScreen userName="Maxime" />);

    fireEvent.click(screen.getByRole("radio", { name: /Gestionnaire de portefeuille/i }));
    fireEvent.click(screen.getByRole("button", { name: "Continuer" }));

    expect(localStorage.getItem("mygestia-welcome-seen")).toBe("true");
    expect(localStorage.getItem("mygestia-user-profile")).toBe("cabinet");
    expect(push).toHaveBeenCalledWith("/dashboard");
  });

  it("ne se réaffiche pas après passage de l'étape", () => {
    const { container } = render(<WelcomeScreen userName="Maxime" />);

    fireEvent.click(screen.getByRole("button", { name: "Passer cette étape" }));

    expect(localStorage.getItem("mygestia-welcome-seen")).toBe("true");
    expect(container).toBeEmptyDOMElement();
  });
});
