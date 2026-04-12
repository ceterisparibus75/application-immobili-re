import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import { Home, Plus, Calendar, Star, TrendingUp, BedDouble } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const PROPERTY_TYPE_LABELS: Record<string, string> = {
  APARTMENT: "Appartement",
  HOUSE: "Maison",
  VILLA: "Villa",
  STUDIO: "Studio",
  ROOM: "Chambre",
  GITE: "Gîte",
  CHALET: "Chalet",
};

export default async function SaisonnierPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const properties = await prisma.seasonalProperty.findMany({
    where: { societyId },
    include: {
      bookings: {
        where: {
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
          checkOut: { gte: new Date(new Date().getFullYear(), 0, 1) },
        },
        select: { id: true, totalPrice: true, netRevenue: true, nights: true, checkIn: true, checkOut: true, status: true },
      },
      pricing: {
        orderBy: { startDate: "asc" },
        take: 1,
        select: { pricePerNight: true },
      },
    },
    orderBy: { name: "asc" },
  });

  // Calculate stats
  const totalRevenue = properties.reduce(
    (s, p) => s + p.bookings.reduce((bs, b) => bs + b.netRevenue, 0),
    0
  );
  const totalNights = properties.reduce(
    (s, p) => s + p.bookings.reduce((bs, b) => bs + b.nights, 0),
    0
  );
  const activeBookings = properties.reduce(
    (s, p) => s + p.bookings.filter((b) => b.status === "CONFIRMED" || b.status === "CHECKED_IN").length,
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Home className="h-6 w-6 text-[var(--color-brand-cyan)]" />
            Location saisonnière
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Gérez vos biens en location courte durée, tarification et réservations
          </p>
        </div>
        <Link href="/saisonnier/nouveau">
          <Button className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white">
            <Plus className="h-4 w-4" />
            Nouveau bien
          </Button>
        </Link>
      </div>

      {/* Stats */}
      {properties.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{properties.length}</p>
              <p className="text-xs text-muted-foreground">Biens</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{activeBookings}</p>
              <p className="text-xs text-muted-foreground">Réservations actives</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-2xl font-bold tabular-nums">{totalNights}</p>
              <p className="text-xs text-muted-foreground">Nuitées (année)</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 px-4 text-center">
              <p className="text-2xl font-bold tabular-nums text-brand-gradient">{formatCurrency(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenus nets (année)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Properties list */}
      {properties.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Home className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-lg font-medium mb-1">Aucun bien saisonnier</p>
            <p className="text-sm text-muted-foreground mb-6">
              Ajoutez votre premier bien en location courte durée
            </p>
            <Link href="/saisonnier/nouveau">
              <Button className="gap-1.5">
                <Plus className="h-4 w-4" />
                Ajouter un bien
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {properties.map((prop) => {
            const yearRevenue = prop.bookings.reduce((s, b) => s + b.netRevenue, 0);
            const yearNights = prop.bookings.reduce((s, b) => s + b.nights, 0);
            const occupancyRate = Math.round((yearNights / 365) * 100);
            const basePrice = prop.pricing[0]?.pricePerNight;
            const currentBooking = prop.bookings.find(
              (b) => (b.status === "CONFIRMED" || b.status === "CHECKED_IN") &&
                new Date(b.checkIn) <= new Date() &&
                new Date(b.checkOut) >= new Date()
            );

            return (
              <Link key={prop.id} href={`/saisonnier/${prop.id}`}>
                <Card className="hover:shadow-brand-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{prop.name}</CardTitle>
                      {currentBooking ? (
                        <Badge className="bg-emerald-500 text-white text-[10px]">Occupé</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px]">Disponible</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {PROPERTY_TYPE_LABELS[prop.propertyType]} · {prop.city}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <BedDouble className="h-3.5 w-3.5" />
                        {prop.bedrooms} ch.
                      </span>
                      <span className="text-muted-foreground">
                        {prop.capacity} pers.
                      </span>
                      {basePrice && (
                        <span className="ml-auto font-semibold tabular-nums">
                          {formatCurrency(basePrice)}/nuit
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {yearNights} nuitées
                      </span>
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {occupancyRate}% occupation
                      </span>
                    </div>

                    {/* Occupancy bar */}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-brand-gradient-soft transition-all"
                        style={{ width: `${Math.min(100, occupancyRate)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">Revenu net</span>
                      <span className="text-sm font-bold tabular-nums">{formatCurrency(yearRevenue)}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
