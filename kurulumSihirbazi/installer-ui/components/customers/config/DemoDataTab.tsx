"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDemoPacks } from "@/hooks/templates/useDemoPacks";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import { Loader2, Upload, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { io as socketIO } from "socket.io-client";

type StepStatus = "idle" | "running" | "success" | "error";

type StatusProps = {
  status: StepStatus;
};

function StepStatusBadge({ status }: StatusProps) {
  const styles: Record<StepStatus, { label: string; className: string }> = {
    idle: {
      label: "Hazır",
      className: "bg-slate-100 text-slate-600 dark:bg-slate-800/70 dark:text-slate-300",
    },
    running: {
      label: "Çalışıyor",
      className: "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300",
    },
    success: {
      label: "Tamamlandı",
      className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
    },
    error: {
      label: "Hata",
      className: "bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-300",
    },
  };

  const style = styles[status];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${style.className}`}>
      {status === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : status === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <Loader2 className={`h-3.5 w-3.5 ${status === "running" ? "animate-spin" : "text-inherit"}`} />}
      {style.label}
    </span>
  );
}

export function DemoDataTab({ domain }: { domain: string }) {
  const { packs, loading, error, latestVersion, refresh } = useDemoPacks();
  const [selected, setSelected] = useState<string>("");

  const [step1Status, setStep1Status] = useState<StepStatus>("idle");
  const [step1Message, setStep1Message] = useState<string>("");
  const [step1Error, setStep1Error] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const logContainerRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);

  const formatLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString('tr-TR');
    return `[${timestamp}] ${message}`;
  }, []);

  const appendLog = useCallback((message: string) => {
    setLogs(prev => [...prev, formatLog(message)]);
  }, [formatLog]);

  useEffect(() => {
    if (packs.length > 0 && !selected) {
      setSelected(packs[0].name);
    }
  }, [packs, selected]);

  useEffect(() => {
    if (!domain) return;
    const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";
    const socket = socketIO(API_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
    });
    socketRef.current = socket;

    const handleDemoOutput = (data: { message?: string }) => {
      if (!data?.message) return;
      appendLog(data.message);
    };

    const handleProgress = (data: { message?: string; step?: string }) => {
      if (!data?.message) return;
      if (data.step && data.step !== "demo-import") return;
      appendLog(data.message);
    };

    socket.on("connect", () => {
      socket.emit("subscribe-deployment", domain);
      appendLog("Log akışı başlatıldı");
    });

    socket.on("disconnect", () => {
      appendLog("Log bağlantısı kapandı");
    });

    socket.on("demo-import-output", handleDemoOutput);
    socket.on("setup-progress", handleProgress);

    return () => {
      socket.off("demo-import-output", handleDemoOutput);
      socket.off("setup-progress", handleProgress);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [domain, appendLog]);

  useEffect(() => {
    if (!logContainerRef.current) return;
    logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
  }, [logs]);

  const submitStep1 = async () => {
    if (!selected) {
      toast.error("Lütfen bir demo paketi seçin");
      return;
    }
    setStep1Status("running");
    setStep1Error("");
    setStep1Message("");
    setLogs([]);
    appendLog("Demo verileri içe aktarma başlatıldı");

    try {
      const res = await apiFetch("/api/setup/import-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          domain,
          version: latestVersion,
          packName: selected,
          overwriteUploads: true,
          mode: "schema-restore",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.message || data?.error || "Demo verileri yüklenemedi");
      }
      setStep1Status("success");
      const message = data?.message || "Demo verileri yükleme tamamlandı";
      setStep1Message(message);
      toast.success(message);
    } catch (err) {
      const message = err instanceof Error ? err.message : "İşlem başarısız";
      setStep1Status("error");
      setStep1Error(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Demo Verileri Kurulumu</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Domain: <span className="font-mono">{domain}</span> • Versiyon: {latestVersion ?? "-"}
          </p>
        </div>
        <button
          onClick={() => refresh(latestVersion)}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border"
        >
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>

      <section className="rounded-lg border p-5 space-y-4 bg-white/40 dark:bg-slate-950/40">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Tek Adım</p>
            <h4 className="text-base font-semibold">Demo verilerini içeri aktar</h4>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Seçilen demo paketi veritabanına yüklenir ve uploads klasörü kopyalanır.
            </p>
          </div>
          <StepStatusBadge status={step1Status} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Demo paketi</label>
              <select
                className="w-full max-w-md border rounded-md px-3 py-2 bg-white dark:bg-gray-900"
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                disabled={step1Status === "running"}
              >
                {packs.map((p) => (
                  <option key={`${p.category}-${p.name}`} value={p.name}>
                    {p.name} ({p.size})
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={submitStep1}
              disabled={step1Status === "running" || !selected}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-gray-900 to-slate-800 text-white hover:from-gray-800 hover:to-slate-700 disabled:opacity-60"
            >
              {step1Status === "running" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {step1Status === "running" ? "Yükleniyor..." : "Demo verilerini yükle"}
            </button>

            {step1Message && step1Status === "success" && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">{step1Message}</p>
            )}
            {step1Error && step1Status === "error" && (
              <p className="text-sm text-rose-600 dark:text-rose-400">{step1Error}</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Log çıktısı</label>
          <div
            ref={logContainerRef}
            className="max-h-56 overflow-y-auto rounded-lg border bg-slate-950/70 p-3 font-mono text-xs text-slate-100 dark:border-slate-800"
          >
            {logs.length === 0 ? (
              <div className="text-slate-400">Henüz log yok. İşlemi başlattığınızda çıktı burada görünecek.</div>
            ) : (
              logs.map((line, idx) => (
                <div key={`${line}-${idx}`} className="whitespace-pre-wrap">
                  {line}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
