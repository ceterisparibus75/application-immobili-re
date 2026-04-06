import {
  Shield,
  Lock,
  Globe,
  Server,
  Key,
  FileCheck,
  Users,
  Eye,
  Database,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Metadata } from "next";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

export const metadata: Metadata = {
  title: `Sécurité & Conformité — ${APP_NAME}`,
  description:
    "Infrastructure européenne, chiffrement AES-256-GCM, authentification multifacteur, conformité RGPD et export FEC. Découvrez les engagements de sécurité de MyGestia.",
};

const infraItems = [
  {
    icon: Globe,
    title: "Hébergement souverain européen",
    description:
      "Vos données sont hébergées exclusivement dans des datacenters européens (Frankfurt, Allemagne). Aucun transfert hors UE. Fournisseur conforme aux normes ISO 27001 et SOC 2.",
  },
  {
    icon: Server,
    title: "Haute disponibilité & redondance",
    description:
      "Architecture distribuée avec réplication automatique des données. SLA de disponibilité garanti à 99,9%. Sauvegardes journalières avec rétention de 30 jours.",
  },
  {
    icon: Database,
    title: "Isolation des données",
    description:
      "Chaque société dispose d'un espace logiquement isolé. Les requêtes sont systématiquement scopées par identifiant de société, empêchant tout accès croisé entre locataires de la plateforme.",
  },
];

const encryptionItems = [
  {
    icon: Lock,
    title: "Chiffrement AES-256-GCM",
    description:
      "Les données bancaires sensibles (IBAN, BIC) sont chiffrées au repos avec l'algorithme AES-256-GCM, le standard utilisé par les institutions financières. Les clés de chiffrement sont gérées de manière sécurisée et distincte des données.",
  },
  {
    icon: Key,
    title: "Authentification multifacteur (MFA)",
    description:
      "Chaque utilisateur peut activer l'authentification à deux facteurs (TOTP). Les sessions sont limitées à 24 heures avec renouvellement par token JWT signé. Protection contre le bruteforce par rate-limiting.",
  },
  {
    icon: Users,
    title: "Contrôle d'accès granulaire (RBAC)",
    description:
      "Cinq niveaux de rôles hiérarchiques : Super Admin, Admin Société, Gestionnaire, Comptable, Lecture seule. Chaque action est vérifiée côté serveur avant exécution.",
  },
  {
    icon: Eye,
    title: "Audit logs exhaustifs",
    description:
      "Chaque création, modification et suppression est enregistrée dans un journal d'audit horodaté, associé à l'utilisateur et à la société. Conservation conforme pendant 12 mois.",
  },
];

