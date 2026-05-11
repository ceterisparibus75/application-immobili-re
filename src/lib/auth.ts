import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authorizeCredentials } from "./auth-credentials";

export const { handlers, auth, signIn, signOut, unstable_update: update } = NextAuth({
  trustHost: true,
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 heures
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      // Mise a jour manuelle du token via update()
      if (trigger === "update" && session) {
        if ("requires2FA" in session) {
          token.requires2FA = session.requires2FA as boolean;
        }
        if ("twoFactorVerified" in session) {
          token.twoFactorVerified = session.twoFactorVerified as boolean;
        }
        return token;
      }

      if (user) {
        token.id = user.id;
        // Propager le flag 2FA depuis authorize()
        if (user.requires2FA === true) {
          token.requires2FA = true;
          token.twoFactorVerified = false;
          return token; // Ne pas enrichir tant que 2FA non complete
        }
      }

      // Si 2FA requis et non verifie, ne pas enrichir le token
      if (token.requires2FA && !token.twoFactorVerified) {
        return token;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      // Exposer le statut 2FA dans la session (types declares dans src/types/next-auth.d.ts)
      // Object.assign evite le conflit de types strict de NextAuth v5
      return Object.assign(session, {
        requires2FA: (token.requires2FA ?? false) as boolean,
        twoFactorVerified: (token.twoFactorVerified ?? false) as boolean,
      });
    },
  },
});
