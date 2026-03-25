"use server";

import type { ActionResult } from "@/actions/society";

export type FiscalYearRow = {
  id: string;
  year: number;
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  closedBy: { firstName: string | null; name: string | null } | null;
  closedAt: Date | null;
};

export async function getFiscalYears(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string
): Promise<ActionResult<FiscalYearRow[]>> {
  return { success: true, data: [] };
}

export async function createFiscalYear(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _input: { year: number; startDate: string; endDate: string }
): Promise<ActionResult<{ id: string }>> {
  return { success: false, error: "Fonctionnalité en cours de développement" };
}

export async function closeFiscalYear(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _societyId: string,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _fiscalYearId: string
): Promise<ActionResult> {
  return { success: false, error: "Fonctionnalité en cours de développement" };
}
