import fs from "fs-extra";
import path from "path";
import { v4 as uuidv4 } from "uuid";

export type PartnerMember = { userId: string; role: "PARTNER_ADMIN" | "PARTNER_INSTALLER" };
export type PartnerLedger = { id: string; delta: number; reason: "GRANT" | "CONSUME" | "ADJUST" | "RESERVE" | "RESERVE_CANCEL"; reference?: string | null; byUserId?: string | null; note?: string | null; createdAt: string };
export type Partner = {
  id: string;
  name: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  wallet: { balance: number };
  pricing: { setupCredits: number };
  members: PartnerMember[];
  ledger: PartnerLedger[];
  createdAt: string;
  updatedAt: string;
};

type Store = { partners: Partner[] };

class SimpleMutex {
  private queue: Promise<any> = Promise.resolve();
  runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.then(() => {}, () => {});
    return run;
  }
}

export class PartnerRepository {
  private static instance: PartnerRepository;
  private readonly dataPath: string;
  private locks = new Map<string, SimpleMutex>();

  private constructor() {
    this.dataPath = path.join(process.cwd(), "data", "partners.json");
  }

  public static getInstance(): PartnerRepository {
    if (!PartnerRepository.instance) PartnerRepository.instance = new PartnerRepository();
    return PartnerRepository.instance;
  }

  private async load(): Promise<Store> {
    await fs.ensureDir(path.dirname(this.dataPath));
    if (!(await fs.pathExists(this.dataPath))) {
      await fs.writeJSON(this.dataPath, { partners: [] }, { spaces: 2 });
    }
    return (await fs.readJSON(this.dataPath)) as Store;
  }

  private async save(store: Store): Promise<void> {
    await fs.writeJSON(this.dataPath, store, { spaces: 2 });
  }

  private mutexFor(partnerId: string): SimpleMutex {
    let m = this.locks.get(partnerId);
    if (!m) { m = new SimpleMutex(); this.locks.set(partnerId, m); }
    return m;
  }

  async list(): Promise<Partner[]> {
    const s = await this.load();
    return s.partners;
  }

  async getById(id: string): Promise<Partner | null> {
    const s = await this.load();
    return s.partners.find(p => p.id === id) || null;
  }

  async findByUserId(userId: string): Promise<{ partner: Partner; member: PartnerMember } | null> {
    const s = await this.load();
    for (const p of s.partners) {
      const m = p.members.find(mm => mm.userId === userId);
      if (m) return { partner: p, member: m };
    }
    return null;
  }

  async create(name: string, setupCredits = 1): Promise<Partner> {
    const s = await this.load();
    const now = new Date().toISOString();
    const newP: Partner = {
      id: uuidv4(),
      name,
      status: "approved",
      wallet: { balance: 0 },
      pricing: { setupCredits },
      members: [],
      ledger: [],
      createdAt: now,
      updatedAt: now,
    };
    s.partners.push(newP);
    await this.save(s);
    return newP;
  }

  async addMember(partnerId: string, userId: string, role: PartnerMember["role"]): Promise<Partner | null> {
    const s = await this.load();
    const p = s.partners.find(pp => pp.id === partnerId);
    if (!p) return null;
    if (!p.members.find(m => m.userId === userId)) p.members.push({ userId, role });
    p.updatedAt = new Date().toISOString();
    await this.save(s);
    return p;
  }

  async grantCredits(partnerId: string, amount: number, byUserId?: string, note?: string): Promise<Partner | null> {
    const mutex = this.mutexFor(partnerId);
    return mutex.runExclusive(async () => {
      const s = await this.load();
      const p = s.partners.find(pp => pp.id === partnerId);
      if (!p) return null;
      p.wallet.balance += amount;
      p.ledger.push({ id: uuidv4(), delta: amount, reason: "GRANT", reference: null, byUserId: byUserId || null, note: note || null, createdAt: new Date().toISOString() });
      p.updatedAt = new Date().toISOString();
      await this.save(s);
      return p;
    });
  }

  async reserveSetup(partnerId: string, tempRef: string, byUserId: string): Promise<{ ok: boolean; ledgerId?: string; price?: number; balance?: number; needed?: number }>{
    const mutex = this.mutexFor(partnerId);
    return mutex.runExclusive(async () => {
      const s = await this.load();
      const p = s.partners.find(pp => pp.id === partnerId);
      if (!p) return { ok: false };
      const price = p.pricing.setupCredits || 1;
      if (p.wallet.balance < price) return { ok: false, needed: price, balance: p.wallet.balance, price };
      p.wallet.balance -= price;
      const id = uuidv4();
      p.ledger.push({ id, delta: -price, reason: "RESERVE", reference: tempRef, byUserId, note: "setup-reserve", createdAt: new Date().toISOString() });
      p.updatedAt = new Date().toISOString();
      await this.save(s);
      return { ok: true, ledgerId: id, price, balance: p.wallet.balance };
    });
  }

  async commitReservation(partnerId: string, ledgerId: string, finalRef: string): Promise<boolean> {
    const mutex = this.mutexFor(partnerId);
    return mutex.runExclusive(async () => {
      const s = await this.load();
      const p = s.partners.find(pp => pp.id === partnerId);
      if (!p) return false;
      const tx = p.ledger.find(l => l.id === ledgerId && l.reason === "RESERVE");
      if (!tx) return false;
      tx.reason = "CONSUME";
      tx.reference = finalRef;
      p.updatedAt = new Date().toISOString();
      await this.save(s);
      return true;
    });
  }

  async cancelReservation(partnerId: string, ledgerId: string, note?: string): Promise<boolean> {
    const mutex = this.mutexFor(partnerId);
    return mutex.runExclusive(async () => {
      const s = await this.load();
      const p = s.partners.find(pp => pp.id === partnerId);
      if (!p) return false;
      const tx = p.ledger.find(l => l.id === ledgerId && l.reason === "RESERVE");
      if (!tx) return false;
      // iade
      p.wallet.balance += Math.abs(tx.delta);
      tx.reason = "RESERVE_CANCEL";
      if (note) tx.note = note;
      p.updatedAt = new Date().toISOString();
      await this.save(s);
      return true;
    });
  }
}
