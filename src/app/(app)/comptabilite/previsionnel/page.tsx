import { redirect } from "next/navigation";

/**
 * L'ancien module "Prévisionnel" a été fusionné dans le module "Cash-flow".
 * Cette page redirige automatiquement vers /comptabilite/cashflow.
 */
export default function PrevisionnelRedirect() {
  redirect("/comptabilite/cashflow");
}
