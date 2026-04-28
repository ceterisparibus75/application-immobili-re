"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  cancelBooking,
  createBlockedDate,
  createBooking,
  createPricing,
} from "@/actions/seasonal";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Ban, CalendarPlus, Loader2, Plus, Save, Tag } from "lucide-react";
import { toast } from "sonner";

type BookingForAction = {
  id: string;
  guestName: string;
  status: string;
};

type Props = {
  societyId: string;
  propertyId: string;
  capacity: number;
  minStay: number;
  bookings: BookingForAction[];
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(dateIso: string, days: number) {
  const date = new Date(dateIso);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export function SeasonalPropertyActions({
  societyId,
  propertyId,
  capacity,
  minStay,
  bookings,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const defaultCheckIn = todayIso();
  const defaultCheckOut = addDaysIso(defaultCheckIn, Math.max(1, minStay));

  function refreshAfter(message: string) {
    toast.success(message);
    router.refresh();
  }

  function handleBookingSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createBooking(societyId, {
        propertyId,
        guestName: String(formData.get("guestName") ?? ""),
        guestEmail: String(formData.get("guestEmail") ?? ""),
        guestPhone: String(formData.get("guestPhone") ?? ""),
        guestCount: Number(formData.get("guestCount") ?? 1),
        checkIn: String(formData.get("checkIn") ?? ""),
        checkOut: String(formData.get("checkOut") ?? ""),
        totalPrice: Number(formData.get("totalPrice") ?? 0),
        cleaningFee: Number(formData.get("cleaningFee") ?? 0),
        platformFee: Number(formData.get("platformFee") ?? 0),
        source: String(formData.get("source") ?? ""),
        notes: String(formData.get("notes") ?? ""),
      });

      if (!result.success) {
        toast.error(result.error ?? "Impossible de créer la réservation");
        return;
      }

      setBookingOpen(false);
      refreshAfter("Réservation ajoutée");
    });
  }

  function handlePricingSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPricing(societyId, {
        propertyId,
        name: String(formData.get("name") ?? ""),
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        pricePerNight: Number(formData.get("pricePerNight") ?? 0),
        weeklyDiscount: formData.get("weeklyDiscount")
          ? Number(formData.get("weeklyDiscount"))
          : undefined,
        monthlyDiscount: formData.get("monthlyDiscount")
          ? Number(formData.get("monthlyDiscount"))
          : undefined,
      });

      if (!result.success) {
        toast.error(result.error ?? "Impossible de créer le tarif");
        return;
      }

      setPricingOpen(false);
      refreshAfter("Tarif ajouté");
    });
  }

  function handleBlockedSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createBlockedDate(societyId, {
        propertyId,
        startDate: String(formData.get("startDate") ?? ""),
        endDate: String(formData.get("endDate") ?? ""),
        reason: String(formData.get("reason") ?? ""),
      });

      if (!result.success) {
        toast.error(result.error ?? "Impossible de bloquer ces dates");
        return;
      }

      setBlockedOpen(false);
      refreshAfter("Dates bloquées");
    });
  }

  function handleCancelBooking(bookingId: string) {
    startTransition(async () => {
      const result = await cancelBooking(societyId, bookingId);
      if (!result.success) {
        toast.error(result.error ?? "Impossible d'annuler la réservation");
        return;
      }
      refreshAfter("Réservation annulée");
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarPlus className="h-4 w-4" />
            Actions rapides
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-3">
            <Button variant={bookingOpen ? "default" : "outline"} onClick={() => setBookingOpen((v) => !v)} type="button">
              <Plus className="h-4 w-4" />
              Réservation
            </Button>
            <Button variant={pricingOpen ? "default" : "outline"} onClick={() => setPricingOpen((v) => !v)} type="button">
              <Tag className="h-4 w-4" />
              Tarif
            </Button>
            <Button variant={blockedOpen ? "default" : "outline"} onClick={() => setBlockedOpen((v) => !v)} type="button">
              <Ban className="h-4 w-4" />
              Indisponibilité
            </Button>
          </div>

          {bookingOpen && (
            <form action={handleBookingSubmit} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="guestName">Voyageur *</Label>
                  <Input id="guestName" name="guestName" required placeholder="Nom du voyageur" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source">Canal</Label>
                  <Input id="source" name="source" placeholder="direct, airbnb, booking..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestEmail">Email</Label>
                  <Input id="guestEmail" name="guestEmail" type="email" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestPhone">Téléphone</Label>
                  <Input id="guestPhone" name="guestPhone" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkIn">Arrivée *</Label>
                  <Input id="checkIn" name="checkIn" type="date" defaultValue={defaultCheckIn} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="checkOut">Départ *</Label>
                  <Input id="checkOut" name="checkOut" type="date" defaultValue={defaultCheckOut} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="guestCount">Voyageurs</Label>
                  <Input id="guestCount" name="guestCount" type="number" min={1} max={capacity} defaultValue={1} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="totalPrice">Total séjour *</Label>
                  <Input id="totalPrice" name="totalPrice" type="number" min={0} step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cleaningFee">Ménage</Label>
                  <Input id="cleaningFee" name="cleaningFee" type="number" min={0} step="0.01" defaultValue={0} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="platformFee">Frais plateforme</Label>
                  <Input id="platformFee" name="platformFee" type="number" min={0} step="0.01" defaultValue={0} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" name="notes" rows={2} />
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Enregistrer
              </Button>
            </form>
          )}

          {pricingOpen && (
            <form action={handlePricingSubmit} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pricingName">Période *</Label>
                  <Input id="pricingName" name="name" placeholder="Haute saison" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricePerNight">Prix / nuit *</Label>
                  <Input id="pricePerNight" name="pricePerNight" type="number" min={0} step="0.01" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingStart">Début *</Label>
                  <Input id="pricingStart" name="startDate" type="date" defaultValue={defaultCheckIn} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingEnd">Fin *</Label>
                  <Input id="pricingEnd" name="endDate" type="date" defaultValue={defaultCheckOut} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="weeklyDiscount">Remise semaine (%)</Label>
                  <Input id="weeklyDiscount" name="weeklyDiscount" type="number" min={0} max={100} step="0.01" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="monthlyDiscount">Remise mois (%)</Label>
                  <Input id="monthlyDiscount" name="monthlyDiscount" type="number" min={0} max={100} step="0.01" />
                </div>
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Ajouter le tarif
              </Button>
            </form>
          )}

          {blockedOpen && (
            <form action={handleBlockedSubmit} className="space-y-4 rounded-md border p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="blockedStart">Début *</Label>
                  <Input id="blockedStart" name="startDate" type="date" defaultValue={defaultCheckIn} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="blockedEnd">Fin *</Label>
                  <Input id="blockedEnd" name="endDate" type="date" defaultValue={defaultCheckOut} required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="reason">Motif</Label>
                <Input id="reason" name="reason" placeholder="Travaux, usage personnel..." />
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Bloquer
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Annulations rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {bookings.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Aucune réservation annulable</p>
          ) : (
            bookings.map((booking) => (
              <div key={booking.id} className="flex items-center justify-between gap-3 rounded-md border p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{booking.guestName}</p>
                  <p className="text-xs text-muted-foreground">{booking.status}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleCancelBooking(booking.id)}
                >
                  Annuler
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
