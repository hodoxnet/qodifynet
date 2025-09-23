import type { Request, Response, NextFunction } from "express";

const ROLE_ORDER = ["VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"] as const;
type Role = typeof ROLE_ORDER[number];

export function authorize(...allowed: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: Role } | undefined;
    if (!user?.role) return res.status(403).json({ error: "Forbidden" });
    if (allowed.includes(user.role)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}

