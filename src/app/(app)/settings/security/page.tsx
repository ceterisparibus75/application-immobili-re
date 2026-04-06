import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TwoFactorSection } from "./_components/two-factor-section";
import { prisma } from "@/lib/prisma";
import { requiresTwoFactor } from "@/lib/plan-limits";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [user, twoFactorRequired] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { twoFactorEnabled: true },
    }),
    requiresTwoFactor(session.user.id),
  ]);

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Securite</h1>
        <p className="text-muted-foreground">Gerez la securite de votre compte</p>
      </div>
      <TwoFactorSection
        twoFactorEnabled={user?.twoFactorEnabled ?? false}
        twoFactorRequired={twoFactorRequired}
      />
    </div>
  );
}
