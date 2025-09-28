import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";

const execAsync = promisify(exec);

type ProgressExtra = { percent?: number; status?: string; substep?: string };
type ProgressHandler = (message: string, extra?: ProgressExtra) => void;

interface SSLWorkflowOptions {
  timeoutMs?: number;
  intervalMs?: number;
  onProgress?: ProgressHandler;
}

interface CreateConfigOptions extends SSLWorkflowOptions {
  waitForCertificate?: boolean;
}

export class NginxService {
  private nginxSitesPath = "/etc/nginx/sites-available";
  private nginxEnabledPath = "/etc/nginx/sites-enabled";

  async createConfig(
    domain: string,
    ports: { backend: number; admin: number; store: number },
    withSSL: boolean = false,
    options?: CreateConfigOptions
  ) {
    const configName = domain.replace(/\./g, "-");
    const configPath = path.join(this.nginxSitesPath, configName);

    const notify: ProgressHandler = (message, extra) => {
      options?.onProgress?.(message, extra);
    };

    let nginxConfig = '';

    if (withSSL) {
      const shouldWait = options?.waitForCertificate !== false;
      const certificateReady = shouldWait
        ? await this.waitForCertificateReady(domain, options)
        : await this.isCertificateReady(domain);

      if (!certificateReady) {
        notify(
          "SSL sertifika dosyaları hazırlanamadı, HTTP yapılandırmasına geri dönüldü",
          { status: "error", substep: "ssl" }
        );
        throw new Error(`Let’s Encrypt sertifika dosyaları hazır değil: ${domain}`);
      }
    }

    if (withSSL) {
      nginxConfig = `
server {
    server_name ${domain} www.${domain};
    listen 80;
    listen [::]:80;

    # Redirect HTTP to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    server_name ${domain} www.${domain};
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/${domain}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${domain}/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size
    client_max_body_size 100M;

    # Store (main domain)
    location / {
        proxy_pass http://localhost:${ports.store};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:${ports.backend}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for real-time features
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # Admin Panel
    location /admin {
        proxy_pass http://localhost:${ports.admin};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Not: Next.js statik dosyaları (/_next/*) ve public içerikleri upstream tarafından servis edilir.
    # Ayrı bir static location tanımlamayarak upstream'e proxy'lemeyi bozmayız.

    # Logs
    access_log /var/log/nginx/${configName}_access.log;
    error_log /var/log/nginx/${configName}_error.log;
}
`;
    } else {
      // HTTP-only config (no SSL)
      nginxConfig = `
server {
    server_name ${domain} www.${domain};
    listen 80;
    listen [::]:80;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Max upload size
    client_max_body_size 100M;

    # Store (main domain)
    location / {
        proxy_pass http://localhost:${ports.store};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:${ports.backend}/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support for real-time features
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
    }

    # Admin Panel
    location /admin {
        proxy_pass http://localhost:${ports.admin};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Not: Next.js statik dosyaları (/_next/*) ve public içerikleri upstream tarafından servis edilir.
    # Ayrı bir static location tanımlamayarak upstream'e proxy'lemeyi bozmayız.

    # Logs
    access_log /var/log/nginx/${configName}_access.log;
    error_log /var/log/nginx/${configName}_error.log;

    # Certbot webroot path for SSL certificate
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
}
`;
    }

    try {
      // Write config file
      await fs.writeFile(configPath, nginxConfig);

      // Create symbolic link to sites-enabled
      const enabledPath = path.join(this.nginxEnabledPath, configName);
      if (await fs.pathExists(enabledPath)) {
        await fs.unlink(enabledPath);
      }
      await fs.symlink(configPath, enabledPath);

      // Test nginx configuration
      await execAsync("nginx -t");

      // Reload nginx
      await execAsync("nginx -s reload");

      console.log(`Nginx configuration created for ${domain}`);
      notify("Nginx konfigürasyonu güncellendi", { status: "success", substep: "nginx" });
      return { success: true };
    } catch (error) {
      console.error("Failed to create nginx config:", error);
      throw error;
    }
  }

  async removeConfig(domain: string) {
    const configName = domain.replace(/\./g, "-");
    const configPath = path.join(this.nginxSitesPath, configName);
    const enabledPath = path.join(this.nginxEnabledPath, configName);

    try {
      // Remove symbolic link
      if (await fs.pathExists(enabledPath)) {
        await fs.unlink(enabledPath);
      }

      // Remove config file
      if (await fs.pathExists(configPath)) {
        await fs.unlink(configPath);
      }

      // Reload nginx
      await execAsync("nginx -s reload");

      console.log(`Nginx configuration removed for ${domain}`);
      return { success: true };
    } catch (error) {
      console.error("Failed to remove nginx config:", error);
      throw error;
    }
  }

