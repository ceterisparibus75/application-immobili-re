import { auth } from "@/lib/auth";
import { UnauthenticatedActionError } from "@/lib/action-society";

type AuthSession = {
  user: {
    id: string;
  };
  requires2FA?: boolean;
};

export type AuthenticatedActionContext = {
  userId: string;
  session: AuthSession;
};

export async function requireAuthenticatedActionContext(): Promise<AuthenticatedActionContext> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new UnauthenticatedActionError();
  }

  return {
    userId: session.user.id,
    session,
  };
}

export async function getOptionalAuthenticatedActionContext(): Promise<AuthenticatedActionContext | null> {
  const session = await auth();
  if (!session?.user?.id) {
    return null;
  }

  return {
    userId: session.user.id,
    session,
  };
}
