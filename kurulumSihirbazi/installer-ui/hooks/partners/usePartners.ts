"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";

export type Partner = { id: string; name: string; status: string; wallet?: { balance: number }; pricing?: { setupCredits: number } };

export function usePartners() {
  const [items, setItems] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try { const res = await apiFetch('/api/partners'); const data = await res.json(); setItems(Array.isArray(data?.partners) ? data.partners : []); }
    catch { toast.error('Partner listesi yüklenemedi'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchList(); }, [fetchList]);

  const create = useCallback(async (name: string, setupCredits = 1) => {
    try { const res = await apiFetch('/api/partners', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, setupCredits }) }); if (!res.ok) throw new Error(); toast.success('Partner oluşturuldu'); await fetchList(); } catch { toast.error('Oluşturma hatası'); }
  }, [fetchList]);

  return { items, loading, refresh: fetchList, create };
}

export function usePartnerDetail(id: string) {
  const [partner, setPartner] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [p, w, m, l] = await Promise.all([
        apiFetch(`/api/partners/${id}`),
        apiFetch(`/api/partners/${id}/wallet`),
        apiFetch(`/api/partners/${id}/members`),
        apiFetch(`/api/partners/${id}/ledger?take=50`),
      ]);
      const pj = await p.json(); const wj = await w.json(); const mj = await m.json(); const lj = await l.json();
      setPartner(pj?.partner || null);
      setWallet(wj || null);
      setMembers(Array.isArray(mj?.members) ? mj.members : []);
      setLedger(Array.isArray(lj?.ledger) ? lj.ledger : []);
    } catch { toast.error('Detaylar yüklenemedi'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { if (id) refresh(); }, [id, refresh]);

  const grant = useCallback(async (amount: number, note?: string) => {
    try { const res = await apiFetch(`/api/partners/${id}/credits/grant`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount, note }) }); if (!res.ok) throw new Error(); toast.success('Kredi yüklendi'); await refresh(); } catch { toast.error('Kredi yükleme hatası'); }
  }, [id, refresh]);

  const setPricing = useCallback(async (setupCredits: number) => {
    try { const res = await apiFetch(`/api/partners/${id}/pricing`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setupCredits }) }); if (!res.ok) throw new Error(); toast.success('Pricing güncellendi'); await refresh(); } catch { toast.error('Pricing hatası'); }
  }, [id, refresh]);

  const addMemberByEmail = useCallback(async (email: string, role: 'PARTNER_ADMIN'|'PARTNER_INSTALLER', password: string, name?: string) => {
    try {
      const res = await apiFetch(`/api/partners/${id}/members/by-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role })
      });
      if (!res.ok) throw new Error();
      toast.success('Üye eklendi');
      await refresh();
    } catch {
      toast.error('Üye ekleme hatası');
    }
  }, [id, refresh]);

  return { partner, wallet, members, ledger, loading, refresh, grant, setPricing, addMemberByEmail };
}
