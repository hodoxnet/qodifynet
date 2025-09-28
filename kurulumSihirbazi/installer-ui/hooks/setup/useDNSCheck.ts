import { useState, useCallback } from 'react';
import axios from 'axios';
import { DNSCheckResult } from '@/lib/types/setup';

export function useDNSCheck() {
  const [testResult, setTestResult] = useState<DNSCheckResult | null>(null);
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

  const checkDNS = useCallback(async (domain: string) => {
    if (!domain) {
      setTestResult({
        valid: false,
        message: "Lütfen bir domain girin"
      });
      return;
    }

    // Local domain kontrolü
    const isLocal = domain.endsWith('.local') ||
                   domain === 'localhost' ||
                   !domain.includes('.') ||
                   domain.startsWith('test') ||
                   domain.startsWith('local');

    if (isLocal) {
      setTestResult({
        valid: true,
        message: "Local mode - DNS kontrolü atlandı"
      });
      return;
    }

    setLoading(true);
    setTestResult(null);

    try {
      const response = await axios.post(
        `${API_URL}/api/dns/check`,
        { domain },
        { headers: getAuthHeaders() }
      );

      const { valid, ip, serverIp } = response.data;

      setTestResult({
        valid,
        message: valid
          ? `DNS başarıyla doğrulandı! Domain IP: ${ip}`
          : `Domain sunucuya yönlendirilmemiş. Domain IP: ${ip || 'Bulunamadı'}, Sunucu IP: ${serverIp}`,
        ip,
        serverIp
      });
    } catch (error: any) {
      console.error("DNS check error:", error);
      setTestResult({
        valid: false,
        message: error.response?.data?.error || "DNS kontrolü sırasında hata oluştu"
      });
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  const resetTest = useCallback(() => {
    setTestResult(null);
  }, []);

  return {
    testResult,
    loading,
    checkDNS,
    resetTest
  };
}