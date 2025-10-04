import { Router } from "express";
import { DnsService } from "../services/dns.service";
import { authorize } from "../middleware/authorize";
import { requireScopes } from "../middleware/scopes";
import { SCOPES } from "../constants/scopes";

export const dnsRouter = Router();
const dnsService = new DnsService();

// Staff (ADMIN/SUPER_ADMIN) ve partner (scope: setup.run) erişebilir
dnsRouter.post("/check", requireScopes(SCOPES.SETUP_RUN), async (req, res): Promise<void> => {
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
