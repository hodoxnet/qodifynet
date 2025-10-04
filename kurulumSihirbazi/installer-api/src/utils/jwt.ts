import { sign, verify } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-access";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh";
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "60m"; // default 60 minutes
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "30d"; // default 30 days

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  jti?: string;
  partnerId?: string;
  scopes?: string[];
};

export function signAccessToken(payload: JwtPayload, expiresIn = ACCESS_EXPIRES) {
  return sign(payload as any, ACCESS_SECRET as any, { expiresIn } as any) as unknown as string;
}

export function signRefreshToken(payload: JwtPayload, expiresIn = REFRESH_EXPIRES) {
  return sign(payload as any, REFRESH_SECRET as any, { expiresIn } as any) as unknown as string;
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, ACCESS_SECRET as any) as unknown as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, REFRESH_SECRET as any) as unknown as JwtPayload;
}
