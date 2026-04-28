"use server";

import { requireAuthenticatedActionContext } from "@/lib/action-auth";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, requireSuperAdmin } from "@/lib/permissions";
import { UnauthenticatedActionError } from "@/lib/action-society";
import type { ActionResult } from "@/actions/society";

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function readAuditEvent(details: unknown): string {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return "ACTION";
  }

  const event = (details as Record<string, unknown>).event;
  return typeof event === "string" ? event : "ACTION";
}

function readAuditEmail(details: unknown): string | null {
  if (!details || typeof details !== "object" || Array.isArray(details)) {
    return null;
  }

  const email = (details as Record<string, unknown>).email;
  return typeof email === "string" ? email : null;
}

export type AdminSupervisionData = Awaited<ReturnType<typeof buildAdminSupervision>>;

async function buildAdminSupervision() {
  const now = new Date();
  const last7Days = daysAgo(7);
  const last30Days = daysAgo(30);

  const [
    totalUsers,
    activeUsers,
    usersCreated30d,
    usersLogged7d,
    failedAttemptUsers,
    lockedUsers,
    totalSocieties,
    activeSocieties,
    societiesCreated30d,
    totalMemberships,
    subscriptionGroups,
    roleGroups,
    recentUsers,
    recentProfiles,
    recentAuditLogins,
    recentAuditEvents,
    largestSocieties,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.user.count({ where: { lastLoginAt: { gte: last7Days } } }),
    prisma.user.count({ where: { failedLoginAttempts: { gt: 0 } } }),
    prisma.user.count({ where: { lockedUntil: { gt: now } } }),
    prisma.society.count(),
    prisma.society.count({ where: { isActive: true } }),
    prisma.society.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.userSociety.count(),
    prisma.subscription.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    prisma.userSociety.groupBy({
      by: ["role"],
      _count: { _all: true },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        createdAt: true,
        email: true,
        name: true,
        firstName: true,
        isActive: true,
        lastLoginAt: true,
        failedLoginAttempts: true,
        lockedUntil: true,
      },
    }),
    prisma.userSociety.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            firstName: true,
            lastLoginAt: true,
          },
        },
        society: {
          select: {
            id: true,
            name: true,
            legalForm: true,
          },
        },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: "LOGIN", entity: "User" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        user: { select: { id: true, email: true, name: true, firstName: true } },
        society: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        user: { select: { id: true, email: true, name: true, firstName: true } },
        society: { select: { id: true, name: true } },
      },
    }),
    prisma.society.findMany({
      orderBy: { userSocieties: { _count: "desc" } },
      take: 8,
      select: {
        id: true,
        name: true,
        legalForm: true,
        isActive: true,
        createdAt: true,
        _count: {
          select: {
            userSocieties: true,
            leases: true,
            buildings: true,
          },
        },
        subscription: {
          select: {
            planId: true,
            status: true,
            trialEnd: true,
            currentPeriodEnd: true,
          },
        },
      },
    }),
  ]);

  const recentLogins = recentAuditLogins.map((log) => ({
    id: log.id,
    createdAt: log.createdAt,
    event: readAuditEvent(log.details),
    email: log.user?.email ?? readAuditEmail(log.details),
    userName: [log.user?.firstName, log.user?.name].filter(Boolean).join(" ") || null,
    societyName: log.society.name,
  }));

  return {
    generatedAt: now,
    stats: {
      totalUsers,
      activeUsers,
      usersCreated30d,
      usersLogged7d,
      failedAttemptUsers,
      lockedUsers,
      totalSocieties,
      activeSocieties,
      societiesCreated30d,
      totalMemberships,
    },
    subscriptionStatus: subscriptionGroups.map((group) => ({
      status: group.status,
      count: group._count._all,
    })),
    roles: roleGroups.map((group) => ({
      role: group.role,
      count: group._count._all,
    })),
    recentUsers,
    recentProfiles: recentProfiles.map((profile) => ({
      id: profile.id,
      createdAt: profile.createdAt,
      role: profile.role,
      user: profile.user,
      society: profile.society,
    })),
    recentLogins,
    recentAuditEvents: recentAuditEvents.map((log) => ({
      id: log.id,
      createdAt: log.createdAt,
      action: log.action,
      entity: log.entity,
      event: readAuditEvent(log.details),
      userEmail: log.user?.email ?? readAuditEmail(log.details),
      userName: [log.user?.firstName, log.user?.name].filter(Boolean).join(" ") || null,
      societyName: log.society.name,
    })),
    largestSocieties,
  };
}

export async function getAdminSupervision(): Promise<ActionResult<AdminSupervisionData>> {
  try {
    const context = await requireAuthenticatedActionContext();
    await requireSuperAdmin(context.userId);

    const data = await buildAdminSupervision();
    return { success: true, data };
  } catch (error) {
    if (error instanceof UnauthenticatedActionError) {
      return { success: false, error: error.message };
    }
    if (error instanceof ForbiddenError) {
      return { success: false, error: "Accès réservé aux super administrateurs" };
    }

    console.error("[getAdminSupervision]", error);
    return { success: false, error: "Impossible de charger la supervision admin" };
  }
}
