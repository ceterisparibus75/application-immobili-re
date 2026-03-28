import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { getDataroom } from "@/actions/dataroom";
import { getDocuments } from "@/actions/document";
import { DataroomDetail } from "../_components/dataroom-detail";

export default async function DataroomDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const cookieStore = await cookies();
  const societyId = cookieStore.get("active-society-id")?.value;
  if (!societyId) redirect("/dashboard");

  const { id } = await params;
  const dataroom = await getDataroom(societyId, id);
  if (!dataroom) notFound();

  const allDocuments = await getDocuments(societyId);

  return <DataroomDetail societyId={societyId} dataroom={dataroom} allDocuments={allDocuments} />;
}
