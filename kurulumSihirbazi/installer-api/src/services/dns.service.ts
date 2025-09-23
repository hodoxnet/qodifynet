import dns from "dns";
import { promisify } from "util";
import { exec } from "child_process";
import os from "os";

const dnsResolve4 = promisify(dns.resolve4);
const execAsync = promisify(exec);

export class DnsService {
  async checkDomainDNS(domain: string) {
    try {
      // Check if this is a local domain
      if (this.isLocalDomain(domain)) {
        return {
          valid: true,
          serverIP: "localhost",
          domainIPs: ["127.0.0.1"],
          message: "Local domain - DNS check bypassed",
          isLocal: true,
        };
      }

      // Get server's public IP
      const serverIP = await this.getServerIP();

      // Resolve domain IP addresses
      const domainIPs = await this.resolveDomain(domain);

      // Check if domain points to our server
      const valid = domainIPs.includes(serverIP);

      return {
        valid,
        serverIP,
        domainIPs,
        message: valid
          ? "Domain is correctly pointed to this server"
          : `Domain is not pointed to this server. Please update DNS A record to: ${serverIP}`,
        isLocal: false,
      };
    } catch (error) {
      console.error("DNS check error:", error);
      return {
        valid: false,
        serverIP: null,
        domainIPs: [],
        message: "Failed to check DNS configuration",
        isLocal: false,
      };
    }
  }

  private isLocalDomain(domain: string): boolean {
    return domain.endsWith('.local') ||
           domain === 'localhost' ||
           !domain.includes('.') ||
           domain.startsWith('test') ||
           domain.startsWith('local');
  }

  async resolveDomain(domain: string): Promise<string[]> {
    try {
      // Remove protocol if present
      const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");

      // Resolve domain to IP addresses
      const addresses = await dnsResolve4(cleanDomain);
      return addresses;
    } catch (error) {
      console.error(`Failed to resolve domain ${domain}:`, error);
      return [];
    }
  }

  async getServerIP(): Promise<string> {
    try {
      // Try to get public IP from external service
      const { stdout } = await execAsync("curl -s https://api.ipify.org");
      return stdout.trim();
    } catch (error) {
      // Fallback to local network interface
      const networkInterfaces = os.networkInterfaces();
      for (const interfaceName in networkInterfaces) {
        const interfaces = networkInterfaces[interfaceName];
        if (interfaces) {
          for (const iface of interfaces) {
            // Skip internal and IPv6 addresses
            if (!iface.internal && iface.family === "IPv4") {
              return iface.address;
            }
          }
        }
      }
      return "127.0.0.1";
    }
  }

  async checkDNSPropagation(domain: string) {
    const dnsServers = [
      { name: "Google", ip: "8.8.8.8" },
      { name: "Cloudflare", ip: "1.1.1.1" },
      { name: "OpenDNS", ip: "208.67.222.222" },
    ];

    const results = [];

    for (const server of dnsServers) {
      try {
        const { stdout } = await execAsync(`nslookup ${domain} ${server.ip}`);
        const hasRecord = stdout.includes("Address:") && !stdout.includes("can't find");

        results.push({
          server: server.name,
          ip: server.ip,
          resolved: hasRecord,
        });
      } catch (error) {
        results.push({
          server: server.name,
          ip: server.ip,
          resolved: false,
        });
      }
    }

    return results;
  }

  async generateDNSInstructions(domain: string) {
    const serverIP = await this.getServerIP();

    return {
      instructions: [
        {
          type: "A",
          host: "@",
          value: serverIP,
          ttl: 3600,
          description: "Main domain record",
        },
        {
          type: "A",
          host: "www",
          value: serverIP,
          ttl: 3600,
          description: "WWW subdomain record",
        },
        {
          type: "CNAME",
          host: "*",
          value: domain,
          ttl: 3600,
          description: "Wildcard subdomain (optional)",
        },
      ],
      providers: {
        cloudflare: "Go to DNS settings in Cloudflare dashboard",
        namecheap: "Go to Advanced DNS in domain list",
        godaddy: "Go to DNS Management in domain settings",
        generic: "Add A records in your domain provider's DNS settings",
      },
    };
  }

  async validateDomain(domain: string): Promise<{ valid: boolean; reason?: string }> {
    // Basic domain validation
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-_.]+\.[a-zA-Z]{2,}$/;

    if (!domainRegex.test(domain)) {
      return {
        valid: false,
        reason: "Invalid domain format",
      };
    }

    // Check if domain is reachable
    try {
      await dnsResolve4(domain);
      return { valid: true };
    } catch (error: any) {
      if (error.code === "ENOTFOUND") {
        return {
          valid: false,
          reason: "Domain does not exist or has no DNS records",
        };
      }
      return {
        valid: false,
        reason: "Failed to validate domain",
      };
    }
  }
}