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
  CaseStudies,
  FAQ,
  FinalCTA,
  Footer,
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
  openGraph: {
    title: `${APP_NAME} — Logiciel de gestion immobilière pour foncières et gestionnaires`,
    description:
      "Plateforme sécurisée de gestion d'actifs immobiliers. Pilotage, conformité, reporting — conçue pour les foncières privées et les cabinets de gestion.",
    type: "website",
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
      <CaseStudies />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
