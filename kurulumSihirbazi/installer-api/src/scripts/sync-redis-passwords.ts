import { prisma } from "../db/prisma";
import * as fs from "fs";
import * as path from "path";

/**
 * Reads a .env file and returns key-value pairs
 */
function parseEnvFile(filePath: string): Record<string, string> {
  const content = fs.readFileSync(filePath, "utf-8");
  const env: Record<string, string> = {};

  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    const index = trimmed.indexOf("=");
    if (index === -1) return;

    const key = trimmed.substring(0, index).trim();
    const value = trimmed.substring(index + 1).trim();
    env[key] = value;
  });

  return env;
}

/**
 * Syncs Redis passwords from customer .env files to database
 */
async function syncRedisPasswords() {
  console.log("🔄 Starting Redis password sync...\n");

  try {
    const customers = await prisma.customer.findMany();
    console.log(`📋 Found ${customers.length} customers\n`);

    let updated = 0;
    let skipped = 0;
    let errors = 0;

    for (const customer of customers) {
      const slug = customer.domain.replace(/\./g, "-");
      const envPath = path.join("/var/qodify/customers", slug, "backend", ".env");

      console.log(`🔍 Processing: ${customer.domain} (${slug})`);

      // Check if .env file exists
      if (!fs.existsSync(envPath)) {
        console.log(`   ⚠️  .env file not found: ${envPath}`);
        skipped++;
        continue;
      }

      try {
        // Parse .env file
        const envVars = parseEnvFile(envPath);
        const redisPassword = envVars["REDIS_PASSWORD"];

        if (!redisPassword) {
          console.log(`   ℹ️  No REDIS_PASSWORD found in .env`);
          skipped++;
          continue;
        }

        // Check if password already exists in database
        if (customer.redisPassword === redisPassword) {
          console.log(`   ✓ Password already synced`);
          skipped++;
          continue;
        }

        // Update database
        await prisma.customer.update({
          where: { id: customer.id },
          data: { redisPassword }
        });

        console.log(`   ✅ Updated password in database`);
        updated++;
      } catch (error) {
        console.error(`   ❌ Error processing customer: ${error}`);
        errors++;
      }

      console.log("");
    }

    console.log("📊 Summary:");
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ⏭️  Skipped: ${skipped}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log("");
    console.log("✨ Sync completed!");
  } catch (error) {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the sync
syncRedisPasswords();
