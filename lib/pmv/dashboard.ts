import type { PmvRecord, PmvStatus } from "@/lib/types/pmv";
import { PMV_CHECKLIST_ITEMS, PMV_STATUS_LABELS } from "./config";

export type PmvDashboardFilters = {
  date?: string;
  machine?: string;
  status?: PmvStatus | "";
};

export function latestPmvDate(records: PmvRecord[]) {
  return records.map((record) => record.reportDate).filter(isIsoDate).sort().at(-1) || todayDate();
}

export function filterPmvRecords(records: PmvRecord[], filters: PmvDashboardFilters) {
  return records.filter((record) =>
    (!filters.date || record.reportDate === filters.date)
    && (!filters.machine || record.machineNumber === filters.machine)
    && (!filters.status || record.machineStatus === filters.status));
}

export function filterPmvWindow(records: PmvRecord[], endDate: string, days: number, filters: Omit<PmvDashboardFilters, "date">) {
  const dates = new Set(dateWindow(endDate, days));
  return records.filter((record) => dates.has(record.reportDate)
    && (!filters.machine || record.machineNumber === filters.machine)
    && (!filters.status || record.machineStatus === filters.status));
}

export function dateWindow(endDate: string, days: number) {
  const end = parseIsoDate(isIsoDate(endDate) ? endDate : todayDate());
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(end);
    date.setUTCDate(end.getUTCDate() - (days - 1 - index));
    return date.toISOString().slice(0, 10);
  });
}

export function hasPmvActionIssue(record: PmvRecord) {
  return record.machineStatus === "breakdown"
    || record.machineStatus === "idle"
    || record.ipsBattery === "No"
    || PMV_CHECKLIST_ITEMS.some((item) => record.checklist?.[item.key] === "Kurang Baik");
}

export function pmvActionReasons(record: PmvRecord) {
  if (record.machineStatus === "breakdown") {
    return record.damagedComponents?.length ? record.damagedComponents : ["Breakdown - component not captured"];
  }
  if (record.machineStatus === "idle") return [record.idleReason || "Idle - reason not captured"];
  const reasons: string[] = [];
  if (record.ipsBattery === "No") reasons.push("IPS Battery >13v: No");
  PMV_CHECKLIST_ITEMS.forEach((item) => {
    if (record.checklist?.[item.key] === "Kurang Baik") reasons.push(item.label);
  });
  return reasons;
}

export function uniqueMachineCount(records: PmvRecord[]) {
  return new Set(records.map((record) => record.machineNumber || "Machine not captured")).size;
}

export function groupMachineReporters(records: PmvRecord[]) {
  const groups = new Map<string, Set<string>>();
  records.forEach((record) => {
    const machine = record.machineNumber || "Machine not captured";
    const names = groups.get(machine) || new Set<string>();
    names.add(record.reporterName || "Name not captured");
    groups.set(machine, names);
  });
  return [...groups.entries()]
    .map(([machine, names]) => ({ machine, names: [...names] }))
    .sort((a, b) => a.machine.localeCompare(b.machine, undefined, { numeric: true }));
}

export function countValues(values: string[], limit = 8) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const label = String(value || "").trim();
    if (label) counts.set(label, (counts.get(label) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { numeric: true }))
    .slice(0, limit);
}

export function pmvExportHeaders() {
  return [
    "ID", "Start time", "Completion time", "Email", "Name", "Last modified time", "Piih nama anda",
    "Pilih Mesin Anda", "Status Mesin2", "IPS Battery Voltmeter >13v",
    ...PMV_CHECKLIST_ITEMS.map((item) => item.detail ? `${item.label} (${item.detail})` : item.label),
    "Catatan untuk Tuan Assistant", "Component rosak (Mesin Rusak)", "Machine Idle",
  ];
}

export function pmvExportRow(record: PmvRecord) {
  const row: Record<string, string> = {
    ID: record.originalId || record.id,
    "Start time": exportDateTime(record.startTime),
    "Completion time": exportDateTime(record.completionTime || record.updatedAt),
    Email: record.email || "",
    Name: record.formName || "",
    "Last modified time": exportDateTime(record.lastModifiedTime),
    "Piih nama anda": record.reporterName || "",
    "Pilih Mesin Anda": record.machineNumber || "",
    "Status Mesin2": PMV_STATUS_LABELS[record.machineStatus] || record.machineStatus,
    "IPS Battery Voltmeter >13v": record.ipsBattery || "",
    "Catatan untuk Tuan Assistant": record.assistantNotes || "",
    "Component rosak (Mesin Rusak)": record.damagedComponents?.join("; ") || "",
    "Machine Idle": record.idleReason || "",
  };
  PMV_CHECKLIST_ITEMS.forEach((item) => {
    row[item.detail ? `${item.label} (${item.detail})` : item.label] = record.checklist?.[item.key] || "";
  });
  return row;
}

export function formatPmvDate(date: string, short = false) {
  if (!isIsoDate(date)) return date || "-";
  return new Intl.DateTimeFormat("en-GB", short
    ? { day: "2-digit", month: "short" }
    : { day: "2-digit", month: "short", year: "numeric" }).format(parseIsoDate(date));
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseIsoDate(value: string) {
  return new Date(`${value}T00:00:00Z`);
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function exportDateTime(value?: string) {
  return String(value || "").replace("T", " ");
}
