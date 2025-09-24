import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import { PM2Repository } from "../repositories/pm2.repository";

const execAsync = promisify(exec);

export class LogService {
  private readonly customersPath: string;
  private pm2Repository: PM2Repository;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
    this.pm2Repository = PM2Repository.getInstance();
  }

  async getCustomerLogs(
    domain: string,
    service: string = 'backend',
    lines: number = 100
  ): Promise<{ logs: string; service: string; processName: string }> {
    const validServices = ['backend', 'admin', 'store'];
    if (!validServices.includes(service)) {
      throw new Error(`Invalid service. Must be one of: ${validServices.join(', ')}`);
    }

    const processName = `${domain}-${service}`;

    // Önce PM2 loglarını dene
    const pm2Logs = await this.getPM2Logs(processName, lines);
    if (pm2Logs) {
      return { logs: pm2Logs, service, processName };
    }

    // PM2 logları yoksa veya boşsa dosya loglarına bak
    const fileLogs = await this.getFileLogs(domain, service, lines);
    return { logs: fileLogs, service, processName };
  }

  private async getPM2Logs(processName: string, lines: number): Promise<string | null> {
    try {
      const logs = await this.pm2Repository.getProcessLogs(processName, lines);
      const trimmed = (logs || "").trim();
      return trimmed.length > 0 ? logs : null;
    } catch (error) {
      console.error(`Failed to get PM2 logs for ${processName}:`, error);
      return null;
    }
  }

  private async getFileLogs(
    domain: string,
    service: string,
    lines: number
  ): Promise<string> {
    try {
      const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
      const logDir = path.join(customerPath, "logs");
      const logFileOut = path.join(logDir, `${domain}-${service}-out.log`);
      const logFileErr = path.join(logDir, `${domain}-${service}-error.log`);

      await fs.ensureDir(logDir);

      const hasOut = await fs.pathExists(logFileOut);
      const hasErr = await fs.pathExists(logFileErr);

      if (!hasOut && !hasErr) {
        return this.getNoLogsMessage(logFileOut, logFileErr);
      }

      let collected = "";

      // Output logları
      if (hasOut) {
        const { stdout } = await execAsync(`tail -n ${lines} "${logFileOut}"`);
        collected += `# OUT (${logFileOut})\n${stdout}\n`;
      }

      // Error logları
      if (hasErr) {
        const { stdout } = await execAsync(`tail -n ${lines} "${logFileErr}"`);
        collected += `# ERROR (${logFileErr})\n${stdout}\n`;
      }

      return collected.trim() || "Log dosyaları boş";
    } catch (error) {
      return `Log okuma hatası: ${error}`;
    }
  }

  private getNoLogsMessage(outFile: string, errFile: string): string {
    return `Log dosyaları henüz oluşmamış. Servis yeni başlıyorsa birkaç saniye bekleyin.
Beklenen dosyalar:
- ${outFile}
- ${errFile}`;
  }

  async clearLogs(domain: string, service?: string): Promise<void> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const logDir = path.join(customerPath, "logs");

    if (service) {
      // Belirli bir servisin loglarını temizle
      const logFileOut = path.join(logDir, `${domain}-${service}-out.log`);
      const logFileErr = path.join(logDir, `${domain}-${service}-error.log`);

      if (await fs.pathExists(logFileOut)) {
        await fs.writeFile(logFileOut, '');
      }
      if (await fs.pathExists(logFileErr)) {
        await fs.writeFile(logFileErr, '');
      }
    } else {
      // Tüm logları temizle
      const services = ['backend', 'admin', 'store'];
      for (const svc of services) {
        const logFileOut = path.join(logDir, `${domain}-${svc}-out.log`);
        const logFileErr = path.join(logDir, `${domain}-${svc}-error.log`);

        if (await fs.pathExists(logFileOut)) {
          await fs.writeFile(logFileOut, '');
        }
        if (await fs.pathExists(logFileErr)) {
          await fs.writeFile(logFileErr, '');
        }
      }
    }
  }

  async getLogFileSize(domain: string, service: string): Promise<{
    outSize: number;
    errSize: number;
  }> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const logDir = path.join(customerPath, "logs");
    const logFileOut = path.join(logDir, `${domain}-${service}-out.log`);
    const logFileErr = path.join(logDir, `${domain}-${service}-error.log`);

    let outSize = 0;
    let errSize = 0;

    try {
      if (await fs.pathExists(logFileOut)) {
        const stats = await fs.stat(logFileOut);
        outSize = stats.size;
      }

      if (await fs.pathExists(logFileErr)) {
        const stats = await fs.stat(logFileErr);
        errSize = stats.size;
      }
    } catch (error) {
      console.error('Error getting log file sizes:', error);
    }

    return { outSize, errSize };
  }

  async rotateLogs(domain: string): Promise<void> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const logDir = path.join(customerPath, "logs");
    const timestamp = new Date().toISOString().replace(/:/g, '-').slice(0, -5);

    const services = ['backend', 'admin', 'store'];
    for (const service of services) {
      const logFileOut = path.join(logDir, `${domain}-${service}-out.log`);
      const logFileErr = path.join(logDir, `${domain}-${service}-error.log`);

      if (await fs.pathExists(logFileOut)) {
        const rotatedOut = path.join(logDir, `${domain}-${service}-out-${timestamp}.log`);
        await fs.move(logFileOut, rotatedOut);
        await fs.writeFile(logFileOut, '');
      }

      if (await fs.pathExists(logFileErr)) {
        const rotatedErr = path.join(logDir, `${domain}-${service}-error-${timestamp}.log`);
        await fs.move(logFileErr, rotatedErr);
        await fs.writeFile(logFileErr, '');
      }
    }
  }
}