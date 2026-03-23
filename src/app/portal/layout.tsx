import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, FileText, Home, Shield, LogOut, ReceiptText } from "lucide-react";
import "../globals.css";

async function PortalNav({ tenantName }: { tenantName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto max-w-5xl flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/portal/dashboard" className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">Espace locataire</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              href="/portal/dashboard"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Home className="h-3.5 w-3.5" />
              Accueil
            </Link>
            <Link
              href="/portal/documents"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Documents
            </Link>
            <Link
              href="/portal/assurance"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Assurance
            </Link>
            <Link
              href="/portal/charges"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm hover:bg-accent transition-colors"
            >
              <ReceiptText className="h-3.5 w-3.5" />
              Charges
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:inline">{tenantName}</span>
          <form action="/api/portal/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();

  // Pages publiques du portail
  const publicPaths = ["/portal/login", "/portal/activate"];
  // Note: on ne peut pas facilement lire le pathname ici en App Router,
  // donc on rend le layout avec ou sans nav selon la session

  if (!session) {
    return (
      <html lang="fr" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center p-4">
            {children}
          </div>
        </body>
      </html>
    );
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: session.tenantId },
    select: {
      entityType: true,
      companyName: true,
      firstName: true,
      lastName: true,
    },
  });

  const tenantName = tenant
    ? tenant.entityType === "PERSONNE_MORALE"
      ? (tenant.companyName ?? "Locataire")
      : `${tenant.firstName ?? ""} ${tenant.lastName ?? ""}`.trim() || "Locataire"
    : "Locataire";

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <PortalNav tenantName={tenantName} />
        <main className="mx-auto max-w-5xl p-4 sm:p-6">{children}</main>
      </body>
    </html>
  );
}
