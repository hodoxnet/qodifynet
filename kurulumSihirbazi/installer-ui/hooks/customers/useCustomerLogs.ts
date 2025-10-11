"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch as fetcher } from "@/lib/api";
import { io as socketIO, Socket } from "socket.io-client";

export type ServiceType = "backend" | "admin" | "store";

interface UseCustomerLogsProps {
  customerId?: string;
  customerDomain?: string;
  service?: ServiceType;
  lines?: number;
  autoRefresh?: boolean;
  refreshInterval?: number;
  streamingMode?: boolean; // Yeni: WebSocket streaming kullan
}

interface LogLine {
  service: string;
  line: string;
  type: "stdout" | "stderr";
  timestamp: string;
}

export function useCustomerLogs({
  customerId,
  customerDomain,
  service = "backend",
  lines = 100,
  autoRefresh = false,
  refreshInterval = 3000,
  streamingMode = true // Varsayılan olarak streaming kullan
}: UseCustomerLogsProps = {}) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [logLines, setLogLines] = useState<LogLine[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const logBufferRef = useRef<string[]>([]);

  const fetchLogs = useCallback(async (
    id?: string,
    svc?: ServiceType,
    lineCount?: number
  ) => {
    const targetId = id || customerId;
    const targetService = svc || service;
    const targetLines = lineCount || lines;

    if (!targetId) return "";

    setLoading(true);
    setError(null);
    try {
      const response = await fetcher(
        `/api/customers/${targetId}/logs?service=${targetService}&lines=${targetLines}`
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err?.error || "Log getirme başarısız");
      }

      const data = await response.json();
      const logContent = data.logs || "Log bulunmuyor";
      setLogs(logContent);
      return logContent;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Log getirme hatası";
      setError(errorMsg);
      setLogs(`Hata: ${errorMsg}`);
      return "";
    } finally {
      setLoading(false);
    }
  }, [customerId, service, lines]);

  // WebSocket streaming başlat
  const startStreaming = useCallback(() => {
    if (!customerId || !customerDomain || !streamingMode) return;
    if (socketRef.current?.connected) return; // Zaten bağlı

    const API_URL = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";

    console.log("[LogStream] Starting WebSocket connection...");
    setLoading(true);
    setIsStreaming(true);

    const socket = socketIO(API_URL, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[LogStream] Connected, subscribing to logs...");
      socket.emit("subscribe-log-stream", {
        customerId,
        domain: customerDomain,
        service,
      });
    });

    socket.on("stream-started", ({ service: svc }) => {
      console.log(`[LogStream] Stream started for ${svc}`);
      setLoading(false);
      setError(null);
    });

    socket.on("log-line", (data: LogLine) => {
      // Her satırı buffer'a ekle
      const formattedLine = data.line.trim();
      if (formattedLine) {
        logBufferRef.current.push(formattedLine);
        setLogLines(prev => [...prev, data]);

        // logs state'ini de güncelle (geriye dönük uyumluluk için)
        setLogs(prev => prev + (prev ? "\n" : "") + formattedLine);
      }
    });

    socket.on("stream-ended", ({ service: svc, code }) => {
      console.log(`[LogStream] Stream ended for ${svc}, code: ${code}`);
      setIsStreaming(false);
      setLoading(false);
    });

    socket.on("stream-error", ({ error: err }) => {
      console.error("[LogStream] Stream error:", err);
      setError(err || "Streaming hatası");
      setIsStreaming(false);
      setLoading(false);
    });

    socket.on("connect_error", (err) => {
      console.error("[LogStream] Connection error:", err.message);
      setError("WebSocket bağlantı hatası");
      setLoading(false);
    });

    socket.on("disconnect", (reason) => {
      console.log("[LogStream] Disconnected:", reason);
      setIsStreaming(false);
      setLoading(false);
    });

    // İlk yükleme için mevcut logları da çek
    fetchLogs(customerId, service, lines);
  }, [customerId, customerDomain, service, streamingMode, lines, fetchLogs]);

  // Streaming durdur
  const stopStreaming = useCallback(() => {
    if (!socketRef.current || !customerId) return;

    console.log("[LogStream] Stopping stream...");
    socketRef.current.emit("unsubscribe-log-stream", {
      customerId,
      service,
    });

    socketRef.current.disconnect();
    socketRef.current = null;
    setIsStreaming(false);
  }, [customerId, service]);

  const clearLogs = useCallback(() => {
    setLogs("");
    setLogLines([]);
    setError(null);
    logBufferRef.current = [];
  }, []);

  const downloadLogs = useCallback(() => {
    const logContent = logs || logBufferRef.current.join("\n");
    if (!logContent || !customerId || !service) return;

    const blob = new Blob([logContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${customerId}-${service}-${new Date().toISOString()}.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [logs, customerId, service]);

  // Streaming mode etkinse ve autoRefresh açıksa WebSocket kullan
  useEffect(() => {
    if (streamingMode && autoRefresh && customerId && customerDomain) {
      startStreaming();
      return () => {
        stopStreaming();
      };
    }
  }, [streamingMode, autoRefresh, customerId, customerDomain, service, startStreaming, stopStreaming]);

  // Polling mode (eski davranış)
  useEffect(() => {
    if (!streamingMode && autoRefresh && customerId) {
      const interval = setInterval(() => {
        fetchLogs();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
  }, [streamingMode, autoRefresh, customerId, refreshInterval, fetchLogs]);

  // Component unmount'ta cleanup
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        stopStreaming();
      }
    };
  }, [stopStreaming]);

  return {
    logs,
    logLines,
    loading,
    error,
    isStreaming,
    fetchLogs,
    clearLogs,
    downloadLogs,
    startStreaming,
    stopStreaming,
  };
}