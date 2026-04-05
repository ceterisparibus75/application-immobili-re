import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getLoginRatelimit } from "@/lib/rate-limit";
import { randomBytes } from "crypto";

export async function POST(request: NextRequest) {
  // Rate limiting
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
  const limiter = getLoginRatelimit();
  const { success } = await limiter.limit(ip);
  if (!success) {
    return NextResponse.json({ error: "Trop de tentatives" }, { status: 429 });
  }

  const body = await request.json();
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";

  if (!email) {
    return NextResponse.json({ error: "Email requis" }, { status: 400 });
  }

  // Toujours repondre OK pour eviter l'enumeration de comptes
  const genericResponse = NextResponse.json({
    message: "Si un compte existe avec cet email, un lien de reinitialisation a ete envoye.",
  });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Generer un token securise
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 heure

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpiresAt: expiresAt,
      },
    });

    // Envoyer l'email
    const { sendPasswordResetEmail } = await import("@/lib/email");
    const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      to: user.email,
      name: user.name ?? user.firstName ?? user.email,
      resetUrl,
    });
  } catch (err) {
    console.error("[forgot-password]", err);
  }

  return genericResponse;
}
