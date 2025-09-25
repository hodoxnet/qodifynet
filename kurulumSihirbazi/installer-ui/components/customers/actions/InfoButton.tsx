"use client";

import { Info } from "lucide-react";
import { ActionButton } from "./ActionButton";

interface InfoButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function InfoButton({ onClick, loading }: InfoButtonProps) {
  return (
    <ActionButton
      icon={<Info className="h-4 w-4" />}
      tooltip="Bilgi"
      onClick={onClick}
      loading={loading}
      colorClass="hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
    />
  );
}