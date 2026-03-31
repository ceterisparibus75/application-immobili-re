import { redirect } from "next/navigation";

export const metadata = { title: "Relances" };

export default function RelancesPage() {
  redirect("/facturation?tab=en-retard");
}
