import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface Pm2Info {
  bin: string;
  version: string;
}

// Detect the best available PM2 binary and its version.
export async function detectPm2(): Promise<Pm2Info | null> {
  const candidates: string[] = [];

  // 0) Explicit override via env
  if (process.env.PM2_BIN) {
    candidates.push(process.env.PM2_BIN);
  }

  if (process.env.NVM_BIN) {
    candidates.push(`${process.env.NVM_BIN}/pm2`);
  }

  try {
    const { stdout } = await execAsync("npm bin -g");
    const npmGlobalBin = stdout.trim();
    if (npmGlobalBin) candidates.push(`${npmGlobalBin}/pm2`);
  } catch {}

  candidates.push("/opt/homebrew/bin/pm2");
  candidates.push("/usr/local/bin/pm2");
  candidates.push("pm2");

  // 5) Scan PATH for any pm2 binaries (captures nvm/asdf and others)
  const pathEnv = process.env.PATH || process.env.Path || process.env.path || "";
  if (pathEnv) {
    const parts = pathEnv.split(":").filter(Boolean);
    for (const dir of parts) {
      candidates.push(`${dir}/pm2`);
    }
  }

  const found: Array<{ path: string; version: string }> = [];
  // De-duplicate while preserving order
  const seen = new Set<string>();
  for (const raw of candidates) {
    const bin = raw.replace(/\/+/g, "/");
    if (seen.has(bin)) continue;
    seen.add(bin);
    try {
      const { stdout } = await execAsync(`${bin} --version 2>&1`);
      const raw = stdout.trim();
      const match = raw.match(/\d+\.\d+\.\d+/) || raw.match(/\d+\.\d+/);
      const ver = match ? match[0] : raw;
      if (ver && !found.some((f) => f.path === bin)) {
        found.push({ path: bin, version: ver });
      }
    } catch {}
  }

  if (found.length === 0) return null;

  const toParts = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const cmp = (a: string, b: string) => {
    const [a1, a2, a3] = toParts(a);
    const [b1, b2, b3] = toParts(b);
    if (a1 !== b1) return a1 - b1;
    if (a2 !== b2) return a2 - b2;
    return a3 - b3;
  };

  const best = found.reduce((acc, cur) => (cmp(cur.version, acc.version) > 0 ? cur : acc));
  return { bin: best.path, version: best.version };
}
