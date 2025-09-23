import { sign, verify } from "jsonwebtoken";

const ACCESS_SECRET = process.env.JWT_SECRET || "dev-access";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "dev-refresh";

export type JwtPayload = {
  sub: string;
  email: string;
  role: string;
  jti?: string;
};

export function signAccessToken(payload: JwtPayload, expiresIn = "10m") {
  return sign(payload as any, ACCESS_SECRET as any, { expiresIn } as any) as unknown as string;
}

export function signRefreshToken(payload: JwtPayload, expiresIn = "30d") {
  return sign(payload as any, REFRESH_SECRET as any, { expiresIn } as any) as unknown as string;
}

export function verifyAccessToken(token: string): JwtPayload {
  return verify(token, ACCESS_SECRET as any) as unknown as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return verify(token, REFRESH_SECRET as any) as unknown as JwtPayload;
}
