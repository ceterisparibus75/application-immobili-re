"use client";

import { useState, useTransition } from "react";
import { updatePortalTenantContact } from "@/actions/portal-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { User, MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = { phone: string; mobile: string; address: string };

export function ProfileContactForm({ phone, mobile, address }: Props) {
  const [phoneVal, setPhoneVal] = useState(phone);
  const [mobileVal, setMobileVal] = useState(mobile);
  const [addressVal, setAddressVal] = useState(address);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, string> = {};
    if (phoneVal.trim()) data.phone = phoneVal.trim();
    if (mobileVal.trim()) data.mobile = mobileVal.trim();
    if (addressVal.trim()) data.address = addressVal.trim();

    startTransition(async () => {
      const result = await updatePortalTenantContact(data);
      if (result.success) {
        toast.success("Coordonnees mises a jour");
      } else {
        toast.error(result.error ?? "Erreur lors de la mise a jour");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Telephones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="h-4 w-4" />
            Coordonnees
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Telephone fixe</Label>
            <Input
              id="phone"
              type="tel"
              value={phoneVal}
              onChange={(e) => setPhoneVal(e.target.value)}
              placeholder="01 23 45 67 89"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile</Label>
            <Input
              id="mobile"
              type="tel"
              value={mobileVal}
              onChange={(e) => setMobileVal(e.target.value)}
              placeholder="06 12 34 56 78"
            />
          </div>
        </CardContent>
      </Card>

      {/* Adresse */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MapPin className="h-4 w-4" />
            Adresse postale
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="address">Adresse complete</Label>
            <Textarea
              id="address"
              value={addressVal}
              onChange={(e) => setAddressVal(e.target.value)}
              placeholder={"12 rue de la Paix\n75001 Paris"}
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Indiquez votre adresse de residence principale (utilisee pour vos quittances).
            </p>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}
