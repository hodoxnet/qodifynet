import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { RedisTestResult } from '@/lib/types/setup';

export function useRedisConnection() {
  const [testResult, setTestResult] = useState<RedisTestResult | null>(null);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";
  const CSRF_KEY = 'qid_csrf_token';

  const ensureCsrfToken = useCallback(async () => {
    try {
      const cached = typeof localStorage !== 'undefined' ? localStorage.getItem(CSRF_KEY) : null;
      if (cached) return cached;
      const res = await fetch(`${API_URL}/api/csrf-token`, { credentials: 'include' });
      if (!res.ok) return null;
      const j = await res.json();
      const tok = j?.token as string | undefined;
      if (tok) { try { localStorage.setItem(CSRF_KEY, tok); } catch {} return tok; }
      return null;
    } catch { return null; }
  }, [API_URL]);

  const getAuthHeaders = useCallback(() => {
    let token = null;
    try {
      token = localStorage.getItem("qid_access");
    } catch {}

    const headers: Record<string, string> = {
      Authorization: token ? `Bearer ${token}` : "",
      "Content-Type": "application/json"
    };
    try { const csrf = localStorage.getItem(CSRF_KEY); if (csrf) headers['x-csrf-token'] = csrf; } catch {}
    return headers;
  }, []);

  const testRedis = useCallback(async (host: string, port: number) => {
    setLoading(true);

    try {
      await ensureCsrfToken();
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
