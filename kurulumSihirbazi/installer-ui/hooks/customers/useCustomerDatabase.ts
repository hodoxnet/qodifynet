"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api";

export interface DatabaseOperations {
  generating: boolean;
  pushing: boolean;
  migrating: boolean;
  seeding: boolean;
}

export interface DatabaseOutput {
  generate?: string;
  push?: string;
  migrate?: string;
  seed?: string;
}

export function useCustomerDatabase(customerId: string) {
  const [operations, setOperations] = useState<DatabaseOperations>({
    generating: false,
    pushing: false,
    migrating: false,
    seeding: false,
  });

  const [output, setOutput] = useState<DatabaseOutput>({});

  const runDatabaseOperation = useCallback(async (
    operation: "generate" | "push" | "migrate" | "seed"
  ) => {
    const operationKey = `${operation}ing` as keyof DatabaseOperations;

    setOperations((prev) => ({ ...prev, [operationKey]: true }));

    try {
      const res = await apiFetch(`/api/customers/${customerId}/database/${operation}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await res.json();

      if (result.success) {
        toast.success(result.message || `${operation} işlemi başarılı`);
        setOutput((prev) => ({ ...prev, [operation]: result.output }));
        return { success: true, output: result.output };
      } else {
        toast.error(result.message || `${operation} işlemi başarısız`);
        return { success: false, error: result.message };
      }
    } catch (error) {
      const errorMsg = `${operation} işlemi başarısız oldu`;
      toast.error(errorMsg);
      console.error(`Database ${operation} error:`, error);
      return { success: false, error: errorMsg };
    } finally {
      setOperations((prev) => ({ ...prev, [operationKey]: false }));
    }
  }, [customerId]);

  const generatePrismaClient = useCallback(() =>
    runDatabaseOperation("generate"), [runDatabaseOperation]);

  const pushSchema = useCallback(() =>
    runDatabaseOperation("push"), [runDatabaseOperation]);

  const runMigrations = useCallback(() =>
    runDatabaseOperation("migrate"), [runDatabaseOperation]);

  const seedDatabase = useCallback(() =>
    runDatabaseOperation("seed"), [runDatabaseOperation]);

  const clearOutput = useCallback((operation?: keyof DatabaseOutput) => {
    if (operation) {
      setOutput((prev) => ({ ...prev, [operation]: undefined }));
    } else {
      setOutput({});
    }
  }, []);

  return {
    operations,
    output,
    generatePrismaClient,
    pushSchema,
    runMigrations,
    seedDatabase,
    clearOutput,
  };
}