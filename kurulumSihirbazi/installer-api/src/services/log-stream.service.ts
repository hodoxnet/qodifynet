import { spawn, ChildProcess } from "child_process";
import { io } from "../index";

interface StreamSession {
  processName: string;
  pm2Process: ChildProcess | null;
  clientCount: number;
}

export class LogStreamService {
  private static instance: LogStreamService;
  private activeStreams: Map<string, StreamSession> = new Map();

  private constructor() {
    // Empty constructor
  }

  static getInstance(): LogStreamService {
    if (!LogStreamService.instance) {
      LogStreamService.instance = new LogStreamService();
    }
    return LogStreamService.instance;
  }

  /**
   * Belirli bir müşteri servisi için log stream'i başlatır
   */
  async startLogStream(customerId: string, domain: string, service: string) {
    const processName = `${domain}-${service}`;
    const streamKey = `${customerId}-${service}`;

    // Zaten stream varsa, sadece client sayısını artır
    if (this.activeStreams.has(streamKey)) {
      const session = this.activeStreams.get(streamKey)!;
      session.clientCount++;
      console.log(`[LogStream] Client joined ${streamKey}, total clients: ${session.clientCount}`);
      return;
    }

    console.log(`[LogStream] Starting stream for ${processName}`);

    try {
      // PM2 binary path al
      const { detectPm2 } = await import("../utils/pm2-utils");
      const pm2Info = await detectPm2();
      const bin = pm2Info?.bin || "pm2";

      // PM2 logs --raw --lines 50 ile başlat, ardından yeni logları stream et
      const pm2Process = spawn(bin, [
        "logs",
        processName,
        "--raw",
        "--lines",
        "100", // İlk 100 satır
        "--timestamp", // Timestamp ekle
      ]);

      // Session'ı kaydet
      this.activeStreams.set(streamKey, {
        processName,
        pm2Process,
        clientCount: 1,
      });

      // stdout stream
      pm2Process.stdout?.on("data", (data: Buffer) => {
        const logLine = data.toString();
        io.to(`logs-${customerId}-${service}`).emit("log-line", {
          service,
          line: logLine,
          type: "stdout",
          timestamp: new Date().toISOString(),
        });
      });

      // stderr stream
      pm2Process.stderr?.on("data", (data: Buffer) => {
        const logLine = data.toString();
        io.to(`logs-${customerId}-${service}`).emit("log-line", {
          service,
          line: logLine,
          type: "stderr",
          timestamp: new Date().toISOString(),
        });
      });

      // Process exit
      pm2Process.on("exit", (code) => {
        console.log(`[LogStream] Stream ended for ${processName}, code: ${code}`);
        this.activeStreams.delete(streamKey);
        io.to(`logs-${customerId}-${service}`).emit("stream-ended", {
          service,
          code,
        });
      });

      // Error handling
      pm2Process.on("error", (err) => {
        console.error(`[LogStream] Error for ${processName}:`, err);
        this.activeStreams.delete(streamKey);
        io.to(`logs-${customerId}-${service}`).emit("stream-error", {
          service,
          error: err.message,
        });
      });

    } catch (error) {
      console.error(`[LogStream] Failed to start stream for ${processName}:`, error);
      throw error;
    }
  }

  /**
   * Client ayrıldığında stream'i durdur veya client sayısını azalt
   */
  stopLogStream(customerId: string, service: string) {
    const streamKey = `${customerId}-${service}`;
    const session = this.activeStreams.get(streamKey);

    if (!session) return;

    session.clientCount--;
    console.log(`[LogStream] Client left ${streamKey}, remaining clients: ${session.clientCount}`);

    // Son client ayrıldıysa stream'i kapat
    if (session.clientCount <= 0) {
      console.log(`[LogStream] Stopping stream for ${streamKey}`);
      session.pm2Process?.kill();
      this.activeStreams.delete(streamKey);
    }
  }

  /**
   * Belirli bir müşterinin tüm stream'lerini durdur
   */
  stopAllStreams(customerId: string) {
    const keys = Array.from(this.activeStreams.keys()).filter(key => key.startsWith(customerId));
    keys.forEach(key => {
      const session = this.activeStreams.get(key);
      if (session) {
        console.log(`[LogStream] Force stopping stream ${key}`);
        session.pm2Process?.kill();
        this.activeStreams.delete(key);
      }
    });
  }

  /**
   * Tüm stream'leri temizle (server shutdown)
   */
  cleanup() {
    console.log(`[LogStream] Cleaning up ${this.activeStreams.size} active streams`);
    this.activeStreams.forEach((session) => {
      session.pm2Process?.kill();
    });
    this.activeStreams.clear();
  }
}
