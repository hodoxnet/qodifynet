import { prisma } from "../db/prisma";

async function verifyRedisPasswords() {
  console.log("🔍 Verifying Redis passwords in database...\n");

  try {
    const customers = await prisma.customer.findMany({
      where: {
        redisHost: { not: null }
      },
      select: {
        domain: true,
        redisHost: true,
        redisPort: true,
        redisPassword: true
      }
    });

    console.log(`Found ${customers.length} customers with Redis configuration:\n`);

    customers.forEach(customer => {
      const passwordPreview = customer.redisPassword
        ? `${customer.redisPassword.substring(0, 15)}...`
        : '❌ NO PASSWORD';

      console.log(`✅ ${customer.domain}`);
      console.log(`   Host: ${customer.redisHost}:${customer.redisPort}`);
      console.log(`   Password: ${passwordPreview}`);
      console.log("");
    });

  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyRedisPasswords();
