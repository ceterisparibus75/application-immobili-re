// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChargeStatementPdfButton } from "./charge-statement-pdf-button";

describe("ChargeStatementPdfButton", () => {
  it("ouvre le PDF du décompte de charges dans un nouvel onglet", () => {
    render(<ChargeStatementPdfButton regularizationId="reg-1" />);

    const link = screen.getByRole("link", { name: "PDF" });
    expect(link).toHaveAttribute("href", "/api/charges/regularizations/reg-1/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });
});
