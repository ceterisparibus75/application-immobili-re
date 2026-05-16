import { NextRequest, NextResponse } from "next/server";
import { getOptionalAuthenticatedRouteContext } from "@/lib/api-auth";
import { ForbiddenError, requireSocietyAccess } from "@/lib/permissions";
import { checkSubscriptionActive } from "@/lib/plan-limits";

export async function GET(request: NextRequest) {
  const context = await getOptionalAuthenticatedRouteContext();
  if (!context) {
    return NextResponse.json({ type: null, message: "" });
  }

  const societyId = request.nextUrl.searchParams.get("societyId");
  if (!societyId) {
    return NextResponse.json({ type: null, message: "" });
  }

  // Empêche un utilisateur d'inspecter l'état d'abonnement d'une autre société
  // en passant un societyId arbitraire. Sans accès → réponse neutre (pas 403
  // pour ne pas fuiter l'existence de la société).
  try {
    await requireSocietyAccess(context.userId, societyId);
  } catch (error) {
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ type: null, message: "" });
    }
    throw error;
  }

  const result = await checkSubscriptionActive(societyId);

  if (result.active && result.status === "TRIALING" && result.daysLeft !== undefined) {
    if (result.daysLeft <= 5) {
      return NextResponse.json({
        type: "trial_warning",
        message: `Votre essai gratuit expire dans ${result.daysLeft} jour${result.daysLeft > 1 ? "s" : ""}. Passez à l'abonnement payant pour conserver l'accès.`,
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
    if (result.status === "OVER_LIMIT") {
      return NextResponse.json({
        type: "over_limit",
        message: result.message ?? "Cette société dépasse le quota de votre plan. Passez au plan supérieur pour l'activer.",
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
