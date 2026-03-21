"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Mail, KeyRound } from "lucide-react";
import Link from "next/link";

export default function PortalActivatePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/portal/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/portal/dashboard");
      } else {
        setError(data.error ?? "Erreur d'activation");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <CardTitle>Activation de votre espace</CardTitle>
        <CardDescription>
          Entrez votre email et le code d'activation reçu par email
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="votre@email.fr"
                className="pl-9"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="code">Code d'activation</Label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                maxLength={6}
                className="pl-9 text-center text-lg tracking-widest font-mono"
                required
              />
            </div>
          </div>
          <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Activer mon espace"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <Link href="/portal/login" className="text-sm text-primary hover:underline">
            Déjà activé ? Se connecter
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
