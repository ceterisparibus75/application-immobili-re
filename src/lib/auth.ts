import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compareSync } from "bcryptjs";
import { prisma } from "./prisma";

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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        let user;
        try {
          user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            include: {
              userSocieties: {
                include: { society: { select: { id: true, name: true } } },
              },
            },
          });
        } catch (err) {
          console.error("[auth] DB error:", err);
          return null;
        }

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = compareSync(password, user.passwordHash);
        if (!isPasswordValid) {
          return null;
        }

        // Mettre a jour la date de derniere connexion
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });
        } catch (err) {
          console.error("[auth] update lastLoginAt error:", err);
        }

        // Si 2FA active, retourner un token partiel
        if (user.twoFactorEnabled) {
          return {
            id: user.id,
            email: user.email,
            name: user.name ?? user.firstName ?? user.email,
            image: user.image,
            requires2FA: true,
          };
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.firstName ?? user.email,
          image: user.image,
        };
      },
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
        if ("pendingTwoFactorSecret" in session) {
          token.pendingTwoFactorSecret = (session.pendingTwoFactorSecret as string | null) ?? undefined;
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
      // Exposer le statut 2FA dans la session
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const s = session as any;
      s.requires2FA = token.requires2FA ?? false;
      s.twoFactorVerified = token.twoFactorVerified ?? false;
      if (token.pendingTwoFactorSecret !== undefined) {
        s.pendingTwoFactorSecret = token.pendingTwoFactorSecret ?? null;
      }
      return session;
    },
  },
});
