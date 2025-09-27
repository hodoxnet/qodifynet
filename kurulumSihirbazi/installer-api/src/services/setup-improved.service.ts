import { spawn } from "child_process";
import fs from "fs-extra";
import path from "path";
import { io } from "../index";

export interface BuildResult {
  ok: boolean;
  message: string;
  stdout?: string;
  stderr?: string;
  code?: number | string;
  errorType?: "heap" | "timeout" | "syntax" | "other";
}

export class ImprovedSetupService {
  private customersPath = process.env.CUSTOMERS_PATH || "/var/qodify/customers";

  /**
   * Build işlemini gerçek zamanlı log stream'i ile çalıştır
   */
  async buildApplicationWithStream(
    domain: string,
    service: "backend" | "admin" | "store",
    isLocal: boolean,
    options?: { heapMB?: number; skipTypeCheck?: boolean }
  ): Promise<BuildResult> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const servicePath = path.join(customerPath, service);
    const logPath = path.join(servicePath, `build-${service}.log`);

    // Log dosyasını oluştur
    const logStream = fs.createWriteStream(logPath, { flags: 'a' });
    logStream.write(`\n\n========== BUILD START: ${new Date().toISOString()} ==========\n`);

    return new Promise(async (resolve) => {
      console.log(`[${service}] Build başlatılıyor: ${servicePath}`);

      // Opsiyonel: Next.js tip kontrolünü geçici olarak devre dışı bırak (frontend için)
      const isFrontend = service === "admin" || service === "store";
      let restorePatchedConfig: null | (() => Promise<void>) = null;
      if (isFrontend && options?.skipTypeCheck) {
        try {
          const candidates = [
            path.join(servicePath, "next.config.ts"),
            path.join(servicePath, "next.config.js"),
            path.join(servicePath, "next.config.mjs"),
          ];
          let existing: string | null = null;
          for (const c of candidates) {
            if (await fs.pathExists(c)) { existing = c; break; }
          }

          if (!existing) {
            const newCfg = path.join(servicePath, "next.config.js");
            const content = `module.exports = {\n  typescript: { ignoreBuildErrors: true },\n  eslint: { ignoreDuringBuilds: true }\n};\n`;
            await fs.writeFile(newCfg, content);
            restorePatchedConfig = async () => { try { await fs.remove(newCfg); } catch {} };
          } else {
            const ext = path.extname(existing);
            const base = path.join(servicePath, `next.config.qodify-base${ext}`);
            await fs.move(existing, base, { overwrite: true });
            const baseImport = `./next.config.qodify-base${ext}`;
            let wrapper = "";
            if (ext === ".js") {
              wrapper = `const base = require('${baseImport}');\nmodule.exports = (...args) => {\n  const cfg = typeof base === 'function' ? base(...args) : base;\n  return {\n    ...cfg,\n    typescript: { ...(cfg?.typescript || {}), ignoreBuildErrors: true },\n    eslint: { ...(cfg?.eslint || {}), ignoreDuringBuilds: true }\n  };\n};\n`;
            } else if (ext === ".mjs") {
              wrapper = `import base from '${baseImport}';\nexport default (...args) => {\n  const cfg = typeof base === 'function' ? base(...args) : base;\n  return {\n    ...cfg,\n    typescript: { ...(cfg?.typescript || {}), ignoreBuildErrors: true },\n    eslint: { ...(cfg?.eslint || {}), ignoreDuringBuilds: true }\n  };\n};\n`;
            } else { // .ts
              wrapper = `import base from '${baseImport}';\nexport default (...args: any[]) => {\n  const cfg: any = typeof (base as any) === 'function' ? (base as any)(...args) : (base as any);\n  return {\n    ...cfg,\n    typescript: { ...(cfg?.typescript || {}), ignoreBuildErrors: true },\n    eslint: { ...(cfg?.eslint || {}), ignoreDuringBuilds: true }\n  } as any;\n};\n`;
            }
            await fs.writeFile(existing, wrapper);
            restorePatchedConfig = async () => {
              try { await fs.remove(existing!); } catch {}
              try { await fs.move(base, existing!, { overwrite: true }); } catch {}
            };
          }
        } catch (e) {
          console.warn(`[${service}] Tip kontrol devre dışı bırakma yapılamadı:`, e);
        }
      }

      // Environment variables
      const heap = options?.heapMB && options.heapMB > 0 ? String(options.heapMB) : undefined;
      const buildEnv = {
        ...process.env,
        NODE_ENV: "production",
        // RAM limiti: parametre ile override edilebilir
        NODE_OPTIONS: heap ? `--max-old-space-size=${heap}` : "--max-old-space-size=4096",
        // Next.js için telemetry'yi kapat
        NEXT_TELEMETRY_DISABLED: "1",
        // CI ortamı - bazı araçlar paralelliği azaltır
        CI: "1",
        // Frontend build'lerinde SWC worker sayısını düşür (bellek için)
        ...(isFrontend ? { SWC_WORKER_COUNT: "1", SWC_MINIFY: "false" } : {}),
        // Production modda log azalt
        NPM_CONFIG_LOGLEVEL: "error",
        // Local mode kontrolü
        IS_LOCAL_BUILD: String(isLocal)
      };

      // Build komutu
      const buildCmd = "build";
      const buildProcess = spawn("npm", ["run", buildCmd], {
        cwd: servicePath,
        env: buildEnv,
        shell: true,
        // stdin, stdout, stderr'i pipe et
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "";
      let stderr = "";
      let lastProgress = 0;
      let hasError = false;
      let errorType: BuildResult["errorType"] = "other";

      // STDOUT handler
      buildProcess.stdout?.on("data", (data) => {
        const output = data.toString();
        stdout += output;
        logStream.write(`[STDOUT] ${output}`);

        // Her satırı ayrı ayrı işle
        const lines = output.split("\\n").filter((line: string) => line.trim());

        lines.forEach((line: string) => {
          // WebSocket ile gönder
          io.to(`deployment-${domain}`).emit("build-output", {
            service,
            output: line,
            type: "stdout"
          });

          // Progress yüzdesini çıkar
          const progressMatch = line.match(/(\\d+)%/);
          if (progressMatch) {
            const progress = parseInt(progressMatch[1]);
            if (progress > lastProgress) {
              lastProgress = progress;
              io.to(`deployment-${domain}`).emit("setup-progress", {
                message: `${service.charAt(0).toUpperCase() + service.slice(1)} derleniyor...`,
                step: "build",
                percent: progress
              });
            }
          }

          // Next.js build aşamalarını takip et
          if (line.includes("Creating an optimized production build")) {
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `${service}: Production build oluşturuluyor...`,
              step: "build"
            });
          } else if (line.includes("Collecting page data")) {
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `${service}: Sayfa verileri toplanıyor...`,
              step: "build",
              percent: 30
            });
          } else if (line.includes("Generating static pages")) {
            const pageMatch = line.match(/\((\d+)\/(\d+)\)/);
            if (pageMatch) {
              const [, current, total] = pageMatch;
              const percent = Math.round((parseInt(current) / parseInt(total)) * 100);
              io.to(`deployment-${domain}`).emit("setup-progress", {
                message: `${service}: Statik sayfalar oluşturuluyor (${current}/${total})...`,
                step: "build",
                percent: 30 + Math.round(percent * 0.5) // 30-80 arası
              });
            }
          } else if (line.includes("Finalizing page optimization")) {
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `${service}: Optimizasyon tamamlanıyor...`,
              step: "build",
              percent: 90
            });
          } else if (line.includes("Route (app)") || line.includes("First Load JS")) {
            // Next.js build başarılı
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `${service}: Build tamamlandı`,
              step: "build",
              percent: 95
            });
          }

