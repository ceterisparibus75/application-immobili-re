import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
    requires2FA?: boolean;
    twoFactorVerified?: boolean;
    pendingTwoFactorSecret?: string | null;
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    image?: string | null;
    requires2FA?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    requires2FA?: boolean;
    twoFactorVerified?: boolean;
    pendingTwoFactorSecret?: string | null;
  }
}
