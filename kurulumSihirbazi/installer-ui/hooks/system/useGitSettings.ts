"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export interface GitSettings {
  defaultRepo: string;
  defaultBranch: string;
  depth: number;
  username: string;
  tokenSet: boolean;
}

export function useGitSettings() {
  const [settings, setSettings] = useState<GitSettings>({
    defaultRepo: "",
    defaultBranch: "main",
    depth: 1,
    username: "",
    tokenSet: false,
  });
  const [tokenInput, setTokenInput] = useState<string>("");
  const [clearToken, setClearToken] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/system/settings");
      if (!res.ok) {
        throw new Error("Git ayarları alınamadı");
      }
      const data = await res.json();
      const git = data?.git || {};
      setSettings({
        defaultRepo: git.defaultRepo || "",
        defaultBranch: git.defaultBranch || "main",
        depth: typeof git.depth === "number" ? git.depth : 1,
        username: git.username || "",
        tokenSet: Boolean(git.tokenSet),
      });
      setTokenInput("");
      setClearToken(false);
    } catch (error: any) {
      console.error("Git ayarları alınamadı:", error);
      toast.error(error?.message || "Git ayarları alınamadı");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const saveSettings = useCallback(async () => {
    setSaving(true);
    try {
      const payload: any = {
        git: {
          defaultRepo: settings.defaultRepo,
          defaultBranch: settings.defaultBranch,
          depth: settings.depth,
          username: settings.username,
        }
      };

      if (clearToken) {
        payload.git.clearToken = true;
      } else if (tokenInput.trim().length > 0) {
        payload.git.token = tokenInput.trim();
      }

      const res = await apiFetch("/api/system/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || err?.message || "Git ayarları kaydedilemedi");
      }
      const data = await res.json();
      const git = data?.git || {};
      setSettings({
        defaultRepo: git.defaultRepo || "",
        defaultBranch: git.defaultBranch || "main",
        depth: typeof git.depth === "number" ? git.depth : 1,
        username: git.username || "",
        tokenSet: Boolean(git.tokenSet),
      });
      setTokenInput("");
      setClearToken(false);
      toast.success("Git ayarları kaydedildi");
    } catch (error: any) {
      console.error("Git ayarları kaydedilemedi:", error);
      toast.error(error?.message || "Git ayarları kaydedilemedi");
      throw error;
    } finally {
      setSaving(false);
    }
  }, [settings, tokenInput, clearToken]);

  return {
    settings,
    setSettings,
    tokenInput,
    setTokenInput,
    clearToken,
    setClearToken,
    loading,
    saving,
    saveSettings,
    refresh: fetchSettings,
  };
}
