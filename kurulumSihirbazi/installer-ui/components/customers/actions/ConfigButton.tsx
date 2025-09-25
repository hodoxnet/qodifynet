"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { ActionButton } from "./ActionButton";

interface ConfigButtonProps {
  customerId: string;
}

export function ConfigButton({ customerId }: ConfigButtonProps) {
  return (
    <Link href={`/customers/${customerId}/config`}>
      <ActionButton
        icon={<Settings className="h-4 w-4" />}
        tooltip="Konfigürasyon"
        colorClass="hover:bg-purple-100 dark:hover:bg-purple-900/20 text-purple-600 dark:text-purple-400"
      />
    </Link>
  );
}