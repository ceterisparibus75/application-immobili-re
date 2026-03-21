import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
        console.log("[auth] authorize called, email:", credentials?.email);
        if (!credentials?.email || !credentials?.password) {
          console.log("[auth] missing credentials");
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

        console.log("[auth] user found:", !!user, "isActive:", user?.isActive);

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);
        console.log("[auth] password valid:", isPasswordValid);
        if (!isPasswordValid) {
          return null;
        }

        // Mettre à jour la date de dernière connexion
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

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
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
