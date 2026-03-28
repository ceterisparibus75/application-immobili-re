import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 1. Passer en EN_RETARD les factures dont l'échéance est dépassée
    const overdueResult = await prisma.invoice.updateMany({
      where: {
        status: { in: ["ENVOYEE", "EN_ATTENTE", "PARTIELLEMENT_PAYE"] },
        dueDate: { lt: now },
      },
      data: { status: "EN_RETARD" },
    });

    // 2. Auto-escalade : créer des relances automatiques
    let remindersCreated = 0;

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ["EN_RETARD", "RELANCEE"] },
        dueDate: { lt: now },
      },
      include: {
        tenant: { select: { id: true, email: true } },
        lease: { select: { id: true, societyId: true } },
      },
    });

    for (const invoice of overdueInvoices) {
      if (!invoice.lease) continue;

      const societyId = invoice.societyId;
      const leaseId = invoice.lease.id;
      const daysSinceDue = Math.floor(
        (now.getTime() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      // Trouver le scénario de relance par défaut
      const scenario = await prisma.reminderScenario.findFirst({
        where: { societyId, isDefault: true, isActive: true },
        include: { steps: { orderBy: { daysAfterDue: "asc" } } },
      });
      if (!scenario) continue;

      // Vérifier les relances déjà envoyées pour ce bail contenant cette facture
      const existingReminders = await prisma.reminder.findMany({
        where: { leaseId },
        select: { level: true, invoiceIds: true },
      });
      // Niveaux déjà envoyés pour cette facture spécifique
      const sentLevels = new Set(
        existingReminders
          .filter((r) => r.invoiceIds.includes(invoice.id))
          .map((r) => r.level)
      );

      // Trouver la prochaine étape applicable
      for (const step of scenario.steps) {
        if (daysSinceDue >= step.daysAfterDue && !sentLevels.has(step.level)) {
          if (step.requiresValidation) continue; // Pas d'auto-envoi pour les mises en demeure

          await prisma.reminder.create({
            data: {
              leaseId,
              tenantId: invoice.tenantId,
              level: step.level,
              invoiceIds: [invoice.id],
              totalAmount: invoice.totalTTC ?? invoice.totalHT,
              channel: step.channel,
              subject: step.subject,
              body: step.bodyTemplate,
              sentAt: now,
              isSent: true,
            },
          });

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: "RELANCEE" },
          });

          remindersCreated++;
          break; // Une seule relance par exécution de cron
        }
      }
    }

    return NextResponse.json({
      success: true,
      overdueMarked: overdueResult.count,
      remindersCreated,
    });
  } catch (error) {
    console.error("[cron/invoice-reminder]", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
