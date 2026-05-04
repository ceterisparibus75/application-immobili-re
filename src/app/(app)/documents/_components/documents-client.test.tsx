// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocumentsClient } from "./documents-client";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("@/actions/document", () => ({
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  bulkUpdateCategory: vi.fn(),
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
  userTags: [],
  versionOf: null,
  versionNumber: 1,
  versions: [],
};

describe("DocumentsClient", () => {
  it("affiche un état vide quand aucun document", () => {
    render(<DocumentsClient societyId="society-1" initialDocuments={[]} datarooms={[]} />);
    expect(screen.getByText("Aucun document trouvé")).toBeInTheDocument();
  });

  it("affiche les documents et permet de chercher", () => {
    render(<DocumentsClient societyId="society-1" initialDocuments={[documentItem]} datarooms={[]} />);
    expect(screen.getByText("Bail Marie Dupont.pdf")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/Rechercher dans les documents/i), { target: { value: "introuvable" } });
    expect(screen.getByText("Aucun document trouvé")).toBeInTheDocument();
  });
});
