import type { Response } from "express";

export function err(res: Response, status: number, code: string, message: string, details?: any) {
  return res.status(status).json({ ok: false, error: { code, message }, ...(details ? { details } : {}) });
}

export function ok(res: Response, data: any = {}) {
  return res.json({ ok: true, ...data });
}

