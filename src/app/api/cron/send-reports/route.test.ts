import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { generateConsolidatedReport, computeNextRunAt, computeReportYear, getReportLabel, getFrequencyLabel } =
  vi.hoisted(() => ({
    generateConsolidatedReport: vi.fn(),
    computeNextRunAt: vi.fn(),
    computeReportYear: vi.fn(),
    getReportLabel: vi.fn(),
    getFrequencyLabel: vi.fn(),
  }));

const { sendConsolidatedReportEmail } = vi.hoisted(() => ({
  sendConsolidatedReportEmail: vi.fn(),
}));

vi.mock("@/lib/reports/consolidated", () => ({
  generateConsolidatedReport,
  computeNextRunAt,
  computeReportYear,
  getReportLabel,
  getFrequencyLabel,
}));

vi.mock("@/lib/email", () => ({
  sendConsolidatedReportEmail,
}));
vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T08:00:00.000Z"));
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.reportSchedule.findMany.mockResolvedValue([]);
  computeReportYear.mockReturnValue(2026);
  computeNextRunAt.mockReturnValue(new Date("2026-05-26T08:00:00.000Z"));
  getReportLabel.mockReturnValue("Suivi mensuel");
  getFrequencyLabel.mockReturnValue("Mensuel");
  generateConsolidatedReport.mockResolvedValue({ filename: "rapport.pdf", buffer: Buffer.from("pdf") });
  sendConsolidatedReportEmail.mockResolvedValue({ success: true });
});

describe("GET /api/cron/send-reports", () => {
  it("retourne 500 si CRON_SECRET non configuré", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/send-reports") as never);
    expect(response.status).toBe(500);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization manquant", async () => {
    const response = await GET(new Request("http://localhost/api/cron/send-reports") as never);
    expect(response.status).toBe(401);
  });

  it("retourne un message si aucune planification n'est due", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/send-reports", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, sent: 0, message: "Aucune planification à exécuter" });
  });

  it("génère et envoie le rapport pour chaque planification due", async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([
      {
        id: "sched-1",
        name: "Rapport mensuel",
        societyId: "soc-1",
        frequency: "MONTHLY",
        reportTypes: ["suivi-mensuel"],
        recipients: ["gestionnaire@test.com"],
        society: { name: "SCI Test" },
      },
    ] as never);
    prismaMock.reportSchedule.update.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/send-reports", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true, total: 1, sent: 1, errors: 0 });
    expect(generateConsolidatedReport).toHaveBeenCalledWith("soc-1", ["suivi-mensuel"], 2026);
    expect(sendConsolidatedReportEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "gestionnaire@test.com", scheduleName: "Rapport mensuel" })
    );
    expect(prismaMock.reportSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "sched-1" },
        data: expect.objectContaining({ lastSentAt: expect.any(Date), nextRunAt: expect.any(Date) }),
      })
    );
  });

  it("avance nextRunAt même si la génération échoue", async () => {
    prismaMock.reportSchedule.findMany.mockResolvedValue([
      {
        id: "sched-fail",
        name: "Rapport raté",
        societyId: "soc-1",
        frequency: "MONTHLY",
        reportTypes: ["suivi-mensuel"],
        recipients: ["a@b.com"],
        society: { name: "SCI" },
      },
    ] as never);
    generateConsolidatedReport.mockRejectedValue(new Error("PDF generation failed"));
    prismaMock.reportSchedule.update.mockResolvedValue({} as never);

    const response = await GET(
      new Request("http://localhost/api/cron/send-reports", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body).toEqual({ success: true, total: 1, sent: 0, errors: 1 });
    expect(prismaMock.reportSchedule.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sched-fail" } })
    );
  });

  it("retourne 500 si la BDD échoue", async () => {
    prismaMock.reportSchedule.findMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/send-reports", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
