// @vitest-environment jsdom
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { toast } from "sonner";
import { ExportPdfButton } from "./export-pdf-button";

const mockToast = vi.mocked(toast);

beforeEach(() => {
  vi.clearAllMocks();
  global.URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
  global.URL.revokeObjectURL = vi.fn();
});

describe("ExportPdfButton", () => {
  it('affiche le bouton "Exporter en PDF"', () => {
    render(<ExportPdfButton />);
    expect(screen.getByRole("button", { name: /exporter en pdf/i })).toBeInTheDocument();
  });

  it("le bouton est activé par défaut", () => {
    render(<ExportPdfButton />);
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("désactive le bouton et appelle fetch au clic", async () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByRole("button")).toBeDisabled());
    expect(global.fetch).toHaveBeenCalledWith("/api/dashboard/export");
  });

  it("affiche un toast de succès et re-active le bouton après téléchargement", async () => {
    const mockBlob = new Blob(["PDF content"], { type: "application/pdf" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: {
        get: (name: string) => name === "Content-Disposition" ? 'attachment; filename="rapport.pdf"' : null,
      },
    } as unknown as Response);

    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("PDF exporte avec succes"));
    expect(screen.getByRole("button")).not.toBeDisabled();
    expect(global.URL.createObjectURL).toHaveBeenCalledWith(mockBlob);
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("affiche un toast d'erreur si res.ok est false", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Erreur serveur" }),
    } as unknown as Response);

    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Erreur serveur"));
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("affiche le message d'erreur générique si json() échoue", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("parse error")),
    } as unknown as Response);

    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Erreur lors de la generation du PDF"));
  });

  it("affiche un toast d'erreur si fetch lève une exception", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("réseau indisponible"));

    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("réseau indisponible"));
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("utilise le nom de fichier de l'en-tête Content-Disposition", async () => {
    const mockBlob = new Blob([], { type: "application/pdf" });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
      headers: { get: () => 'attachment; filename="mon-rapport.pdf"' },
    } as unknown as Response);

    const clickSpy = vi.fn();
    const originalCreate = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag) => {
      const el = originalCreate(tag);
      if (tag === "a") {
        Object.defineProperty(el, "click", { value: clickSpy });
      }
      return el;
    });

    render(<ExportPdfButton />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(clickSpy).toHaveBeenCalled());

    vi.restoreAllMocks();
  });
});
