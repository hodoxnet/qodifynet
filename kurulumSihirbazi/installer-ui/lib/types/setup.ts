export interface SystemRequirement {
  name: string;
  status: "ok" | "warning" | "error";
  version?: string;
  message?: string;
  required: boolean;
}

export interface SetupConfig {
  // Veritabanı
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  appDbUser: string;
  appDbPassword: string;

  // Redis
  redisHost: string;
  redisPort: number;

  // Site bilgileri
  domain: string;
  storeName: string;
  templateVersion: string;
  // Build seçenekleri
  buildHeapMB?: number; // NODE_OPTIONS --max-old-space-size
  skipTypeCheckFrontend?: boolean; // Next.js build'de tip kontrolünü atla
}

export interface DatabaseTestResult {
  ok: boolean;
  message: string;
  version?: string;
}

export interface RedisTestResult {
  ok: boolean;
  message: string;
  version?: string;
}

export interface CompletedInfo {
  urls: {
    store: string;
    admin: string;
    api: string;
  };
  credentials?: {
    email: string;
    password: string;
  };
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
}

export type InstallStatus = "idle" | "running" | "completed" | "error";

// Kurulum adımları için tipler
export type InstallStepKey =
  | "checkTemplates"
  | "createDatabase"
  | "extractTemplates"
  | "configureEnvironment"
  | "installDependencies"
  | "runMigrations"
  | "buildApplications"
  | "configureServices"
  | "finalize";

export type StepStatus = "pending" | "running" | "success" | "error";

export interface InstallStep {
  key: InstallStepKey;
  label: string;
  status: StepStatus;
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  error?: string;
  progress?: number; // 0..100
}

export enum WizardStep {
  SYSTEM_CHECK = 1,
  DATABASE_CONFIG = 2,
  REDIS_CONFIG = 3,
  SITE_CONFIG = 4,
  SUMMARY = 5,
  INSTALLATION = 6
}

export const STEP_TITLES = [
  "Sistem Kontrolü",
  "Veritabanı",
  "Redis",
  "Site Bilgileri",
  "Özet",
  "Kurulum"
];

export const DEFAULT_CONFIG: SetupConfig = {
  dbHost: "localhost",
  dbPort: 5432,
  dbUser: "postgres",
  dbPassword: "",
  dbName: "",
  appDbUser: "qodify_user",
  appDbPassword: "qodify_pass",
  redisHost: "localhost",
  redisPort: 6379,
  domain: "",
  storeName: "",
  templateVersion: "latest",
  buildHeapMB: undefined,
  skipTypeCheckFrontend: false
};
