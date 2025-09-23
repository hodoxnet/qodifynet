import "express";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      email: string;
      role: "VIEWER" | "OPERATOR" | "ADMIN" | "SUPER_ADMIN";
    };
  }
}

