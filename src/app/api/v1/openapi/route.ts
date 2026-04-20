import { NextResponse } from "next/server";
import { requireAuthenticatedRouteContext } from "@/lib/api-auth";
import { openApiSpec } from "@/lib/openapi";

export async function GET() {
  const context = await requireAuthenticatedRouteContext();
  if (context instanceof NextResponse) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return NextResponse.json(openApiSpec, {
    headers: {
      "Content-Type": "application/json",
    },
  });
}
