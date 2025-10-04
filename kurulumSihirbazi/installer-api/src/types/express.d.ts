import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: "VIEWER" | "OPERATOR" | "ADMIN" | "SUPER_ADMIN" | "PARTNER_ADMIN" | "PARTNER_INSTALLER";
      partnerId?: string;
      scopes?: string[];
    };
  }
}
