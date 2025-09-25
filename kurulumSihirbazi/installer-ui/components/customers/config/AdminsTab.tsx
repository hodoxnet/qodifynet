"use client";

import { useState } from "react";
import { Users, UserPlus, Loader2, User, Mail, Lock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Admin, NewAdmin } from "@/hooks/customers/useCustomerAdmins";

interface AdminsTabProps {
  admins: Admin[];
  loading: boolean;
  creating: boolean;
  onCreateAdmin: (adminData: NewAdmin) => Promise<boolean>;
}

export function AdminsTab({ admins, loading, creating, onCreateAdmin }: AdminsTabProps) {
  const [newAdmin, setNewAdmin] = useState<NewAdmin>({
    email: "",
    password: "",
    name: "",
  });

  const handleCreateAdmin = async () => {
    const success = await onCreateAdmin(newAdmin);
    if (success) {
      setNewAdmin({ email: "", password: "", name: "" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Admin Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Yeni Yönetici Ekle
          </CardTitle>
          <CardDescription>
            Admin paneline erişim sağlayacak yeni bir yönetici kullanıcı oluşturun
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email" className="flex items-center gap-2">
                <Mail className="h-3 w-3" />
                Email <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin-email"
                type="email"
                value={newAdmin.email}
                onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                placeholder="admin@example.com"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-password" className="flex items-center gap-2">
                <Lock className="h-3 w-3" />
                Şifre <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin-password"
                type="password"
                value={newAdmin.password}
                onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                placeholder="••••••••"
                className="text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-name" className="flex items-center gap-2">
                <User className="h-3 w-3" />
                İsim
              </Label>
              <Input
                id="admin-name"
                type="text"
                value={newAdmin.name || ""}
                onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                placeholder="Admin User"
                className="text-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleCreateAdmin}
            disabled={creating || !newAdmin.email || !newAdmin.password}
            className="mt-4 gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Oluşturuluyor...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Yönetici Ekle
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Admins List Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Yönetici Kullanıcıları
          </CardTitle>
          <CardDescription>
            Admin paneline erişim yetkisi olan tüm kullanıcılar
          </CardDescription>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Yöneticiler yükleniyor...
                </p>
              </div>
            </div>
          ) : admins.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Henüz yönetici kullanıcı bulunmuyor
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                Yukarıdaki formu kullanarak yeni bir yönetici ekleyin
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>İsim</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead>Oluşturulma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {admins.map((admin) => (
                  <TableRow key={admin.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        {admin.email}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-gray-400" />
                        {admin.name || "-"}
                      </div>
                    </TableCell>
                    <TableCell>
                      {admin.isActive ? (
                        <Badge variant="default" className="gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Aktif
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          Pasif
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-gray-600 dark:text-gray-400">
                      {admin.createdAt
                        ? new Date(admin.createdAt).toLocaleDateString("tr-TR", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}