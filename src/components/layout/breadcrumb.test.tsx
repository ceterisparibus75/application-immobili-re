// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

import { usePathname } from "next/navigation";
import { Breadcrumb } from "./breadcrumb";

const mockPathname = vi.mocked(usePathname);

describe("Breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: () => Promise.resolve({}) } as Response);
  });

  it("ne rend rien pour un seul segment", () => {
    mockPathname.mockReturnValue("/dashboard");
    const { container } = render(<Breadcrumb />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ne rend rien pour la racine /", () => {
    mockPathname.mockReturnValue("/");
    const { container } = render(<Breadcrumb />);
    expect(container).toBeEmptyDOMElement();
  });

  it("traduit les segments connus via LABELS", () => {
    mockPathname.mockReturnValue("/patrimoine/immeubles");
    render(<Breadcrumb />);
    expect(screen.getByText("Patrimoine")).toBeInTheDocument();
    expect(screen.getByText("Immeubles")).toBeInTheDocument();
  });

  it("capitalise le premier caractère pour un segment inconnu", () => {
    mockPathname.mockReturnValue("/patrimoine/inconnusegment");
    render(<Breadcrumb />);
    expect(screen.getByText("Inconnusegment")).toBeInTheDocument();
  });

  it("le dernier segment est un <span>, les autres sont des liens", () => {
    mockPathname.mockReturnValue("/patrimoine/immeubles");
    render(<Breadcrumb />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent("Patrimoine");
    expect(screen.getByText("Immeubles").tagName).toBe("SPAN");
  });

  it("le lien du premier segment pointe vers la bonne route", () => {
    mockPathname.mockReturnValue("/patrimoine/immeubles");
    render(<Breadcrumb />);
    expect(screen.getByRole("link", { name: "Patrimoine" })).toHaveAttribute("href", "/patrimoine");
  });

  it("affiche '…' pour un segment ID pendant la résolution", () => {
    // ID unique pour éviter tout hit de cache entre tests
    mockPathname.mockReturnValue("/baux/aaaaaaaaaaaaaaaaaaaaa");
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<Breadcrumb />);
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("résout le nom d'un segment ID via l'API breadcrumb", async () => {
    mockPathname.mockReturnValue("/baux/bbbbbbbbbbbbbbbbbbbb");
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ "1": "Bail Martin" }),
    } as Response);
    render(<Breadcrumb />);
    await waitFor(() => screen.getByText("Bail Martin"));
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/breadcrumb?path="),
      expect.anything()
    );
  });

  it("affiche '…' si l'API breadcrumb échoue", async () => {
    // ID différent pour éviter le cache des tests précédents
    mockPathname.mockReturnValue("/baux/cccccccccccccccccccc");
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response);
    render(<Breadcrumb />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(screen.getByText("…")).toBeInTheDocument();
  });

  it("un segment CHILD_SEGMENTS_OF_ID après un ID pointe vers la page parente", () => {
    // Ajouter un segment final "info" pour que "lots" (index 3) soit un lien (non-dernier)
    const ID = "dddddddddddddddddddd";
    mockPathname.mockReturnValue(`/patrimoine/immeubles/${ID}/lots/info`);
    render(<Breadcrumb />);
    const links = screen.getAllByRole("link");
    const lotsLink = links.find((l) => l.textContent === "Lots");
    expect(lotsLink).toBeDefined();
    expect(lotsLink!.getAttribute("href")).toBe(`/patrimoine/immeubles/${ID}`);
  });

  it("affiche le chemin /baux/modeles correctement", () => {
    mockPathname.mockReturnValue("/baux/modeles");
    render(<Breadcrumb />);
    expect(screen.getByText("Baux")).toBeInTheDocument();
    expect(screen.getByText("Modèles de bail")).toBeInTheDocument();
  });

  it("affiche 3 segments avec 2 liens et 1 span", () => {
    mockPathname.mockReturnValue("/administration/utilisateurs/nouveau");
    render(<Breadcrumb />);
    expect(screen.getAllByRole("link")).toHaveLength(2);
    expect(screen.getByText("Nouveau").tagName).toBe("SPAN");
  });
});
