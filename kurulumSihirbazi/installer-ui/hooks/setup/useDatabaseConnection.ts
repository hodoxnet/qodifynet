import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { DatabaseTestResult, SetupConfig } from '@/lib/types/setup';

export function useDatabaseConnection() {
  const [testResult, setTestResult] = useState<DatabaseTestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

  const getAuthHeaders = useCallback(() => {
    let token = null;
    try {
      token = localStorage.getItem("qid_access");
    } catch {}

    return {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    };
  }, []);

  const testDatabase = useCallback(async (config: Pick<SetupConfig, 'dbHost' | 'dbPort' | 'dbUser' | 'dbPassword'>) => {
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/setup/test-database`,
        {
          host: config.dbHost,
          port: config.dbPort,
          user: config.dbUser,
          password: config.dbPassword
        },
        { headers: getAuthHeaders(), withCredentials: true }
      );

      setTestResult(response.data);
      if (response.data.ok) {
        toast.success("Veritabanı bağlantısı başarılı!");
      } else {
        toast.error(response.data.message);
      }

      return response.data;
    } catch (error) {
      toast.error("Veritabanı test hatası");
      const errorResult = { ok: false, message: "Bağlantı kurulamadı" };
      setTestResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  const createDatabase = useCallback(async (
    dbConfig: Pick<SetupConfig, 'dbHost' | 'dbPort' | 'dbUser' | 'dbPassword'>,
    dbName: string,
    appUser: string,
    appPassword: string
  ) => {
    const response = await axios.post(
      `${API_URL}/api/setup/create-database`,
      {
        dbConfig: {
          host: dbConfig.dbHost,
          port: dbConfig.dbPort,
          user: dbConfig.dbUser,
          password: dbConfig.dbPassword
        },
        dbName,
        appUser,
        appPassword
      },
      { headers: getAuthHeaders(), withCredentials: true }
    );

    return response.data;
  }, [API_URL, getAuthHeaders]);

  return {
    testResult,
    loading,
    testDatabase,
    createDatabase,
    canProceed: () => testResult?.ok === true
  };
}