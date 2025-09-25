"use client";

import React from "react";
import { ExternalLink, Globe, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  StartButton,
  StopButton,
  RestartButton,
  DeleteButton,
  InfoButton,
  ConfigButton,
} from "./actions";
import { CustomerStatusBadge } from "./CustomerStatusBadge";
import { Customer } from "@/hooks/customers/useCustomerList";
import { cn } from "@/lib/utils";

interface CustomersTableProps {
  customers: Customer[];
  loading: boolean;
  error: string | null;
  actionLoading: string | null;
  onStart: (customerId: string, domain: string) => void;
  onStop: (customerId: string, domain: string) => void;
  onRestart: (customerId: string, domain: string) => void;
  onDelete: (customerId: string, domain: string) => void;
  onInfo: (customer: Customer) => void;
}

export const CustomersTable = React.memo(function CustomersTable({
  customers,
  loading,
  error,
  actionLoading,
  onStart,
  onStop,
  onRestart,
  onDelete,
  onInfo,
}: CustomersTableProps) {
  const isLocalCustomer = (customer: Customer) =>
    customer.mode === "local" ||
    !customer.domain.includes(".") ||
    customer.domain.endsWith(".local");

  const getUrls = (customer: Customer) => {
    if (isLocalCustomer(customer)) {
      return {
        store: `http://localhost:${customer.ports.store}`,
        admin: `http://localhost:${customer.ports.admin}/admin/login`,
        api: `http://localhost:${customer.ports.backend}/api/health`,
      };
    }
    return {
      store: `https://${customer.domain}`,
      admin: `https://${customer.domain}/admin/login`,
      api: `https://${customer.domain}/api/health`,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          <span className="text-gray-600 dark:text-gray-400">
            Müşteriler yükleniyor...
          </span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (customers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          Henüz müşteri bulunmuyor
        </p>
      </div>
    );
  }

  return (
    <div className="relative overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-800">
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              Domain
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              Durum
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              Port Aralığı
            </th>
            <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              Kaynak Kullanımı
            </th>
            <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-xs">
              İşlemler
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {customers.map((customer) => {
            const urls = getUrls(customer);
            const isLoading = actionLoading === customer.id;

            return (
              <tr
                key={customer.id}
                className={cn(
                  "transition-colors",
                  "hover:bg-gray-50 dark:hover:bg-gray-800/50",
                  isLoading && "opacity-60"
                )}
              >
                {/* Domain */}
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {customer.domain}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        ID: {customer.id}
                      </div>
                    </div>
                    {isLocalCustomer(customer) ? (
                      <Badge variant="outline" className="ml-2">
                        <Globe className="h-3 w-3 mr-1" />
                        LOCAL
                      </Badge>
                    ) : (
                      <a
                        href={`https://${customer.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </td>

                {/* Durum */}
                <td className="px-4 py-4">
                  <CustomerStatusBadge status={customer.status} showIcon />
                </td>

                {/* Port Aralığı */}
                <td className="px-4 py-4">
                  <div className="space-y-2">
                    <div className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                      {customer.ports.backend}-{customer.ports.store}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <a
                        href={urls.store}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Store
                      </a>
                      <span className="text-gray-400">•</span>
                      <a
                        href={urls.admin}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        Admin
                      </a>
                      <span className="text-gray-400">•</span>
                      <a
                        href={urls.api}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        API
                      </a>
                    </div>
                  </div>
                </td>

                {/* Kaynak Kullanımı */}
                <td className="px-4 py-4">
                  <div className="space-y-2 min-w-[120px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">CPU</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {customer.resources.cpu}%
                        </span>
                      </div>
                      <Progress
                        value={customer.resources.cpu}
                        className={cn(
                          "h-1.5",
                          customer.resources.cpu > 80 && "bg-red-100 dark:bg-red-900/20"
                        )}
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600 dark:text-gray-400">RAM</span>
                        <span className="font-mono text-gray-900 dark:text-gray-100">
                          {customer.resources.memory}MB
                        </span>
                      </div>
                      <Progress
                        value={(customer.resources.memory / 500) * 100}
                        className={cn(
                          "h-1.5",
                          customer.resources.memory > 400 && "bg-red-100 dark:bg-red-900/20"
                        )}
                      />
                    </div>
                  </div>
                </td>

                {/* İşlemler */}
                <td className="px-4 py-4">
                  <div className="flex items-center justify-end gap-1">
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                    ) : (
                      <>
                        <InfoButton
                          onClick={() => onInfo(customer)}
                          loading={false}
                        />
                        <ConfigButton customerId={customer.id} />
                        {customer.status === "stopped" ? (
                          <StartButton
                            onClick={() => onStart(customer.id, customer.domain)}
                            loading={false}
                          />
                        ) : (
                          <StopButton
                            onClick={() => onStop(customer.id, customer.domain)}
                            loading={false}
                          />
                        )}
                        <RestartButton
                          onClick={() => onRestart(customer.id, customer.domain)}
                          loading={false}
                        />
                        <DeleteButton
                          onClick={() => onDelete(customer.id, customer.domain)}
                          loading={false}
                        />
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});