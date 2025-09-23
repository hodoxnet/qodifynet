"use client";

import { useEffect, useState } from "react";
import { Play, Square, RefreshCw, Trash2, ExternalLink, Loader2, Info, Terminal, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { LogViewer } from "./LogViewer";
import { apiFetch as fetcher } from "@/lib/api";

interface Customer {
  id: string;
  domain: string;
  status: "running" | "stopped" | "error";
  createdAt: string;
  ports: {
    backend: number;
    admin: number;
    store: number;
  };
  resources: {
    cpu: number;
    memory: number;
  };
  mode?: "local" | "production";
  db?: { name: string; user: string; host: string; port: number; schema?: string };
  redis?: { host: string; port: number; prefix?: string };
}

interface CustomersListProps {
  onRefresh: () => void;
}

export function CustomersList({ onRefresh }: CustomersListProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState<boolean>(false);
  const [infoCustomer, setInfoCustomer] = useState<Customer | null>(null);
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [logService, setLogService] = useState<"backend" | "admin" | "store">("backend");

  const isLocalCustomer = (c: Customer) => c.mode === "local" || !c.domain.includes(".") || c.domain.endsWith(".local");
  const getUrls = (c: Customer) => {
    if (isLocalCustomer(c)) {
      return {
        store: `http://localhost:${c.ports.store}`,
        admin: `http://localhost:${c.ports.admin}`,
        api: `http://localhost:${c.ports.backend}`,
      };
    }
    return {
      store: `https://${c.domain}`,
      admin: `https://${c.domain}/qpanel`,
      api: `https://${c.domain}/api`,
    };
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await fetcher("/api/customers");
      if (!response.ok) throw new Error("Unauthorized or failed");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("Unexpected response");
      setCustomers(data);
    } catch (error) {
      toast.error("Müşteri listesi yüklenemedi");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (customerId: string, action: "start" | "stop" | "restart" | "delete") => {
    setActionLoading(customerId);
    try {
      const response = await fetcher(`/api/customers/${customerId}/${action}`, {
        method: "POST",
      });

      if (response.ok) {
        toast.success(`${action} işlemi başarılı`);
        await fetchCustomers();
        onRefresh();
      } else {
        throw new Error("İşlem başarısız");
      }
    } catch (error) {
      toast.error("İşlem sırasında hata oluştu");
      console.error(error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      running: "bg-green-100 text-green-800",
      stopped: "bg-gray-100 text-gray-800",
      error: "bg-red-100 text-red-800",
    };

    const labels = {
      running: "Çalışıyor",
      stopped: "Durduruldu",
      error: "Hata",
    };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status as keyof typeof styles]}`}>
        {labels[status as keyof typeof labels]}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
        <div className="flex items-center justify-center space-x-2">
          <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          <span className="text-gray-600">Müşteriler yükleniyor...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Müşteriler</h2>
        <button
          onClick={fetchCustomers}
          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Domain
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Durum
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Port Aralığı
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Kaynak Kullanımı
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                İşlemler
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Henüz müşteri bulunmuyor
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">{customer.domain}</span>
                      {!customer.domain.includes('.') || customer.domain.endsWith('.local') ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full">
                          LOCAL
                        </span>
                      ) : (
                        <a
                          href={`https://${customer.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-gray-400 hover:text-gray-600"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(customer.status)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-600">
                      <div className="mb-1">{customer.ports.backend}-{customer.ports.store}</div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {(() => {
                          const u = getUrls(customer);
                          return (
                            <>
                              <a href={u.store} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Store</a>
                              <span className="text-gray-400">|</span>
                              <a href={u.admin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Admin</a>
                              <span className="text-gray-400">|</span>
                              <a href={u.api} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API</a>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm">
                      <div className="text-gray-600">
                        CPU: {customer.resources.cpu}%
                      </div>
                      <div className="text-gray-600">
                        RAM: {customer.resources.memory}MB
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end space-x-2">
                      {actionLoading === customer.id ? (
                        <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                      ) : (
                        <>
                          <button
                            onClick={async () => {
                              setInfoCustomer(customer);
                              setInfoOpen(true);
                              setHealthLoading(true);
                              try {
                                const res = await fetcher(`/api/customers/${customer.id}/health`);
                                const data = await res.json();
                                setHealth(data);
                              } catch (error) {
                                console.error('Health check failed:', error);
                              } finally {
                                setHealthLoading(false);
                              }
                            }}
                            className="p-1 text-gray-700 hover:bg-gray-100 rounded"
                            title="Bilgi"
                          >
                            <Info className="w-4 h-4" />
                          </button>
                          {customer.status === "stopped" ? (
                            <button
                              onClick={() => handleAction(customer.id, "start")}
                              className="p-1 text-green-600 hover:bg-green-100 rounded"
                              title="Başlat"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleAction(customer.id, "stop")}
                              className="p-1 text-red-600 hover:bg-red-100 rounded"
                              title="Durdur"
                            >
                              <Square className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleAction(customer.id, "restart")}
                            className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                            title="Yeniden Başlat"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`${customer.domain} müşterisini silmek istediğinize emin misiniz?`)) {
                                handleAction(customer.id, "delete");
                              }
                            }}
                            className="p-1 text-red-600 hover:bg-red-100 rounded"
                            title="Sil"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
          {infoOpen && infoCustomer && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Müşteri Bilgileri</h3>
                    <p className="text-sm text-gray-600">{infoCustomer.domain} ({infoCustomer.mode === 'local' ? 'Local' : 'Production'})</p>
                  </div>
                  <button onClick={() => { setInfoOpen(false); setHealth(null); }} className="text-gray-600 hover:text-gray-900">Kapat</button>
                </div>
                <div className="space-y-4 text-sm">
                  <div>
                    <p className="text-gray-800 font-medium">Uygulama Portları</p>
                    <p className="text-gray-600">Backend: {infoCustomer.ports.backend} • Admin: {infoCustomer.ports.admin} • Store: {infoCustomer.ports.store}</p>
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium mb-2">Servis Sağlığı</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">
                        {healthLoading ? 'Kontrol ediliyor...' : health ? 'Son kontrol: ' + new Date().toLocaleTimeString() : 'Henüz kontrol edilmedi'}
                      </span>
                      <button
                        onClick={async () => {
                          setHealthLoading(true);
                          try {
                            const res = await fetcher(`/api/customers/${infoCustomer.id}/health`);
                            const data = await res.json();
                            setHealth(data);
                          } catch (error) {
                            console.error('Health check failed:', error);
                            toast.error('Servis sağlığı kontrol edilemedi');
                          } finally {
                            setHealthLoading(false);
                          }
                        }}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Yenile
                      </button>
                    </div>
                    <div className="space-y-2">
                      {['backend', 'admin', 'store'].map((service) => (
                        <div key={service} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div className="flex items-center space-x-2">
                            <span className="capitalize font-medium">{service}:</span>
                            {health ? (
                              <>
                                {health[service]?.status === 'healthy' ? (
                                  <CheckCircle className="w-4 h-4 text-green-500" />
                                ) : health[service]?.status === 'stopped' ? (
                                  <AlertCircle className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <AlertCircle className="w-4 h-4 text-red-500" />
                                )}
                                <span className={`text-xs ${
                                  health[service]?.status === 'healthy' ? 'text-green-600' :
                                  health[service]?.status === 'stopped' ? 'text-gray-500' :
                                  'text-red-600'
                                }`}>
                                  {health[service]?.status === 'healthy' ? `OK (HTTP ${health[service]?.httpCode || '200'})` :
                                   health[service]?.status === 'stopped' ? 'Durduruldu' :
                                   health[service]?.error || 'HATA'}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-gray-400">Bilinmiyor</span>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setLogService(service as "backend" | "admin" | "store");
                              setLogViewerOpen(true);
                            }}
                            className="flex items-center space-x-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            <Terminal className="w-3 h-3" />
                            <span>Logs</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Direkt URL'ler</p>
                    {(() => {
                      const u = getUrls(infoCustomer);
                      return (
                        <p className="text-gray-600 space-x-2">
                          <a href={u.store} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Store</a>
                          <span className="text-gray-400">|</span>
                          <a href={u.admin} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Admin</a>
                          <span className="text-gray-400">|</span>
                          <a href={u.api} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">API</a>
                        </p>
                      );
                    })()}
                  </div>
                  <div>
                    <p className="text-gray-800 font-medium">Veritabanı</p>
                    <p className="text-gray-600">Host: {infoCustomer.db?.host || '-'} • Port: {infoCustomer.db?.port ?? '-'}</p>
                    <p className="text-gray-600">Ad: {infoCustomer.db?.name || '-'} • Kullanıcı: {infoCustomer.db?.user || '-'}</p>
                    <p className="text-gray-600">Şema: {infoCustomer.db?.schema || 'public'}</p>
                  </div>
              <div>
                <p className="text-gray-800 font-medium">Redis</p>
                <p className="text-gray-600">Host: {infoCustomer.redis?.host || '-'} • Port: {infoCustomer.redis?.port ?? '-'}</p>
                <p className="text-gray-600">Prefix: {infoCustomer.redis?.prefix || '-'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {logViewerOpen && infoCustomer && (
        <LogViewer
          customerId={infoCustomer.id}
          customerDomain={infoCustomer.domain}
          service={logService}
          isOpen={logViewerOpen}
          onClose={() => setLogViewerOpen(false)}
        />
      )}
    </div>
  );
}
