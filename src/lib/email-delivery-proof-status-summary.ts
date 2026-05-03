import type { EmailDeliveryProofStatus } from "@/generated/prisma/client";

export type EmailDeliveryProofStatusTone = "success" | "neutral" | "warning" | "danger";

export type EmailDeliveryProofStatusSummaryItem = {
  status: EmailDeliveryProofStatus;
  label: string;
  count: number;
  tone: EmailDeliveryProofStatusTone;
};

type EmailDeliveryProofStatusCountRow = {
  status: EmailDeliveryProofStatus;
  _count: { _all: number };
};

const STATUS_CONFIG: Array<Omit<EmailDeliveryProofStatusSummaryItem, "count">> = [
  { status: "DELIVERED", label: "Livré", tone: "success" },
  { status: "SENT", label: "Envoyé", tone: "neutral" },
  { status: "DELIVERY_DELAYED", label: "Retardé", tone: "warning" },
  { status: "BOUNCED", label: "Rejeté", tone: "danger" },
  { status: "COMPLAINED", label: "Plainte", tone: "danger" },
  { status: "FAILED", label: "Échec", tone: "danger" },
];

export function buildEmailDeliveryProofStatusSummary(
  rows: EmailDeliveryProofStatusCountRow[],
): EmailDeliveryProofStatusSummaryItem[] {
  const counts = new Map(rows.map((row) => [row.status, row._count._all]));
  return STATUS_CONFIG.map((status) => ({
    ...status,
    count: counts.get(status.status) ?? 0,
  }));
}
