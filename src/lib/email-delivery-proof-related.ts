import type { Prisma } from "@/generated/prisma/client";

type RelatedEmailDeliveryProofInput = {
  societyId: string;
  currentProofId: string;
  invoiceId: string | null;
  entityType: string;
  entityId: string | null;
};

export function buildRelatedEmailDeliveryProofWhere(
  input: RelatedEmailDeliveryProofInput,
): Prisma.EmailDeliveryProofWhereInput {
  const relatedClauses: Prisma.EmailDeliveryProofWhereInput[] = [];

  if (input.invoiceId) {
    relatedClauses.push({ invoiceId: input.invoiceId });
  }

  if (input.entityId) {
    relatedClauses.push({ entityType: input.entityType, entityId: input.entityId });
  }

  if (relatedClauses.length === 0) {
    return {
      societyId: input.societyId,
      id: "__no_related_email_delivery_proof__",
    };
  }

  return {
    societyId: input.societyId,
    id: { not: input.currentProofId },
    OR: relatedClauses,
  };
}
