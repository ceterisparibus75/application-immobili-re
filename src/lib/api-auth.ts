import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export type AuthenticatedRouteContext = {
  userId: string;
};

export async function requireAuthenticatedRouteContext(): Promise<AuthenticatedRouteContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  return {
    userId: session.user.id,
  };
}

export async function getOptionalAuthenticatedRouteContext(): Promise<AuthenticatedRouteContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  return {
    userId: session.user.id,
  };
}
