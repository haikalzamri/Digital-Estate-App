import type { PmvRecord, PmvStatus } from "@/lib/types/pmv";
import { PMV_CHECKLIST_ITEMS, PMV_EXCEL_SOURCE } from "./config";

export function defaultPmvChecklist() {
  return Object.fromEntries(PMV_CHECKLIST_ITEMS.map((item) => [item.key, "Baik"]));
}

export function normalisePmvRecord(record: PmvRecord): PmvRecord {
  const machineStatus = normalisePmvStatus(record.machineStatus);
  const historical = isPmvHistoricalRecord(record);
  return {
    ...record,
    source: record.source || "PMV Tracker",
    reporterName: String(record.reporterName || "").trim(),
    reportDate: record.reportDate || datePart(record.startTime || record.updatedAt || "") || todayDate(),
    machineNumber: String(record.machineNumber || "").trim(),
    machineType: String(record.machineType || "").trim(),
    machineStatus,
    ipsBattery: machineStatus === "working" ? String(record.ipsBattery || "").trim() : "",
    checklist: normaliseChecklist(record.checklist, !historical && machineStatus === "working"),
    damagedComponents: machineStatus === "breakdown" ? normaliseComponents(record.damagedComponents) : [],
    idleReason: machineStatus === "idle" ? String(record.idleReason || "").trim() : "",
    assistantNotes: String(record.assistantNotes || "").trim(),
    syncStatus: record.syncStatus || "Synced",
    updatedAt: record.updatedAt || record.completionTime || new Date().toISOString(),
  };
}

export function mergePmvRecords(...sets: PmvRecord[][]) {
  const byId = new Map<string, PmvRecord>();
  sets.flat().forEach((record) => {
    const normalised = normalisePmvRecord(record);
    if (normalised.id) byId.set(normalised.id, normalised);
  });
  return [...byId.values()].sort(sortPmvRecordsDescending);
}

export function isPmvHistoricalRecord(record: PmvRecord) {
  return record.source === PMV_EXCEL_SOURCE || record.id.startsWith("pmv-excel-");
}

export function sortPmvRecordsDescending(a: PmvRecord, b: PmvRecord) {
  return new Date(b.completionTime || b.updatedAt || b.reportDate || 0).getTime()
    - new Date(a.completionTime || a.updatedAt || a.reportDate || 0).getTime();
}

function normalisePmvStatus(status: unknown): PmvStatus {
  const value = String(status || "").toLowerCase();
  if (value.startsWith("breakdown")) return "breakdown";
  if (value.startsWith("idle")) return "idle";
  return "working";
}

function normaliseChecklist(checklist: Record<string, string> | undefined, fillMissing: boolean) {
  return Object.fromEntries(PMV_CHECKLIST_ITEMS.map((item) => {
    const value = checklist?.[item.key];
    return [item.key, value === "Baik" || value === "Kurang Baik" ? value : fillMissing ? "Baik" : ""];
  }));
}

function normaliseComponents(components: string[] | undefined) {
  return Array.isArray(components) ? components.map((component) => String(component).trim()).filter(Boolean) : [];
}

function datePart(value: string) {
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}
