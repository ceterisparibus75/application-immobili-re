import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { getSocieties } from "@/actions/society";
import { SocietyProvider } from "@/providers/society-provider";
import { TopNav } from "@/components/layout/top-nav";
import { Header } from "@/components/layout/header";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SubscriptionBanner } from "@/components/layout/subscription-banner";
import { IdleTimeoutProvider } from "@/providers/idle-timeout-provider";
import { KeyboardShortcutsProvider } from "@/providers/keyboard-shortcuts-provider";
import { PageTransition } from "@/components/ui/page-transition";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { WelcomeScreen } from "@/components/welcome-screen";
import { SkipToContent, KeyboardFocusIndicator } from "@/components/ui/accessibility";
import { requiresTwoFactor } from "@/lib/plan-limits";
import { prisma } from "@/lib/prisma";

async function hasThirdPartyManagedLease(societyId: string): Promise<boolean> {
  const lease = await prisma.lease.findFirst({
    where: {
      societyId,
      deletedAt: null,
      isThirdPartyManaged: true,
    },
    select: { id: true },
  });

  return Boolean(lease);
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const h = await headers();
  const pathname = h.get("x-pathname") ?? "";

  if (pathname.startsWith("/aide")) {
    return <>{children}</>;
  }

  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Verifier si le 2FA est obligatoire (plan Enterprise) mais pas encore active
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

  const cookieStore = await cookies();
  const activeSocietyIdFromCookie = cookieStore.get("active-society-id")?.value;
  const activeSocietyId =
    societies.find((society) => society.id === activeSocietyIdFromCookie)?.id ?? societies[0]?.id ?? null;
  const navigationFeatures = {
    showThirdPartyManagement: activeSocietyId ? await hasThirdPartyManagedLease(activeSocietyId) : false,
  };

  return (
    <SocietyProvider initialSocieties={societies}>
      <IdleTimeoutProvider>
        <KeyboardShortcutsProvider>
          <SkipToContent />
          <KeyboardFocusIndicator />
          <div className="flex flex-col h-screen overflow-hidden">
            <TopNav navigationFeatures={navigationFeatures} />
            <Header navigationFeatures={navigationFeatures} />
            <SubscriptionBanner />
            <Breadcrumb />
            <main id="main-content" className="flex-1 overflow-y-auto px-6 py-6 lg:px-8" role="main">
              <PageTransition>{children}</PageTransition>
            </main>
          </div>
          <OnboardingWizard />
          <WelcomeScreen userName={session.user.name ?? undefined} />
        </KeyboardShortcutsProvider>
      </IdleTimeoutProvider>
    </SocietyProvider>
  );
}
