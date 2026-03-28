import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatarooms } from "@/actions/dataroom";
import { DataroomsClient } from "./_components/datarooms-client";

export default async function DataroomsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const datarooms = await getDatarooms(societyId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Datarooms</h1>
        <p className="text-muted-foreground text-sm">
          Partagez des sélections de documents de façon sécurisée avec vos partenaires externes
        </p>
      </div>
      <DataroomsClient societyId={societyId} datarooms={datarooms} />
    </div>
  );
}
