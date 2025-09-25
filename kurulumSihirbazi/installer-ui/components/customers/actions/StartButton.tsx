"use client";

import { Play } from "lucide-react";
import { ActionButton } from "./ActionButton";

interface StartButtonProps {
  onClick: () => void;
  loading?: boolean;
}

export function StartButton({ onClick, loading }: StartButtonProps) {
  return (
    <ActionButton
      icon={<Play className="h-4 w-4" />}
      tooltip="Başlat"
      onClick={onClick}
      loading={loading}
      colorClass="hover:bg-green-100 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400"
    />
  );
}