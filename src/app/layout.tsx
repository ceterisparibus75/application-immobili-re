import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/nextjs";
import { ZendeskWidget } from "@/components/zendesk-widget";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { ConsentAnalytics } from "@/components/layout/consent-analytics";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.AUTH_URL ?? "https://mygestia.immo"),
  title: {
    default: "MyGestia — Gestion immobiliere SaaS",
    template: "%s | MyGestia",
  },
  description: "Application de gestion locative et patrimoine immobilier",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyGestia",
    startupImage: [
      { url: "/icons/icon-512.png", media: "(device-width: 320px)" },
    ],
  },
  icons: {
    apple: [
      { url: "/icons/icon-apple.png", sizes: "180x180" },
      { url: "/icons/icon-152.png", sizes: "152x152" },
      { url: "/icons/icon-144.png", sizes: "144x144" },
      { url: "/icons/icon-128.png", sizes: "128x128" },
    ],
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B4F8A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`h-full ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="min-h-full font-sans antialiased">
        <SessionProvider>
          <ThemeProvider>
            <Sentry.ErrorBoundary
              fallback={
                <div className="p-8 text-center text-muted-foreground">
                  Une erreur inattendue est survenue.
                </div>
              }
            >
              {children}
            </Sentry.ErrorBoundary>
            <Toaster richColors closeButton />
            <ZendeskWidget />
            <PwaInstallPrompt />
            <ConsentAnalytics />
          </ThemeProvider>
        </SessionProvider>
      </body>
      <Script
        id="sw-register"
        strategy="lazyOnload"
        dangerouslySetInnerHTML={{
          __html: `if ("serviceWorker" in navigator) { navigator.serviceWorker.register("/sw.js"); }`,
        }}
      />
    </html>
  );
}
