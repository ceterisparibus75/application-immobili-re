import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Shield, ScrollText, Merge, Upload, Stethoscope } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Administration" };

const modules = [
  {
    title: "Supervision",
    description: "Vue globale des comptes, connexions et sociétés",
    href: "/administration/supervision",
    icon: Activity,
  },
  {
    title: "Utilisateurs",
    description: "Gérer les utilisateurs et les rôles d'accès",
    href: "/administration/utilisateurs",
    icon: Shield,
  },
  {
    title: "Diagnostic facturation",
    description: "Vérifier qu'un appel de loyer a bien été émis et envoyé pour chaque bail",
    href: "/administration/diagnostic-facturation",
    icon: Stethoscope,
  },
  {
    title: "Audit",
    description: "Historique des actions et journal d'audit",
    href: "/administration/audit",
    icon: ScrollText,
  },
  {
    title: "Fusions",
    description: "Fusionner des entités en doublon",
    href: "/administration/fusions",
    icon: Merge,
  },
  {
    title: "Import",
    description: "Importer des données depuis des fichiers",
    href: "/administration/import",
    icon: Upload,
  },
];

export default function AdministrationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-brand-deep)]">Administration</h1>
        <p className="text-muted-foreground">Gestion des utilisateurs, audit et outils avancés</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {modules.map((mod) => (
          <Link key={mod.href} href={mod.href}>
            <Card className="border-0 shadow-brand bg-white rounded-xl hover:shadow-brand-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--color-brand-light)] mb-2">
                  <mod.icon className="h-5 w-5 text-[var(--color-brand-blue)]" />
                </div>
                <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">{mod.title}</CardTitle>
                <CardDescription className="text-xs">{mod.description}</CardDescription>
              </CardHeader>
              <CardContent />
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
