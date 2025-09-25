"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle, XCircle, PauseCircle } from "lucide-react";

export type CustomerStatus = "running" | "stopped" | "error";

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  showIcon?: boolean;
  className?: string;
}

const statusConfig = {
  running: {
    label: "Çalışıyor",
    variant: "default" as const,
    icon: CheckCircle,
    className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30",
    iconClassName: "text-green-600 dark:text-green-400"
  },
  stopped: {
    label: "Durduruldu",
    variant: "secondary" as const,
    icon: PauseCircle,
    className: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800",
    iconClassName: "text-gray-600 dark:text-gray-400"
  },
  error: {
    label: "Hata",
    variant: "destructive" as const,
    icon: XCircle,
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30",
    iconClassName: "text-red-600 dark:text-red-400"
  }
};

export function CustomerStatusBadge({
  status,
  showIcon = false,
  className
}: CustomerStatusBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "font-medium transition-colors",
        config.className,
        className
      )}
    >
      {showIcon && (
        <Icon className={cn("mr-1 h-3 w-3", config.iconClassName)} />
      )}
      {config.label}
    </Badge>
  );
}