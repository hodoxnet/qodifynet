import { exec } from "child_process";
import { promisify } from "util";
import os from "os";
import { Client } from "pg";

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
      const { stdout } = await execAsync("redis-cli ping 2>&1");
      return stdout.trim() === "PONG" ? "running" : "error";
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
      // Try to get PM2 version to check if installed
      await execAsync("pm2 --version");

      // If we get here, PM2 is installed. Check if daemon is running
      try {
        const { stdout } = await execAsync("pm2 list");
        // If pm2 list works, daemon is running
        return "running";
      } catch {
        // PM2 installed but daemon not running
        return "warning";
      }
    } catch (error: any) {
      // PM2 not installed or not found
      return "error";
    }
  }

  async getSystemResources() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const cpuUsage = os.loadavg()[0];
    const diskUsage = await this.getDiskUsage();

    return {
      memory: {
        total: Math.round(totalMem / (1024 * 1024 * 1024)), // GB
        free: Math.round(freeMem / (1024 * 1024 * 1024)), // GB
        used: Math.round((totalMem - freeMem) / (1024 * 1024 * 1024)), // GB
        percentage: Math.round(((totalMem - freeMem) / totalMem) * 100),
      },
      cpu: {
        usage: Math.round(cpuUsage * 100) / 100,
        cores: os.cpus().length,
      },
      disk: diskUsage,
    };
  }

  async getDiskUsage() {
    try {
      const { stdout } = await execAsync("df -h / | awk 'NR==2 {print $3, $4, $5}'");
      const [used, available, percentage] = stdout.trim().split(" ");
      return {
        used,
        available,
        percentage: percentage.replace("%", ""),
      };
    } catch {
      return {
        used: "N/A",
        available: "N/A",
        percentage: "N/A",
      };
    }
  }

  async testRedisConnection(host: string, port: number): Promise<{ ok: boolean; message?: string }> {
    try {
      // Prefer redis-cli for simplicity
      const { stdout } = await execAsync(`redis-cli -h ${host} -p ${port} ping 2>&1`);
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
      const { stdout } = await execAsync("pm2 --version");
      return { installed: true, version: stdout.trim() };
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
