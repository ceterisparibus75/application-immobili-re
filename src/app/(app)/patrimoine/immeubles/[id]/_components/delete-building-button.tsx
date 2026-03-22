"use client";

import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteBuilding } from "@/actions/building";

interface Props {
  societyId: string;
  buildingId: string;
  buildingName: string;
  hasActiveLeases: boolean;
}

export function DeleteBuildingButton({
  societyId,
  buildingId,
  buildingName,
  hasActiveLeases,
}: Props) {
  return (
    <DeleteConfirmButton
      description={`Vous êtes sur le point de supprimer l'immeuble "${buildingName}" et tous ses lots. Cette action est irréversible.`}
      redirectTo="/patrimoine/immeubles"
      disabled={hasActiveLeases}
      disabledReason="Suppression impossible : des baux actifs existent sur cet immeuble."
      onDelete={() => deleteBuilding(societyId, buildingId)}
    />
  );
}
