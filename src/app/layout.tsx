import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/nextjs";

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
    maximumScale: 1,
    userScalable: false,
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
    <html lang="fr" className="h-full" suppressHydrationWarning>
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
          </ThemeProvider>
        </SessionProvider>
      </body>
      <script
        dangerouslySetInnerHTML={{
          __html: `if ("serviceWorker" in navigator) { window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js"); }); }`,
        }}
      />
    </html>
  );
}
