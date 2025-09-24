import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import { detectPm2 } from "../utils/pm2-utils";
import { parseJsonFromMixedOutput } from "../utils/json-utils";

const execAsync = promisify(exec);

export class PM2Service {
  private async pm2Exec(args: string) {
    const info = await detectPm2();
    const bin = info?.bin || "pm2";
    return execAsync(`${bin} ${args}`);
  }
  async createEcosystem(
    domain: string,
    customerPath: string,
    ports: { backend: number; admin: number; store: number },
    options?: { devMode?: boolean }
  ) {
    const devMode = options?.devMode === true;
    const logsDir = path.join(customerPath, "logs");
    const beCwd = path.join(customerPath, "backend");
    const adminCwd = path.join(customerPath, "admin");
    const storeCwd = path.join(customerPath, "store");

    const ecosystemConfig = {
      apps: [
        {
          name: `${domain}-backend`,
          // Use project's own scripts to avoid hardcoding dist path
          script: "npm",
          args: devMode ? "run start:dev" : "run start:prod",
          cwd: beCwd,
          instances: 1,
          exec_mode: "fork",
          max_memory_restart: "500M",
          env_file: path.join(beCwd, ".env"),
          env: {
            NODE_ENV: devMode ? "development" : "production",
            PORT: ports.backend,
            NODE_OPTIONS: "-r dotenv/config",
            DOTENV_CONFIG_PATH: ".env",
          },
          error_file: path.join(logsDir, `${domain}-backend-error.log`),
          out_file: path.join(logsDir, `${domain}-backend-out.log`),
          log_date_format: "YYYY-MM-DD HH:mm:ss Z",
          merge_logs: true,
          autorestart: true,
          watch: false,
        },
        {
          name: `${domain}-admin`,
          script: "node_modules/.bin/next",
          args: `${devMode ? "dev" : "start"} -p ${ports.admin}`,
          cwd: adminCwd,
          instances: 1,
          exec_mode: "fork",
          max_memory_restart: "300M",
          env: {
            NODE_ENV: devMode ? "development" : "production",
            PORT: ports.admin,
          },
          error_file: path.join(logsDir, `${domain}-admin-error.log`),
          out_file: path.join(logsDir, `${domain}-admin-out.log`),
          log_date_format: "YYYY-MM-DD HH:mm:ss Z",
          merge_logs: true,
          autorestart: true,
          watch: false,
        },
        {
          name: `${domain}-store`,
          script: "node_modules/.bin/next",
          args: `${devMode ? "dev" : "start"} -p ${ports.store}`,
          cwd: storeCwd,
          instances: 1,
          exec_mode: "fork",
          max_memory_restart: "300M",
          env: {
            NODE_ENV: devMode ? "development" : "production",
            PORT: ports.store,
          },
          error_file: path.join(logsDir, `${domain}-store-error.log`),
          out_file: path.join(logsDir, `${domain}-store-out.log`),
          log_date_format: "YYYY-MM-DD HH:mm:ss Z",
          merge_logs: true,
          autorestart: true,
          watch: false,
        },
      ],
    };

    const configPath = path.join(customerPath, `ecosystem-${domain}.config.js`);
    const configContent = `module.exports = ${JSON.stringify(ecosystemConfig, null, 2)};`;

    try {
      // Create logs directory
      await fs.ensureDir(logsDir);

      // Write ecosystem config
      await fs.writeFile(configPath, configContent);

      console.log(`PM2 ecosystem config created for ${domain}`);
      return { success: true, configPath };
    } catch (error) {
      console.error("Failed to create PM2 ecosystem:", error);
      throw error;
    }
  }

  async startCustomer(domain: string) {
    try {
      const customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";
      const customerPath = path.join(customersPath, domain.replace(/\./g, "-"));
      const configPath = path.join(customerPath, `ecosystem-${domain}.config.js`);

      await this.pm2Exec(`start ${configPath}`);
      await this.pm2Exec("save");

      console.log(`Customer ${domain} started with PM2`);
      return { success: true };
    } catch (error) {
      console.error("Failed to start customer with PM2:", error);
      throw error;
    }
  }

  async stopCustomer(domain: string) {
    try {
      await this.pm2Exec(`stop ${domain}-backend ${domain}-admin ${domain}-store`);
      console.log(`Customer ${domain} stopped`);
      return { success: true };
    } catch (error) {
      console.error("Failed to stop customer:", error);
      throw error;
    }
  }

