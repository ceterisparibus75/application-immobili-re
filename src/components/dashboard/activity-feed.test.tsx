// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return { ...actual, formatDistanceToNow: vi.fn().mockReturnValue("il y a 2 minutes") };
});

import { ActivityFeed } from "./activity-feed";

function mockFetch(data: unknown) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

function makeActivity(overrides: Partial<{
  id: string; userId: string; userName: string; action: string;
  entity: string; entityId: string; entityLabel?: string; createdAt: string; link?: string;
}> = {}) {
  return {
    id: "act-1",
    userId: "user-1",
    userName: "Alice Dupont",
    action: "CREATE",
    entity: "Lease",
    entityId: "lease-abc123",
    entityLabel: "Bail Lot 3",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("ActivityFeed", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("affiche le skeleton pendant le chargement", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<ActivityFeed />);
    const pulsingDivs = document.querySelectorAll(".animate-pulse");
    expect(pulsingDivs.length).toBeGreaterThan(0);
  });

  it('affiche "Aucune activité récente" quand data est vide', async () => {
    mockFetch({ data: [] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Aucune activité récente"));
  });

  it("affiche le nom de l'utilisateur et l'étiquette de l'entité", async () => {
    mockFetch({ data: [makeActivity()] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Alice Dupont"));
    expect(screen.getByText("Bail Lot 3")).toBeInTheDocument();
  });

  it("affiche le label d'action traduit", async () => {
    mockFetch({ data: [makeActivity({ action: "CREATE" })] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("a créé"));
  });

  it("affiche l'entité tronquée quand entityLabel est absent", async () => {
    mockFetch({ data: [makeActivity({ entityLabel: undefined, entity: "Invoice", entityId: "inv-abc12345" })] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText(/Invoice inv-abc1/));
  });

  it("rend un lien quand activity.link est présent", async () => {
    mockFetch({ data: [makeActivity({ link: "/baux/lease-abc" })] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByRole("link"));
    expect(screen.getByRole("link")).toHaveAttribute("href", "/baux/lease-abc");
  });

  it("ne rend pas de lien quand activity.link est absent", async () => {
    mockFetch({ data: [makeActivity({ link: undefined })] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Alice Dupont"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("affiche plusieurs activités", async () => {
    mockFetch({
      data: [
        makeActivity({ id: "1", userName: "Alice Martin", action: "CREATE" }),
        makeActivity({ id: "2", userName: "Bob Durand", action: "UPDATE" }),
      ],
    });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Alice Martin"));
    expect(screen.getByText("Bob Durand")).toBeInTheDocument();
    expect(screen.getByText("a créé")).toBeInTheDocument();
    expect(screen.getByText("a modifié")).toBeInTheDocument();
  });

  it("utilise le label UPDATE pour action inconnue", async () => {
    mockFetch({ data: [makeActivity({ action: "UNKNOWN_ACTION" })] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("a effectué une action sur"));
  });

  it("affiche la date relative fournie par formatDistanceToNow", async () => {
    mockFetch({ data: [makeActivity()] });
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("il y a 2 minutes"));
  });

  it("ne plante pas si le fetch échoue", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network error"));
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Aucune activité récente"));
  });

  it("ignore la réponse si res.ok est false", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, json: vi.fn() } as unknown as Response);
    render(<ActivityFeed />);
    await waitFor(() => screen.getByText("Aucune activité récente"));
  });
});
