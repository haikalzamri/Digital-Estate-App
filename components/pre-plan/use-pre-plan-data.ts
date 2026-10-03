"use client";

import { useCallback, useEffect, useState } from "react";
import { parsePlanStore, PRE_PLAN_STORAGE_KEY, tomorrowDate } from "@/lib/pre-plan/planning";
import type { PrePlanDay } from "@/lib/types/pre-plan";

export function usePrePlanData() {
  const [date, setDate] = useState("");
  const [days, setDays] = useState<Record<string, PrePlanDay>>({});
  const [dirtyDates, setDirtyDates] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState("");
  const [externalChange, setExternalChange] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setDays(parsePlanStore(window.localStorage.getItem(PRE_PLAN_STORAGE_KEY)).days);
      } catch {
        setStorageError("Browser storage is unavailable or saved demo data is invalid. You can try the planner, but saving is unavailable.");
      }
      setDate(tomorrowDate());
      setReady(true);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === PRE_PLAN_STORAGE_KEY || event.key === null) setExternalChange(true);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    if (!dirtyDates.length) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirtyDates.length]);

  const updatePlan = useCallback((plan: PrePlanDay) => {
    setDays((current) => ({ ...current, [plan.date]: plan }));
    setDirtyDates((current) => [...new Set([...current, plan.date])]);
  }, []);

  const savePlan = useCallback((plan: PrePlanDay) => {
    if (storageError) throw new Error(storageError);
    if (externalChange) throw new Error("Demo data changed in another tab. Reload before saving to avoid overwriting it.");
    const savedPlan = { ...plan, savedAt: new Date().toISOString() };
    try {
      const stored = parsePlanStore(window.localStorage.getItem(PRE_PLAN_STORAGE_KEY));
      const nextStore = { version: 2 as const, days: { ...stored.days, [plan.date]: savedPlan } };
      parsePlanStore(JSON.stringify(nextStore));
      window.localStorage.setItem(PRE_PLAN_STORAGE_KEY, JSON.stringify(nextStore));
    } catch {
      throw new Error("The demo plan could not be saved in this browser. Your changes remain on this page; keep it open and try again.");
    }
    setDays((current) => ({ ...current, [plan.date]: savedPlan }));
    setDirtyDates((current) => current.filter((item) => item !== plan.date));
    return savedPlan;
  }, [externalChange, storageError]);

  return { date, setDate, days, ready, dirtyDates, storageError, externalChange, updatePlan, savePlan };
}
