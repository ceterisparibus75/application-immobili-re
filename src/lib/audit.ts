import { AuditAction } from "@/generated/prisma/client";
import { prisma } from "./prisma";

interface AuditLogParams {
  societyId: string;
  userId?: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Enregistre une action dans le journal d'audit.
 * Appeler cette fonction après chaque action sensible (CRUD, export, envoi email, etc.)
 */
export async function createAuditLog(params: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        societyId: params.societyId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        details: params.details ? JSON.parse(JSON.stringify(params.details)) : undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    // L'audit ne doit pas bloquer l'action principale
    console.error("[AUDIT] Failed to create audit log:", error);
  }
}

/**
 * Récupère les logs d'audit pour une société, paginés.
 */
export async function getAuditLogs(
  societyId: string,
  options: {
    page?: number;
    perPage?: number;
    entity?: string;
    action?: AuditAction;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  } = {}
) {
  const {
    page = 1,
    perPage = 50,
    entity,
    action,
    userId,
    startDate,
    endDate,
    search,
  } = options;

  const where: Record<string, unknown> = {
    societyId,
    ...(entity && { entity }),
    ...(action && { action }),
    ...(userId && { userId }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  if (search) {
    where.OR = [
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs,
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
  };
}

/**
 * Récupère tous les logs d'audit pour export CSV (sans pagination).
 */
export async function getAuditLogsForExport(
  societyId: string,
  options: {
    entity?: string;
    action?: AuditAction;
    userId?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  } = {}
) {
  const { entity, action, userId, startDate, endDate, search } = options;

  const where: Record<string, unknown> = {
    societyId,
    ...(entity && { entity }),
    ...(action && { action }),
    ...(userId && { userId }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: startDate }),
            ...(endDate && { lte: endDate }),
          },
        }
      : {}),
  };

  if (search) {
    where.OR = [
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { user: { name: { contains: search, mode: "insensitive" } } },
      { user: { email: { contains: search, mode: "insensitive" } } },
    ];
  }

  return prisma.auditLog.findMany({
    where,
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
}
