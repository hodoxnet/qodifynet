import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec) as (
  command: string,
  options?: any
) => Promise<{ stdout: string; stderr: string }>;

export class SystemService {
  async checkSystemStatus() {
    const status = {
      postgres: await this.checkPostgres(),
      redis: await this.checkRedis(),
      nginx: await this.checkNginx(),
      pm2: await this.checkPM2(),
    };
    return status;
  }

  async checkPostgres(): Promise<string> {
    try {
      const { stdout } = await execAsync("pg_isready 2>&1");
      return stdout.includes("accepting connections") ? "running" : "error";
    } catch (error: any) {
      // If command not found, mark as not installed rather than error
      if (error.message?.includes("command not found")) {
        return "error";
      }
      return "error";
    }
  }

  async checkRedis(): Promise<string> {
    try {
      const password = process.env.REDIS_PASSWORD || "";
      const authFlag = password ? `-a "${password}"` : "";
      const { stdout } = await execAsync(`redis-cli ${authFlag} ping 2>&1`);
      return stdout.trim() === "PONG" || stdout.includes("PONG") ? "running" : "error";
    } catch (error: any) {
      if (error.message?.includes("command not found")) {
        return "error";
      }
      return "error";
    }
  }

  async checkNginx(): Promise<string> {
    try {
      // Try to run nginx -v to check if installed
      await execAsync("nginx -v");

      // If we get here, nginx is installed. Check if running
      try {
        const { stdout } = await execAsync("nginx -t 2>&1");
        return stdout.includes("syntax is ok") || stdout.includes("successful") ? "running" : "warning";
      } catch {
        // Nginx installed but not running or misconfigured
        return "warning";
      }
    } catch (error: any) {
      // Nginx not installed or not found
      return "error";
    }
  }

  async checkPM2(): Promise<string> {
    try {
      // Prefer a global PM2 binary when checking status
      try {
        const { detectPm2 } = await import("../utils/pm2-utils");
        const info = await detectPm2();
        if (!info) throw new Error("pm2 not found");
        // PM2 installed. Check daemon
        try {
          await execAsync(`${info.bin} list`);
          return "running";
        } catch {
          return "warning";
        }
      } catch {
        // Fallback to PATH
        await execAsync("pm2 --version");
        try {
          await execAsync("pm2 list");
          return "running";
        } catch {
          return "warning";
        }
      }
    } catch (error: any) {
      return "error";
    }
  }

  async getSystemResources() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const cpuLoad = os.loadavg()[0];
    const cpus = os.cpus();
    const diskUsage = await this.getDiskUsageDetailed();

