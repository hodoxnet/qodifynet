"use client";

import { RefreshCw } from "lucide-react";
import { ActionButton } from "./ActionButton";

interface RestartButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function RestartButton({ onClick, loading }: RestartButtonProps) {
  return (
    <ActionButton
      icon={<RefreshCw className="h-4 w-4" />}
      tooltip="Yeniden Başlat"
      onClick={onClick}
      loading={loading}
      colorClass="hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
    />
  );
}