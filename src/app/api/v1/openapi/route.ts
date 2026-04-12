import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { openApiSpec } from "@/lib/openapi";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
