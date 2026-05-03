// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MissingTenantEmailBadge } from "./missing-tenant-email-badge";

describe("MissingTenantEmailBadge", () => {
  it("signale clairement qu'un décompte finalisé ne peut pas être envoyé", () => {
    render(<MissingTenantEmailBadge />);

    expect(screen.getByText("Email locataire manquant")).toBeInTheDocument();
  });
});
