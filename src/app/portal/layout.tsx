import { getPortalSession } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import {
  Building2, FileText, Home, Shield, LogOut, ReceiptText,
  MessageSquare, Menu, Upload,
} from "lucide-react";
import "../globals.css";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME ?? "MyGestia";

/* ------------------------------------------------------------------ */
/*  Nav links                                                          */
/* ------------------------------------------------------------------ */

const navLinks = [
  { href: "/portal/dashboard", label: "Accueil", icon: Home },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/assurance", label: "Assurance", icon: Shield },
  { href: "/portal/charges", label: "Charges", icon: ReceiptText },
  { href: "/portal/upload", label: "Envoyer", icon: Upload },
  { href: "/portal/tickets", label: "Demandes", icon: MessageSquare },
];

/* ------------------------------------------------------------------ */
/*  Portal Nav (branded)                                               */
/* ------------------------------------------------------------------ */

function PortalNav({ tenantName, initials }: { tenantName: string; initials: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-gradient shadow-brand-lg">
      <div className="mx-auto max-w-6xl flex h-16 items-center justify-between px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/portal/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
              <Building2 className="h-4.5 w-4.5 text-white" />
            </div>
            <div className="hidden sm:block">
              <span className="text-sm font-bold text-white">{APP_NAME}</span>
              <span className="text-[10px] text-white/60 block -mt-0.5">Espace locataire</span>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              >
                <link.icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white text-xs font-bold">
              {initials}
            </div>
            <span className="text-sm text-white/80 max-w-[140px] truncate">{tenantName}</span>
          </div>
          <form action="/api/portal/logout" method="POST">
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav */}
      <div className="md:hidden border-t border-white/10 overflow-x-auto">
        <div className="flex items-center gap-0.5 px-4 py-1.5">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-white/70 hover:text-white hover:bg-white/10 transition-colors whitespace-nowrap"
            >
              <link.icon className="h-3 w-3" />
              {link.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();

  if (!session) {
    return (
      <html lang="fr" suppressHydrationWarning>
        <body className="min-h-screen bg-background font-sans antialiased">
          <div className="flex min-h-screen flex-col items-center justify-center p-4">
            <div className="mb-8 flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <span className="text-lg font-bold text-[var(--color-brand-deep)]">{APP_NAME}</span>
                <span className="text-xs text-muted-foreground block">Espace locataire</span>
              </div>
            </div>
            {children}
          </div>
        </body>
      </html>
    );
  }

  const tenant = await prisma.tenant.findFirst({
    where: { email: { equals: session.email, mode: "insensitive" }, isActive: true },
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

  const initials = tenant
    ? tenant.entityType === "PERSONNE_MORALE"
      ? (tenant.companyName ?? "L").slice(0, 2).toUpperCase()
      : `${(tenant.firstName ?? "L")[0]}${(tenant.lastName ?? "")[0] ?? ""}`.toUpperCase()
    : "L";

  return (
    <html lang="fr" suppressHydrationWarning>
      <body className="min-h-screen bg-[#F8FAFC] font-sans antialiased">
        <PortalNav tenantName={tenantName} initials={initials} />
        <main className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</main>
        <footer className="border-t mt-12 py-6 text-center text-xs text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} {APP_NAME} &middot; Espace locataire sécurisé</p>
        </footer>
      </body>
    </html>
  );
}
