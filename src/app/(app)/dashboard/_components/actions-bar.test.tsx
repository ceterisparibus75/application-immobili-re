// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className, style }: { href: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) =>
    React.createElement("a", { href, className, style }, children),
}));

import { ActionsBar } from "./actions-bar";

describe("ActionsBar", () => {
  it("présente les baux sans facture du mois comme des appels de loyers à générer", () => {
    render(
      <ActionsBar
        pendingRevisionCount={0}
        invoicesToIssueCount={3}
        unpaidInvoiceCount={0}
      />
    );

    expect(screen.getByRole("link", { name: /3 appels de loyer à générer/i })).toHaveAttribute(
      "href",
      "/facturation/generer"
    );
    expect(screen.queryByText(/factures à émettre/i)).not.toBeInTheDocument();
  });
});
