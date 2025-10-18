import type { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    const header = req.headers["authorization"] || "";
    let token = typeof header === "string" && header.startsWith("Bearer ")
      ? header.slice(7)
      : undefined;

    if (!token && req.method === "GET") {
      const queryToken: string | undefined = typeof req.query?.access_token === "string"
        ? req.query.access_token
        : Array.isArray(req.query?.access_token)
          ? String(req.query?.access_token[0])
          : undefined;
      if (queryToken) {
        token = queryToken;
      }
    }

    if (!token) {
      const cookieToken = typeof (req as any).cookies?.bull_access === "string"
        ? (req as any).cookies.bull_access
        : undefined;
      if (cookieToken) {
        token = cookieToken;
      }
    }

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

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  try {
    const user = (req as any).user;
    if (!user || user.role !== "SUPER_ADMIN") {
      res.status(403).json({ error: "Forbidden: Super Admin access required" });
      return;
    }
    next();
  } catch (e) {
    res.status(403).json({ error: "Forbidden" });
  }
}
