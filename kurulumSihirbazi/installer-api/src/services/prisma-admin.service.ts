import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs-extra";
import path from "path";
import { AdminUser } from "../types/customer.types";

const execAsync = promisify(exec);

export class PrismaAdminService {
  private readonly customersPath: string;

  constructor() {
    this.customersPath = process.env.CUSTOMERS_PATH || path.join(process.cwd(), "../customers");
  }

  async createAdmin(
    domain: string,
    adminData: { email: string; password: string; name?: string }
  ): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    const adminScript = this.generateAdminScript(adminData);
    const scriptPath = path.join(backendPath, 'create-admin-temp.ts');

    try {
      await fs.writeFile(scriptPath, adminScript);

      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync(`npx ts-node ${scriptPath}`, {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: `Admin user ${adminData.email} created successfully`,
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error creating admin:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    } finally {
      await fs.remove(scriptPath);
    }
  }

  async getAdmins(domain: string): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    const getAdminsScript = this.generateGetAdminsScript();
    const scriptPath = path.join(backendPath, 'get-admins-temp.ts');

    try {
      await fs.writeFile(scriptPath, getAdminsScript);

      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync(`npx ts-node ${scriptPath}`, {
        cwd: backendPath,
        env
      });

      const admins = JSON.parse(result.stdout.trim());

      return {
        success: true,
        admins
      };
    } catch (error: any) {
      console.error("Error getting admins:", error);
      return {
        success: false,
        message: error.message,
        admins: []
      };
    } finally {
      await fs.remove(scriptPath);
    }
  }

  async updateAdmin(
    domain: string,
    adminId: string,
    updates: Partial<AdminUser>
  ): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    const updateScript = this.generateUpdateAdminScript(adminId, updates);
    const scriptPath = path.join(backendPath, 'update-admin-temp.ts');

    try {
      await fs.writeFile(scriptPath, updateScript);

      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync(`npx ts-node ${scriptPath}`, {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: `Admin ${adminId} updated successfully`,
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error updating admin:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    } finally {
      await fs.remove(scriptPath);
    }
  }

  async deleteAdmin(domain: string, adminId: string): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    const deleteScript = this.generateDeleteAdminScript(adminId);
    const scriptPath = path.join(backendPath, 'delete-admin-temp.ts');

    try {
      await fs.writeFile(scriptPath, deleteScript);

      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync(`npx ts-node ${scriptPath}`, {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: `Admin ${adminId} deleted successfully`,
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error deleting admin:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    } finally {
      await fs.remove(scriptPath);
    }
  }

  async runPrismaGenerate(domain: string): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    try {
      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync("npx prisma generate", {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: "Prisma Client başarıyla oluşturuldu",
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error running prisma generate:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  async runPrismaDbPush(domain: string, acceptDataLoss = false): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    try {
      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const dataLossFlag = acceptDataLoss ? "--accept-data-loss" : "";
      const command = `npx prisma db push --skip-generate ${dataLossFlag}`.trim();

      const result = await execAsync(command, {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: "Veritabanı şeması başarıyla güncellendi",
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error running prisma db push:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  async runPrismaMigrate(domain: string): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    try {
      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync("npx prisma migrate deploy", {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: "Veritabanı migration'ları başarıyla uygulandı",
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error running prisma migrate:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  async runSeed(domain: string): Promise<any> {
    const customerPath = path.join(this.customersPath, domain.replace(/\./g, "-"));
    const backendPath = path.join(customerPath, "backend");

    try {
      const env = { ...process.env } as Record<string, any>;
      delete env.DATABASE_URL;

      const result = await execAsync("npm run db:seed", {
        cwd: backendPath,
        env
      });

      return {
        success: true,
        message: "Seed verileri başarıyla yüklendi",
        output: result.stdout
      };
    } catch (error: any) {
      console.error("Error running seed:", error);
      return {
        success: false,
        message: error.message,
        error: error.toString()
      };
    }
  }

  private generateAdminScript(adminData: { email: string; password: string; name?: string }): string {
    return `
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('${adminData.password}', 10);

  try {
    const admin = await prisma.admin.upsert({
      where: { email: '${adminData.email}' },
      update: {
        password: hashedPassword,
        name: '${adminData.name || 'Admin User'}',
        isActive: true
      },
      create: {
        email: '${adminData.email}',
        password: hashedPassword,
        name: '${adminData.name || 'Admin User'}',
        isActive: true
      }
    });

    console.log('✅ Admin created/updated:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createAdmin();
    `;
  }

  private generateGetAdminsScript(): string {
    return `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getAdmins() {
  try {
    const admins = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        createdAt: true
      }
    });

    console.log(JSON.stringify(admins));
    process.exit(0);
  } catch (error) {
    console.error('❌ Error getting admins:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

getAdmins();
    `;
  }

  private generateUpdateAdminScript(adminId: string, updates: Partial<AdminUser>): string {
    const updateData: any = {};
    if (updates.name) updateData.name = updates.name;
    if (updates.email) updateData.email = updates.email;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;

    if (updates.password) {
      return `
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function updateAdmin() {
  const hashedPassword = await bcrypt.hash('${updates.password}', 10);

  try {
    const admin = await prisma.admin.update({
      where: { id: '${adminId}' },
      data: {
        ...${JSON.stringify(updateData)},
        password: hashedPassword
      }
    });

    console.log('✅ Admin updated:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
      `;
    }

    return `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateAdmin() {
  try {
    const admin = await prisma.admin.update({
      where: { id: '${adminId}' },
      data: ${JSON.stringify(updateData)}
    });

    console.log('✅ Admin updated:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateAdmin();
    `;
  }

  private generateDeleteAdminScript(adminId: string): string {
    return `
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteAdmin() {
  try {
    const admin = await prisma.admin.delete({
      where: { id: '${adminId}' }
    });

    console.log('✅ Admin deleted:', admin.email);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting admin:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

deleteAdmin();
    `;
  }
}