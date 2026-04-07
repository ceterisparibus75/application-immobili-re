"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Home, Users, FileText, Receipt, Building2 } from "lucide-react";

const actions = [
  { label: "Ajouter un lot", href: "/patrimoine/immeubles", icon: Home },
  { label: "Cr\u00e9er un locataire", href: "/locataires/nouveau", icon: Users },
  { label: "Cr\u00e9er un bail", href: "/baux/nouveau", icon: FileText },
  { label: "G\u00e9n\u00e9rer des factures", href: "/facturation", icon: Receipt },
  { label: "Synchroniser la banque", href: "/banque", icon: Building2 },
] as const;

export function QuickActions() {
  return (
    <Card className="border-0 shadow-brand bg-white rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-[var(--color-brand-deep)]">
          Actions rapides
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.href}
              variant="outline"
              className="h-auto flex-col gap-2 py-4 px-3 text-center hover:bg-gray-50 transition-colors"
              asChild
            >
              <Link href={action.href}>
                <Icon className="h-5 w-5 text-[var(--color-brand-blue)]" />
                <span className="text-xs font-medium text-[var(--color-brand-deep)] leading-tight">
                  {action.label}
                </span>
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
