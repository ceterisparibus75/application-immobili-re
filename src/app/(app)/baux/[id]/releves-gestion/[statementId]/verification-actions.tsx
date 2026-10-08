"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  verifyManagementStatement,
  validateStatement,
  markStatementConforme,
  markStatementLitige,
} from "@/actions/third-party-statement";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Loader2,
  Search,
  ShieldCheck,
  ShieldAlert,
} from "lucide-react";

interface VerificationActionsProps {
  societyId: string;
  statementId: string;
  leaseId: string;
  status: string;
  verificationStatus: string | null;
}

export function VerificationActions({
  societyId,
  statementId,
  status,
}: VerificationActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleVerify() {
    setLoading("verify");
    try {
      const result = await verifyManagementStatement(societyId, statementId);
      if (result.success) {
        toast.success("Vérification terminée");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la vérification");
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(null);
    }
  }

  async function handleValidate() {
    setLoading("validate");
    try {
      const result = await validateStatement(societyId, statementId);
      if (result.success) {
        toast.success("Décompte validé");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur lors de la validation");
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(null);
    }
  }

  async function handleConforme() {
    setLoading("conforme");
    try {
      const result = await markStatementConforme(societyId, statementId);
      if (result.success) {
        toast.success("Décompte marqué conforme");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(null);
    }
  }

  async function handleLitige() {
    setLoading("litige");
    try {
      const result = await markStatementLitige(societyId, statementId);
      if (result.success) {
        toast.success("Litige signalé");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erreur");
      }
    } catch {
      toast.error("Erreur inattendue");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* BROUILLON: Valider + Lancer la verification */}
      {status === "BROUILLON" && (
        <>
          <Button
            onClick={handleValidate}
            disabled={loading !== null}
            variant="outline"
          >
            {loading === "validate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Valider
          </Button>
          <Button
            onClick={handleVerify}
            disabled={loading !== null}
          >
            {loading === "verify" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Lancer la vérification
          </Button>
        </>
      )}

      {/* VALIDE: Lancer la vérification */}
      {status === "VALIDE" && (
        <Button
          onClick={handleVerify}
          disabled={loading !== null}
        >
          {loading === "verify" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Lancer la vérification
        </Button>
      )}

      {/* VERIFIE: Conforme / Litige */}
      {status === "VERIFIE" && (
        <>
          <Button
            onClick={handleConforme}
            disabled={loading !== null}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {loading === "conforme" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Marquer conforme
          </Button>
          <Button
            onClick={handleLitige}
            disabled={loading !== null}
            variant="destructive"
          >
            {loading === "litige" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Signaler un litige
          </Button>
        </>
      )}

      {/* Re-verify for already verified/conforme/litige */}
      {(status === "VERIFIE" || status === "CONFORME" || status === "LITIGE") && (
        <Button
          onClick={handleVerify}
          disabled={loading !== null}
          variant="outline"
          size="sm"
        >
          {loading === "verify" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
          Re-vérifier
        </Button>
      )}
    </div>
  );
}
