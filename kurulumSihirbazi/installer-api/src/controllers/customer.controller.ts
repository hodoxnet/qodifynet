import { Router } from "express";
import { CustomerService } from "../services/customer.service";
import { DeploymentService } from "../services/deployment.service";

export const customerRouter = Router();
const customerService = new CustomerService();
const deploymentService = new DeploymentService();

// Get all customers
customerRouter.get("/", async (req, res) => {
  try {
    const customers = await customerService.getAllCustomers();
    res.json(customers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
});

// Get customer by ID
customerRouter.get("/:id", async (req, res) => {
  try {
    const customer = await customerService.getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ error: "Customer not found" });
    }
    res.json(customer);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch customer" });
  }
});

// Deploy new customer
customerRouter.post("/deploy", async (req, res) => {
  try {
    const result = await deploymentService.deployCustomer(req.body);
    res.json(result);
  } catch (error) {
    console.error("Deployment error:", error);
    const message = (error as any)?.message || "Deployment failed";
    res.status(500).json({ error: message });
  }
});

// Customer actions
customerRouter.post("/:id/start", async (req, res) => {
  try {
    const result = await customerService.startCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to start customer" });
  }
});

customerRouter.post("/:id/stop", async (req, res) => {
  try {
    const result = await customerService.stopCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to stop customer" });
  }
});

customerRouter.post("/:id/restart", async (req, res) => {
  try {
    const result = await customerService.restartCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to restart customer" });
  }
});

customerRouter.post("/:id/delete", async (req, res) => {
  try {
    const result = await customerService.deleteCustomer(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to delete customer" });
  }
});

// Get customer logs
customerRouter.get("/:id/logs", async (req, res) => {
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
customerRouter.get("/:id/health", async (req, res) => {
  try {
    const health = await customerService.getCustomerHealth(req.params.id);
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: "Failed to check health" });
  }
});
