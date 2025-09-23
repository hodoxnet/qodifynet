"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { getAccessToken } from "@/lib/api";

export function AuthGate() {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // Skip on login page
    if (pathname?.startsWith("/login")) {
      setChecked(true);
      return;
    }
    const token = getAccessToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    setChecked(true);
  }, [router, pathname]);

  if (!checked) return null;
  return null;
}

