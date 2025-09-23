import { Client } from "pg";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export type PgAdminConfig = {
  host: string;
  port: number;
  user: string;
  password: string;
  database?: string;
};

export class DatabaseService {
  private pgConfig: PgAdminConfig;

  constructor(overrides?: Partial<PgAdminConfig>) {
    this.pgConfig = {
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT || "5432"),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "postgres",
      database: "postgres",
      ...overrides,
    };
  }

  async createDatabase(dbName: string, appUser?: string, appPassword?: string): Promise<string> {
    const client = new Client(this.pgConfig as any);

    try {
      await client.connect();

      // Sanitize database name (respect provided name; do not auto-prefix)
      const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");

      // Check if database exists
      const checkQuery = `SELECT 1 FROM pg_database WHERE datname = $1`;
      const result = await client.query(checkQuery, [safeName]);

      if (result.rows.length === 0) {
        // Create database
        await client.query(`CREATE DATABASE "${safeName}"`);
        console.log(`Database ${safeName} created successfully`);
      } else {
        console.log(`Database ${safeName} already exists`);
      }

      // Create application user if not exists and grant privileges
      const user = (appUser && appUser.trim()) || "hodox_user";
      const pwd = (appPassword && appPassword.trim()) || "hodox_pass";
      await client.query(`
        DO
        $do$
        BEGIN
          IF NOT EXISTS (
            SELECT FROM pg_catalog.pg_roles
            WHERE rolname = '${user}'
          ) THEN
            EXECUTE format('CREATE USER %I WITH PASSWORD %L', '${user}', '${pwd}');
          ELSE
            EXECUTE format('ALTER USER %I WITH PASSWORD %L', '${user}', '${pwd}');
          END IF;
        END
        $do$;
      `);

      await client.query(`GRANT ALL PRIVILEGES ON DATABASE "${safeName}" TO "${user}"`);

      // Apply schema-level privileges and defaults inside the target DB
      await this.applySchemaPrivileges(safeName, user);

      return safeName;
    } catch (error) {
      console.error("Failed to create database:", error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async dropDatabase(dbName: string): Promise<void> {
    const client = new Client(this.pgConfig as any);

    try {
      await client.connect();

      // Sanitize database name
      const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");

      // Terminate existing connections
      await client.query(`
        SELECT pg_terminate_backend(pg_stat_activity.pid)
        FROM pg_stat_activity
        WHERE pg_stat_activity.datname = $1
          AND pid <> pg_backend_pid();
      `, [safeName]);

      // Drop database
      await client.query(`DROP DATABASE IF EXISTS "${safeName}"`);
      console.log(`Database ${safeName} dropped successfully`);
    } catch (error) {
      console.error("Failed to drop database:", error);
      throw error;
    } finally {
      await client.end();
    }
  }

  async checkDatabaseExists(dbName: string): Promise<boolean> {
    const client = new Client(this.pgConfig as any);

    try {
      await client.connect();

      const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
      const query = `SELECT 1 FROM pg_database WHERE datname = $1`;
      const result = await client.query(query, [safeName]);

      return result.rows.length > 0;
    } catch (error) {
      console.error("Failed to check database:", error);
      return false;
    } finally {
      await client.end();
    }
  }

  async listDatabases(): Promise<string[]> {
    const client = new Client(this.pgConfig);

    try {
      await client.connect();

      const query = `SELECT datname FROM pg_database WHERE datname LIKE 'hodox_%'`;
      const result = await client.query(query);

      return result.rows.map(row => row.datname);
    } catch (error) {
      console.error("Failed to list databases:", error);
      return [];
    } finally {
      await client.end();
    }
  }

  async getDatabaseSize(dbName: string): Promise<string> {
    const client = new Client(this.pgConfig);

    try {
      await client.connect();

      const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
      const query = `SELECT pg_size_pretty(pg_database_size($1)) as size`;
      const result = await client.query(query, [safeName]);

      return result.rows[0]?.size || "0 MB";
    } catch (error) {
      console.error("Failed to get database size:", error);
      return "0 MB";
    } finally {
      await client.end();
    }
  }

  async backupDatabase(dbName: string, backupPath: string): Promise<void> {
    const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = `${backupPath}/${safeName}_${timestamp}.sql`;

    try {
      await execAsync(
        `pg_dump -U ${this.pgConfig.user} -h ${this.pgConfig.host} -p ${this.pgConfig.port} -d ${safeName} -f ${backupFile}`
      );
      console.log(`Database backed up to ${backupFile}`);
    } catch (error) {
      console.error("Failed to backup database:", error);
      throw error;
    }
  }

  async restoreDatabase(dbName: string, backupFile: string): Promise<void> {
    const safeName = dbName.replace(/[^a-zA-Z0-9_]/g, "_");

    try {
      await execAsync(
        `psql -U ${this.pgConfig.user} -h ${this.pgConfig.host} -p ${this.pgConfig.port} -d ${safeName} -f ${backupFile}`
      );
      console.log(`Database restored from ${backupFile}`);
    } catch (error) {
      console.error("Failed to restore database:", error);
      throw error;
    }
  }

  async testConnection(config?: Partial<PgAdminConfig>): Promise<{ ok: boolean; message?: string }> {
    const client = new Client({
      host: config?.host ?? this.pgConfig.host,
      port: config?.port ?? this.pgConfig.port,
      user: config?.user ?? this.pgConfig.user,
      password: config?.password ?? this.pgConfig.password,
      database: "postgres",
    } as any);
    try {
      await client.connect();
      await client.query("SELECT 1");
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) };
    } finally {
      try { await client.end(); } catch {}
    }
  }

  private async applySchemaPrivileges(dbName: string, appUser: string) {
    const safeDb = dbName.replace(/[^a-zA-Z0-9_]/g, "_");
    const safeUser = appUser.replace(/[^a-zA-Z0-9_]/g, "_");

    const client = new Client({
      host: this.pgConfig.host,
      port: this.pgConfig.port,
      user: this.pgConfig.user,
      password: this.pgConfig.password,
      database: safeDb,
    } as any);

    try {
      await client.connect();

      // Transfer schema ownership and grant required privileges
      await client.query(`ALTER SCHEMA public OWNER TO "${safeUser}"`);
      await client.query(`GRANT USAGE, CREATE ON SCHEMA public TO "${safeUser}"`);
      await client.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${safeUser}"`);
      await client.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${safeUser}"`);

      // Ensure new objects will inherit proper permissions for this role
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${safeUser}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${safeUser}"`);

      // Also set defaults for objects created by the app role itself
      await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${safeUser}" IN SCHEMA public GRANT ALL ON TABLES TO "${safeUser}"`);
      await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE "${safeUser}" IN SCHEMA public GRANT ALL ON SEQUENCES TO "${safeUser}"`);
    } catch (e) {
      console.error("Failed to apply schema privileges:", e);
      throw e;
    } finally {
      try { await client.end(); } catch {}
    }
  }
}
