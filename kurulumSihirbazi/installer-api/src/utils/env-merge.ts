import fs from "fs-extra";

// Replace or append env keys in a file while preserving comments and ordering.
export async function mergeEnvFile(
  filePath: string,
  updates: Record<string, string>
) {
  const exists = await fs.pathExists(filePath);
  const original = exists ? await fs.readFile(filePath, "utf8") : "";

  const keys = Object.keys(updates);
  if (keys.length === 0) return; // nothing to do

  const done = new Set<string>();
  const lines = original.split(/\r?\n/);
  const out: string[] = [];

  for (const line of lines) {
    // Preserve blank lines and comments as-is
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") {
      out.push(line);
      continue;
    }

    // Match KEY=VALUE (avoid commented lines already handled)
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) {
      out.push(line);
      continue;
    }

    const key = m[1];
    if (updates.hasOwnProperty(key)) {
      const value = updates[key];
      // String() kullanmadan direkt değeri yazıyoruz
      out.push(`${key}=${value}`);
      done.add(key);
    } else {
      out.push(line);
    }
  }

  // Append remaining updates that weren't present
  const missing = keys.filter((k) => !done.has(k));
  if (missing.length > 0) {
    if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
    out.push("# --- Appended by Qodify Installer ---");
    for (const k of missing) {
      const value = updates[k];
      out.push(`${k}=${value}`);
    }
  }

  // Only write if changed
  const next = out.join("\n");
  if (next !== original) {
    await fs.writeFile(filePath, next);
  }
}

