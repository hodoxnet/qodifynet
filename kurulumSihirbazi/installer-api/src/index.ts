import dotenv from "dotenv";
dotenv.config(); // Load .env first!

import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { systemRouter } from "./controllers/system.controller";
import { customerRouter } from "./controllers/customer.controller";
import { dnsRouter } from "./controllers/dns.controller";
import { templateRouter } from "./controllers/template.controller";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3030",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 3031;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/api/system", systemRouter);
app.use("/api/customers", customerRouter);
app.use("/api/dns", dnsRouter);
app.use("/api/templates", templateRouter);

// Health check
app.get("/health", (req, res) => {
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

httpServer.listen(PORT, () => {
  console.log(`🚀 Installer API running on http://localhost:${PORT}`);
});
