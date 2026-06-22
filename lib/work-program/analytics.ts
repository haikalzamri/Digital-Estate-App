import sourceRowsJson from "@/lib/data/work-program-source.json";
import type { WorkProgramRecord } from "@/lib/types/work-program";
import {
  DASHBOARD_YEAR,
  DEFAULT_RECORD_GPS,
  EXCEL_RECORD_SOURCE,
  MAP_STATUS_RULES,
  MONTHS_2026,
  type MapStatus,
} from "./config";

type SourceTuple = [string, string, string, number, string, number | string, number | string, number | string, string, number[]];

export type DashboardRow = {
  id: string;
  programType: string;
  field: string;
  category: string;
  hect: number;
  actualBudget: "Completed" | "Programme";
  frequencyMonths: number | string;
  completedRounds: number | string;
  intervalMonths: number | string;
  proposedNextDate: string;
  months: Record<string, number>;
  isTemplate?: boolean;
};

export type FieldProperties = {
  field_gis: string;
  field_no: string;
  field_sem?: string;
  estate?: string;
  division?: string;
  field_type?: string;
  ha_gis?: number;
};

export type FieldFeature = {
  type: "Feature";
  properties: FieldProperties;
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
  };
};

export type FieldFeatureCollection = {
  type: "FeatureCollection";
  features: FieldFeature[];
};

export type MapFieldStatus = {
  field: FieldFeature;
  row: DashboardRow | null;
  completedRow: DashboardRow | null;
  status: MapStatus;
  label: string;
  intervalValue: number | null;
  intervalMonths: number | string;
  proposedNextDate: string;
  plannedToDate: number;
  completedToDate: number;
  message: string;
};

const sourceTuples = sourceRowsJson as unknown as SourceTuple[];

export const dashboardSourceRows: DashboardRow[] = sourceTuples.map(
  ([programType, field, category, hect, actualBudget, frequencyMonths, completedRounds, intervalMonths, proposedNextDate, values]) => ({
    id: `${normaliseKey(programType)}-${normaliseKey(field)}-${normaliseKey(actualBudget)}`,
    programType,
    field,
    category,
    hect: Number(hect) || 0,
    actualBudget: actualBudget === "Programme" ? "Programme" : "Completed",
    frequencyMonths,
    completedRounds,
    intervalMonths,
    proposedNextDate,
    months: Object.fromEntries(MONTHS_2026.map((month, index) => [month.key, Number(values[index]) || 0])),
  }),
);

export function buildFallbackRecords(): WorkProgramRecord[] {
  return dashboardSourceRows
    .filter((row) => row.actualBudget === "Completed")
    .flatMap((row) =>
      MONTHS_2026.flatMap((month) => {
        const hectares = Number(row.months[month.key]) || 0;
        if (hectares <= 0) return [];
        const completionDate = monthEndDate(month.key);
        return [
          {
            id: `excel-main-${normaliseKey(row.programType)}-${normaliseKey(row.field)}-${month.key}`,
            source: EXCEL_RECORD_SOURCE,
            reporterName: "Haikal",
            programType: row.programType,
            blockField: row.field,
            taskName: row.programType,
            schedulerStage: "Completed",
            hectares,
            actualCompletionDate: completionDate,
            deadline: completionDate,
            priority: "Must",
            approvalStatus: "Approved" as const,
            remarks: "",
            latitude: DEFAULT_RECORD_GPS.latitude,
            longitude: DEFAULT_RECORD_GPS.longitude,
            gpsAccuracy: "",
            photoData: "",
            syncStatus: "Synced",
            updatedAt: `${completionDate}T12:00:00.000Z`,
            category: row.category,
          },
        ];
      }),
    )
    .sort(sortRecordsDescending);
}

export function normaliseRecord(record: WorkProgramRecord): WorkProgramRecord {
  return {
    ...record,
    reporterName: record.reporterName || "Not captured",
    taskName: record.taskName || record.programType || "Completion",
    schedulerStage: record.schedulerStage || "Completed",
    approvalStatus: record.approvalStatus === "Approved" ? "Approved" : "Pending Approval",
    syncStatus: record.syncStatus || "Synced",
    remarks: record.remarks || "",
    photoData: record.photoData || "",
  };
}

export function mergeRecords(...sets: WorkProgramRecord[][]) {
  const records = new Map<string, WorkProgramRecord>();
  sets.flat().forEach((record) => records.set(record.id, normaliseRecord(record)));
  return [...records.values()].sort(sortRecordsDescending);
}

