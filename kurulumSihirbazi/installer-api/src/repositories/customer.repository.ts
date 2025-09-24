import fs from "fs-extra";
import path from "path";
import { Customer } from "../types/customer.types";

export class CustomerRepository {
  private static instance: CustomerRepository;
  private readonly customerDataPath: string;
  private dataCache: { data: Customer[]; timestamp: number } | null = null;
  private readonly CACHE_TTL = 10000; // 10 saniye cache

  private constructor() {
    this.customerDataPath = path.join(process.cwd(), "data", "customers.json");
    this.ensureDataDirectory();
  }

  public static getInstance(): CustomerRepository {
    if (!CustomerRepository.instance) {
      CustomerRepository.instance = new CustomerRepository();
    }
    return CustomerRepository.instance;
  }

  private async ensureDataDirectory(): Promise<void> {
    await fs.ensureDir(path.dirname(this.customerDataPath));
    if (!(await fs.pathExists(this.customerDataPath))) {
      await fs.writeJson(this.customerDataPath, []);
    }
  }

  async getAll(forceRefresh = false): Promise<Customer[]> {
    // Cache kontrolü
    if (!forceRefresh && this.dataCache &&
        Date.now() - this.dataCache.timestamp < this.CACHE_TTL) {
      return [...this.dataCache.data]; // Kopya döndür
    }

    try {
      const customers = await fs.readJson(this.customerDataPath);

      // Cache'i güncelle
      this.dataCache = {
        data: customers,
        timestamp: Date.now()
      };

      return customers;
    } catch (error) {
      console.error("Error reading customers:", error);
      return [];
    }
  }

  async getById(id: string): Promise<Customer | null> {
    const customers = await this.getAll();
    return customers.find(c => c.id === id) || null;
  }

  async getByDomain(domain: string): Promise<Customer | null> {
    const customers = await this.getAll();
    return customers.find(c => c.domain === domain) || null;
  }

  async save(customer: Customer): Promise<void> {
    const customers = await this.getAll(true);
    const existingIndex = customers.findIndex(c => c.id === customer.id);

    if (existingIndex >= 0) {
      customers[existingIndex] = customer;
    } else {
      customers.push(customer);
    }

    await fs.writeJson(this.customerDataPath, customers, { spaces: 2 });
    this.invalidateCache();
  }

  async update(id: string, updates: Partial<Customer>): Promise<Customer | null> {
    const customers = await this.getAll(true);
    const index = customers.findIndex(c => c.id === id);

    if (index === -1) {
      return null;
    }

    customers[index] = { ...customers[index], ...updates };
    await fs.writeJson(this.customerDataPath, customers, { spaces: 2 });
    this.invalidateCache();

    return customers[index];
  }

  async delete(id: string): Promise<boolean> {
    const customers = await this.getAll(true);
    const filteredCustomers = customers.filter(c => c.id !== id);

    if (customers.length === filteredCustomers.length) {
      return false; // Silinecek müşteri bulunamadı
    }

    await fs.writeJson(this.customerDataPath, filteredCustomers, { spaces: 2 });
    this.invalidateCache();
    return true;
  }

  async getNextAvailablePort(): Promise<number> {
    const customers = await this.getAll();
    const usedPorts = customers.flatMap(c => [
      c.ports.backend,
      c.ports.admin,
      c.ports.store
    ]);

    let basePort = 4000;
    while (
      usedPorts.includes(basePort) ||
      usedPorts.includes(basePort + 1) ||
      usedPorts.includes(basePort + 2)
    ) {
      basePort += 3;
    }

    return basePort;
  }

  async exists(id: string): Promise<boolean> {
    const customer = await this.getById(id);
    return customer !== null;
  }

  async domainExists(domain: string): Promise<boolean> {
    const customer = await this.getByDomain(domain);
    return customer !== null;
  }

  private invalidateCache(): void {
    this.dataCache = null;
  }
}