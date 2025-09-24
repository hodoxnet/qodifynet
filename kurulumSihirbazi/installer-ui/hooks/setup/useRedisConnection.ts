import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RedisTestResult } from '@/lib/types/setup';

export function useRedisConnection() {
  const [testResult, setTestResult] = useState<RedisTestResult | null>(null);
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

  const testRedis = useCallback(async (host: string, port: number) => {
    setLoading(true);

    try {
      const response = await axios.post(
        `${API_URL}/api/setup/test-redis`,
        { host, port },
        { headers: getAuthHeaders(), withCredentials: true }
      );

      setTestResult(response.data);
      if (response.data.ok) {
        toast.success("Redis bağlantısı başarılı!");
      } else {
        toast.error(response.data.message);
      }

      return response.data;
    } catch (error) {
      toast.error("Redis test hatası");
      const errorResult = { ok: false, message: "Bağlantı kurulamadı" };
      setTestResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  return {
    testResult,
    loading,
    testRedis,
    canProceed: () => true // Redis opsiyonel olduğu için her zaman devam edilebilir
  };
}