const complianceItems = [
  {
    icon: Shield,
    title: "Conformité RGPD native",
    description:
      "Consentement éclairé, droit à l'effacement, portabilité des données, registre des traitements. Module RGPD intégré avec gestion des demandes d'exercice de droits et durées de conservation paramétrables.",
    details: [
      "Durées de conservation par type de donnée (locataire actif, archivé, document d'identité, données bancaires)",
      "Anonymisation automatique après expiration",
      "Export des données personnelles sur demande",
      "Registre des consentements avec horodatage",
    ],
  },
  {
    icon: FileCheck,
    title: "Fichier des Écritures Comptables (FEC)",
    description:
      "L'export FEC est généré nativement au format requis par l'administration fiscale française (article L.47 A du Livre des procédures fiscales). Structure conforme, numérotation séquentielle, pièces justificatives liées.",
    details: [
      "Format XML/CSV conforme aux spécifications DGFiP",
      "Numérotation chronologique et continue des écritures",
      "Traçabilité complète : journal, date, pièce, montant, lettrage",
      "Prêt à transmettre à votre expert-comptable ou au vérificateur",
    ],
  },
];

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-white/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mygestia.svg" alt={APP_NAME} className="h-9" width={140} height={36} />
          </Link>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-[var(--color-brand-deep)] font-semibold">
                Se connecter
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="gap-1.5 bg-brand-gradient-soft hover:opacity-90 text-white rounded-lg">
                Évaluer la solution <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(27,79,138,0.08),transparent)]" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16 sm:pt-28 sm:pb-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[var(--color-brand-light)] text-[var(--color-brand-blue)] text-sm font-semibold px-5 py-2 rounded-full mb-8 ring-1 ring-[var(--color-brand-cyan)]/20">
            <Shield className="h-4 w-4" />
            Sécurité & Conformité
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] mb-6 text-[var(--color-brand-deep)]">
            La sécurité de vos données,
            <br />
            <span className="text-brand-gradient">notre engagement fondateur.</span>
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Hébergement souverain, chiffrement de grade bancaire, conformité réglementaire — chaque couche de MyGestia est conçue pour protéger vos actifs numériques.
          </p>
        </div>
      </section>

      {/* Infrastructure */}
      <section className="py-20 sm:py-28 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Infrastructure</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              Une infrastructure pensée pour la pérennité
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Vos données patrimoniales méritent un socle technique à la hauteur de leur valeur.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {infraItems.map((item) => (
              <div key={item.title} className="rounded-xl border border-border/60 bg-white p-8 shadow-brand">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-gradient-soft text-white mb-5">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-[var(--color-brand-deep)] mb-3">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chiffrement & Accès */}
      <section className="py-20 sm:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Chiffrement & Accès</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              Protection des données à chaque niveau
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Du chiffrement des données bancaires au contrôle d&apos;accès par rôle, chaque interaction est sécurisée et tracée.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {encryptionItems.map((item) => (
              <div key={item.title} className="rounded-xl border border-border/60 bg-[#F9FAFB] p-8 shadow-brand">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient-soft text-white">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-brand-deep)]">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Conformité Réglementaire */}
      <section className="py-20 sm:py-28 bg-[#F9FAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-[var(--color-brand-cyan)] font-semibold text-sm tracking-wide uppercase mb-3">Conformité réglementaire</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[var(--color-brand-deep)] mb-5">
              RGPD et conformité fiscale intégrées
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              La conformité n&apos;est pas une option — elle est native dans chaque fonctionnalité de la plateforme.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {complianceItems.map((item) => (
              <div key={item.title} className="rounded-xl border border-border/60 bg-white p-8 shadow-brand">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-gradient-soft text-white">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-[var(--color-brand-deep)]">{item.title}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">{item.description}</p>
                <ul className="space-y-2.5">
                  {item.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle className="h-4 w-4 text-[var(--color-brand-cyan)] mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Résumé des engagements */}
      <section className="py-16 bg-white border-t border-border/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[var(--color-brand-deep)] text-center mb-10">Nos engagements en synthèse</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: "Hébergement", value: "UE (Frankfurt)" },
              { label: "Chiffrement", value: "AES-256-GCM" },
              { label: "Disponibilité", value: "SLA 99,9%" },
              { label: "Sauvegardes", value: "Quotidiennes" },
              { label: "Authentification", value: "MFA (TOTP)" },
              { label: "RGPD", value: "Conforme" },
              { label: "Export FEC", value: "Natif" },
              { label: "Audit logs", value: "12 mois" },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-lg bg-[#F9FAFB]">
                <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-1">{item.label}</p>
                <p className="text-base font-bold text-[var(--color-brand-deep)]">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div className="absolute inset-0 bg-brand-gradient" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-5 text-white">
            Des questions sur notre politique de sécurité ?
          </h2>
          <p className="text-lg text-white/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Notre équipe est à votre disposition pour répondre à vos exigences de conformité et de sécurité.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/contact">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 gap-2 bg-white text-[var(--color-brand-deep)] hover:bg-white/90 font-bold rounded-lg shadow-xl"
              >
                Contacter l&apos;équipe sécurité
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dpa">
              <Button
                size="lg"
                className="w-full sm:w-auto text-base px-8 h-13 bg-white/15 text-white hover:bg-white/25 font-bold border-2 border-white/30 rounded-lg"
              >
                Consulter le DPA
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer minimaliste */}
      <footer className="border-t border-border/60 py-8 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} MTG HOLDING · {APP_NAME}. Tous droits réservés.</p>
          <div className="flex items-center gap-6">
            <Link href="/mentions-legales" className="hover:text-foreground transition-colors">Mentions légales</Link>
            <Link href="/politique-confidentialite" className="hover:text-foreground transition-colors">Confidentialité</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Accueil</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
