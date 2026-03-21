"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Loader2, Mail, KeyRound } from "lucide-react";
import Link from "next/link";

export default function PortalLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (data.codeSent) {
        setStep("code");
      } else {
        setError(data.error ?? "Erreur");
      }
    } catch {
      setError("Erreur de connexion");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/portal/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/portal/dashboard");
      } else {
        setError(data.error ?? "Code invalide");
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
        <CardTitle>Espace locataire</CardTitle>
        <CardDescription>
          {step === "email"
            ? "Entrez votre email pour recevoir un code de connexion"
            : "Un code à 6 chiffres a été envoyé à votre adresse email"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive mb-4">
            {error}
          </div>
        )}

        {step === "email" ? (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
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
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Recevoir mon code"}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleCodeSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code de connexion</Label>
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Se connecter"}
            </Button>
            <button
              type="button"
              onClick={() => { setStep("email"); setCode(""); setError(""); }}
              className="w-full text-sm text-muted-foreground hover:underline"
            >
              Changer d'adresse email
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link href="/portal/activate" className="text-sm text-primary hover:underline">
            Première connexion ? Activez votre compte
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