  async obtainSSLCertificate(domain: string, email: string, options?: SSLWorkflowOptions) {
    try {
      const notify: ProgressHandler = (message, extra) => {
        options?.onProgress?.(message, extra);
        console.log(`[SSL][${domain}] ${message}`);
      };

      // First ensure HTTP config is set up for certbot
      const configName = domain.replace(/\./g, "-");
      const configPath = path.join(this.nginxSitesPath, configName);

      // Use Certbot to obtain SSL certificate with webroot method
      notify("Let’s Encrypt sertifika isteği başlatıldı", { status: "running", substep: "certbot" });
      await execAsync(
        `certbot certonly --webroot -w /var/www/html -d ${domain} -d www.${domain} --non-interactive --agree-tos -m ${email}`
      );

      notify("Sertifika talebi başarıyla tamamlandı", { status: "running", substep: "certbot" });

      const ready = await this.waitForCertificateReady(domain, options);
      if (!ready) {
        notify("Sertifika dosyaları zamanında hazırlanamadı", { status: "error", substep: "ssl" });
        throw new Error("Let’s Encrypt sertifika dosyaları doğrulanamadı");
      }

      notify("Sertifika dosyaları bulundu, Nginx SSL konfigürasyonu uygulanıyor", {
        status: "running",
        substep: "nginx"
      });

      // Get current ports from existing config
      const currentConfig = await fs.readFile(configPath, 'utf-8');
      const backendPort = currentConfig.match(/proxy_pass http:\/\/localhost:(\d+)\/api\//)?.[1];
      const storeMatch = currentConfig.match(/location \/ \{[\s\S]*?proxy_pass http:\/\/localhost:(\d+);/);
      const adminMatch = currentConfig.match(/location \/admin \{[\s\S]*?proxy_pass http:\/\/localhost:(\d+);/);

      if (backendPort && storeMatch && adminMatch) {
        const ports = {
          backend: parseInt(backendPort),
          store: parseInt(storeMatch[1]),
          admin: parseInt(adminMatch[1])
        };

        // Update nginx config with SSL
        await this.createConfig(domain, ports, true, {
          ...options,
          waitForCertificate: false
        });
      }

      return { success: true };
    } catch (error) {
      console.error("Failed to obtain SSL certificate:", error);
      throw error;
    }
  }

  private getCertificatePaths(domain: string) {
    const base = `/etc/letsencrypt/live/${domain}`;
    return {
      cert: `${base}/fullchain.pem`,
      key: `${base}/privkey.pem`
    };
  }

  private async isCertificateReady(domain: string): Promise<boolean> {
    const paths = this.getCertificatePaths(domain);
    const [certExists, keyExists] = await Promise.all([
      fs.pathExists(paths.cert),
      fs.pathExists(paths.key)
    ]);

    if (!certExists || !keyExists) {
      return false;
    }

    try {
      await Promise.all([
        fs.access(paths.cert, fs.constants.R_OK),
        fs.access(paths.key, fs.constants.R_OK)
      ]);
      return true;
    } catch {
      return false;
    }
  }

  private async waitForCertificateReady(domain: string, options?: SSLWorkflowOptions): Promise<boolean> {
    const timeoutMs = options?.timeoutMs ?? 20000;
    const intervalMs = options?.intervalMs ?? 1000;
    const deadline = Date.now() + timeoutMs;

    if (await this.isCertificateReady(domain)) {
      return true;
    }

    let attempt = 0;
    while (Date.now() < deadline) {
      attempt += 1;
      options?.onProgress?.(`Sertifika dosyaları bekleniyor... (deneme ${attempt})`, {
        status: "running",
        substep: "ssl-wait",
        percent: Math.min(95, Math.round((attempt * intervalMs) / timeoutMs * 100))
      });

      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      if (await this.isCertificateReady(domain)) {
        return true;
      }
    }

    return this.isCertificateReady(domain);
  }

  // Helper: check if certbot is installed
  async isCertbotInstalled(): Promise<boolean> {
    try {
      await execAsync("certbot --version");
      return true;
    } catch {
      return false;
    }
  }

  // Helper: try to install certbot (best-effort). Requires sufficient privileges.
  async installCertbot(): Promise<{ ok: boolean; method?: string; output?: string }> {
    // Try snap first
    try {
      await execAsync("snap --version");
      await execAsync("snap install core");
      await execAsync("snap refresh core");
      await execAsync("snap install --classic certbot");
      // Ensure path
      await execAsync("ln -sf /snap/bin/certbot /usr/bin/certbot || true");
      // Verify
      await execAsync("certbot --version");
      return { ok: true, method: "snap" };
    } catch (e: any) {
      // Fallback to package manager (apt/dnf)
    }

    try {
      const { stdout } = await execAsync("bash -lc 'source /etc/os-release && echo $ID' ");
      const id = (stdout || "").trim();
      if (["ubuntu", "debian"].includes(id)) {
        await execAsync("apt-get update");
        await execAsync("DEBIAN_FRONTEND=noninteractive apt-get install -y certbot");
        await execAsync("certbot --version");
        return { ok: true, method: "apt" };
      } else {
        await execAsync("dnf install -y certbot || yum install -y certbot");
        await execAsync("certbot --version");
        return { ok: true, method: "dnf" };
      }
    } catch (e: any) {
      return { ok: false, output: e?.stderr || e?.message };
    }
  }

  async renewSSLCertificates() {
    try {
      await execAsync("certbot renew --quiet");
      console.log("SSL certificates renewed");
      return { success: true };
    } catch (error) {
      console.error("Failed to renew SSL certificates:", error);
      throw error;
    }
  }

  async testConfiguration() {
    try {
      const { stdout } = await execAsync("nginx -t");
      return { valid: true, output: stdout };
    } catch (error: any) {
      return { valid: false, output: error.stderr || error.message };
    }
  }

  async getStatus() {
    try {
      const { stdout } = await execAsync("systemctl status nginx");
      return { running: stdout.includes("active (running)"), output: stdout };
    } catch (error) {
      return { running: false, output: "Nginx not running" };
    }
  }
}
