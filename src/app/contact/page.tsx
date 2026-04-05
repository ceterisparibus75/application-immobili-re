"use client";
import { useState } from "react";
import { Building2, Send, CheckCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sendContactEmail } from "./actions";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const form = e.currentTarget;
    const data = new FormData(form);
    const result = await sendContactEmail({
      name: data.get("name") as string,
      email: data.get("email") as string,
      subject: data.get("subject") as string,
      message: data.get("message") as string,
    });
    setLoading(false);
    if (result.success) {
      setSent(true);
    } else {
      setError(result.error ?? "Une erreur est survenue");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg">MyGestia</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/locaux" className="text-muted-foreground hover:text-foreground">Locaux disponibles</Link>
            <Link href="/login"><Button variant="outline" size="sm">Espace gestion</Button></Link>
          </nav>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold mb-2">Nous contacter</h1>
        <p className="text-muted-foreground mb-8">
          Une question sur nos locaux disponibles ? Nous vous repondrons dans les plus brefs delais.
        </p>

        {sent ? (
          <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-semibold">Message envoyé !</h2>
            <p className="text-muted-foreground">Nous vous recontacterons rapidement.</p>
            <Button variant="outline" asChild>
              <Link href="/">Retour a l'accueil</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nom complet</Label>
                <Input id="name" name="name" required placeholder="Jean Dupont" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required placeholder="jean@exemple.fr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Objet</Label>
              <Input id="subject" name="subject" required placeholder="Renseignement sur un local" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" name="message" required rows={6} placeholder="Decrivez votre demande..." />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              <Send className="h-4 w-4 mr-2" />
              {loading ? "Envoi en cours..." : "Envoyer le message"}
            </Button>
          </form>
        )}

        <div className="mt-12 pt-8 border-t">
          <h2 className="font-semibold mb-4">Coordonnees</h2>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>MyGestia</p>
            <p>contact@mygestia.immo</p>
          </div>
        </div>
      </main>

      <footer className="border-t py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MyGestia.</p>
          <div className="flex gap-4">
            <Link href="/mentions-legales" className="hover:text-foreground">Mentions legales</Link>
            <Link href="/politique-confidentialite" className="hover:text-foreground">Confidentialite</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
