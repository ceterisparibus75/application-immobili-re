import { getSocietyById } from "@/actions/society";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Building2, FileText, Pencil, Users } from "lucide-react";
import Link from "next/link";

export default async function SocieteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const society = await getSocietyById(id);

  if (!society) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/societes">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {society.name}
              </h1>
              <Badge variant={society.isActive ? "success" : "secondary"}>
                {society.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              {society.legalForm} &bull; SIRET {society.siret}
            </p>
          </div>
        </div>
        <Link href={`/societes/${id}/modifier`}>
          <Button variant="outline">
            <Pencil className="h-4 w-4" />
            Modifier
          </Button>
        </Link>
      </div>

      {/* Compteurs */}
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="Immeubles"
          value={society._count.buildings}
          icon={Building2}
        />
        <StatCard
          label="Baux"
          value={society._count.leases}
          icon={FileText}
        />
        <StatCard
          label="Locataires"
          value={society._count.tenants}
          icon={Users}
        />
        <StatCard
          label="Factures"
          value={society._count.invoices}
          icon={FileText}
        />
      </div>

      {/* Informations */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations légales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow label="Raison sociale" value={society.name} />
            <InfoRow label="Forme juridique" value={society.legalForm} />
            <InfoRow label="SIRET" value={society.siret} />
            <InfoRow
              label="TVA intracommunautaire"
              value={society.vatNumber}
            />
            <Separator />
            <InfoRow label="Adresse" value={society.addressLine1} />
            {society.addressLine2 && (
              <InfoRow label="" value={society.addressLine2} />
            )}
            <InfoRow
              label="Ville"
              value={`${society.postalCode} ${society.city}`}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Fiscalité</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <InfoRow
              label="Régime d'imposition"
              value={society.taxRegime === "IS" ? "Impôt sur les Sociétés" : "Impôt sur le Revenu"}
            />
            <InfoRow
              label="TVA"
              value={
                society.vatRegime === "TVA"
                  ? "Assujetti TVA"
                  : "Franchise de TVA"
              }
            />
            <Separator />
            <CardDescription>Expert-comptable</CardDescription>
            <InfoRow label="Nom" value={society.accountantName} />
            <InfoRow label="Cabinet" value={society.accountantFirm} />
            <InfoRow label="Email" value={society.accountantEmail} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex justify-between text-sm">
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
}
