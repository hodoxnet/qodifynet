import { useState, useEffect } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface Pm2Info {
  bin: string | null;
  version: string | null;
}

export interface Pm2Process {
  id: number;
  name: string;
  status: string;
  cpu: number;
  memory: string;
  uptime: string;
  restarts: number;
}

export function usePm2() {
  const [pm2Info, setPm2Info] = useState<Pm2Info | null>(null);
  const [processes, setProcesses] = useState<Pm2Process[]>([]);
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState<string | null>(null);
  const [listLoading, setListLoading] = useState(false);

  useEffect(() => {
    fetchPm2Info();
    fetchProcessList();

    // Auto refresh process list every 5 seconds
    const interval = setInterval(fetchProcessList, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchPm2Info = async () => {
    try {
      const response = await apiFetch("/api/system/pm2/info");
      if (!response.ok) return;
      const data = await response.json();
      setPm2Info(data);
    } catch (error) {
      console.error("Failed to fetch PM2 info:", error);
    }
  };

  const fetchProcessList = async () => {
    try {
      setListLoading(true);
      const response = await apiFetch("/api/system/pm2/list");
      if (!response.ok) return;
      const data = await response.json();
      setProcesses(data || []);
    } catch (error) {
      console.error("Failed to fetch PM2 process list:", error);
    } finally {
      setListLoading(false);
    }
  };

  const runPm2Command = async (
    command: string,
    endpoint: string,
    successMessage: string
  ) => {
    setLoading(command);
    try {
      const response = await apiFetch(endpoint, { method: "POST" });
      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success(successMessage);
      } else {
        toast.error(data?.output || data?.error || "İşlem başarısız");
      }

      setOutput(String(data?.output || ""));
    } catch (error: any) {
      setOutput(String(error?.message || error));
      toast.error("İşlem sırasında hata oluştu");
    } finally {
      setLoading(null);
      fetchPm2Info();
    }
  };

  const savePm2 = () =>
    runPm2Command("save", "/api/system/pm2/save", "Süreç listesi kaydedildi");

  const setupStartup = () =>
    runPm2Command(
      "startup",
      "/api/system/pm2/startup",
      "Startup komutu çalıştırıldı"
    );

  const updatePm2 = () =>
    runPm2Command(
      "update",
      "/api/system/pm2/update",
      "PM2 güncellendi (daemon reload)"
    );

  const restartAll = () =>
    runPm2Command(
      "restart-all",
      "/api/system/pm2/restart-all",
      "Tüm süreçler yeniden başlatıldı"
    );

  const stopAll = () =>
    runPm2Command(
      "stop-all",
      "/api/system/pm2/stop-all",
      "Tüm süreçler durduruldu"
    );

  return {
    pm2Info,
    processes,
    output,
    loading,
    listLoading,
    savePm2,
    setupStartup,
    updatePm2,
    restartAll,
    stopAll,
    refreshInfo: fetchPm2Info,
    refreshProcessList: fetchProcessList,
  };
}