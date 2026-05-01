import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const { requireActiveSocietyRouteContext, createAuditLog, generateReport } = vi.hoisted(() => ({
  requireActiveSocietyRouteContext: vi.fn(),
  createAuditLog: vi.fn(),
  generateReport: vi.fn(),
}));

vi.mock("@/lib/api-society", () => ({
  requireActiveSocietyRouteContext,
}));

vi.mock("@/lib/audit", () => ({
  createAuditLog,
}));

vi.mock("@/lib/reports", () => ({
  generateReport,
}));

import { POST } from "./route";

describe("POST /api/rapports", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireActiveSocietyRouteContext.mockResolvedValue({
      societyId: "society-1",
      userId: "user-1",
    });
    createAuditLog.mockResolvedValue(undefined);
    generateReport.mockResolvedValue({
      buffer: Buffer.from("pdf-content"),
      filename: "rapport.pdf",
      contentType: "application/pdf",
    });
  });

  it("propage les erreurs d'authentification de contexte", async () => {
    requireActiveSocietyRouteContext.mockResolvedValue(
      NextResponse.json({ error: "Non authentifié" }, { status: 401 })
    );

    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({ type: "SITUATION_LOCATIVE", format: "pdf" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      error: { code: "UNAUTHORIZED", message: "Non authentifié" },
    });
  });

  it("retourne 400 si le body est invalide", async () => {
    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body).toEqual({
      error: { code: "INVALID_BODY", message: "Le corps de la requête est invalide" },
    });
  });

  it("retourne 400 si la validation Zod échoue", async () => {
    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({ type: "RECAP_CHARGES_LOCATAIRE", format: "pdf" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("locataire");
  });

  it("retourne 400 si le format demandé n'est pas compatible avec le rapport", async () => {
    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({ type: "SUIVI_TRAVAUX", year: 2026, format: "pdf" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toContain("Excel");
  });

  it("génère le rapport, écrit l'audit et renvoie le binaire", async () => {
    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({
          type: "SUIVI_MENSUEL",
          year: 2026,
          format: "pdf",
        }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = Buffer.from(await res.arrayBuffer());

    expect(res.status).toBe(200);
    expect(body.toString()).toBe("pdf-content");
    expect(generateReport).toHaveBeenCalledWith({
      societyId: "society-1",
      type: "SUIVI_MENSUEL",
      year: 2026,
      buildingId: undefined,
      tenantId: undefined,
      format: "pdf",
    });
    expect(createAuditLog).toHaveBeenCalledWith({
      societyId: "society-1",
      userId: "user-1",
      action: "EXPORT",
      entity: "Report",
      entityId: "SUIVI_MENSUEL",
      details: { filename: "rapport.pdf", year: 2026, format: "pdf" },
    });
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe('attachment; filename="rapport.pdf"');
  });

  it("retourne 404 pour une erreur métier introuvable", async () => {
    generateReport.mockRejectedValue(new Error("Locataire introuvable"));

    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({
          type: "RECAP_CHARGES_LOCATAIRE",
          year: 2026,
          tenantId: "clh3x2z4k0000qh8g7z1y2v3t",
          format: "pdf",
        }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body).toEqual({
      error: { code: "NOT_FOUND", message: "Locataire introuvable" },
    });
  });

  it("retourne 500 pour une erreur de génération générique", async () => {
    generateReport.mockRejectedValue(new Error("boom"));

    const res = await POST(
      new Request("http://localhost/api/rapports", {
        method: "POST",
        body: JSON.stringify({ type: "SITUATION_LOCATIVE", format: "pdf" }),
        headers: { "Content-Type": "application/json" },
      }) as never
    );
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toEqual({
      error: { code: "GENERATION_FAILED", message: "boom" },
    });
  });
});
