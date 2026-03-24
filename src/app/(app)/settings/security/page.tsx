import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TwoFactorSection } from "./_components/two-factor-section";
import { prisma } from "@/lib/prisma";

export default async function SecuritySettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true },
  });

  return (
    <div className="container max-w-2xl py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Securite</h1>
        <p className="text-muted-foreground">Gerez la securite de votre compte</p>
      </div>
      <TwoFactorSection twoFactorEnabled={user?.twoFactorEnabled ?? false} />
    </div>
  );
}
