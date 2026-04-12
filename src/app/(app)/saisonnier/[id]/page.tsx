import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import Link from "next/link";
import {
  ArrowLeft, Home, Calendar, BedDouble, Users, MapPin,
  TrendingUp, CreditCard, Clock, Ban,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  CONFIRMED: "Confirmée",
  CHECKED_IN: "Check-in",
  CHECKED_OUT: "Check-out",
  CANCELLED: "Annulée",
  NO_SHOW: "No-show",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "destructive" | "outline" | "warning"> = {
  PENDING: "warning",
  CONFIRMED: "success",
  CHECKED_IN: "default",
  CHECKED_OUT: "outline",
  CANCELLED: "destructive",
  NO_SHOW: "destructive",
};

export default async function SeasonalPropertyDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/");

  const property = await prisma.seasonalProperty.findUnique({
    where: { id, societyId },
    include: {
      bookings: { orderBy: { checkIn: "desc" }, take: 20 },
      pricing: { orderBy: { startDate: "asc" } },
      blockedDates: { orderBy: { startDate: "asc" } },
    },
  });

  if (!property) notFound();

  const amenities = (property.amenities as string[]) ?? [];
  const yearBookings = property.bookings.filter(
    (b) => b.status !== "CANCELLED" && b.status !== "NO_SHOW" &&
      b.checkOut >= new Date(new Date().getFullYear(), 0, 1)
  );
  const totalRevenue = yearBookings.reduce((s, b) => s + b.netRevenue, 0);
  const totalNights = yearBookings.reduce((s, b) => s + b.nights, 0);
  const avgNightRate = totalNights > 0 ? totalRevenue / totalNights : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/saisonnier" className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2">
          <ArrowLeft className="h-3 w-3" />
          Location saisonnière
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Home className="h-6 w-6 text-[var(--color-brand-cyan)]" />
              {property.name}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {property.address}, {property.postalCode} {property.city}
            </p>
          </div>
          <Badge variant="outline">{property.isActive ? "Actif" : "Inactif"}</Badge>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <BedDouble className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{property.bedrooms}</p>
            <p className="text-[10px] text-muted-foreground">Chambres</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Users className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold">{property.capacity}</p>
            <p className="text-[10px] text-muted-foreground">Personnes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <Calendar className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold tabular-nums">{totalNights}</p>
            <p className="text-[10px] text-muted-foreground">Nuitées (année)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold tabular-nums">{formatCurrency(avgNightRate)}</p>
            <p className="text-[10px] text-muted-foreground">Prix moyen/nuit</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4 text-center">
            <CreditCard className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalRevenue)}</p>
            <p className="text-[10px] text-muted-foreground">Revenus nets</p>
          </CardContent>
        </Card>
      </div>

      {/* Amenities */}
      {amenities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {amenities.map((a) => (
            <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Réservations récentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {property.bookings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Aucune réservation</p>
            ) : (
              <div className="space-y-2">
                {property.bookings.map((booking) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{booking.guestName}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(booking.checkIn)} → {formatDate(booking.checkOut)} · {booking.nights} nuits
                      </p>
                      {booking.source && (
                        <Badge variant="outline" className="text-[9px] mt-1">{booking.source}</Badge>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-mono tabular-nums font-semibold">{formatCurrency(booking.totalPrice)}</p>
                      <Badge variant={STATUS_VARIANTS[booking.status] ?? "outline"} className="text-[9px]">
                        {STATUS_LABELS[booking.status]}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pricing periods + Blocked dates */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Grille tarifaire
              </CardTitle>
            </CardHeader>
            <CardContent>
              {property.pricing.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune période tarifaire</p>
              ) : (
                <div className="space-y-2">
                  {property.pricing.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium">{p.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(p.startDate)} → {formatDate(p.endDate)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-mono tabular-nums font-bold">{formatCurrency(p.pricePerNight)}/nuit</p>
                        {p.weeklyDiscount && (
                          <p className="text-[10px] text-emerald-600">-{p.weeklyDiscount}% sem.</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4" />
                Indisponibilités
              </CardTitle>
            </CardHeader>
            <CardContent>
              {property.blockedDates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Aucune date bloquée</p>
              ) : (
                <div className="space-y-2">
                  {property.blockedDates.map((bd) => (
                    <div key={bd.id} className="flex items-center justify-between p-3 rounded-lg border bg-red-50/30">
                      <div>
                        <p className="text-sm font-medium text-red-700">
                          {formatDate(bd.startDate)} → {formatDate(bd.endDate)}
                        </p>
                        {bd.reason && (
                          <p className="text-xs text-muted-foreground">{bd.reason}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check-in/out info */}
          <Card>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Check-in
                </span>
                <span className="font-medium">{property.checkInTime}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  Check-out
                </span>
                <span className="font-medium">{property.checkOutTime}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Séjour minimum</span>
                <span className="font-medium">{property.minStay} nuit{property.minStay > 1 ? "s" : ""}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
