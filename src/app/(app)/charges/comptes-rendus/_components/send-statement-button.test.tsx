// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SendStatementButton } from "./send-statement-button";

const { sendChargeRegularization } = vi.hoisted(() => ({
  sendChargeRegularization: vi.fn().mockResolvedValue({ success: true, data: { emailId: "email-1" } }),
}));

const { toast } = vi.hoisted(() => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const { refresh } = vi.hoisted(() => ({
  refresh: vi.fn(),
}));

vi.mock("@/actions/charge-statement", () => ({ sendChargeRegularization }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("SendStatementButton", () => {
  it("envoie le décompte et affiche les libellés accentués", async () => {
    render(
      <SendStatementButton
        societyId="society-1"
        regularizationId="reg-1"
        tenantEmail="tenant@example.test"
      />
    );

    const button = screen.getByRole("button", { name: "Envoyer" });
    expect(button).toHaveAttribute("title", "Envoyer le décompte à tenant@example.test");

    fireEvent.click(button);

    await waitFor(() => {
      expect(sendChargeRegularization).toHaveBeenCalledWith("society-1", "reg-1");
      expect(toast.success).toHaveBeenCalledWith("Décompte envoyé à tenant@example.test");
      expect(refresh).toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Envoyé" })).toBeDisabled();
    });
  });
});
