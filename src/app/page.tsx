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
  title: `${APP_NAME} — Pilotage immobilier multi-sociétés pour SCI et foncières`,
  description:
    "Unifiez gestion locative, banque, comptabilité FEC, documents et reporting propriétaire pour vos SCI, holdings patrimoniales et foncières privées.",
  alternates: {
    canonical: "https://mygestia.immo",
  },
  openGraph: {
    title: `${APP_NAME} — Pilotage immobilier multi-sociétés pour SCI et foncières`,
    description:
      "Plateforme sécurisée pour patrimoines immobiliers multi-sociétés : location, comptabilité, banque, conformité et reporting consolidé.",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Pilotage immobilier multi-sociétés`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Pilotage immobilier multi-sociétés pour SCI et foncières`,
    description:
      "Plateforme sécurisée pour patrimoines immobiliers multi-sociétés : location, comptabilité, banque, conformité et reporting consolidé.",
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
