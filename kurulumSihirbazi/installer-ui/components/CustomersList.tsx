"use client";

import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CustomersTable } from "@/components/customers/CustomersTable";
import { CustomerInfoDialog } from "@/components/customers/CustomerInfoDialog";
import { CustomerLogViewer } from "@/components/customers/CustomerLogViewer";
import { DeleteCustomerDialog } from "@/components/customers/DeleteCustomerDialog";
import { useCustomerList, Customer } from "@/hooks/customers/useCustomerList";
import { useCustomerActions } from "@/hooks/customers/useCustomerActions";
import { ServiceType } from "@/hooks/customers/useCustomerLogs";
import { CreateEditCustomerDialog } from "@/components/customers/CreateEditCustomerDialog";

interface CustomersListProps {
  onRefresh: () => void;
}

export function CustomersList({ onRefresh }: CustomersListProps) {
  const { customers, loading, error, refreshCustomers } = useCustomerList();
  const {
    actionLoading,
    startCustomer,
    stopCustomer,
    restartCustomer,
    deleteCustomer,
    deleteSoft,
    deleteHard,
    createCustomer,
    updateCustomer,
  } = useCustomerActions(refreshCustomers);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [infoDialogOpen, setInfoDialogOpen] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [logService, setLogService] = useState<ServiceType>("backend");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const handleRefresh = useCallback(async () => {
    await refreshCustomers();
    onRefresh();
  }, [refreshCustomers, onRefresh]);

  const handleOpenInfo = useCallback((customer: Customer) => {
    setSelectedCustomer(customer);
    setInfoDialogOpen(true);
  }, []);

  const handleOpenLogs = useCallback((service: ServiceType) => {
    setLogService(service);
    setLogViewerOpen(true);
    setInfoDialogOpen(false);
  }, []);

  const handleDeleteClick = useCallback((customerId: string, customerDomain: string) => {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
      setCustomerToDelete(customer);
      setDeleteDialogOpen(true);
    }
  }, [customers]);

  const handleDeleteConfirm = useCallback(async () => {
    if (customerToDelete) {
      await deleteHard(customerToDelete.id);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  }, [customerToDelete, deleteCustomer]);

  const handleSoftDelete = useCallback(async () => {
    if (customerToDelete) {
      await deleteSoft(customerToDelete.id);
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    }
  }, [customerToDelete, deleteSoft]);

  const openCreate = useCallback(() => { setEditing(null); setFormOpen(true); }, []);
  const openEdit = useCallback((customer: Customer) => {
    setEditing(customer); setFormOpen(true);
  }, []);

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-xl font-bold">Müşteriler</CardTitle>
          <div className="flex items-center gap-2">
            <Button onClick={openCreate} className="rounded-full">
              Yeni Müşteri
            </Button>
            <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            className="rounded-full"
          >
            <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <CustomersTable
            customers={customers}
            loading={loading}
            error={error}
            actionLoading={actionLoading}
            onStart={startCustomer}
            onStop={stopCustomer}
            onRestart={restartCustomer}
            onDelete={handleDeleteClick}
            onInfo={handleOpenInfo}
            onEdit={openEdit}
          />
        </CardContent>
      </Card>

      <CustomerInfoDialog
        customer={selectedCustomer}
        open={infoDialogOpen}
        onOpenChange={setInfoDialogOpen}
        onOpenLogs={handleOpenLogs}
      />

      {selectedCustomer && (
        <CustomerLogViewer
          customerId={selectedCustomer.id}
          customerDomain={selectedCustomer.domain}
          service={logService}
          open={logViewerOpen}
          onOpenChange={setLogViewerOpen}
        />
      )}

      <DeleteCustomerDialog
        customer={customerToDelete}
        open={deleteDialogOpen}
        loading={actionLoading === customerToDelete?.id}
        onOpenChange={setDeleteDialogOpen}
        onSoftDelete={handleSoftDelete}
        onHardDelete={handleDeleteConfirm}
      />

      <CreateEditCustomerDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        initial={editing ? {
          id: editing.id,
          domain: editing.domain,
          partnerId: editing.partnerId,
          mode: editing.mode || 'local',
          ports: editing.ports,
        } : undefined}
        onSubmit={async (values) => {
          if (editing) await updateCustomer(editing.id, values);
          else await createCustomer(values);
        }}
      />
    </>
  );
}
