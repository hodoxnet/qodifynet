import { prisma } from "../db/prisma";

export class AuditService {
  async log(params: {
    actorId?: string | null;
    action: string;
    targetType?: string | null;
    targetId?: string | null;
    metadata?: any;
    ip?: string | null;
    userAgent?: string | null;
  }) {
    const { actorId = null, action, targetType = null, targetId = null, metadata, ip = null, userAgent = null } = params;
    try {
      await prisma.auditLog.create({
        data: {
          actorId: actorId || null,
          action,
          targetType: targetType || null,
          targetId: targetId || null,
          metadata: metadata ? (metadata as any) : undefined,
          ip: ip || null,
          userAgent: userAgent || null,
        },
      });
    } catch (e) {
      // fail-safe: audit hataları uygulamayı etkilemesin
      console.error("Audit log failed:", e);
    }
  }
}

