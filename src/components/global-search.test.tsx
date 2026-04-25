// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GlobalSearch } from "./global-search";

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

describe("GlobalSearch", () => {
  it("ouvre directement la modale quand initiallyOpen est vrai", () => {
    render(<GlobalSearch initiallyOpen />);

    expect(screen.getByPlaceholderText(/rechercher immeubles/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Document/i })).toBeInTheDocument();
  });

  it("notifie la fermeture de la modale", () => {
    const onClose = vi.fn();
    render(<GlobalSearch initiallyOpen onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
