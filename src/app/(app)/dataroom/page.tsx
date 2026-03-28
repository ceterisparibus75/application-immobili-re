import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDatarooms } from "@/actions/dataroom";
import { DataroomList } from "./_components/dataroom-list";

export default async function DataroomPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const datarooms = await getDatarooms(societyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Datarooms</h1>
          <p className="text-muted-foreground text-sm">
            {datarooms.length} dataroom{datarooms.length !== 1 ? "s" : ""} · Espaces de partage de documents
          </p>
        </div>
      </div>
      <DataroomList societyId={societyId} datarooms={datarooms} />
    </div>
  );
}
