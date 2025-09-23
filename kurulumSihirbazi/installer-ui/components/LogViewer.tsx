"use client";

import { useEffect, useState } from "react";
import { X, Terminal, RefreshCw, Download } from "lucide-react";

interface LogViewerProps {
  customerId: string;
  customerDomain: string;
  service: "backend" | "admin" | "store";
  isOpen: boolean;
  onClose: () => void;
}

export function LogViewer({ customerId, customerDomain, service, isOpen, onClose }: LogViewerProps) {
  const [logs, setLogs] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lines, setLines] = useState(100);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `http://localhost:3031/api/customers/${customerId}/logs?service=${service}&lines=${lines}`
      );
      const data = await response.json();
      setLogs(data.logs || "No logs available");
    } catch (error) {
      setLogs(`Error fetching logs: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, service, lines]);

  useEffect(() => {
    if (autoRefresh && isOpen) {
      const interval = setInterval(fetchLogs, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, isOpen]);

  const handleDownload = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${customerDomain}-${service}-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const serviceColors = {
    backend: "bg-blue-500",
    admin: "bg-purple-500",
    store: "bg-green-500"
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg w-full max-w-5xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center space-x-3">
            <Terminal className="w-5 h-5" />
            <h2 className="text-lg font-semibold">
              {customerDomain} - {service.charAt(0).toUpperCase() + service.slice(1)} Logs
            </h2>
            <span className={`px-2 py-1 rounded text-xs text-white ${serviceColors[service]}`}>
              {service.toUpperCase()}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center space-x-4 px-4 py-2 border-b">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm">Auto-refresh</span>
          </label>

          <select
            value={lines}
            onChange={(e) => setLines(parseInt(e.target.value))}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value={50}>Last 50 lines</option>
            <option value={100}>Last 100 lines</option>
            <option value={200}>Last 200 lines</option>
            <option value={500}>Last 500 lines</option>
          </select>

          <button
            onClick={handleDownload}
            className="flex items-center space-x-1 px-3 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>Download</span>
          </button>
        </div>

        {/* Log content */}
        <div className="flex-1 overflow-auto p-4 bg-gray-900">
          <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">
            {loading ? (
              <div className="flex items-center space-x-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Loading logs...</span>
              </div>
            ) : (
              logs || "No logs available"
            )}
          </pre>
        </div>
      </div>
    </div>
  );
}