import { beforeEach, describe, expect, it, vi } from "vitest";
import { prismaMock } from "@/test/mocks/prisma";

const { executeWorkflowSteps } = vi.hoisted(() => ({
  executeWorkflowSteps: vi.fn(),
}));

vi.mock("@/lib/workflow-engine", () => ({ executeWorkflowSteps }));
vi.mock("@/lib/env", () => ({ env: process.env }));

import { GET } from "./route";

const SCHEDULED_WORKFLOW = {
  id: "wf-1",
  name: "Envoi mensuel",
  societyId: "soc-1",
  isActive: true,
  trigger: { type: "schedule", config: { cron: "0 2 * * *" } },
  steps: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-26T02:00:00.000Z"));
  process.env.CRON_SECRET = "cron-secret";
  prismaMock.workflow.findMany.mockResolvedValue([]);
  prismaMock.workflowRun.create.mockResolvedValue({ id: "run-1" } as never);
  prismaMock.workflowRun.update.mockResolvedValue({} as never);
  prismaMock.workflow.update.mockResolvedValue({} as never);
  executeWorkflowSteps.mockResolvedValue([{ status: "success" }]);
});

describe("GET /api/cron/run-workflows", () => {
  it("retourne 401 si CRON_SECRET non configuré ou header manquant", async () => {
    delete process.env.CRON_SECRET;
    const response = await GET(new Request("http://localhost/api/cron/run-workflows") as never);
    expect(response.status).toBe(401);
    process.env.CRON_SECRET = "cron-secret";
  });

  it("retourne 401 si Authorization incorrect", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer wrong" },
      }) as never
    );
    expect(response.status).toBe(401);
  });

  it("retourne scheduled=0 s'il n'y a aucun workflow actif planifié", async () => {
    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, scheduled: 0, executed: 0, failed: 0 });
    expect(executeWorkflowSteps).not.toHaveBeenCalled();
  });

  it("ignore les workflows sans trigger schedule", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([
      { ...SCHEDULED_WORKFLOW, trigger: { type: "manual" } },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.scheduled).toBe(0);
    expect(executeWorkflowSteps).not.toHaveBeenCalled();
  });

  it("ignore un workflow planifié sans expression cron", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([
      { ...SCHEDULED_WORKFLOW, trigger: { type: "schedule", config: {} } },
    ] as never);

    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.scheduled).toBe(1);
    expect(body.executed).toBe(0);
  });

  it("exécute un workflow planifié avec succès", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([SCHEDULED_WORKFLOW] as never);
    executeWorkflowSteps.mockResolvedValue([{ status: "success" }]);

    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, scheduled: 1, executed: 1, failed: 0 });
    expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("comptabilise un workflow dont une étape échoue", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([SCHEDULED_WORKFLOW] as never);
    executeWorkflowSteps.mockResolvedValue([{ status: "failed", error: "step error" }]);

    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body).toMatchObject({ ok: true, scheduled: 1, executed: 0, failed: 1 });
    expect(prismaMock.workflowRun.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) })
    );
  });

  it("comptabilise un workflow qui lève une exception", async () => {
    prismaMock.workflow.findMany.mockResolvedValue([SCHEDULED_WORKFLOW] as never);
    prismaMock.workflowRun.create.mockRejectedValue(new Error("DB error"));

    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    const body = await response.json();
    expect(body.failed).toBe(1);
    expect(body.errors).toEqual(expect.arrayContaining([expect.stringContaining("Envoi mensuel")]));
  });

  it("retourne 500 si prisma.workflow.findMany échoue", async () => {
    prismaMock.workflow.findMany.mockRejectedValue(new Error("DB error"));
    const response = await GET(
      new Request("http://localhost/api/cron/run-workflows", {
        headers: { Authorization: "Bearer cron-secret" },
      }) as never
    );
    expect(response.status).toBe(500);
  });
});
