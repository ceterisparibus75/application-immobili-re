import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getDataroom } from "@/actions/dataroom";
import { getDocuments } from "@/actions/document";
import { DataroomManager } from "./_components/dataroom-manager";

export default async function DataroomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const [dataroom, allDocuments] = await Promise.all([
    getDataroom(societyId, id),
    getDocuments(societyId),
  ]);

  if (!dataroom) notFound();

  return (
    <DataroomManager
      societyId={societyId}
      dataroom={dataroom}
      allDocuments={allDocuments}
    />
  );
}
