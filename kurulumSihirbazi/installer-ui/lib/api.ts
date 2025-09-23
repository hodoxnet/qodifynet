"use client";

const API_BASE = process.env.NEXT_PUBLIC_INSTALLER_API_URL || "http://localhost:3031";
const ACCESS_KEY = "qid_access";

let memoryAccess: string | null = null;

export function setAccessToken(token: string) {
  memoryAccess = token;
  try { localStorage.setItem(ACCESS_KEY, token); } catch {}
}

export function clearAccessToken() {
  memoryAccess = null;
  try { localStorage.removeItem(ACCESS_KEY); } catch {}
}

export function getAccessToken(): string | null {
  if (memoryAccess) return memoryAccess;
  try { memoryAccess = localStorage.getItem(ACCESS_KEY); } catch {}
  return memoryAccess;
}

async function refreshAccess(): Promise<string | null> {
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    const tok = data?.accessToken as string | undefined;
    if (tok) {
      setAccessToken(tok);
      return tok;
    }
    return null;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  let token = getAccessToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers, credentials: "include" });
  if (res.status !== 401) return res;
  // try refresh once
  token = await refreshAccess();
  if (!token) return res;
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(url, { ...init, headers, credentials: "include" });
}

export async function login(email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error || "Login failed");
  }
  const data = await res.json();
  if (data?.accessToken) setAccessToken(data.accessToken);
  // persist basic user info for sidebar
  try {
    const avatar = localStorage.getItem('qid_avatar') || '/api/avatar';
    localStorage.setItem('qid_user', JSON.stringify({
      name: data?.user?.name || data?.user?.email || 'Kullanıcı',
      email: data?.user?.email,
      avatar,
    }));
  } catch {}
  return data;
}

export async function logout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {}
  clearAccessToken();
  try { localStorage.removeItem('qid_user'); localStorage.removeItem('qid_avatar'); } catch {}
}

export async function getMe() {
  let token = getAccessToken();
  const headers: Record<string, string> = { };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/api/auth/me`, { headers, credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}
