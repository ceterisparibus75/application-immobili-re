// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { MobileSidebar } from "./mobile-sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/baux",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, onClick, className }: { href: string; children: React.ReactNode; onClick?: () => void; className?: string }) =>
    React.createElement("a", { href, onClick, className }, children),
}));

vi.mock("./proprietaire-switcher", () => ({
  ProprietaireSwitcher: () => <button type="button">Propriétaire actif</button>,
}));

vi.mock("./society-switcher", () => ({
  SocietySwitcher: () => <button type="button">Société active</button>,
}));

describe("MobileSidebar", () => {
  it("ne rend rien quand il est fermé", () => {
    const { container } = render(<MobileSidebar open={false} onClose={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("rend un dialogue de navigation mobile avec fermeture accessible", () => {
    const onClose = vi.fn();
    render(<MobileSidebar open onClose={onClose} />);

    expect(screen.getByRole("dialog", { name: "Navigation principale" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navigation mobile" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Fermer le menu" })).toHaveLength(2);

    fireEvent.click(screen.getAllByRole("button", { name: "Fermer le menu" })[0]);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("ferme le drawer après clic sur un lien", () => {
    const onClose = vi.fn();
    render(<MobileSidebar open onClose={onClose} />);

    fireEvent.click(screen.getByRole("link", { name: "Facturation" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("masque le lien décompte de gestion tiers quand la fonctionnalité est inactive", () => {
    render(
      <MobileSidebar
        open
        onClose={vi.fn()}
        navigationFeatures={{ showThirdPartyManagement: false }}
      />,
    );

    expect(screen.queryByRole("link", { name: "Décompte de gestion tiers" })).not.toBeInTheDocument();
  });
});
