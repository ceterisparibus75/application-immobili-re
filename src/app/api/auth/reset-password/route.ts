import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSync } from "bcryptjs";
import { getLoginRatelimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const limiter = getLoginRatelimit();
  const { success } = await limiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const body = await request.json();
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password) {
    return NextResponse.json({ error: "Token et mot de passe requis" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Le mot de passe doit contenir au moins 8 caracteres" }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({ where: { resetToken: token } });

    if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: "Lien invalide ou expire" }, { status: 400 });
    }

    const passwordHash = hashSync(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetToken: null,
        resetTokenExpiresAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return NextResponse.json({ message: "Mot de passe reinitialise avec succes" });
  } catch (err) {
    console.error("[reset-password]", err);
    return NextResponse.json({ error: "Erreur lors de la reinitialisation" }, { status: 500 });
  }
}
