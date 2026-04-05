"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Mail, KeyRound, ArrowLeft } from "lucide-react";
import { registerUser } from "@/actions/register";

const PLAN_LABELS: Record<string, string> = {
  STARTER: "Starter — 19€/mois",
  PRO: "Pro — 79€/mois",
  ENTERPRISE: "Enterprise — 199€/mois",
};

function SignupForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const plan = searchParams.get("plan")?.toUpperCase() || "STARTER";
  const planLabel = PLAN_LABELS[plan] || PLAN_LABELS.STARTER;

  const [name, setName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [accountExists, setAccountExists] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setAccountExists(false);
    setIsLoading(true);
    try {
      const result = await registerUser({
        email,
        name,
        firstName,
        plan: plan as "STARTER" | "PRO" | "ENTERPRISE",
      });
      if (result.success && result.data) {
        router.push(`/signup/confirm?email=${encodeURIComponent(result.data.email)}`);
      } else if (result.code === "ACCOUNT_EXISTS") {
        setAccountExists(true);
      } else {
        setError(result.error || "Une erreur est survenue");
      }
    } catch {
      setError("Une erreur est survenue");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSendReset() {
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setResetSent(true);
      } else {
        setError("Erreur lors de l'envoi. Réessayez.");
      }
    } catch {
      setError("Erreur lors de l'envoi. Réessayez.");
    } finally {
      setResetLoading(false);
    }
  }

  // État : compte existant détecté
  if (accountExists) {
    if (resetSent) {
      return (
        <div className="text-center space-y-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 mx-auto">
            <Mail className="h-7 w-7 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Email envoyé !</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Un lien de réinitialisation a été envoyé à <strong className="text-foreground">{email}</strong>.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Vérifiez votre boîte de réception et vos spams.
            </p>
          </div>
          <Link href="/login">
            <Button className="w-full h-11 rounded-xl font-semibold text-sm mt-2">
              Se connecter
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 mx-auto mb-3">
            <KeyRound className="h-5 w-5 text-amber-600" />
          </div>
          <p className="text-sm font-medium text-amber-900">
            Un compte existe déjà avec l&apos;adresse
          </p>
          <p className="text-sm font-semibold text-amber-900 mt-1">{email}</p>
        </div>

        <p className="text-sm text-muted-foreground text-center">
          Mot de passe oublié ? Nous pouvons vous envoyer un lien pour en définir un nouveau.
        </p>

        <Button
          onClick={handleSendReset}
          className="w-full h-11 rounded-xl font-semibold text-sm"
          disabled={resetLoading}
        >
          {resetLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Envoi en cours...
            </>
          ) : (
            <>
              <Mail className="h-4 w-4 mr-2" />
              Recevoir un lien de réinitialisation
            </>
          )}
        </Button>

        <div className="flex gap-3">
          <Link href="/login" className="flex-1">
            <Button variant="outline" className="w-full h-11 rounded-xl text-sm">
              Se connecter
            </Button>
          </Link>
          <Button
            variant="ghost"
            className="flex-1 h-11 rounded-xl text-sm"
            onClick={() => {
              setAccountExists(false);
              setEmail("");
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Autre email
          </Button>
        </div>
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
