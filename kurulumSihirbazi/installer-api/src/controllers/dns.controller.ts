import { Router } from "express";
import { DnsService } from "../services/dns.service";

export const dnsRouter = Router();
const dnsService = new DnsService();

dnsRouter.post("/check", async (req, res) => {
  try {
    const { domain } = req.body;

    if (!domain) {
      return res.status(400).json({ error: "Domain is required" });
    }

    const result = await dnsService.checkDomainDNS(domain);
    res.json(result);
  } catch (error) {
    console.error("DNS check error:", error);
    res.status(500).json({ error: "DNS check failed" });
  }
});

dnsRouter.get("/server-ip", async (req, res) => {
  try {
    const ip = await dnsService.getServerIP();
    res.json({ ip });
  } catch (error) {
    res.status(500).json({ error: "Failed to get server IP" });
  }
});