export function getProgrammeRows(programType: string, fields: FieldFeature[]): DashboardRow[] {
  const source = dashboardSourceRows.filter((row) => row.programType === programType && row.actualBudget === "Programme");
  if (source.length) return source.map(copyDashboardRow);
  return sortFields(fields).map((field) => ({
    id: `${normaliseKey(programType)}-${normaliseKey(field.properties.field_no)}-programme-template`,
    programType,
    field: field.properties.field_no || field.properties.field_gis,
    category: fieldCategory(field),
    hect: Number(field.properties.ha_gis) || 0,
    actualBudget: "Programme",
    frequencyMonths: "",
    completedRounds: "",
    intervalMonths: "",
    proposedNextDate: "",
    months: emptyMonths(),
    isTemplate: true,
  }));
}

export function getDashboardRows(programType: string, records: WorkProgramRecord[], fields: FieldFeature[]) {
  const programmeRows = getProgrammeRows(programType, fields);
  const approvedRecords = records.filter((record) => record.programType === programType && record.approvalStatus === "Approved");
  const recordsByField = groupBy(approvedRecords, (record) => fieldKey(record.blockField));
  const completedRows = programmeRows.map((programmeRow) =>
    buildCompletedRow(programType, programmeRow.field, programmeRow, recordsByField.get(fieldKey(programmeRow.field)) || []),
  );
  recordsByField.forEach((fieldRecords, key) => {
    if (completedRows.some((row) => fieldKey(row.field) === key)) return;
    completedRows.push(buildCompletedRow(programType, fieldRecords[0]?.blockField || key, null, fieldRecords));
  });
  return { programmeRows, completedRows, rows: [...completedRows, ...programmeRows] };
}

function buildCompletedRow(programType: string, field: string, programmeRow: DashboardRow | null, records: WorkProgramRecord[]): DashboardRow {
  const sourceCompleted = dashboardSourceRows.find(
    (row) => row.programType === programType && row.actualBudget === "Completed" && fieldKey(row.field) === fieldKey(field),
  );
  const latest = [...records].sort(sortRecordsDescending)[0];
  const manualRecords = records.filter((record) => record.source !== EXCEL_RECORD_SOURCE);
  const preserveSource = Boolean(sourceCompleted && !manualRecords.length);
  const frequencyMonths = preserveSource
    ? sourceCompleted?.frequencyMonths ?? ""
    : sourceCompleted?.frequencyMonths || programmeRow?.frequencyMonths || "";
  const completedRounds = preserveSource ? sourceCompleted?.completedRounds ?? "" : records.length || sourceCompleted?.completedRounds || "";
  const intervalMonths = preserveSource ? sourceCompleted?.intervalMonths ?? "" : latest ? intervalFromDate(latest.actualCompletionDate) : "";
  const proposedNextDate = preserveSource
    ? sourceCompleted?.proposedNextDate ?? ""
    : latest && Number(frequencyMonths) > 0
      ? addMonths(latest.actualCompletionDate, Number(frequencyMonths))
      : "";

  return {
    id: `${normaliseKey(programType)}-${normaliseKey(field)}-completed-approved`,
    programType,
    field: programmeRow?.field || sourceCompleted?.field || field,
    category: programmeRow?.category || sourceCompleted?.category || latest?.category || "-",
    hect: Number(programmeRow?.hect || sourceCompleted?.hect || latest?.hectares) || 0,
    actualBudget: "Completed",
    frequencyMonths,
    completedRounds,
    intervalMonths,
    proposedNextDate,
    months: Object.fromEntries(
      MONTHS_2026.map((month) => [
        month.key,
        records
          .filter((record) => monthKey(record.actualCompletionDate || record.deadline || "") === month.key)
          .reduce((total, record) => total + Number(record.hectares || 0), 0),
      ]),
    ),
    isTemplate: !sourceCompleted && !records.length,
  };
}

export function getMapStatuses(programType: string, records: WorkProgramRecord[], fields: FieldFeature[]): MapFieldStatus[] {
  const { programmeRows, completedRows } = getDashboardRows(programType, records, fields);
  const currentMonth = currentMonthKey();
  const rule = MAP_STATUS_RULES[programType];
  return sortFields(fields).map((field) => {
    const key = fieldKey(field.properties.field_no || field.properties.field_gis);
    const row = programmeRows.find((item) => fieldKey(item.field) === key) || null;
    const completedRow = completedRows.find((item) => fieldKey(item.field) === key) || null;
    const intervalMonths = firstNonBlank(completedRow?.intervalMonths, row?.intervalMonths);
    const intervalValue = numericValue(intervalMonths);
    const plannedToDate = sumMonthsToDate(row, currentMonth);
    const completedToDate = sumMonthsToDate(completedRow, currentMonth);

    if (!row && !completedRow) {
      return mapStatus(field, row, completedRow, "grey", "No planned data", intervalValue, intervalMonths, plannedToDate, completedToDate);
    }
    if (intervalValue == null) {
      return mapStatus(field, row, completedRow, "grey", "No interval", intervalValue, intervalMonths, plannedToDate, completedToDate);
    }
    if (!rule || rule.greenBelow == null || rule.yellowTo == null) {
      return mapStatus(field, row, completedRow, "grey", "No rule configured", intervalValue, intervalMonths, plannedToDate, completedToDate);
    }
    const status: MapStatus = intervalValue < rule.greenBelow ? "green" : intervalValue <= rule.yellowTo ? "yellow" : "red";
    const label = status.charAt(0).toUpperCase() + status.slice(1);
    return mapStatus(field, row, completedRow, status, label, intervalValue, intervalMonths, plannedToDate, completedToDate);
  });
}