    return {
      memory: {
        // legacy
        total: totalMem / (1024 * 1024 * 1024),
        free: freeMem / (1024 * 1024 * 1024),
        used: usedMem / (1024 * 1024 * 1024),
        percentage: (usedMem / totalMem) * 100,
        // new, UI-friendly
        totalGB: totalMem / (1024 * 1024 * 1024),
        usedGB: usedMem / (1024 * 1024 * 1024),
        usedPercent: (usedMem / totalMem) * 100,
      },
      cpu: {
        usage: Math.round(cpuLoad * 100) / 100,
        cores: cpus.length,
        model: cpus[0]?.model || undefined,
      },
      disk: diskUsage,
      network: this.getNetworkInfo(),
    };
  }

  private async getDiskUsageDetailed() {
    try {
      // Portable(ish): 1024-blocks Used Available Capacity Mount
      const { stdout } = await execAsync("df -Pk / | awk 'NR==2 {print $2, $3, $5}'");
      const [totalKbStr, usedKbStr, capacityStr] = stdout.trim().split(/\s+/);
      const totalKB = Number(totalKbStr || 0);
      const usedKB = Number(usedKbStr || 0);
      const usedPercent = Number(String(capacityStr || "0").replace("%", ""));
      return {
        totalGB: totalKB / (1024 * 1024),
        usedGB: usedKB / (1024 * 1024),
        usedPercent,
        percentage: String(usedPercent), // legacy string compatibility
      } as any;
    } catch {
      return {
        totalGB: 0,
        usedGB: 0,
        usedPercent: 0,
        percentage: "0",
      } as any;
    }
  }

  private getNetworkInfo() {
    const ifaces = os.networkInterfaces();
    const list: Array<{ iface: string; ip: string }> = [];
    Object.entries(ifaces).forEach(([name, infos]) => {
      (infos || []).forEach((inf) => {
        if (inf && inf.family === 'IPv4' && !inf.internal) {
          list.push({ iface: name, ip: inf.address });
        }
      });
    });
    return list;
  }

  async testRedisConnection(host: string, port: number, password?: string): Promise<{ ok: boolean; message?: string }> {
    try {
      // Prefer redis-cli for simplicity
      const pwd = password || process.env.REDIS_PASSWORD || "";
      const authFlag = pwd ? `-a "${pwd}"` : "";
      const { stdout } = await execAsync(`redis-cli -h ${host} -p ${port} ${authFlag} ping 2>&1`);
      if (stdout.trim().includes("PONG")) return { ok: true };
      return { ok: false, message: stdout.trim() };
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) };
    }
  }

  async checkRequirements() {
    const requirements = {
      node: await this.checkNodeVersion(),
      npm: await this.checkNpmVersion(),
      git: await this.checkGit(),
      postgresql: await this.checkPostgresInstalled(),
      redis: await this.checkRedisInstalled(),
      nginx: await this.checkNginxInstalled(),
      pm2: await this.checkPM2Installed(),
    };
    return requirements;
  }

  async checkNodeVersion() {
    try {
      const { stdout } = await execAsync("node --version");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkNpmVersion() {
    try {
      const { stdout } = await execAsync("npm --version");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkGit() {
    try {
      const { stdout } = await execAsync("git --version");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkPostgresInstalled() {
    try {
      const { stdout } = await execAsync("psql --version");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkRedisInstalled() {
    try {
      const { stdout } = await execAsync("redis-server --version");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkNginxInstalled() {
    try {
      const { stdout } = await execAsync("nginx -v 2>&1");
      return { installed: true, version: stdout.trim() };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkPM2Installed() {
    try {
      const { detectPm2 } = await import("../utils/pm2-utils");
      const info = await detectPm2();
      if (!info) return { installed: false, version: null };
      return { installed: true, version: info.version };
    } catch {
      return { installed: false, version: null };
    }
  }

  async checkSingleService(service: string): Promise<string> {
    switch (service) {
      case "postgres":
        return await this.checkPostgres();
      case "redis":
        return await this.checkRedis();
      case "nginx":
        return await this.checkNginx();
      case "pm2":
        return await this.checkPM2();
      default:
        return "error";
    }
  }

  async installService(service: string, os: string) {
    const commands = this.getInstallCommands(service, os);

    if (!commands) {
      return { success: false, message: "Unsupported service or OS" };
    }

    try {
      // Check if the service needs special permissions
      if (os === "macos" && !commands.skipBrew) {
        // Check if Homebrew is installed
        try {
          await execAsync("which brew");
        } catch {
          return {
            success: false,
            message: "Homebrew kurulu değil. Önce https://brew.sh adresinden Homebrew kurun.",
          };
        }
      }

      // Execute installation commands
      for (const command of commands.install) {
        console.log(`Executing: ${command}`);
        const { stdout, stderr } = await execAsync(command, {
          timeout: 300000, // 5 minutes timeout for installation
        });
        console.log("Install output:", stdout);
        if (stderr && !stderr.includes("Warning")) {
          console.error("Install error:", stderr);
        }
      }

      // Post-installation setup
      if (commands.postInstall) {
        for (const command of commands.postInstall) {
          console.log(`Post-install: ${command}`);
          await execAsync(command);
        }
      }

      return {
        success: true,
        message: `${service} başarıyla kuruldu`,
      };
    } catch (error: any) {
      console.error("Installation error:", error);
      return {
        success: false,
        message: error.message || "Kurulum sırasında hata oluştu",
      };
    }
  }

  private getInstallCommands(service: string, os: string) {
    const commands: Record<string, Record<string, any>> = {
      postgres: {
        macos: {
          install: ["brew install postgresql@15", "brew services start postgresql@15"],
          postInstall: ["createdb $(whoami) 2>/dev/null || true"],
        },
        ubuntu: {
          install: [
            "sudo apt-get update",
            "sudo apt-get install -y postgresql postgresql-contrib",
          ],
          postInstall: ["sudo systemctl start postgresql", "sudo systemctl enable postgresql"],
        },
        centos: {
          install: [
            "sudo yum install -y postgresql-server postgresql-contrib",
            "sudo postgresql-setup initdb",
          ],
          postInstall: ["sudo systemctl start postgresql", "sudo systemctl enable postgresql"],
        },
      },
      redis: {
        macos: {
          install: ["brew install redis", "brew services start redis"],
        },
        ubuntu: {
          install: ["sudo apt-get update", "sudo apt-get install -y redis-server"],
          postInstall: ["sudo systemctl start redis-server", "sudo systemctl enable redis-server"],
        },
        centos: {
          install: ["sudo yum install -y redis"],
          postInstall: ["sudo systemctl start redis", "sudo systemctl enable redis"],
        },
      },
      nginx: {
        macos: {
          install: ["brew install nginx", "brew services start nginx"],
        },
        ubuntu: {
          install: ["sudo apt-get update", "sudo apt-get install -y nginx"],
          postInstall: ["sudo systemctl start nginx", "sudo systemctl enable nginx"],
        },
        centos: {
          install: ["sudo yum install -y nginx"],
          postInstall: ["sudo systemctl start nginx", "sudo systemctl enable nginx"],
        },
      },
      pm2: {
        macos: {
          install: ["npm install -g pm2"],
          postInstall: ["pm2 startup"],
          skipBrew: true,
        },
        ubuntu: {
          install: ["sudo npm install -g pm2"],
          postInstall: ["pm2 startup systemd -u $(whoami) --hp /home/$(whoami)"],
        },
        centos: {
          install: ["sudo npm install -g pm2"],
          postInstall: ["pm2 startup systemd -u $(whoami) --hp /home/$(whoami)"],
        },
      },
    };

    return commands[service]?.[os];
  }
}
