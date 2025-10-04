export interface Customer {
  id: string;
  domain: string;
  status: "running" | "stopped" | "error";
  createdAt: string;
  partnerId?: string;
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
  resources: {
    cpu: number;
    memory: number;
  };
  mode?: "local" | "production";
  db?: {
    name: string;
    user: string;
    host: string;
    port: number;
    schema?: string;
  };
  redis?: {
    host: string;
    port: number;
    prefix?: string;
  };
}

export interface PM2Process {
  name: string;
  pm2_env?: {
    status: string;
    [key: string]: any;
  };
  monit?: {
    cpu: number;
    memory: number;
  };
  [key: string]: any;
}

export interface CustomerHealth {
  backend: ServiceHealth;
  admin: ServiceHealth;
  store: ServiceHealth;
}

export interface ServiceHealth {
  status: 'unknown' | 'stopped' | 'healthy' | 'error';
  url: string;
  error: string | null;
  httpCode?: number;
}

export interface EnvConfig {
  [service: string]: {
    [key: string]: string | undefined;
  };
}

export interface AdminUser {
  id?: string;
  email: string;
  password?: string;
  name?: string;
  isActive?: boolean;
  createdAt?: Date;
}
