"use client";

import { Trash2 } from "lucide-react";
import { ActionButton } from "./ActionButton";

interface DeleteButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function DeleteButton({ onClick, loading }: DeleteButtonProps) {
  return (
    <ActionButton
      icon={<Trash2 className="h-4 w-4" />}
      tooltip="Sil"
      onClick={onClick}
      loading={loading}
      variant="ghost"
      colorClass="hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
    />
  );
}