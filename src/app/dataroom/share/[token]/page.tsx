import { notFound } from "next/navigation";
import { getDataroomMeta } from "@/actions/dataroom";
import { DataroomShareClient } from "./_components/dataroom-share-client";

export default async function DataroomSharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const meta = await getDataroomMeta(token);
  if (!meta) notFound();

  return <DataroomShareClient token={token} meta={meta} />;
}
