import { getDueCronTasks } from "./daily-maintenance/route";
import { describe, expect, it } from "vitest";
import config from "../../../../vercel.json";

const expectedBusinessCrons = new Map([
  ["/api/cron/ai-retry", "0 * * * *"],
  ["/api/cron/generate-drafts", "0 7 * * *"],
  ["/api/cron/insurance-reminder", "0 9 * * 1"],
  ["/api/cron/invoice-reminder", "0 8 * * 1"],
  ["/api/cron/lease-alerts", "30 9 * * *"],
  ["/api/cron/rent-revisions", "0 8 1 * *"],
  ["/api/cron/run-workflows", "0 2 * * *"],
  ["/api/cron/send-reports", "0 8 * * *"],
  ["/api/cron/sync-bank", "0 6 * * *"],
  ["/api/cron/sync-einvoices", "0 * * * *"],
  ["/api/cron/sync-indices", "0 7 1 * *"],
  ["/api/cron/sync-subscriptions", "30 6 * * *"],
]);

describe("vercel cron configuration", () => {
  it("reste déployable sur le scope Vercel actuel limité à 2 cron jobs quotidiens", () => {
    const configuredCrons = new Map(config.crons.map((cron) => [cron.path, cron.schedule]));

    expect(configuredCrons).toEqual(
      new Map([
        ["/api/cron/generate-drafts", "0 7 * * *"],
        ["/api/cron/daily-maintenance", "15 8 * * *"],
      ])
    );
    expect(config.crons).toHaveLength(2);
  });

  it("garde tous les jobs métier couverts par le rattrapage daily-maintenance", () => {
    const coveredPaths = new Set([
      ...getDueCronTasks(new Date("2026-04-25T08:15:00.000Z")).map((task) => task.path),
      ...getDueCronTasks(new Date("2026-06-01T08:15:00.000Z")).map((task) => task.path),
    ]);

    for (const path of expectedBusinessCrons.keys()) {
      expect(coveredPaths).toContain(path);
    }
  });
});
