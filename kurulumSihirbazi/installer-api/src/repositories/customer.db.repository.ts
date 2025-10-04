import { prisma } from "../db/prisma";
import { Customer } from "../types/customer.types";

function toEntity(row: any): Customer {
  return {
    id: row.id,
    domain: row.domain,
    status: (row.status || "stopped") as any,
    createdAt: (row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt)),
    partnerId: row.partnerId || undefined,
    ports: {
      backend: Number(row.portsBackend),
      admin: Number(row.portsAdmin),
      store: Number(row.portsStore),
    },
    resources: { cpu: 0, memory: 0 },
    mode: row.mode || "local",
    db: row.dbName ? {
      name: row.dbName,
      user: row.dbUser,
      host: row.dbHost,
      port: row.dbPort || 5432,
      schema: row.dbSchema || "public",
    } : undefined,
    redis: row.redisHost ? {
      host: row.redisHost,
      port: row.redisPort || 6379,
      prefix: row.redisPrefix || undefined,
    } : undefined,
  };
}

export class CustomerDbRepository {
  private static instance: CustomerDbRepository;
  static getInstance(): CustomerDbRepository {
    if (!CustomerDbRepository.instance) CustomerDbRepository.instance = new CustomerDbRepository();
    return CustomerDbRepository.instance;
  }

  async getAll(): Promise<Customer[]> {
    const rows = await prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toEntity);
  }

  async getById(id: string): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({ where: { id } });
    return row ? toEntity(row) : null;
  }

  async getByDomain(domain: string): Promise<Customer | null> {
    const row = await prisma.customer.findUnique({ where: { domain } });
    return row ? toEntity(row) : null;
  }

  async save(customer: Customer): Promise<void> {
    const data: any = {
      id: customer.id,
      domain: customer.domain,
      status: customer.status,
      mode: customer.mode || "local",
      portsBackend: customer.ports.backend,
      portsAdmin: customer.ports.admin,
      portsStore: customer.ports.store,
      partnerId: customer.partnerId || null,
      dbName: customer.db?.name || null,
      dbUser: customer.db?.user || null,
      dbHost: customer.db?.host || null,
      dbPort: customer.db?.port || null,
      dbSchema: customer.db?.schema || "public",
      redisHost: customer.redis?.host || null,
      redisPort: customer.redis?.port || null,
      redisPrefix: customer.redis?.prefix || null,
    };
    await prisma.customer.upsert({ where: { id: customer.id }, update: data, create: { ...data, slug: customer.domain.replace(/\./g, "-"), companyName: null } });
  }

  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const prev = await prisma.customer.findUnique({ where: { id } });
    if (!prev) return null;
    const entity = toEntity(prev);
    const next: Customer = { ...entity, ...updates, ports: { ...entity.ports, ...(updates.ports || {}) } };
    await this.save(next);
    return await this.getById(id);
  }

  async delete(id: string): Promise<boolean> {
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) return false;
    await prisma.customer.delete({ where: { id } });
    return true;
  }

  async getNextAvailablePort(): Promise<number> {
    const rows = await prisma.customer.findMany({ select: { portsBackend: true, portsAdmin: true, portsStore: true } });
    const used = new Set<number>();
    rows.forEach(r => { used.add(r.portsBackend); used.add(r.portsAdmin); used.add(r.portsStore); });
    let base = 4000;
    while (used.has(base) || used.has(base + 1) || used.has(base + 2)) base += 3;
    return base;
  }

  async exists(id: string): Promise<boolean> {
    const row = await prisma.customer.findUnique({ where: { id } });
    return !!row;
  }

  async domainExists(domain: string): Promise<boolean> {
    const row = await prisma.customer.findUnique({ where: { domain } });
    return !!row;
  }
}

