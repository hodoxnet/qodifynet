import { prisma } from "../db/prisma";
import { Prisma } from "@prisma/client";

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
    return prisma.$transaction(async (tx) => {
      const wallet = await tx.partnerWallet.update({ where: { partnerId }, data: { balance: { increment: amount } } });
      await tx.partnerLedger.create({ data: { partnerId, delta: amount, reason: "GRANT", byUserId, note } });
      const pricing = await tx.partnerPricing.findUnique({ where: { partnerId } });
      return { balance: wallet.balance, pricing };
    });
  }

  // Reserve credits for setup; makes later commit/cancel possible
  async reserveSetup(partnerId: string, tempRef: string, byUserId: string) {
    return prisma.$transaction(async (tx) => {
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
  }

  async commitReservation(partnerId: string, ledgerId: string, finalRef: string) {
    return prisma.$transaction(async (tx) => {
      const led = await tx.partnerLedger.findUnique({ where: { id: ledgerId } });
      if (!led || led.partnerId !== partnerId || led.reason !== "RESERVE") return false;
      await tx.partnerLedger.update({ where: { id: ledgerId }, data: { reason: "CONSUME", reference: finalRef } });
      return true;
    });
  }

  async cancelReservation(partnerId: string, ledgerId: string, note?: string) {
    return prisma.$transaction(async (tx) => {
      const led = await tx.partnerLedger.findUnique({ where: { id: ledgerId } });
      if (!led || led.partnerId !== partnerId || led.reason !== "RESERVE") return false;
      const amount = Math.abs(led.delta);
      await tx.partnerWallet.update({ where: { partnerId }, data: { balance: { increment: amount } } });
      await tx.partnerLedger.update({ where: { id: ledgerId }, data: { reason: "RESERVE_CANCEL", note: note || led.note } });
      return true;
    });
  }
}

