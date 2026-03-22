"use client";

import { DeleteConfirmButton } from "@/components/delete-confirm-button";
import { deleteLease } from "@/actions/lease";

interface Props {
  societyId: string;
  leaseId: string;
  leaseStatus: string;
}

export function DeleteLeaseButton({ societyId, leaseId, leaseStatus }: Props) {
  const isActive = leaseStatus === "EN_COURS";

  return (
    <DeleteConfirmButton
      description="Vous êtes sur le point de supprimer ce bail et tout son historique (états des lieux, révisions de loyer, provisions de charges). Les factures associées seront conservées mais déliées du bail. Cette action est irréversible."
      redirectTo="/baux"
      disabled={isActive}
      disabledReason="Suppression impossible : le bail est en cours. Résiliez-le d'abord."
      onDelete={() => deleteLease(societyId, leaseId)}
    />
  );
}
