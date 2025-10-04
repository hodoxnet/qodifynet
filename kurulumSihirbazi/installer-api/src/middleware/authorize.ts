import type { Request, Response, NextFunction } from "express";

export function authorize(...allowed: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { role?: string } | undefined;
    if (!user?.role) return res.status(403).json({ error: "Forbidden" });
    if (allowed.includes(user.role)) return next();
    return res.status(403).json({ error: "Forbidden" });
  };
}
