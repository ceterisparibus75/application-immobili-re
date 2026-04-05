import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkSubscriptionActive } from "@/lib/plan-limits";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ type: null, message: "" });
  }

  const societyId = request.nextUrl.searchParams.get("societyId");
  if (!societyId) {
    return NextResponse.json({ type: null, message: "" });
  }

  const result = await checkSubscriptionActive(societyId);

  if (result.active && result.status === "TRIALING" && result.daysLeft !== undefined) {
    if (result.daysLeft <= 5) {
      return NextResponse.json({
        type: "trial_warning",
        message: `Votre essai gratuit expire dans ${result.daysLeft} jour${result.daysLeft > 1 ? "s" : ""}. Souscrivez un abonnement pour ne pas perdre l'accès.`,
        daysLeft: result.daysLeft,
      });
    }
    return NextResponse.json({ type: null, message: "" });
  }

  if (!result.active) {
    if (result.status === "TRIAL_EXPIRED") {
      return NextResponse.json({
        type: "trial_expired",
        message: "Votre période d'essai est terminée. Souscrivez un abonnement pour continuer à utiliser l'application.",
      });
    }
    if (result.status === "PAST_DUE") {
      return NextResponse.json({
        type: "past_due",
        message: "Votre paiement a échoué. Mettez à jour votre moyen de paiement pour éviter la suspension de votre compte.",
      });
    }
    if (result.status === "CANCELED" || result.status === "UNPAID") {
      return NextResponse.json({
        type: "canceled",
        message: "Votre abonnement est expiré. Souscrivez un nouveau plan pour retrouver l'accès.",
      });
    }
  }

  return NextResponse.json({ type: null, message: "" });
}
