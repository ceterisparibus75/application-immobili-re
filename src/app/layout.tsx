import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/providers/session-provider";
import { ThemeProvider } from "@/providers/theme-provider";
import { Toaster } from "sonner";
import * as Sentry from "@sentry/nextjs";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: "Gestion Immobilière",
    template: "%s | Gestion Immobilière",
  },
  description:
    "Application de gestion de baux commerciaux et patrimoine immobilier",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full`} suppressHydrationWarning>
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
    </html>
  );
}
