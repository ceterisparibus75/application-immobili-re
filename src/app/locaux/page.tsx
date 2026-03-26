import { Building2, MapPin, Ruler, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";

const LOT_TYPE_LABELS: Record<string, string> = {
  LOCAL_COMMERCIAL: "Local commercial",
  BUREAUX: "Bureaux",
  LOCAL_ACTIVITE: "Local d'activite",
  ENTREPOT: "Entrepot",
  APPARTEMENT: "Appartement",
  PARKING: "Parking",
  CAVE: "Cave",
  TERRASSE: "Terrasse",
  RESERVE: "Reserve",
};

async function getVacantLots() {
  try {
    return await prisma.lot.findMany({
      where: { status: "VACANT" },
      include: { building: { select: { name: true, addressLine1: true, city: true, postalCode: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  } catch {
    return [];
  }
}

export const metadata = {
  title: "Locaux disponibles | GestImmo",
};

export default async function LocauxPage() {
  const lots = await getVacantLots();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">GestImmo</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/contact" className="text-muted-foreground hover:text-foreground">Contact</Link>
            <Link href="/login"><Button variant="outline" size="sm">Espace gestion</Button></Link>
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Locaux disponibles</h1>
          <p className="text-muted-foreground">
            {lots.length > 0
              ? `${lots.length} local${lots.length > 1 ? "x" : ""} disponible${lots.length > 1 ? "s" : ""}`
              : "Consultez nos disponibilites"}
          </p>
        </div>

        {lots.length === 0 ? (
          <div className="text-center py-24 space-y-4">
            <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Aucun local disponible en ce moment</h2>
            <p className="text-muted-foreground max-w-md mx-auto">
              Nos disponibilites evoluent regulierement. Contactez-nous pour connaitre
              les prochaines opportunites ou deposer une candidature.
            </p>
            <Button asChild className="mt-4">
              <Link href="/contact">Nous contacter<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {lots.map((lot) => (
              <div key={lot.id} className="border rounded-xl p-6 space-y-4 bg-card hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary">{LOT_TYPE_LABELS[lot.lotType] ?? lot.lotType}</Badge>
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Disponible</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Lot {lot.number}</h3>
                  {lot.building && (
                    <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                      <MapPin className="h-3 w-3" />
                      <span>{lot.building.postalCode} {lot.building.city}</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Ruler className="h-4 w-4" />
                  <span>{lot.area} m²</span>
                  {lot.floor && <span>• Etage {lot.floor}</span>}
                </div>
                {lot.marketRentValue && (
                  <p className="font-semibold text-lg">
                    {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(lot.marketRentValue)}
                    <span className="text-sm font-normal text-muted-foreground">/mois</span>
                  </p>
                )}
                {lot.description && (
                  <p className="text-sm text-muted-foreground line-clamp-3">{lot.description}</p>
                )}
                <Button variant="outline" className="w-full" asChild>
                  <Link href="/contact">Nous contacter<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MTG Groupe.</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-foreground">Mentions legales</Link>
            <Link href="/politique-confidentialite" className="hover:text-foreground">Confidentialite</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
