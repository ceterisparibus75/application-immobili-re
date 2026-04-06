import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateConsolidatedReport, computeNextRunAt, computeReportYear, getReportLabel, getFrequencyLabel } from "@/lib/reports/consolidated";
import { sendConsolidatedReportEmail } from "@/lib/email";

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

    // 1. Trouver les planifications actives dont la date d'exécution est atteinte
    const dueSchedules = await prisma.reportSchedule.findMany({
      where: {
        isActive: true,
        nextRunAt: { lte: now },
      },
      include: {
        society: { select: { name: true } },
      },
    });

    if (dueSchedules.length === 0) {
      return NextResponse.json({ success: true, message: "Aucune planification à exécuter", sent: 0 });
    }

    let sent = 0;
    let errors = 0;

    for (const schedule of dueSchedules) {
      try {
        // Génération du rapport consolidé

        // 2. Déterminer l'année du rapport
        const year = computeReportYear(schedule.frequency);

        // 3. Générer le rapport consolidé (fusion PDF)
        const result = await generateConsolidatedReport(
          schedule.societyId,
          schedule.reportTypes,
          year
        );

        // 4. Envoyer par email à chaque destinataire
        const reportLabels = schedule.reportTypes.map(getReportLabel);
        const frequencyLabel = getFrequencyLabel(schedule.frequency);

        for (const recipient of schedule.recipients) {
          try {
            const emailResult = await sendConsolidatedReportEmail({
              to: recipient,
              scheduleName: schedule.name,
              frequencyLabel,
              reportLabels,
              societyName: schedule.society.name,
              attachment: {
                filename: result.filename,
                content: result.buffer,
              },
            });

            if (!emailResult.success) {
              console.error(`[send-reports] Échec envoi à ${recipient}:`, emailResult.error);
            }
          } catch (emailError) {
            console.error(`[send-reports] Erreur email à ${recipient}:`, emailError);
          }
        }

        // 5. Mettre à jour lastSentAt et calculer le prochain envoi
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            lastSentAt: now,
            nextRunAt: computeNextRunAt(schedule.frequency, now),
          },
        });

        sent++;
      } catch (scheduleError) {
        errors++;
        console.error(`[send-reports] Erreur pour "${schedule.name}":`, scheduleError);

        // Ne pas bloquer les autres planifications en cas d'erreur
        // Décaler le prochain envoi pour éviter les boucles d'erreur
        await prisma.reportSchedule.update({
          where: { id: schedule.id },
          data: {
            nextRunAt: computeNextRunAt(schedule.frequency, now),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      total: dueSchedules.length,
      sent,
      errors,
    });
  } catch (error) {
    console.error("[send-reports] Erreur globale:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
