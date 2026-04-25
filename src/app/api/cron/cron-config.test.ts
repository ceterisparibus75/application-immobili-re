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
  it("déclare tous les jobs cron métier avec leur cadence dédiée", () => {
    const configuredCrons = new Map(config.crons.map((cron) => [cron.path, cron.schedule]));

    expect(configuredCrons).toEqual(expectedBusinessCrons);
  });

  it("reste dans la limite Pro de 40 cron jobs", () => {
    expect(config.crons).toHaveLength(expectedBusinessCrons.size);
    expect(config.crons.length).toBeLessThanOrEqual(40);
  });
});
