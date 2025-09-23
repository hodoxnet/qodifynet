import { Router } from "express";
import { DnsService } from "../services/dns.service";
import { authorize } from "../middleware/authorize";

export const dnsRouter = Router();
const dnsService = new DnsService();

dnsRouter.post("/check", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { domain } = req.body;

    if (!domain) {
      res.status(400).json({ error: "Domain is required" });
      return;
    }

    const result = await dnsService.checkDomainDNS(domain);
    res.json(result);
  } catch (error) {
    console.error("DNS check error:", error);
    res.status(500).json({ error: "DNS check failed" });
  }
});

dnsRouter.get("/server-ip", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const ip = await dnsService.getServerIP();
    res.json({ ip });
  } catch (error) {
    res.status(500).json({ error: "Failed to get server IP" });
  }
});
