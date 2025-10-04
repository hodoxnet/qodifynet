import { Router } from "express";
import { prisma } from "../db/prisma";
import { err, ok } from "../utils/http";

export const auditRouter = Router();

// Get audit logs (SUPER_ADMIN only)
auditRouter.get("/", async (req, res) => {
  try {
    const user = (req as any).user as { role: string; id: string };
    if (user.role !== "SUPER_ADMIN") {
      return err(res, 403, "FORBIDDEN", "Forbidden");
    }

    const take = Math.min(parseInt(req.query.take as string) || 100, 500);
    const skip = parseInt(req.query.skip as string) || 0;
    const action = req.query.action as string | undefined;
    const actorId = req.query.actorId as string | undefined;

    const where: any = {};
    if (action) where.action = action;
    if (actorId) where.actorId = actorId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              name: true,
              role: true,
            },
          },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return ok(res, { logs, total, take, skip });
  } catch (e: any) {
    return err(res, 500, "AUDIT_FETCH_FAILED", e?.message || "Failed to fetch audit logs");
  }
});

// Get audit log stats (SUPER_ADMIN only)
auditRouter.get("/stats", async (req, res) => {
  try {
    const user = (req as any).user as { role: string };
    if (user.role !== "SUPER_ADMIN") {
      return err(res, 403, "FORBIDDEN", "Forbidden");
    }

    const [
      totalLogs,
      last24h,
      topActions,
      topActors,
    ] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),
      prisma.auditLog.groupBy({
        by: ["action"],
        _count: { action: true },
        orderBy: { _count: { action: "desc" } },
        take: 10,
      }),
      prisma.auditLog.groupBy({
        by: ["actorId"],
        _count: { actorId: true },
        where: { actorId: { not: null } },
        orderBy: { _count: { actorId: "desc" } },
        take: 10,
      }),
    ]);

    return ok(res, {
      totalLogs,
      last24h,
      topActions: topActions.map(a => ({ action: a.action, count: a._count.action })),
      topActors: topActors.map(a => ({ actorId: a.actorId, count: a._count.actorId })),
    });
  } catch (e: any) {
    return err(res, 500, "STATS_FAILED", e?.message || "Failed to fetch stats");
  }
});
