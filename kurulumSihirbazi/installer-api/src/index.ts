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

const app = express();
const httpServer = createServer(app);
const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3030")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const PORT = process.env.PORT || 3031;

// Middleware
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
app.use(helmet());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRouter);
// Protected routes
app.use("/api/system", authenticate, authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), systemRouter);
// Customers: rota bazında yetki kontrolü yapılacak (partner filtreleri için authenticate yeterli)
app.use("/api/customers", authenticate, customerRouter);
app.use("/api/dns", authenticate, authorize("ADMIN", "SUPER_ADMIN"), dnsRouter);
app.use("/api/templates", authenticate, authorize("ADMIN", "SUPER_ADMIN"), templateRouter);
app.use("/api/setup", authenticate, setupRouter);

// Partner yönetimi
import { partnerRouter } from "./controllers/partner.controller";
import { partnerPublicRouter } from "./controllers/partner-public.controller";
// Public partner application endpoint
app.use("/api/partner-public", partnerPublicRouter);
// Authenticated partner management endpoints
app.use("/api/partners", authenticate, partnerRouter);

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

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Export io for use in services
export { io };

// Set server timeout for large file uploads
httpServer.timeout = 5 * 60 * 1000; // 5 minutes
httpServer.keepAliveTimeout = 5 * 60 * 1000; // 5 minutes
httpServer.headersTimeout = 5 * 60 * 1000; // 5 minutes

httpServer.listen(PORT, () => {
  console.log(`🚀 Installer API running on http://localhost:${PORT}`);
});
