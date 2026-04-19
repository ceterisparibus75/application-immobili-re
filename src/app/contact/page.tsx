"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Send } from "lucide-react";
import { sendContactEmail } from "./actions";
import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";

const INITIAL_STATE = { success: false };

export default function ContactPage() {
  const [state, action, isPending] = useActionState(sendContactEmail, INITIAL_STATE);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="mb-10">
          <span className="inline-block bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4">
            Contactez-nous
          </span>
          <h1 className="text-3xl font-bold text-foreground mb-3">
            Parlons de votre projet
          </h1>
          <p className="text-muted-foreground leading-relaxed">
            Une question, une démonstration, un devis ? Notre équipe vous répond sous 24h ouvrées.
          </p>
        </div>

        {state.error && (
          <div className="mb-6 rounded-xl bg-destructive/8 border border-destructive/20 p-4 text-sm text-destructive">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-5">
          {/* Prénom + Nom */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">Prénom</Label>
              <Input id="firstName" name="firstName" required placeholder="Jean" className="rounded-xl h-11" disabled={isPending} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">Nom</Label>
              <Input id="name" name="name" required placeholder="Dupont" className="rounded-xl h-11" disabled={isPending} />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">Adresse email professionnelle</Label>
            <Input id="email" name="email" type="email" required placeholder="jean@societe.fr" className="rounded-xl h-11" autoComplete="email" disabled={isPending} />
          </div>

          {/* Société */}
          <div className="space-y-1.5">
            <Label htmlFor="society">Nom de la société</Label>
            <Input id="society" name="society" required placeholder="SARL Patrimoine Dupont" className="rounded-xl h-11" disabled={isPending} />
          </div>

          {/* Taille du portefeuille */}
          <div className="space-y-1.5">
            <Label htmlFor="portfolioSize">Taille de votre portefeuille</Label>
            <select
              id="portfolioSize"
              name="portfolioSize"
              required
              defaultValue=""
              disabled={isPending}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>Sélectionnez...</option>
              <option value="<10">Moins de 10 lots</option>
              <option value="10-50">10 à 50 lots</option>
              <option value="50-200">50 à 200 lots</option>
              <option value="200+">Plus de 200 lots</option>
            </select>
          </div>

          {/* Plan d'intérêt */}
          <div className="space-y-1.5">
            <Label htmlFor="plan">Plan qui vous intéresse</Label>
            <select
              id="plan"
              name="plan"
              required
              defaultValue=""
              disabled={isPending}
              className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="" disabled>Sélectionnez...</option>
              <option value="essentiel">Essentiel — 19€/mois</option>
              <option value="professionnel">Professionnel — 79€/mois</option>
              <option value="institutionnel">Institutionnel — 199€/mois</option>
              <option value="unknown">Je ne sais pas encore</option>
            </select>
          </div>

          {/* Message */}
          <div className="space-y-1.5">
            <Label htmlFor="message">Votre message</Label>
            <Textarea
              id="message"
              name="message"
              required
              rows={5}
              placeholder="Décrivez votre besoin, posez vos questions ou demandez une démonstration..."
              className="rounded-xl resize-none"
              disabled={isPending}
            />
          </div>

          {/* Consentement RGPD */}
          <div className="flex items-start gap-3 pt-1">
            <input
              type="checkbox"
              id="rgpd"
              name="rgpd"
              required
              className="mt-0.5 h-4 w-4 rounded border-gray-300 accent-primary"
            />
            <label htmlFor="rgpd" className="text-sm text-muted-foreground leading-relaxed">
              J'accepte que mes données soient utilisées pour me recontacter conformément à la{" "}
              <Link href="/politique-confidentialite" className="underline hover:text-foreground transition-colors">
                politique de confidentialité
              </Link>{" "}
              de MyGestia.
            </label>
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full h-11 rounded-xl font-semibold gap-2 bg-brand-gradient-soft hover:opacity-90 text-white mt-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Envoyer ma demande
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            Réponse sous 24h ouvrées · contact@mygestia.immo
          </p>
        </form>
      </main>

      <Footer />
    </div>
  );
}
