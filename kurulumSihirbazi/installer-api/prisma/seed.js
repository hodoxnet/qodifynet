/* Prisma seed: creates first SUPER_ADMIN user if none exists.
   Config via env:
     SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD, SEED_ADMIN_NAME
*/
const { PrismaClient } = require("@prisma/client");
const argon2 = require("argon2");

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  if (count > 0) {
    console.log("Users already exist. Skipping seed.");
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL || "admin@example.com";
  const name = process.env.SEED_ADMIN_NAME || "Super Admin";
  const password = process.env.SEED_ADMIN_PASSWORD || "admin123!";
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "SUPER_ADMIN",
    },
  });

  console.log("Seeded SUPER_ADMIN:", { id: user.id, email: user.email });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

