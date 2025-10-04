import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers["authorization"] || "";
    const token = typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : undefined;

    if (!token) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role as any,
      partnerId: payload.partnerId,
      scopes: payload.scopes,
    } as any;
    next();
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
}
