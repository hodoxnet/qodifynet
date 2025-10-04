import type { Request, Response, NextFunction } from 'express';

const parseAllowed = (str: string | undefined) =>
  (str || 'http://localhost:3030').split(',').map(s => s.trim()).filter(Boolean);

export function verifyOrigin(req: Request, res: Response, next: NextFunction) {
  try {
    const allowed = new Set(parseAllowed(process.env.CORS_ORIGIN));
    const origin = (req.headers['origin'] as string | undefined) || '';
    const referer = (req.headers['referer'] as string | undefined) || '';
    if (!origin && !referer) return next(); // non-browser or curl
    const ok = (origin && allowed.has(origin)) || [...allowed].some(a => referer.startsWith(a));
    if (!ok) return res.status(403).json({ ok: false, error: { code: 'ORIGIN_FORBIDDEN', message: 'Origin not allowed' } });
    return next();
  } catch {
    return res.status(400).json({ ok: false, error: { code: 'ORIGIN_CHECK_FAILED', message: 'Origin check failed' } });
  }
}

