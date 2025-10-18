import { Router, type RequestHandler } from "express";
import { z } from "zod";
import { AuthService } from "../services/auth.service";
import { verifyRefreshToken, verifyAccessToken, type JwtPayload } from "../utils/jwt";
import rateLimit from "express-rate-limit";
import { authenticate, requireSuperAdmin } from "../middleware/auth";

export const authRouter = Router();
const auth = new AuthService();

const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

authRouter.use(authLimiter);

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "OPERATOR", "VIEWER"]).optional(),
  name: z.string().optional(),
});

type RegisterBody = z.infer<typeof RegisterSchema>;

const parseRegisterBody: RequestHandler = (req, res, next) => {
  try {
    res.locals.registerBody = RegisterSchema.parse(req.body || {});
    next();
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Register failed" });
  }
};

const ensureFirstUserOrNext: RequestHandler = async (_req, res, next) => {
  const body = res.locals.registerBody as RegisterBody | undefined;
  if (!body) {
    return res.status(400).json({ error: "Register payload missing" });
  }

  try {
    const createdFirst = await auth.ensureFirstUser(body.email, body.password, body.name);
    if (createdFirst) {
      res.json({ user: { id: createdFirst.id, email: createdFirst.email, role: createdFirst.role } });
      return;
    }

    return next();
  } catch (e: any) {
    res.status(400).json({ error: e?.message || "Register failed" });
  }
};

authRouter.post(
  "/register",
  parseRegisterBody,
  ensureFirstUserOrNext,
  authenticate,
  requireSuperAdmin,
  async (_req, res) => {
    const body = res.locals.registerBody as RegisterBody | undefined;
    if (!body) {
      return res.status(400).json({ error: "Register payload missing" });
    }

    try {
      const user = await auth.register(body.email, body.password, body.role || "VIEWER", body.name);
      return res.json({ user: { id: user.id, email: user.email, role: user.role } });
    } catch (e: any) {
      return res.status(400).json({ error: e?.message || "Register failed" });
    }
  }
);

authRouter.post("/login", async (req, res) => {
  try {
    const body = LoginSchema.parse(req.body || {});
    const ua = req.headers["user-agent"] as string | undefined;
    const ip = req.ip;
    const { user, access, refresh } = await auth.login(body.email, body.password, ua, ip);

    const prod = process.env.NODE_ENV === "production";
    res.cookie("qid_refresh", refresh, {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? "lax" : "lax",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return res.json({
      accessToken: access,
      user: { id: user.id, email: user.email, role: user.role, name: user.name },
    });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Login failed" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  try {
    const token = (req.cookies && req.cookies["qid_refresh"]) || undefined;
    if (!token) return res.status(401).json({ error: "No refresh token" });
    const payload = verifyRefreshToken(token);
    if (!payload.jti) return res.status(401).json({ error: "Invalid refresh" });

    const ua = req.headers["user-agent"] as string | undefined;
    const ip = req.ip;
    const { user, access, refresh } = await auth.refresh(payload.jti, payload.sub, ua, ip);

    const prod = process.env.NODE_ENV === "production";
    res.cookie("qid_refresh", refresh, {
      httpOnly: true,
      secure: prod,
      sameSite: prod ? "lax" : "lax",
      path: "/api/auth",
      maxAge: 1000 * 60 * 60 * 24 * 30,
    });

    return res.json({ accessToken: access, user: { id: user.id, email: user.email, role: user.role } });
  } catch (e: any) {
    try { res.clearCookie("qid_refresh", { path: "/api/auth" }); } catch {}
    return res.status(401).json({ error: e?.message || "Refresh failed" });
  }
});

authRouter.post("/logout", async (req, res) => {
  try {
    const token = (req.cookies && req.cookies["qid_refresh"]) || undefined;
    if (token) {
      try {
        const payload = verifyRefreshToken(token);
        if (payload.jti) await auth.logout(payload.jti);
      } catch {}
    }
    res.clearCookie("qid_refresh", { path: "/api/auth" });
    return res.json({ ok: true });
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || "Logout failed" });
  }
});

authRouter.get("/me", async (req, res) => {
  try {
    const header = req.headers["authorization"] || "";
    if (!header || typeof header !== "string" || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const access = header.slice(7);
    const payload = verifyAccessToken(access) as JwtPayload;
    return res.json({ user: { id: payload.sub, email: payload.email, role: payload.role, partnerId: payload.partnerId, scopes: payload.scopes } });
  } catch {
    return res.status(401).json({ error: "Unauthorized" });
  }
});
