import { Router } from "express";
import { CustomerService } from "../services/customer.service";
import { authorize } from "../middleware/authorize";

export const customerRouter = Router();
const customerService = new CustomerService();

// Get all customers
customerRouter.get("/", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (_req, res): Promise<void> => {
  try {
    const customers = await customerService.getAllCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get customer by ID
customerRouter.get("/:id", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Deploy endpoint removed - using setup.service.ts instead

// Customer actions
customerRouter.post("/:id/start", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.startCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to start customer" });
  }
});

customerRouter.post("/:id/stop", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.stopCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to stop customer" });
  }
});

customerRouter.post("/:id/restart", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.restartCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to restart customer" });
  }
});

customerRouter.post("/:id/delete", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.deleteCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// Get customer logs
customerRouter.get("/:id/logs", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const service = req.query.service as string || 'backend';
    const lines = parseInt(req.query.lines as string) || 100;
    const logs = await customerService.getCustomerLogs(req.params.id, service, lines);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch logs" });
  }
});

// Get customer service health
customerRouter.get("/:id/health", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const health = await customerService.getCustomerHealth(req.params.id);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: "Failed to check health" });
  }
});

// Get environment configuration
customerRouter.get("/:id/env-config", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const envConfig = await customerService.getEnvConfig(req.params.id);
    res.json(envConfig);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch environment configuration" });
  }
});

// Update environment configuration
customerRouter.put("/:id/env-config", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.updateEnvConfig(req.params.id, req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to update environment configuration" });
  }
});

// Restart specific service with PM2
customerRouter.post("/:id/restart-service", authorize("OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { service } = req.body; // 'backend', 'admin', or 'store'
    const result = await customerService.restartService(req.params.id, service);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to restart service" });
  }
});

// Get admin users
customerRouter.get("/:id/admins", authorize("VIEWER", "OPERATOR", "ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.getAdmins(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admin users" });
  }
});

// Create admin user
customerRouter.post("/:id/admins", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const result = await customerService.createAdmin(req.params.id, { email, password, name });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to create admin user" });
  }
});

// Prisma database operations
customerRouter.post("/:id/database/generate", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaGenerate(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma generate" });
  }
});

customerRouter.post("/:id/database/push", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaDbPush(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma db push" });
  }
});

customerRouter.post("/:id/database/migrate", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runPrismaMigrate(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run Prisma migrate" });
  }
});

customerRouter.post("/:id/database/seed", authorize("ADMIN", "SUPER_ADMIN"), async (req, res): Promise<void> => {
  try {
    const result = await customerService.runSeed(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to run seed" });
  }
});
