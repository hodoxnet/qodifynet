"use client";

import { CustomersList } from "@/components/CustomersList";

export default function CustomersPage() {
  const handleRefresh = () => {
    // Refresh logic will be handled inside CustomersList
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Müşteriler</h1>
        <p className="text-sm text-gray-600">
          Tüm müşteri kurulumlarını yönet ve izle
        </p>
      </div>

      {/* Customers List Component */}
      <CustomersList onRefresh={handleRefresh} />
    </div>
  );
}