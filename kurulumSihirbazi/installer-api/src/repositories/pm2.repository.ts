import { exec } from "child_process";
import { promisify } from "util";
import { detectPm2 } from "../utils/pm2-utils";
import { parseJsonFromMixedOutput } from "../utils/json-utils";
import { PM2Process } from "../types/customer.types";

const execAsync = promisify(exec);

export class PM2Repository {
  private static instance: PM2Repository;
  private pm2Bin: string | null = null;
  private processListCache: { data: PM2Process[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 5000; // 5 saniye cache

  private constructor() {}

  public static getInstance(): PM2Repository {
    if (!PM2Repository.instance) {
      PM2Repository.instance = new PM2Repository();
    }
    return PM2Repository.instance;
  }

  private async ensurePM2Bin(): Promise<string> {
    if (!this.pm2Bin) {
      const info = await detectPm2();
      this.pm2Bin = info?.bin || "pm2";
    }
    return this.pm2Bin;
  }

  async getProcessList(forceRefresh = false): Promise<PM2Process[]> {
    // Cache kontrolü
    if (!forceRefresh && this.processListCache &&
        Date.now() - this.processListCache.timestamp < this.CACHE_TTL) {
      return this.processListCache.data;
    }

    try {
      const bin = await this.ensurePM2Bin();
      const { stdout } = await execAsync(`${bin} jlist`);
      const processes = parseJsonFromMixedOutput(stdout) as PM2Process[];

      // Cache'i güncelle
      this.processListCache = {
        data: processes,
        timestamp: Date.now()
      };

      return processes;
    } catch (error) {
      console.error("Error getting PM2 process list:", error);
      return [];
    }
  }

  async getCustomerProcesses(domain: string): Promise<PM2Process[]> {
    const processes = await this.getProcessList();
    return processes.filter(p => p.name.startsWith(domain));
  }

  async getProcessStatus(processName: string): Promise<string> {
    const processes = await this.getProcessList();
    const process = processes.find(p => p.name === processName);
    return process?.pm2_env?.status || 'stopped';
  }

  async startProcess(processName: string): Promise<void> {
    const bin = await this.ensurePM2Bin();
    await execAsync(`${bin} start ${processName}`);
    this.invalidateCache();
  }

  async stopProcess(processName: string): Promise<void> {
    const bin = await this.ensurePM2Bin();
    await execAsync(`${bin} stop ${processName}`);
    this.invalidateCache();
  }

  async restartProcess(processName: string, updateEnv = true): Promise<void> {
    const bin = await this.ensurePM2Bin();
    const updateFlag = updateEnv ? "--update-env" : "";
    await execAsync(`${bin} restart ${processName} ${updateFlag}`.trim());
    this.invalidateCache();
  }

  async deleteProcess(processName: string): Promise<void> {
    const bin = await this.ensurePM2Bin();
    try {
      await execAsync(`${bin} delete ${processName}`);
    } catch {
      // Process zaten silinmiş olabilir
    }
    this.invalidateCache();
  }

  async startAllCustomerProcesses(domain: string): Promise<void> {
    const services = ["backend", "admin", "store"];
    for (const service of services) {
      await this.startProcess(`${domain}-${service}`);
    }
  }

  async stopAllCustomerProcesses(domain: string): Promise<void> {
    const services = ["backend", "admin", "store"];
    for (const service of services) {
      await this.stopProcess(`${domain}-${service}`);
    }
  }

  async restartAllCustomerProcesses(domain: string, updateEnv = true): Promise<void> {
    const services = ["backend", "admin", "store"];
    for (const service of services) {
      await this.restartProcess(`${domain}-${service}`, updateEnv);
    }
  }

  async deleteAllCustomerProcesses(domain: string): Promise<void> {
    const services = ["backend", "admin", "store"];
    for (const service of services) {
      await this.deleteProcess(`${domain}-${service}`);
    }
  }

  async getProcessLogs(processName: string, lines: number = 100): Promise<string> {
    try {
      const bin = await this.ensurePM2Bin();
      const { stdout } = await execAsync(
        `${bin} logs ${processName} --lines ${lines} --nostream`
      );
      return stdout;
    } catch (error) {
      throw new Error(`Failed to get logs for ${processName}: ${error}`);
    }
  }

  async calculateCustomerResources(domain: string): Promise<{ cpu: number; memory: number }> {
    const processes = await this.getCustomerProcesses(domain);

    if (processes.length === 0) {
      return { cpu: 0, memory: 0 };
    }

    let totalCpu = 0;
    let totalMemory = 0;

    processes.forEach(p => {
      totalCpu += p.monit?.cpu || 0;
      totalMemory += p.monit?.memory || 0;
    });

    return {
      cpu: Math.round(totalCpu * 10) / 10,
      memory: Math.round(totalMemory / (1024 * 1024)) // MB'ye çevir
    };
  }

  async getCustomerStatus(domain: string): Promise<"running" | "stopped" | "error"> {
    const processes = await this.getCustomerProcesses(domain);

    if (processes.length === 0) return "stopped";

    const anyOnline = processes.some(p => p.pm2_env?.status === 'online');
    const anyErrored = processes.some(p =>
      p.pm2_env?.status === 'errored' || p.pm2_env?.status === 'stopped'
    );

    if (anyOnline) return "running";
    if (anyErrored) return "error";
    return "stopped";
  }

  private invalidateCache(): void {
    this.processListCache = null;
  }
}