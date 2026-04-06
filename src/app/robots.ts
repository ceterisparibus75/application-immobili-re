import type { MetadataRoute } from "next";

const SITE_URL = process.env.AUTH_URL ?? "https://app.mygestia.immo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/securite", "/pricing", "/contact", "/aide", "/locaux", "/cgu", "/cgv", "/mentions-legales", "/politique-confidentialite", "/dpa"],
        disallow: ["/dashboard", "/api/", "/patrimoine", "/baux", "/locataires", "/facturation", "/comptabilite", "/banque", "/relances", "/rapports", "/rgpd", "/administration", "/societes", "/proprietaire", "/portal/", "/settings/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