  async restartCustomer(domain: string) {
    try {
      await this.pm2Exec(`restart ${domain}-backend ${domain}-admin ${domain}-store`);
      console.log(`Customer ${domain} restarted`);
      return { success: true };
    } catch (error) {
      console.error("Failed to restart customer:", error);
      throw error;
    }
  }

  async deleteCustomer(domain: string) {
    try {
      await this.pm2Exec(`delete ${domain}-backend ${domain}-admin ${domain}-store`).catch(() => {});
      await this.pm2Exec("save");
      console.log(`Customer ${domain} removed from PM2`);
      return { success: true };
    } catch (error) {
      console.error("Failed to delete customer from PM2:", error);
      throw error;
    }
  }

  async getProcessStatus(domain: string) {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout);

      const customerProcesses = processes.filter((p: any) =>
        p.name.startsWith(domain)
      );

      return customerProcesses.map((p: any) => ({
        name: p.name,
        status: p.pm2_env.status,
        cpu: p.monit.cpu,
        memory: Math.round(p.monit.memory / (1024 * 1024)), // Convert to MB
        uptime: p.pm2_env.pm_uptime,
        restarts: p.pm2_env.restart_time,
      }));
    } catch (error) {
      console.error("Failed to get process status:", error);
      return [];
    }
  }

  async getLogs(processName: string, lines = 100) {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} logs ${processName} --lines ${lines} --nostream`);
      return stdout;
    } catch (error) {
      console.error("Failed to get logs:", error);
      return "";
    }
  }

  async monitorResources() {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout);

      const summary = {
        totalCpu: 0,
        totalMemory: 0,
        processCount: processes.length,
        customers: new Map<string, any>(),
      };

      processes.forEach((p: any) => {
        summary.totalCpu += p.monit.cpu;
        summary.totalMemory += p.monit.memory;

        // Extract customer domain from process name
        const match = p.name.match(/^(.+?)-(backend|admin|store)$/);
        if (match) {
          const domain = match[1];
          if (!summary.customers.has(domain)) {
            summary.customers.set(domain, {
              cpu: 0,
              memory: 0,
              processes: [],
            });
          }

          const customer = summary.customers.get(domain);
          customer.cpu += p.monit.cpu;
          customer.memory += p.monit.memory;
          customer.processes.push({
            type: match[2],
            status: p.pm2_env.status,
            cpu: p.monit.cpu,
            memory: Math.round(p.monit.memory / (1024 * 1024)),
          });
        }
      });

      return {
        ...summary,
        totalMemory: Math.round(summary.totalMemory / (1024 * 1024)), // Convert to MB
        customers: Array.from(summary.customers.entries()).map(([domain, data]) => ({
          domain,
          ...data,
          memory: Math.round(data.memory / (1024 * 1024)),
        })),
      };
    } catch (error) {
      console.error("Failed to monitor resources:", error);
      return null;
    }
  }

  async setupStartup() {
    try {
      await this.pm2Exec("startup");
      await this.pm2Exec("save");
      console.log("PM2 startup configured");
      return { success: true };
    } catch (error) {
      console.error("Failed to setup PM2 startup:", error);
      throw error;
    }
  }

  async pm2Save() {
    try {
      const { stdout, stderr } = await this.pm2Exec("save");
      return { success: true, output: (stdout || "") + (stderr || "") };
    } catch (error: any) {
      return { success: false, output: String(error?.message || error) };
    }
  }

  async pm2Startup() {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout, stderr } = await execAsync(`${bin} startup 2>&1`);
      // PM2 often prints a command that requires sudo. Return it to UI.
      return { success: true, output: (stdout || "") + (stderr || "") };
    } catch (error: any) {
      return { success: false, output: String(error?.message || error) };
    }
  }

  async pm2StopAll() {
    try {
      const { stdout, stderr } = await this.pm2Exec("stop all");
      return { success: true, output: (stdout || "") + (stderr || "") };
    } catch (error: any) {
      return { success: false, output: String(error?.message || error) };
    }
  }

  async pm2RestartAll() {
    try {
      const { stdout, stderr } = await this.pm2Exec("restart all");
      return { success: true, output: (stdout || "") + (stderr || "") };
    } catch (error: any) {
      return { success: false, output: String(error?.message || error) };
    }
  }

  async pm2Update() {
    try {
      const info = await detectPm2();
      const bin = info?.bin || "pm2";
      const { stdout, stderr } = await execAsync(`${bin} update 2>&1`);
      return { success: true, output: (stdout || "") + (stderr || "") };
    } catch (error: any) {
      return { success: false, output: String(error?.message || error) };
    }
  }
}
