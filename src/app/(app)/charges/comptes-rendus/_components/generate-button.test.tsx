// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GenerateReportButton } from "./generate-button";

const { generateAnnualChargeReport } = vi.hoisted(() => ({
  generateAnnualChargeReport: vi.fn().mockResolvedValue({ success: true, data: { created: 2 } }),
}));

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/actions/charge", () => ({ generateAnnualChargeReport }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("GenerateReportButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        data: [{ id: "building-1", name: "Immeuble A", city: "Paris" }],
      }),
    }) as never;
  });

  it("rafraîchit la page après génération réussie", async () => {
    render(<GenerateReportButton societyId="society-1" />);

    fireEvent.click(screen.getByRole("button", { name: /Générer un compte rendu/i }));

    await screen.findByText("Immeuble A — Paris");
    fireEvent.click(screen.getByRole("button", { name: "Générer" }));

    await waitFor(() => {
      expect(generateAnnualChargeReport).toHaveBeenCalledWith("society-1", "building-1", expect.any(Number));
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByText("2 compte(s) rendu(s) généré(s) avec succès.")).toBeInTheDocument();
    });
  });
});
