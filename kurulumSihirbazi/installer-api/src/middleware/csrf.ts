import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_COOKIE = 'qid_csrf';

export function issueCsrfToken(_req: Request, res: Response) {
  const prod = process.env.NODE_ENV === 'production';
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // double-submit cookie: JS erişebilir
    sameSite: prod ? 'lax' : 'lax',
    secure: prod,
    path: '/',
    maxAge: 1000 * 60 * 60 * 2, // 2 saat
  });
  res.json({ ok: true, token });
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  try {
    const method = req.method.toUpperCase();
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) return next();
    const header = (req.headers['x-csrf-token'] as string | undefined) || '';
    const cookie = (req.cookies && req.cookies[CSRF_COOKIE]) || '';
    if (!header || !cookie || header !== cookie) {
      return res.status(403).json({ ok: false, error: { code: 'CSRF', message: 'Invalid CSRF token' } });
    }
    return next();
  } catch (e: any) {
    return res.status(400).json({ ok: false, error: { code: 'CSRF_ERROR', message: e?.message || 'CSRF check failed' } });
  }
}
