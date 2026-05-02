"use client";

import { useState, useTransition } from "react";
import { updatePortalTenantContact } from "@/actions/portal-tenant";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ProfileContactForm({ phone, mobile }: { phone: string; mobile: string }) {
  const [phoneVal, setPhoneVal] = useState(phone);
  const [mobileVal, setMobileVal] = useState(mobile);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const data: Record<string, string> = {};
    if (phoneVal.trim()) data.phone = phoneVal.trim();
    if (mobileVal.trim()) data.mobile = mobileVal.trim();

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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="h-4 w-4" />
          Coordonnees
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enregistrer
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
