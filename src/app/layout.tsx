import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/nextjs";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ZendeskWidget } from "@/components/zendesk-widget";

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
  },
  themeColor: "#1B4F8A",
  viewport: {
    width: "device-width",
    initialScale: 1,
  },
  icons: {
    apple: "/icons/icon-apple.png",
    icon: "/icons/icon-192.png",
  },
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
            <Analytics />
            <SpeedInsights />
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
