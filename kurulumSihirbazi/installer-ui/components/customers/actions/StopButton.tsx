"use client";

import { Square } from "lucide-react";
import { ActionButton } from "./ActionButton";

interface StopButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function StopButton({ onClick, loading }: StopButtonProps) {
  return (
    <ActionButton
      icon={<Square className="h-4 w-4" />}
      tooltip="Durdur"
      onClick={onClick}
      loading={loading}
      colorClass="hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
    />
  );
}