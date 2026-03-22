"use client";

import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteLot } from "@/actions/lot";

interface Props {
  societyId: string;
  buildingId: string;
  lotId: string;
  lotNumber: string;
  leaseCount: number;
}

export function DeleteLotButton({
  societyId,
  buildingId,
  lotId,
  lotNumber,
  leaseCount,
}: Props) {
  return (
    <DeleteConfirmButton
      description={`Vous êtes sur le point de supprimer le lot "${lotNumber}". Cette action est irréversible.`}
      redirectTo={`/patrimoine/immeubles/${buildingId}`}
      disabled={leaseCount > 0}
      disabledReason={`Suppression impossible : ${leaseCount} bail(aux) associé(s). Supprimez les baux d'abord.`}
      onDelete={() => deleteLot(societyId, lotId)}
    />
  );
}
