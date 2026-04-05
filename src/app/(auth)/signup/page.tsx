"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Check, ArrowRight } from "lucide-react";
import { registerUser } from "@/actions/register";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter — 19€/mois",
  PRO: "Pro — 79€/mois",
  ENTERPRISE: "Enterprise — 199€/mois",
};

function SignupForm() {
  const searchParams = useSearchParams();
  const plan = searchParams.get("plan")?.toUpperCase() || "STARTER";
  const planLabel = PLAN_LABELS[plan] || PLAN_LABELS.STARTER;

  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await registerUser({
        email,
        name,
        firstName,
        plan: plan as "STARTER" | "PRO" | "ENTERPRISE",
      });
      if (result.success && result.data) {
        setSuccess(true);
        setRegisteredEmail(result.data.email);
      } else {
        setError(result.error || "Une erreur est survenue");
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  }

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
          <Check className="h-7 w-7 text-green-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Compte créé avec succès !</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Un email a été envoyé à <strong className="text-foreground">{registeredEmail}</strong> avec votre mot de passe provisoire.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          Consultez votre boîte de réception (et vos spams) puis connectez-vous pour configurer votre patrimoine.
        </p>
        <Link href="/login">
          <Button className="w-full h-11 rounded-xl font-semibold text-sm mt-2 gap-2">
            Se connecter <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 text-center">
        <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full">
          {planLabel}
        </span>
        <p className="text-xs text-muted-foreground mt-2">14 jours d&apos;essai gratuit · Sans carte bancaire</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-xl bg-destructive/8 border border-destructive/20 p-3 text-sm text-destructive text-center">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="firstName" className="text-sm font-medium">Prénom</Label>
            <Input
              id="firstName"
              type="text"
              placeholder="Jean"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              disabled={isLoading}
              className="rounded-xl h-11"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-medium">Nom</Label>
            <Input
              id="name"
              type="text"
              placeholder="Dupont"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={isLoading}
              className="rounded-xl h-11"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Adresse email</Label>
          <Input
            id="email"
            type="email"
            placeholder="votre@email.fr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            disabled={isLoading}
            className="rounded-xl h-11"
          />
        </div>

        <Button type="submit" className="w-full h-11 rounded-xl font-semibold text-sm mt-2" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Création en cours...
            </>
          ) : (
            "Créer mon compte gratuitement"
          )}
        </Button>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
          En créant un compte, vous acceptez nos{" "}
          <Link href="/cgu" className="underline hover:text-foreground">CGU</Link> et notre{" "}
          <Link href="/politique-confidentialite" className="underline hover:text-foreground">Politique de confidentialité</Link>.
        </p>
      </form>

      <div className="mt-6 pt-4 border-t text-center">
        <p className="text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Se connecter
          </Link>
        </p>
      </div>
    </>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-muted" />}>
      <SignupForm />
    </Suspense>
  );
}
