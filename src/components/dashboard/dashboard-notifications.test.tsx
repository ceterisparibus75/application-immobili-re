// @vitest-environment jsdom
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/providers/society-provider", () => ({
  useSociety: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement("a", { href, className }, children),
}));

vi.mock("date-fns", async (importOriginal) => {
  const actual = await importOriginal<typeof import("date-fns")>();
  return { ...actual, formatDistanceToNow: vi.fn().mockReturnValue("il y a 5 minutes") };
});

import { useSociety } from "@/providers/society-provider";
import { DashboardNotifications } from "./dashboard-notifications";

const mockUseSociety = vi.mocked(useSociety);
const SOCIETY = { id: "soc-1", name: "SCI Test", legalForm: "SCI", siret: null, city: "Paris", isActive: true, logoUrl: null, role: "ADMIN_SOCIETE" };

function mockFetch(data: unknown, patchOk = true) {
  global.fetch = vi.fn().mockImplementation((url: string, opts?: RequestInit) => {
    if (opts?.method === "PATCH") {
      return Promise.resolve({ ok: patchOk, json: () => Promise.resolve({}) } as Response);
    }
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(data),
    } as Response);
  });
}

function makeNotification(overrides: Partial<{
  id: string; type: string; title: string; message: string;
  isRead: boolean; link?: string | null; createdAt: Date; societyId: string;
  userId: string | null; tenantId: string | null; leaseId: string | null;
  invoiceId: string | null; buildingId: string | null;
}> = {}) {
  return {
    id: "notif-1",
    type: "BAIL_EXPIRING",
    title: "Bail expirant bientôt",
    message: "Le bail expire dans 30 jours",
    isRead: false,
    link: null,
    createdAt: new Date(),
    societyId: "soc-1",
    userId: null,
    tenantId: null,
    leaseId: null,
    invoiceId: null,
    buildingId: null,
    ...overrides,
  };
}

describe("DashboardNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSociety.mockReturnValue({
      activeSociety: SOCIETY,
      societies: [SOCIETY],
      setActiveSociety: vi.fn(),
      isLoading: false,
    });
  });

  it("affiche le skeleton pendant le chargement", () => {
    global.fetch = vi.fn().mockReturnValue(new Promise(() => {}));
    render(<DashboardNotifications />);
    const pulsingDivs = document.querySelectorAll(".animate-pulse");
    expect(pulsingDivs.length).toBeGreaterThan(0);
  });

  it('affiche "Aucune notification" quand la liste est vide', async () => {
    mockFetch({ data: [], meta: { unreadCount: 0 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Aucune notification"));
  });

  it("n'appelle pas fetch si activeSociety est null", async () => {
    mockUseSociety.mockReturnValue({ activeSociety: null, societies: [], setActiveSociety: vi.fn(), isLoading: false });
    global.fetch = vi.fn();
    render(<DashboardNotifications />);
    await waitFor(() => expect(global.fetch).not.toHaveBeenCalled());
  });

  it("affiche le titre d'une notification", async () => {
    mockFetch({ data: [makeNotification()], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Bail expirant bientôt"));
  });

  it("affiche le badge de type avec le label traduit", async () => {
    mockFetch({ data: [makeNotification({ type: "INVOICE_OVERDUE" })], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Facture"));
  });

  it("affiche le compteur de non-lus quand unreadCount > 0", async () => {
    mockFetch({ data: [makeNotification(), makeNotification({ id: "notif-2" })], meta: { unreadCount: 2 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("2"));
  });

  it("n'affiche pas le compteur si unreadCount vaut 0", async () => {
    mockFetch({ data: [makeNotification({ isRead: true })], meta: { unreadCount: 0 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Bail expirant bientôt"));
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it('affiche le bouton "Tout lu" quand unreadCount > 0', async () => {
    mockFetch({ data: [makeNotification()], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByRole("button", { name: /tout lu/i }));
  });

  it('cache le bouton "Tout lu" quand unreadCount vaut 0', async () => {
    mockFetch({ data: [makeNotification({ isRead: true })], meta: { unreadCount: 0 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Bail expirant bientôt"));
    expect(screen.queryByRole("button", { name: /tout lu/i })).not.toBeInTheDocument();
  });

  it('cliquer sur "Tout lu" envoie un PATCH et met le compteur à 0', async () => {
    mockFetch({ data: [makeNotification()], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByRole("button", { name: /tout lu/i }));
    fireEvent.click(screen.getByRole("button", { name: /tout lu/i }));
    await waitFor(() => expect(screen.queryByText("1")).not.toBeInTheDocument());
    const patchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[1]?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1].body)).toMatchObject({ action: "mark_all_read" });
  });

  it("cliquer sur le bouton individuel marque la notification comme lue", async () => {
    mockFetch({ data: [makeNotification({ id: "notif-x", isRead: false })], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByTitle("Marquer comme lu"));
    fireEvent.click(screen.getByTitle("Marquer comme lu"));
    const patchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(
      (c) => c[1]?.method === "PATCH"
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall![1].body)).toMatchObject({ action: "mark_read", ids: ["notif-x"] });
  });

  it("rend un lien quand notif.link est présent", async () => {
    mockFetch({
      data: [makeNotification({ link: "/baux/lease-1" })],
      meta: { unreadCount: 1 },
    });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByRole("link"));
    expect(screen.getByRole("link")).toHaveAttribute("href", "/baux/lease-1");
  });

  it("ne rend pas de lien quand notif.link est null", async () => {
    mockFetch({ data: [makeNotification({ link: null })], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Bail expirant bientôt"));
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("affiche la date relative fournie par formatDistanceToNow", async () => {
    mockFetch({ data: [makeNotification()], meta: { unreadCount: 1 } });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("il y a 5 minutes"));
  });

  it("affiche plusieurs notifications", async () => {
    mockFetch({
      data: [
        makeNotification({ id: "1", title: "Bail expiration" }),
        makeNotification({ id: "2", type: "PAYMENT_RECEIVED", title: "Paiement reçu" }),
      ],
      meta: { unreadCount: 2 },
    });
    render(<DashboardNotifications />);
    await waitFor(() => screen.getByText("Bail expiration"));
    expect(screen.getByText("Paiement reçu")).toBeInTheDocument();
  });
});
