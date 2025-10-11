import dotenv from "dotenv";
dotenv.config(); // Load .env first!

import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import { Server } from "socket.io";

import { systemRouter } from "./controllers/system.controller";
import { customerRouter } from "./controllers/customer.controller";
import { dnsRouter } from "./controllers/dns.controller";
import { templateRouter } from "./controllers/template.controller";
import { authRouter } from "./controllers/auth.controller";
import { setupRouter } from "./controllers/setup.controller";
import { authenticate } from "./middleware/auth";
import { authorize } from "./middleware/authorize";
import { issueCsrfToken, verifyCsrf } from "./middleware/csrf";
import { mutatingLimiter } from "./middleware/ratelimit";

const app = express();
const httpServer = createServer(app);
function expandOrigins(list: string[]): string[] {
  const out = new Set<string>();
  for (const item of list) {
    const s = item.trim();
    if (!s) continue;
    out.add(s);
    try {
      const u = new URL(s);
      if (u.hostname === 'localhost') {
        out.add(`${u.protocol}//127.0.0.1${u.port ? ':' + u.port : ''}`);
      } else if (u.hostname === '127.0.0.1') {
        out.add(`${u.protocol}//localhost${u.port ? ':' + u.port : ''}`);
      }
    } catch {
      // ignore invalid
    }
  }
  return Array.from(out);
}

const ALLOWED_ORIGINS = expandOrigins(
  (process.env.CORS_ORIGIN || "http://localhost:3030").split(",").filter(Boolean)
);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = Number(process.env.PORT || 3031);
const HOST = process.env.HOST || '127.0.0.1';

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());

// CSRF token endpoint
app.get('/api/csrf-token', issueCsrfToken);

// Global mutating rate limit + CSRF check
app.use((req, res, next) => {
  if (["POST", "PUT", "DELETE", "PATCH"].includes(req.method)) {
    return mutatingLimiter(req, res, () => verifyCsrf(req, res, next));
  }
  return next();
});

// Routes
app.use("/api/auth", authRouter);
// Protected routes
app.use("/api/system", authenticate, authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), systemRouter);
// Customers: rota bazında yetki kontrolü yapılacak (partner filtreleri için authenticate yeterli)
app.use("/api/customers", authenticate, customerRouter);
// DNS: partnerlar da kontrol yapabilsin (scope tabanlı). Router kendi içinde kontrol ediyor.
app.use("/api/dns", authenticate, dnsRouter);
app.use("/api/templates", authenticate, authorize("ADMIN", "SUPER_ADMIN"), templateRouter);
app.use("/api/setup", authenticate, setupRouter);

// Partner yönetimi
import { partnerRouter } from "./controllers/partner.controller";
import { partnerPublicRouter } from "./controllers/partner-public.controller";
import { auditRouter } from "./controllers/audit.controller";
// Public partner application endpoint
app.use("/api/partner-public", partnerPublicRouter);
// Authenticated partner management endpoints
app.use("/api/partners", authenticate, partnerRouter);
// Audit logs
app.use("/api/audit", authenticate, authorize("ADMIN", "SUPER_ADMIN"), auditRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// WebSocket for real-time logs
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("subscribe-logs", (customerId) => {
    socket.join(`customer-${customerId}`);
  });

  // Deployment progress subscription by domain
  socket.on("subscribe-deployment", (domain: string) => {
    if (typeof domain === "string" && domain.length > 0) {
      socket.join(`deployment-${domain}`);
    }
  });

  // Real-time log streaming subscription
  socket.on("subscribe-log-stream", async (data: { customerId: string; domain: string; service: string }) => {
    try {
      const { customerId, domain, service } = data;
      if (!customerId || !domain || !service) {
        console.error("Invalid log stream subscription data:", data);
        return;
      }

      // Join the specific log room
      const roomName = `logs-${customerId}-${service}`;
      socket.join(roomName);
      console.log(`[Socket] Client ${socket.id} joined ${roomName}`);

      // Start the log stream
      const { LogStreamService } = await import("./services/log-stream.service");
      const logStreamService = LogStreamService.getInstance();
      await logStreamService.startLogStream(customerId, domain, service);

      socket.emit("stream-started", { service });
    } catch (error) {
      console.error("Error starting log stream:", error);
      socket.emit("stream-error", { error: error instanceof Error ? error.message : "Failed to start stream" });
    }
  });

  // Unsubscribe from log streaming
  socket.on("unsubscribe-log-stream", async (data: { customerId: string; service: string }) => {
    try {
      const { customerId, service } = data;
      if (!customerId || !service) return;

      const roomName = `logs-${customerId}-${service}`;
      socket.leave(roomName);
      console.log(`[Socket] Client ${socket.id} left ${roomName}`);

      // Stop or decrement the stream
      const { LogStreamService } = await import("./services/log-stream.service");
      const logStreamService = LogStreamService.getInstance();
      logStreamService.stopLogStream(customerId, service);
    } catch (error) {
      console.error("Error stopping log stream:", error);
    }
  });

  socket.on("disconnect", async () => {
    console.log("Client disconnected:", socket.id);

    // Clean up any log streams this client was subscribed to
    // Note: PM2 processes will auto-cleanup when client count reaches 0
  });
});

// Export io for use in services
export { io };

// Set server timeout for large file uploads
httpServer.timeout = 10 * 60 * 1000; // 10 minutes
httpServer.keepAliveTimeout = 10 * 60 * 1000; // 10 minutes
httpServer.headersTimeout = 10 * 60 * 1000; // 10 minutes

httpServer.listen(PORT, HOST, () => {
  console.log(`🚀 Installer API running on http://${HOST}:${PORT}`);
  console.log(`CORS origins: ${ALLOWED_ORIGINS.join(', ')}`);
});
