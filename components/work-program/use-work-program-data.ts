"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildFallbackRecords, mergeRecords, normaliseRecord } from "@/lib/work-program/analytics";
import type { WorkProgramRecord } from "@/lib/types/work-program";

const CACHE_KEY = "dge-work-program-next-v1";
const LEGACY_KEY = "sdg-work-program-tracker-v1";

type WorkProgramCache = {
  records: WorkProgramRecord[];
  pendingDeletes: string[];
};

type RecordsResponse = { records?: WorkProgramRecord[]; error?: string };

const fallbackRecords = buildFallbackRecords();

function readCache(): WorkProgramCache {
  if (typeof window === "undefined") return { records: [], pendingDeletes: [] };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || "{}") as Partial<WorkProgramCache>;
    return {
      records: Array.isArray(parsed.records) ? parsed.records : [],
      pendingDeletes: Array.isArray(parsed.pendingDeletes) ? parsed.pendingDeletes : [],
    };
  } catch {
    return { records: [], pendingDeletes: [] };
  }
}

function readLegacyRecords() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LEGACY_KEY) || "{}") as { records?: WorkProgramRecord[] };
    return Array.isArray(parsed.records) ? parsed.records : [];
  } catch {
    return [];
  }
}

function writeCache(records: WorkProgramRecord[], pendingDeletes: string[]) {
  window.localStorage.setItem(CACHE_KEY, JSON.stringify({ records, pendingDeletes } satisfies WorkProgramCache));
}

async function requestRecords(path = "/api/work-program-records", init?: RequestInit) {
  const response = await fetch(path, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
  });
  const data = (await response.json()) as RecordsResponse;
  if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}.`);
  return data;
}

export function useWorkProgramData() {
  const [records, setRecords] = useState<WorkProgramRecord[]>(fallbackRecords);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<"Supabase" | "Local fallback">("Local fallback");
  const [message, setMessage] = useState("");

  const persistRecords = useCallback((nextRecords: WorkProgramRecord[], pendingDeletes = readCache().pendingDeletes) => {
    setRecords(nextRecords);
    writeCache(nextRecords, pendingDeletes);
  }, []);

  const refresh = useCallback(async () => {
    const cache = readCache();
    const cachedPending = cache.records.filter((record) => record.syncStatus === "Pending Sync");
    try {
      const data = await requestRecords();
      const remote = Array.isArray(data.records) ? data.records : [];
      const next = mergeRecords(fallbackRecords, remote, cachedPending).filter(
        (record) => !cache.pendingDeletes.includes(record.id),
      );
      persistRecords(next, cache.pendingDeletes);
      setSource(remote.length ? "Supabase" : "Local fallback");
    } catch {
      const local = mergeRecords(fallbackRecords, readLegacyRecords(), cache.records).filter(
        (record) => !cache.pendingDeletes.includes(record.id),
      );
      setRecords(local);
      setSource("Local fallback");
    } finally {
      setLoading(false);
    }
  }, [persistRecords]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(refreshTimer);
  }, [refresh]);

  const saveRecord = useCallback(
    async (record: WorkProgramRecord) => {
      const payload = normaliseRecord({ ...record, updatedAt: new Date().toISOString() });
      const optimistic = mergeRecords(records.filter((item) => item.id !== payload.id), [payload]);
      persistRecords(optimistic);
      try {
        const data = await requestRecords(undefined, {
          method: "POST",
          body: JSON.stringify({ record: { ...payload, syncStatus: "Synced" } }),
        });
        const saved = data.records?.[0] ? normaliseRecord(data.records[0]) : { ...payload, syncStatus: "Synced" };
        persistRecords(mergeRecords(optimistic.filter((item) => item.id !== saved.id), [saved]));
        setMessage("Record saved to Supabase.");
        setSource("Supabase");
        return saved;
      } catch {
        const pending = { ...payload, syncStatus: "Pending Sync" };
        persistRecords(mergeRecords(optimistic.filter((item) => item.id !== pending.id), [pending]));
        setMessage("Saved locally. Supabase sync is unavailable.");
        return pending;
      }
    },
    [persistRecords, records],
  );

  const approveRecord = useCallback(
    async (record: WorkProgramRecord) => saveRecord({ ...record, approvalStatus: "Approved" }),
    [saveRecord],
  );

  const deleteRecord = useCallback(
    async (record: WorkProgramRecord) => {
      const cache = readCache();
      const remaining = records.filter((item) => item.id !== record.id);
      persistRecords(remaining, cache.pendingDeletes);
      try {
        await requestRecords(undefined, { method: "DELETE", body: JSON.stringify({ id: record.id }) });
        writeCache(remaining, cache.pendingDeletes.filter((id) => id !== record.id));
        setMessage("Record deleted from Supabase.");
      } catch {
        const pendingDeletes = [...new Set([...cache.pendingDeletes, record.id])];
        writeCache(remaining, pendingDeletes);
        setMessage("Record deleted locally. Supabase delete is queued.");
      }
    },
    [persistRecords, records],
  );

  const syncPending = useCallback(async () => {
    const cache = readCache();
    const failedDeletes: string[] = [];
    for (const id of cache.pendingDeletes) {
      try {
        await requestRecords(undefined, { method: "DELETE", body: JSON.stringify({ id }) });
      } catch {
        failedDeletes.push(id);
      }
    }

    const failedUploads: WorkProgramRecord[] = [];
    for (const record of cache.records.filter((item) => item.syncStatus === "Pending Sync")) {
      try {
        await requestRecords(undefined, {
          method: "POST",
          body: JSON.stringify({ record: { ...record, syncStatus: "Synced" } }),
        });
      } catch {
        failedUploads.push(record);
      }
    }

    writeCache(mergeRecords(cache.records.filter((item) => item.syncStatus !== "Pending Sync"), failedUploads), failedDeletes);
    await refresh();
    setMessage(failedDeletes.length || failedUploads.length ? "Some offline changes remain queued." : "Offline changes synced.");
  }, [refresh]);

  useEffect(() => {
    const handleReconnect = () => void syncPending();
    window.addEventListener("online", handleReconnect);
    return () => window.removeEventListener("online", handleReconnect);
  }, [syncPending]);

  return useMemo(
    () => ({ records, loading, source, message, setMessage, refresh, saveRecord, approveRecord, deleteRecord, syncPending }),
    [records, loading, source, message, refresh, saveRecord, approveRecord, deleteRecord, syncPending],
  );
}
