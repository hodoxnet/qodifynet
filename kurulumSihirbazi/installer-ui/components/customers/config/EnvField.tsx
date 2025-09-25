"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

interface EnvFieldProps {
  service: string;
  fieldKey: string;
  value: string | undefined;
  currentValue: string;
  isModified: boolean;
  onChange: (service: string, key: string, value: string) => void;
}

const CRITICAL_FIELDS = [
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_API_URL",
  "NEXT_PUBLIC_BACKEND_PORT",
  "PORT",
  "APP_URL",
  "STORE_URL",
  "ADMIN_URL"
];

const SECRET_FIELDS = ["SECRET", "PASSWORD", "DATABASE_URL", "KEY", "TOKEN"];

export function EnvField({
  service,
  fieldKey,
  value,
  currentValue,
  isModified,
  onChange,
}: EnvFieldProps) {
  const isCritical = CRITICAL_FIELDS.includes(fieldKey);
  const isSecret = SECRET_FIELDS.some((secret) => fieldKey.includes(secret));
  const [showSecret, setShowSecret] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label
          htmlFor={`${service}-${fieldKey}`}
          className={cn(
            "text-sm font-medium",
            isModified && "text-green-600 dark:text-green-400",
            isCritical && !isModified && "text-blue-600 dark:text-blue-400"
          )}
        >
          {fieldKey}
        </Label>
        {isCritical && (
          <Badge variant="outline" className="h-5 text-[10px] px-1.5">
            Kritik
          </Badge>
        )}
        {isModified && (
          <Badge variant="outline" className="h-5 text-[10px] px-1.5 border-green-500 text-green-600 dark:text-green-400">
            Değiştirildi
          </Badge>
        )}
      </div>

      <div className="relative">
        <Input
          id={`${service}-${fieldKey}`}
          type={isSecret && !showSecret ? "password" : "text"}
          value={currentValue}
          onChange={(e) => onChange(service, fieldKey, e.target.value)}
          className={cn(
            "font-mono text-sm pr-10",
            isModified && "border-green-500 dark:border-green-400 focus-visible:ring-green-500"
          )}
          placeholder={value || "Ayarlanmamış"}
        />
        {isSecret && (
          <button
            type="button"
            onClick={() => setShowSecret(!showSecret)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            {showSecret ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}