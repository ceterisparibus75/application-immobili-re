import { requirePortalAuth } from "@/lib/portal-auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { ProfileContactForm } from "./_form";

export const metadata = { title: "Mon profil" };

export default async function PortalProfilePage() {
  let session;
  try {
    session = await requirePortalAuth();
  } catch {
    redirect("/portal/login");
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: session.tenantId, email: { equals: session.email, mode: "insensitive" }, isActive: true },
    select: { phone: true, mobile: true },
  });

  if (!tenant) redirect("/portal/login");

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
        <p className="text-muted-foreground">Mettez a jour vos coordonnees de contact.</p>
      </div>
      <ProfileContactForm phone={tenant.phone ?? ""} mobile={tenant.mobile ?? ""} />
    </div>
  );
}
