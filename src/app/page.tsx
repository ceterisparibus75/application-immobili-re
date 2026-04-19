import type { Metadata } from "next";
import {
  Navbar,
  Hero,
  SocialProof,
  ProblemSection,
  SolutionSection,
  FeaturesGrid,
  HighlightsBanner,
  HowItWorks,
  Pricing,
  Solutions,
  Comparison,
  CaseStudies,
  FAQ,
  FinalCTA,
  Footer,
  CookieBanner,
} from "@/components/landing";
import {
  APP_NAME,
  jsonLdOrganization,
  jsonLdSoftware,
  jsonLdFaq,
} from "@/components/landing/data";

export const metadata: Metadata = {
  title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
  description:
    "Pilotez votre patrimoine immobilier avec rigueur. Baux, facturation, comptabilité FEC, rapprochement bancaire, reporting consolidé. Conforme RGPD, hébergement européen, chiffrement AES-256.",
  alternates: {
    canonical: "https://mygestia.immo",
  },
  openGraph: {
    title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
    description:
      "Plateforme sécurisée de gestion d'actifs immobiliers. Pilotage, conformité, reporting — conçue pour les foncières privées et les cabinets de gestion.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Logiciel de gestion immobilière`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
    description:
      "Plateforme sécurisée de gestion d'actifs immobiliers. Pilotage, conformité, reporting — conçue pour les foncières privées et les cabinets de gestion.",
    images: ["/og-image.png"],
  },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdOrganization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSoftware) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

      <Navbar />
      <Hero />
      <SocialProof />
      <ProblemSection />
      <SolutionSection />
      <FeaturesGrid />
      <HighlightsBanner />
      <HowItWorks />
      <Pricing />
      <Solutions />
      <Comparison />
      <CaseStudies />
      <FAQ />
      <FinalCTA />
      <Footer />
      <CookieBanner />
    </div>
  );
}
