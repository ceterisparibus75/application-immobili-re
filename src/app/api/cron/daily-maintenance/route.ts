import { NextRequest, NextResponse } from "next/server";

type CronCadence = "daily" | "weekly-monday" | "monthly-first";

type CronTask = {
  path: string;
  cadence: CronCadence;
};

const TASKS: CronTask[] = [
  { path: "/api/cron/generate-drafts", cadence: "daily" },
  { path: "/api/cron/sync-einvoices", cadence: "daily" },
  { path: "/api/cron/sync-bank", cadence: "daily" },
  { path: "/api/cron/sync-subscriptions", cadence: "daily" },
  { path: "/api/cron/send-reports", cadence: "daily" },
  { path: "/api/cron/run-workflows", cadence: "daily" },
  { path: "/api/cron/invoice-reminder", cadence: "weekly-monday" },
  { path: "/api/cron/insurance-reminder", cadence: "weekly-monday" },
  { path: "/api/cron/sync-indices", cadence: "monthly-first" },
  { path: "/api/cron/rent-revisions", cadence: "monthly-first" },
];

export function getDueCronTasks(now = new Date()): CronTask[] {
  const isMonday = now.getUTCDay() === 1;
  const isFirstDayOfMonth = now.getUTCDate() === 1;

  return TASKS.filter((task) => {
    if (task.cadence === "daily") return true;
    if (task.cadence === "weekly-monday") return isMonday;
    if (task.cadence === "monthly-first") return isFirstDayOfMonth;
    return false;
  });
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const now = new Date();
  const dueTasks = getDueCronTasks(now);
  const results: Array<{
    path: string;
    ok: boolean;
    status: number | null;
    body?: unknown;
    error?: string;
  }> = [];

  for (const task of dueTasks) {
    try {
      const response = await fetch(new URL(task.path, req.url), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
          "x-cron-orchestrator": "daily-maintenance",
        },
        cache: "no-store",
      });

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = await response.text();
      }

      results.push({
        path: task.path,
        ok: response.ok,
        status: response.status,
        body,
      });
    } catch (error) {
      results.push({
        path: task.path,
        ok: false,
        status: null,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const failed = results.filter((result) => !result.ok);
  const payload = {
    success: failed.length === 0,
    executed: results.length,
    failed: failed.length,
    results,
  };

  if (failed.length > 0) {
    console.error("[cron/daily-maintenance]", payload);
    return NextResponse.json(payload, { status: 207 });
  }

  return NextResponse.json(payload);
}