function mapStatus(
  field: FieldFeature,
  row: DashboardRow | null,
  completedRow: DashboardRow | null,
  status: MapStatus,
  label: string,
  intervalValue: number | null,
  intervalMonths: number | string,
  plannedToDate: number,
  completedToDate: number,
): MapFieldStatus {
  return {
    field,
    row,
    completedRow,
    status,
    label,
    intervalValue,
    intervalMonths,
    proposedNextDate: completedRow?.proposedNextDate || row?.proposedNextDate || "",
    plannedToDate,
    completedToDate,
    message:
      status === "grey"
        ? `${label}; this field is not colour-rated.`
        : `${label} based on ${formatNumber(intervalValue ?? 0)} month interval.`,
  };
}

export function recordsForMonthCell(records: WorkProgramRecord[], programType: string, field: string, month: string) {
  return records
    .filter(
      (record) =>
        record.approvalStatus === "Approved" &&
        record.programType === programType &&
        fieldKey(record.blockField) === fieldKey(field) &&
        monthKey(record.actualCompletionDate || record.deadline || "") === month,
    )
    .sort(sortRecordsDescending);
}

export function getTrackingFields(fields: FieldFeature[]) {
  return sortFields(fields);
}

export function fieldKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function normaliseKey(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function monthKey(date: string) {
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "";
}

export function formatDate(date: string) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

export function formatNumber(value: unknown, maximumFractionDigits = 4) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(number);
}

export function sumRowMonths(row: DashboardRow) {
  return MONTHS_2026.reduce((total, month) => total + Number(row.months[month.key] || 0), 0);
}

export function sortRecordsDescending(a: WorkProgramRecord, b: WorkProgramRecord) {
  return (
    new Date(b.actualCompletionDate || b.updatedAt || 0).getTime() - new Date(a.actualCompletionDate || a.updatedAt || 0).getTime() ||
    a.programType.localeCompare(b.programType)
  );
}

function copyDashboardRow(row: DashboardRow): DashboardRow {
  return { ...row, months: { ...row.months } };
}

function emptyMonths() {
  return Object.fromEntries(MONTHS_2026.map((month) => [month.key, 0]));
}

function monthEndDate(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, monthNumber, 0));
  return end.toISOString().slice(0, 10);
}

function currentMonthKey() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function intervalFromDate(date: string) {
  if (!date) return "";
  const from = monthKey(date);
  const to = currentMonthKey();
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if (![fromYear, fromMonth, toYear, toMonth].every(Number.isFinite)) return "";
  return Math.max(0, (toYear - fromYear) * 12 + toMonth - fromMonth);
}

function addMonths(date: string, months: number) {
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setMonth(parsed.getMonth() + months);
  return parsed.toISOString().slice(0, 10);
}

function numericValue(value: unknown) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstNonBlank(...values: Array<number | string | null | undefined>) {
  return values.find((value) => value !== "" && value != null) ?? "";
}

function sumMonthsToDate(row: DashboardRow | null, currentMonth: string) {
  if (!row) return 0;
  return MONTHS_2026.filter((month) => month.key <= currentMonth).reduce(
    (total, month) => total + Number(row.months[month.key] || 0),
    0,
  );
}

function fieldCategory(field: FieldFeature) {
  return String(field.properties.field_type || "").includes("IMMATURE") ? "Immature" : "Mature";
}

function sortFields(fields: FieldFeature[]) {
  return [...fields].sort((a, b) =>
    (a.properties.field_no || a.properties.field_gis).localeCompare(b.properties.field_no || b.properties.field_gis, undefined, {
      numeric: true,
    }),
  );
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>();
  items.forEach((item) => groups.set(key(item), [...(groups.get(key(item)) || []), item]));
  return groups;
}

export function dashboardYearLabel() {
  return String(DASHBOARD_YEAR);
}
