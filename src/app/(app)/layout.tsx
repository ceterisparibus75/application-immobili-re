import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSocieties } from "@/actions/society";
import { SocietyProvider } from "@/providers/society-provider";
import { TopNav } from "@/components/layout/top-nav";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { IdleTimeoutProvider } from "@/providers/idle-timeout-provider";
import { requiresTwoFactor } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verifier si le 2FA est obligatoire (plan Enterprise) mais pas encore active
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";
  const isSecurityPage = pathname.startsWith("/settings/security");

  if (!isSecurityPage) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    });

    if (!user?.twoFactorEnabled) {
      const mustEnable2FA = await requiresTwoFactor(session.user.id);
      if (mustEnable2FA) {
        redirect("/settings/security?setup2fa=required");
      }
    }
  }

  const societies = await getSocieties();

  if (societies.length === 0) {
    const isSetup =
      pathname.startsWith("/proprietaire/setup") ||
      pathname.startsWith("/societes/nouvelle") ||
      pathname.startsWith("/compte");
    if (!isSetup) {
      redirect("/proprietaire/setup");
    }
  }

  return (
    <SocietyProvider initialSocieties={societies}>
      <IdleTimeoutProvider>
        <div className="flex flex-col h-screen overflow-hidden">
          <TopNav />
          <Header />
          <SubscriptionBanner />
          <Breadcrumb />
          <main className="flex-1 overflow-y-auto px-6 py-6 lg:px-8">{children}</main>
        </div>
      </IdleTimeoutProvider>
    </SocietyProvider>
  );
}
