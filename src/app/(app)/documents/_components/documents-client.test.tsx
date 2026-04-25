// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentsClient } from "./documents-client";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/actions/document", () => ({
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
}));

vi.mock("@/actions/dataroom", () => ({
  getDatarooms: vi.fn().mockResolvedValue([]),
  addDocumentToDataroom: vi.fn(),
}));

vi.mock("./delete-button", () => ({
  DeleteDocumentButton: () => <button type="button">Supprimer</button>,
}));

vi.mock("./ai-badge", () => ({
  AiBadge: () => <span>IA</span>,
}));

vi.mock("./document-chat", () => ({
  DocumentChat: () => <div>Chat document</div>,
}));

const documentItem = {
  id: "doc-1",
  fileName: "Bail Marie Dupont.pdf",
  fileUrl: "/demo/bail.pdf",
  fileSize: 1000,
  mimeType: "application/pdf",
  category: "bail",
  description: "Bail signé",
  expiresAt: null,
  storagePath: null,
  aiSummary: "Bail signé",
  aiTags: ["bail"],
  aiMetadata: null,
  aiStatus: "done",
  aiAnalyzedAt: null,
  buildingId: null,
  lotId: null,
  leaseId: null,
  tenantId: null,
  createdAt: new Date("2026-01-01"),
  building: null,
  lot: null,
  lease: null,
  tenant: null,
};

describe("DocumentsClient", () => {
  it("guide l'utilisateur quand la GED est vide", () => {
    render(<DocumentsClient societyId="society-1" documents={[]} />);

    expect(screen.getByText("Aucun document")).toBeInTheDocument();
    expect(screen.getByText(/Ajoutez vos baux, diagnostics, factures/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajouter un document/i })).toHaveAttribute("href", "/documents/nouveau");
  });

  it("distingue un résultat vide causé par les filtres et permet de réinitialiser", () => {
    render(<DocumentsClient societyId="society-1" documents={[documentItem]} />);

    fireEvent.change(screen.getByPlaceholderText("Rechercher..."), { target: { value: "introuvable" } });

    expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    expect(screen.getByText(/Aucun document ne correspond aux filtres actifs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Réinitialiser" }));

    expect(screen.getByText("Bail Marie Dupont.pdf")).toBeInTheDocument();
  });
});
