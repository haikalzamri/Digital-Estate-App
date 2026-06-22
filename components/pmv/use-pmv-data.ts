"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { isPmvHistoricalRecord, mergePmvRecords, normalisePmvRecord } from "@/lib/pmv/records";
import type { PmvRecord } from "@/lib/types/pmv";

const CACHE_KEY = "dge-pmv-next-v1";
const LEGACY_KEY = "sdg-work-program-tracker-v1";

type PmvCache = { records: PmvRecord[]; pendingDeletes: string[] };
type PmvResponse = { records?: PmvRecord[]; error?: string };

function readCache(): PmvCache {
  if (typeof window === "undefined") return { records: [], pendingDeletes: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as Partial<PmvCache>;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      pendingDeletes: Array.isArray(parsed.pendingDeletes) ? parsed.pendingDeletes : [],
    };
  } catch {
    return { records: [], pendingDeletes: [] };
  }
}

function readLegacyCache(): PmvCache {
  if (typeof window === "undefined") return { records: [], pendingDeletes: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_KEY) || "{}") as {
      pmvRecords?: PmvRecord[];
      pendingPmvDeletes?: string[];
    };
    return {
      records: Array.isArray(parsed.pmvRecords) ? parsed.pmvRecords : [],
      pendingDeletes: Array.isArray(parsed.pendingPmvDeletes) ? parsed.pendingPmvDeletes : [],
    };
  } catch {
    return { records: [], pendingDeletes: [] };
  }
}

function writeCache(records: PmvRecord[], pendingDeletes: string[]) {
  const cacheableRecords = records.filter((record) => !isPmvHistoricalRecord(record));
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ records: cacheableRecords, pendingDeletes } satisfies PmvCache));
}

async function requestPmv(path = "/api/pmv-records", init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const data = (await response.json()) as PmvResponse;
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
  return data;
}

export function usePmvData({ loadRecords = true }: { loadRecords?: boolean } = {}) {
  const [records, setRecords] = useState<PmvRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"Supabase" | "Local fallback">("Local fallback");
  const [message, setMessage] = useState("");

  const persist = useCallback((nextRecords: PmvRecord[], pendingDeletes = readCache().pendingDeletes) => {
    setRecords(nextRecords);
    writeCache(nextRecords, pendingDeletes);
  }, []);

  const refresh = useCallback(async () => {
    const cache = readCache();
    const legacy = readLegacyCache();
    const pending = cache.records.filter((record) => record.syncStatus === "Pending Sync");
    const pendingDeletes = [...new Set([...legacy.pendingDeletes, ...cache.pendingDeletes])];
    if (!loadRecords) {
      const local = mergePmvRecords(legacy.records, cache.records)
        .filter((record) => !isPmvHistoricalRecord(record) && !pendingDeletes.includes(record.id));
      setRecords(local);
      setSource("Local fallback");
      setLoading(false);
      return;
    }
    try {
      const { pmvHistoricalRecords } = await import("@/lib/pmv/analytics");
      const data = await requestPmv();
      const remote = Array.isArray(data.records) ? data.records : [];
      const next = mergePmvRecords(pmvHistoricalRecords, legacy.records, remote, pending)
        .filter((record) => !pendingDeletes.includes(record.id));
      persist(next, pendingDeletes);
      setSource(remote.length ? "Supabase" : "Local fallback");
    } catch {
      const { pmvHistoricalRecords } = await import("@/lib/pmv/analytics");
      const local = mergePmvRecords(pmvHistoricalRecords, legacy.records, cache.records)
        .filter((record) => !pendingDeletes.includes(record.id));
      setRecords(local);
      setSource("Local fallback");
    } finally {
      setLoading(false);
    }
  }, [loadRecords, persist]);

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);

  const saveRecord = useCallback(async (record: PmvRecord) => {
    const payload = normalisePmvRecord({ ...record, updatedAt: new Date().toISOString() });
    const optimistic = mergePmvRecords(records.filter((item) => item.id !== payload.id), [payload]);
    persist(optimistic);
    try {
      const data = await requestPmv(undefined, { method: "POST", body: JSON.stringify({ record: { ...payload, syncStatus: "Synced" } }) });
      const saved = data.records?.[0] ? normalisePmvRecord(data.records[0]) : { ...payload, syncStatus: "Synced" };
      persist(mergePmvRecords(optimistic.filter((item) => item.id !== saved.id), [saved]));
      setSource("Supabase");
      setMessage("PMV report saved.");
      return saved;
    } catch {
      const pending = { ...payload, syncStatus: "Pending Sync" };
      persist(mergePmvRecords(optimistic.filter((item) => item.id !== pending.id), [pending]));
      setMessage("Saved on this device and queued for sync.");
      return pending;
    }
  }, [persist, records]);

  const deleteRecord = useCallback(async (record: PmvRecord) => {
    const cache = readCache();
    const remaining = records.filter((item) => item.id !== record.id);
    persist(remaining, cache.pendingDeletes);
    try {
      await requestPmv(undefined, { method: "DELETE", body: JSON.stringify({ id: record.id }) });
      writeCache(remaining, cache.pendingDeletes.filter((id) => id !== record.id));
    } catch {
      writeCache(remaining, [...new Set([...cache.pendingDeletes, record.id])]);
    }
  }, [persist, records]);

  const syncPending = useCallback(async () => {
    const cache = readCache();
    const failedDeletes: string[] = [];
    for (const id of cache.pendingDeletes) {
      try {
        await requestPmv(undefined, { method: "DELETE", body: JSON.stringify({ id }) });
      } catch {
        failedDeletes.push(id);
      }
    }
    const failedUploads: PmvRecord[] = [];
    for (const record of cache.records.filter((item) => item.syncStatus === "Pending Sync")) {
      try {
        await requestPmv(undefined, { method: "POST", body: JSON.stringify({ record: { ...record, syncStatus: "Synced" } }) });
      } catch {
        failedUploads.push(record);
      }
    }
    const retained = cache.records.filter((record) => record.syncStatus !== "Pending Sync");
    writeCache(mergePmvRecords(retained, failedUploads), failedDeletes);
    await refresh();
    setMessage(failedDeletes.length || failedUploads.length ? "Some PMV reports remain queued." : "PMV reports synced.");
  }, [refresh]);

  useEffect(() => {
    const handleReconnect = () => void syncPending();
    window.addEventListener("online", handleReconnect);
    return () => window.removeEventListener("online", handleReconnect);
  }, [syncPending]);

  useEffect(() => {
    if (!loadRecords) return;
    const handleStorage = (event: StorageEvent) => {
      if (event.key === CACHE_KEY || event.key === LEGACY_KEY) void refresh();
    };
    const refreshTimer = window.setInterval(() => void refresh(), 60000);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadRecords, refresh]);

  return useMemo(
    () => ({ records, loading, source, message, setMessage, refresh, saveRecord, deleteRecord, syncPending }),
    [records, loading, source, message, refresh, saveRecord, deleteRecord, syncPending],
  );
}
