import type { EmailDeliveryProofStatus, Prisma } from "@/generated/prisma/client";

const EMAIL_PROOF_STATUSES = new Set<EmailDeliveryProofStatus>([
  "SENT",
  "DELIVERED",
  "BOUNCED",
  "COMPLAINED",
  "DELIVERY_DELAYED",
  "FAILED",
]);

const EMAIL_PROOF_ENTITY_TYPES = new Set(["INVOICE", "RECEIPT", "CHARGE_STATEMENT", "LETTER"]);

export type EmailDeliveryProofSearchParams = Record<string, string | string[] | undefined>;

export type NormalizedEmailDeliveryProofFilters = {
  status?: EmailDeliveryProofStatus;
  entityType?: string;
  query?: string;
  from?: Date;
  to?: Date;
};

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseDateStart(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseDateEnd(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function normalizeEmailDeliveryProofFilters(
  params: EmailDeliveryProofSearchParams,
): NormalizedEmailDeliveryProofFilters {
  const status = firstValue(params.status);
  const entityType = firstValue(params.type);
  const query = firstValue(params.q)?.trim();

  return {
    ...(status && EMAIL_PROOF_STATUSES.has(status as EmailDeliveryProofStatus)
      ? { status: status as EmailDeliveryProofStatus }
      : {}),
    ...(entityType && EMAIL_PROOF_ENTITY_TYPES.has(entityType) ? { entityType } : {}),
    ...(query && query.length >= 3 ? { query } : {}),
    ...(parseDateStart(firstValue(params.from)) ? { from: parseDateStart(firstValue(params.from)) } : {}),
    ...(parseDateEnd(firstValue(params.to)) ? { to: parseDateEnd(firstValue(params.to)) } : {}),
  };
}

export function buildEmailDeliveryProofWhere(
  societyId: string,
  filters: NormalizedEmailDeliveryProofFilters,
): Prisma.EmailDeliveryProofWhereInput {
  return {
    societyId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.entityType ? { entityType: filters.entityType } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
    ...(filters.query
      ? {
          OR: [
            { recipientEmail: { contains: filters.query, mode: "insensitive" } },
            { recipientName: { contains: filters.query, mode: "insensitive" } },
            { subject: { contains: filters.query, mode: "insensitive" } },
            { providerMessageId: { contains: filters.query, mode: "insensitive" } },
            { entityId: { contains: filters.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
