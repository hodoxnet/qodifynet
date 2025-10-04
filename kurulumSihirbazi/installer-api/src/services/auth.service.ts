import { prisma } from "../db/prisma";
import { hashPassword, verifyPassword } from "../utils/password";
import { signAccessToken, signRefreshToken } from "../utils/jwt";
import { getPartnerContext } from "../utils/partner-auth";
import crypto from "crypto";

export class AuthService {
  async ensureFirstUser(email: string, password: string, name?: string) {
    const count = await prisma.user.count();
    if (count > 0) return null;
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role: "SUPER_ADMIN",
      },
    });
    return user;
  }

  async register(email: string, password: string, role: string = "VIEWER", name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error("Email already in use");
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({ data: { email, name, passwordHash, role: role as any } });
    return user;
  }

  async login(email: string, password: string, userAgent?: string, ip?: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid credentials");
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) throw new Error("Invalid credentials");

    const jti = crypto.randomUUID();

    // Partner üyeliği varsa partnerId ve partner scope'larını JWT'ye ekle
    const { partnerId, scopes } = await getPartnerContext(user.id);

    const basePayload = { sub: user.id, email: user.email, role: user.role as any, partnerId, scopes } as const;
    const access = signAccessToken(basePayload as any);
    const refresh = signRefreshToken({ ...(basePayload as any), jti } as any);

    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30); // 30d
    await prisma.session.create({
      data: { userId: user.id, refreshJti: jti, userAgent, ip, expiresAt },
    });

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return { user, access, refresh };
  }

  async refresh(jti: string, userId: string, userAgent?: string, ip?: string) {
    const existing = await prisma.session.findUnique({ where: { refreshJti: jti } });
    if (!existing) throw new Error("Invalid session");
    if (existing.userId !== userId || existing.revokedAt) {
      await prisma.session.updateMany({ where: { userId }, data: { revokedAt: new Date() } });
      throw new Error("Token reuse detected");
    }
    const now = new Date();
    if (existing.expiresAt <= now) {
      await prisma.session.update({ where: { id: existing.id }, data: { revokedAt: new Date() } });
      throw new Error("Session expired");
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error("User not found");
    const newJti = crypto.randomUUID();

    // Partner bilgisi ve scope'ları koru
    const { partnerId, scopes } = await getPartnerContext(user.id);

    const basePayload = { sub: user.id, email: user.email, role: user.role as any, partnerId, scopes } as const;
    const access = signAccessToken(basePayload as any);
    const refresh = signRefreshToken({ ...(basePayload as any), jti: newJti } as any);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
    await prisma.$transaction([
      prisma.session.update({ where: { id: existing.id }, data: { revokedAt: new Date() } }),
      prisma.session.create({
        data: { userId: user.id, refreshJti: newJti, userAgent, ip, expiresAt },
      }),
    ]);
    return { user, access, refresh };
  }

  async logout(jti: string) {
    await prisma.session.updateMany({ where: { refreshJti: jti, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
