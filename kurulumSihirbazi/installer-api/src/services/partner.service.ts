import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";
import { AuditService } from "./audit.service";

export class PartnerService {
  async createPartner(name: string, setupCredits = 1) {
    return prisma.$transaction(async (tx) => {
      const partner = await tx.partner.create({ data: { name, status: "approved" } });
      await tx.partnerWallet.create({ data: { partnerId: partner.id, balance: 0 } });
      await tx.partnerPricing.create({ data: { partnerId: partner.id, setupCredits } });
      return partner;
    });
  }

  async addMember(partnerId: string, userId: string, role: "PARTNER_ADMIN" | "PARTNER_INSTALLER") {
    return prisma.partnerMember.upsert({
      where: { userId },
      create: { partnerId, userId, role },
      update: { partnerId, role },
    });
  }

  async getById(id: string) {
    return prisma.partner.findUnique({ where: { id }, include: { wallet: true, pricing: true } });
  }

  async findByUserId(userId: string) {
    const mem = await prisma.partnerMember.findUnique({ where: { userId }, include: { partner: true } });
    if (!mem) return null;
    return { partner: mem.partner, member: { userId: mem.userId, role: mem.role as any } };
  }

  async grantCredits(partnerId: string, amount: number, byUserId?: string, note?: string) {
    const audit = new AuditService();
    const result = await prisma.$transaction(async (tx) => {
      const wallet = await tx.partnerWallet.update({ where: { partnerId }, data: { balance: { increment: amount } } });
      await tx.partnerLedger.create({ data: { partnerId, delta: amount, reason: "GRANT", byUserId, note } });
      const pricing = await tx.partnerPricing.findUnique({ where: { partnerId } });
      return { balance: wallet.balance, pricing };
    });
    await audit.log({ actorId: byUserId || null, action: "PARTNER_CREDIT_GRANT", targetType: "Partner", targetId: partnerId, metadata: { amount, note } });
    return result;
  }

  // Reserve credits for setup; makes later commit/cancel possible
  async reserveSetup(partnerId: string, tempRef: string, byUserId: string) {
    const audit = new AuditService();
    const out = await prisma.$transaction(async (tx) => {
      // lock wallet row for update
      await tx.$executeRawUnsafe(`SELECT 1 FROM "PartnerWallet" WHERE "partnerId" = $1 FOR UPDATE`, partnerId);
      const [wallet, pricing] = await Promise.all([
        tx.partnerWallet.findUnique({ where: { partnerId } }),
        tx.partnerPricing.findUnique({ where: { partnerId } }),
      ]);
      if (!wallet || !pricing) return { ok: false } as const;
      const price = pricing.setupCredits || 1;
      if (wallet.balance < price) return { ok: false, price, balance: wallet.balance } as const;
      const updated = await tx.partnerWallet.update({ where: { partnerId }, data: { balance: { decrement: price } } });
      const ledger = await tx.partnerLedger.create({ data: { partnerId, delta: -price, reason: "RESERVE", reference: tempRef, byUserId, note: "setup-reserve" } });
      return { ok: true, ledgerId: ledger.id, price, balance: updated.balance } as const;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (out.ok) await audit.log({ actorId: byUserId, action: "PARTNER_CREDIT_RESERVE", targetType: "Partner", targetId: partnerId, metadata: { tempRef, price: out.price } });
    return out;
  }

  async commitReservation(partnerId: string, ledgerId: string, finalRef: string) {
    const audit = new AuditService();
    const ok = await prisma.$transaction(async (tx) => {
      const led = await tx.partnerLedger.findUnique({ where: { id: ledgerId } });
      if (!led || led.partnerId !== partnerId || led.reason !== "RESERVE") return false;
      await tx.partnerLedger.update({ where: { id: ledgerId }, data: { reason: "CONSUME", reference: finalRef } });
      return true;
    });
    if (ok) await audit.log({ action: "PARTNER_CREDIT_CONSUME", targetType: "Partner", targetId: partnerId, metadata: { ledgerId, finalRef } });
    return ok;
  }

  async cancelReservation(partnerId: string, ledgerId: string, note?: string) {
    const audit = new AuditService();
    const ok = await prisma.$transaction(async (tx) => {
      const led = await tx.partnerLedger.findUnique({ where: { id: ledgerId } });
      if (!led || led.partnerId !== partnerId || led.reason !== "RESERVE") return false;
      const amount = Math.abs(led.delta);
      await tx.partnerWallet.update({ where: { partnerId }, data: { balance: { increment: amount } } });
      await tx.partnerLedger.update({ where: { id: ledgerId }, data: { reason: "RESERVE_CANCEL", note: note || led.note } });
      return true;
    });
    if (ok) await audit.log({ action: "PARTNER_CREDIT_RESERVE_CANCEL", targetType: "Partner", targetId: partnerId, metadata: { ledgerId, note } });
    return ok;
  }

  // Applications
  async createApplication(form: Record<string, any>) {
    return prisma.partnerApplication.create({ data: { form, status: "pending" } });
  }

  async getApplication(id: string) {
    return prisma.partnerApplication.findUnique({ where: { id } });
  }

  async listApplications(status?: string) {
    return prisma.partnerApplication.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" } });
  }

  async approveApplication(applicationId: string, partnerId: string, decidedBy: string) {
    return prisma.$transaction(async (tx) => {
      const app = await tx.partnerApplication.findUnique({ where: { id: applicationId } });
      if (!app || app.status !== "pending") throw new Error("Application not pending");
      await tx.partnerApplication.update({ where: { id: applicationId }, data: { status: "approved", decidedAt: new Date(), decidedBy, partnerId } });
      return true;
    });
  }

  async rejectApplication(applicationId: string, decidedBy: string, reason?: string) {
    const app = await this.getApplication(applicationId);
    const form: any = app?.form && typeof app.form === 'object' ? { ...(app.form as any) } : {};
    form.rejectedReason = reason;
    return prisma.partnerApplication.update({ where: { id: applicationId }, data: { status: "rejected", decidedAt: new Date(), decidedBy, form } });
  }

  async updatePricing(partnerId: string, setupCredits: number) {
    const pricing = await prisma.partnerPricing.upsert({ where: { partnerId }, create: { partnerId, setupCredits }, update: { setupCredits } });
    return pricing;
  }

  async getLedger(partnerId: string, take = 50) {
    return prisma.partnerLedger.findMany({ where: { partnerId }, orderBy: { createdAt: "desc" }, take });
  }
}
