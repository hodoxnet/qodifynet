import { useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { SystemRequirement } from '@/lib/types/setup';

export function useSystemRequirements() {
  const [requirements, setRequirements] = useState<SystemRequirement[]>([]);
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

  const checkRequirements = useCallback(async () => {
    setLoading(true);
    setRequirements([]);

    try {
      const response = await axios.get(`${API_URL}/api/setup/requirements`, {
        headers: getAuthHeaders(),
        withCredentials: true,
        params: { t: Date.now() }
      });

      if (response.data.ok) {
        console.log("Requirements from API:", response.data.requirements);
        setRequirements(response.data.requirements);
      } else {
        toast.error("Sistem gereksinimleri alınamadı");
      }
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error("Oturum süreniz dolmuş. Tekrar giriş yapın.");
        window.location.href = "/login";
      } else {
        toast.error("Bağlantı hatası");
      }
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [API_URL, getAuthHeaders]);

  const canProceed = useCallback(() => {
    return requirements.filter(r => r.required && r.status === "error").length === 0;
  }, [requirements]);

  return {
    requirements,
    loading,
    checkRequirements,
    canProceed
  };
}