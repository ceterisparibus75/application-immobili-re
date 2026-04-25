import { getSocieties } from "@/actions/society";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/permissions";
import { Plus } from "lucide-react";
import Link from "next/link";
import type { UserRole } from "@/generated/prisma/client";
import { LEGAL_FORM_LABELS } from "@/lib/constants";
import { SocietesEmptyState } from "./_components/societes-empty-state";

export const metadata = {
  title: "Sociétés",
};

export default async function SocietesPage() {
  const societies = await getSocieties();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sociétés</h1>
          <p className="text-muted-foreground">
            Gérez vos sociétés propriétaires
          </p>
        </div>
        <Link href="/societes/nouvelle">
          <Button>
            <Plus className="h-4 w-4" />
            Nouvelle société
          </Button>
        </Link>
      </div>

      {societies.length === 0 ? (
        <SocietesEmptyState />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {societies.map((society) => (
            <Link key={society.id} href={`/societes/${society.id}`}>
              <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{society.name}</CardTitle>
                    <Badge
                      variant={society.isActive ? "success" : "secondary"}
                    >
                      {society.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <CardDescription>
                    {LEGAL_FORM_LABELS[society.legalForm] ?? society.legalForm}{society.siret ? <> &bull; {society.siret}</> : null}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {society.city}
                    </span>
                    <Badge variant="outline">
                      {ROLE_LABELS[society.role as UserRole]}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
