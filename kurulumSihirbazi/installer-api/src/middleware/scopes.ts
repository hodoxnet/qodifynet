import type { Request, Response, NextFunction } from "express";

export function requireScopes(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string; scopes?: string[] } | undefined;
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Staff adminler için scope kontrolünü atla; diğer tüm roller için scope gerekli
    if (user.role && ["SUPER_ADMIN", "ADMIN"].includes(user.role)) return next();

    const scopes = new Set(user.scopes || []);
    for (const s of required) {
      if (!scopes.has(s)) return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}

export function enforcePartnerOwnership(getCustomerId: (req: Request) => string | undefined) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user as { role?: string; partnerId?: string } | undefined;
      if (!user) return res.status(401).json({ error: "Unauthorized" });

      // Staff adminler için atla (sadece ADMIN ve SUPER_ADMIN)
      if (user.role && ["SUPER_ADMIN", "ADMIN"].includes(user.role)) {
        return next();
      }

      if (!user.partnerId) return res.status(403).json({ error: "Forbidden" });

      const { CustomerDbRepository } = await import("../repositories/customer.db.repository");
      const repo = CustomerDbRepository.getInstance();
      const id = getCustomerId(req);
      if (!id) return res.status(400).json({ error: "Customer id required" });
      const customer = await repo.getById(id);
      if (!customer) return res.status(404).json({ error: "Customer not found" });
      if (customer.partnerId && customer.partnerId !== user.partnerId) return res.status(403).json({ error: "Forbidden" });
      next();
    } catch (e: any) {
      return res.status(500).json({ error: e?.message || "Ownership check failed" });
    }
  };
}
