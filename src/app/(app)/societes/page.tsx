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
import { Building2, Plus } from "lucide-react";
import Link from "next/link";
import type { UserRole } from "@prisma/client";

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
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aucune société
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-md mb-4">
              Créez votre première société propriétaire pour commencer à gérer
              votre patrimoine immobilier.
            </p>
            <Link href="/societes/nouvelle">
              <Button>
                <Plus className="h-4 w-4" />
                Créer une société
              </Button>
            </Link>
          </CardContent>
        </Card>
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
                    {society.legalForm} &bull; {society.siret}
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