          // TypeScript build (backend için)
          if (line.includes("tsc") || line.includes("Compiling TypeScript")) {
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `${service}: TypeScript derleniyor...`,
              step: "build"
            });
          }

          // Webpack progress
          if (line.includes("webpack") && line.includes("building")) {
            const webpackMatch = line.match(/(\\d+)%/);
            if (webpackMatch) {
              io.to(`deployment-${domain}`).emit("setup-progress", {
                message: `${service}: Webpack build ${webpackMatch[1]}%`,
                step: "build",
                percent: parseInt(webpackMatch[1])
              });
            }
          }
        });
      });

      // STDERR handler
      buildProcess.stderr?.on("data", (data) => {
        const output = data.toString();
        stderr += output;
        logStream.write(`[STDERR] ${output}`);

        // Heap memory hatası kontrolü
        if (
          output.includes("JavaScript heap out of memory") ||
          output.includes("FATAL ERROR") ||
          output.includes("Allocation failed") ||
          output.includes("Cannot allocate memory") ||
          output.includes("Maximum call stack size exceeded")
        ) {
          hasError = true;
          errorType = "heap";

          // Kritik hata bildirimi
          io.to(`deployment-${domain}`).emit("build-output", {
            service,
            output: "❌ KRİTİK HATA: Node.js bellek yetersizliği (heap out of memory)!",
            type: "stderr",
            isError: true,
            errorType: "heap"
          });

          io.to(`deployment-${domain}`).emit("build-output", {
            service,
            output: `💡 Çözüm: Sunucu RAM'ini arttırın veya NODE_OPTIONS="--max-old-space-size=8192" kullanın`,
            type: "stderr"
          });

          // Detaylı memory bilgisi
          const memoryInfo = `
📊 Memory Bilgisi:
- Mevcut limit: ${buildEnv.NODE_OPTIONS || "Varsayılan (~1.4GB)"}
- Önerilen: --max-old-space-size=8192 (8GB)
- Alternatif: Swap memory aktif edin
- Komut: sudo fallocate -l 4G /swapfile && sudo swapon /swapfile
          `.trim();

          io.to(`deployment-${domain}`).emit("build-output", {
            service,
            output: memoryInfo,
            type: "stderr"
          });
        }
        // TypeScript hataları
        else if (output.includes("error TS")) {
          hasError = true;
          errorType = "syntax";
          const lines = output.split("\\n").filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            io.to(`deployment-${domain}`).emit("build-output", {
              service,
              output: line,
              type: "stderr"
            });

            if (line.includes("error TS")) {
              io.to(`deployment-${domain}`).emit("setup-progress", {
                message: `${service}: TypeScript hatası tespit edildi`,
                step: "build",
                type: "error"
              });
            }
          });
        }
        // ESLint hataları
        else if (output.includes("ESLint") && output.includes("error")) {
          // ESLint hataları genelde kritik değil
          const lines = output.split("\\n").filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            io.to(`deployment-${domain}`).emit("build-output", {
              service,
              output: line,
              type: "stderr"
            });
          });

          io.to(`deployment-${domain}`).emit("setup-progress", {
            message: `${service}: ESLint uyarıları var`,
            step: "build",
            type: "warning"
          });
        }
        // Module not found hataları
        else if (output.includes("Module not found") || output.includes("Cannot find module")) {
          hasError = true;
          errorType = "syntax";
          io.to(`deployment-${domain}`).emit("build-output", {
            service,
            output: "❌ Modül bulunamadı hatası! Bağımlılıklar eksik olabilir.",
            type: "stderr",
            isError: true
          });

          const lines = output.split("\\n").filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            io.to(`deployment-${domain}`).emit("build-output", {
              service,
              output: line,
              type: "stderr"
            });
          });
        }
        // Normal stderr output (warning vb.)
        else {
          const lines = output.split("\\n").filter((line: string) => line.trim());
          lines.forEach((line: string) => {
            if (line.length > 0) {
              io.to(`deployment-${domain}`).emit("build-output", {
                service,
                output: line,
                type: "stderr"
              });
            }
          });
        }
      });

      // Process bitişi
      buildProcess.on("close", async (code) => {
        if (restorePatchedConfig) { try { await restorePatchedConfig(); } catch {} restorePatchedConfig = null; }
        logStream.write(`\n========== BUILD END: ${new Date().toISOString()} | Exit Code: ${code} ==========\n`);
        logStream.end();

        console.log(`[${service}] Build tamamlandı. Exit code: ${code}`);

        if (code === 0 && !hasError) {
          // Başarılı - dist/out kontrolü yap
          let buildSuccess = false;

          if (service === "backend") {
            // Backend için dist/main.js veya dist/src/main.js kontrolü
            const distSrcMain = path.join(servicePath, "dist", "src", "main.js");
            const distMain = path.join(servicePath, "dist", "main.js");

            if (await fs.pathExists(distSrcMain)) {
              buildSuccess = true;
            } else if (await fs.pathExists(distMain)) {
              buildSuccess = true;
            } else {
              // dist klasöründe main.js'i ara
              const distDir = path.join(servicePath, "dist");
              if (await fs.pathExists(distDir)) {
                const found = await this.findMainJs(distDir);
                buildSuccess = !!found;
              }
            }
          } else {
            // Next.js için .next veya out klasörü
            const nextPath = path.join(servicePath, ".next");
            const outPath = path.join(servicePath, "out");
            buildSuccess = (await fs.pathExists(nextPath)) || (await fs.pathExists(outPath));
          }

          if (buildSuccess) {
            io.to(`deployment-${domain}`).emit("setup-progress", {
              message: `✅ ${service} build başarılı`,
              step: "build",
              percent: 100
            });

            resolve({
              ok: true,
              message: `${service} build başarılı`,
              stdout: stdout.slice(-5000),
              stderr: stderr.slice(-5000),
              code: 0
            });
          } else {
            // Build başarılı görünüyor ama output yok
            io.to(`deployment-${domain}`).emit("build-output", {
              service,
              output: `❌ Build tamamlandı ancak çıktı dosyaları bulunamadı`,
              type: "stderr",
              isError: true
            });

            io.to(`deployment-${domain}`).emit("build-output", {
              service,
              output: `Beklenen: ${service === 'backend' ? 'dist/main.js' : '.next klasörü'}`,
              type: "stderr"
            });

            resolve({
              ok: false,
              message: `Build output not found`,
              stdout: stdout.slice(-10000),
              stderr: stderr.slice(-10000),
              code: "OUTPUT_NOT_FOUND",
              errorType: "other"
            });
          }
        } else if (code === 137 || errorType === "heap") {
          // 137 = SIGKILL (muhtemelen OOM killer)
          resolve({
            ok: false,
            message: "Build process killed (likely out of memory)",
            stdout: stdout.slice(-10000),
            stderr: stderr.slice(-10000),
            code: code || "MEMORY_ERROR",
            errorType: "heap"
          });
        } else {
          // Diğer hatalar
          resolve({
            ok: false,
            message: `Build failed with exit code ${code}`,
            stdout: stdout.slice(-10000),
            stderr: stderr.slice(-10000),
            code: code || 1,
            errorType
          });
        }
      });

      // Error handler
      buildProcess.on("error", (err) => {
        (async () => { if (restorePatchedConfig) { try { await restorePatchedConfig(); } catch {} restorePatchedConfig = null; } })();
        logStream.end();
        console.error(`[${service}] Build process error:`, err);

        io.to(`deployment-${domain}`).emit("build-output", {
          service,
          output: `❌ Build process başlatılamadı: ${err.message}`,
          type: "stderr",
          isError: true
        });

        resolve({
          ok: false,
          message: `Failed to start build process: ${err.message}`,
          code: "SPAWN_ERROR",
          errorType: "other"
        });
      });

      // Timeout - 15 dakika
      const timeout = setTimeout(() => {
        buildProcess.kill("SIGTERM");
        setTimeout(() => {
          buildProcess.kill("SIGKILL");
        }, 5000);

        io.to(`deployment-${domain}`).emit("build-output", {
          service,
          output: "⏱️ Build timeout (15 dakika). İşlem sonlandırıldı.",
          type: "stderr",
          isError: true
        });

        (async () => { if (restorePatchedConfig) { try { await restorePatchedConfig(); } catch {} restorePatchedConfig = null; } })();

        resolve({
          ok: false,
          message: "Build timeout after 15 minutes",
          stdout: stdout.slice(-10000),
          stderr: stderr.slice(-10000),
          code: "TIMEOUT",
          errorType: "other"
        });
      }, 15 * 60 * 1000);

      // Cleanup timeout when process ends
      buildProcess.on("exit", () => {
        clearTimeout(timeout);
      });
    });
  }

  /**
   * dist klasöründe main.js dosyasını rekürsif ara
   */
  private async findMainJs(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir);

    for (const entry of entries) {
      const fullPath = path.join(dir, entry);
      const stat = await fs.stat(fullPath);

      if (stat.isDirectory()) {
        const found = await this.findMainJs(fullPath);
        if (found) return found;
      } else if (stat.isFile() && entry === "main.js") {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Tüm servisleri sıralı olarak build et (memory için)
   */
  async buildAllApplications(
    domain: string,
    isLocal: boolean,
    options?: { heapMB?: number; skipTypeCheck?: boolean }
  ): Promise<BuildResult> {
    try {
      console.log("=== Build işlemi başlatılıyor ===");

      // 1. Backend build
      console.log("Backend build başlatılıyor...");
      io.to(`deployment-${domain}`).emit("setup-progress", {
        message: "Backend derleniyor...",
        step: "build",
        percent: 0
      });

      const backendResult = await this.buildApplicationWithStream(domain, "backend", isLocal, options);
      if (!backendResult.ok) {
        return backendResult;
      }

      // Local mode'da sadece backend yeterli
      if (isLocal) {
        return {
          ok: true,
          message: "Backend build başarılı (local mode)"
        };
      }

      // 2. Admin panel build
      console.log("Admin panel build başlatılıyor...");
      io.to(`deployment-${domain}`).emit("setup-progress", {
        message: "Admin paneli derleniyor...",
        step: "build",
        percent: 33
      });

      const adminResult = await this.buildApplicationWithStream(domain, "admin", isLocal, options);
      if (!adminResult.ok) {
        return adminResult;
      }

      // 3. Store build
      console.log("Store build başlatılıyor...");
      io.to(`deployment-${domain}`).emit("setup-progress", {
        message: "Store derleniyor...",
        step: "build",
        percent: 66
      });

      const storeResult = await this.buildApplicationWithStream(domain, "store", isLocal, options);
      if (!storeResult.ok) {
        return storeResult;
      }

      io.to(`deployment-${domain}`).emit("setup-progress", {
        message: "✅ Tüm uygulamalar başarıyla derlendi",
        step: "build",
        percent: 100
      });

      return {
        ok: true,
        message: "Tüm uygulamalar başarıyla derlendi"
      };

    } catch (error: any) {
      console.error("Build error:", error);

      return {
        ok: false,
        message: error.message || "Build işlemi başarısız",
        code: "GENERAL_ERROR",
        errorType: "other"
      };
    }
  }
}
