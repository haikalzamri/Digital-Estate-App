export const DASHBOARD_YEAR = 2026;

export const MONTHS_2026 = [
  { key: "2026-01", label: "Jan" },
  { key: "2026-02", label: "Feb" },
  { key: "2026-03", label: "Mar" },
  { key: "2026-04", label: "Apr" },
  { key: "2026-05", label: "May" },
  { key: "2026-06", label: "Jun" },
  { key: "2026-07", label: "Jul" },
  { key: "2026-08", label: "Aug" },
  { key: "2026-09", label: "Sep" },
  { key: "2026-10", label: "Oct" },
  { key: "2026-11", label: "Nov" },
  { key: "2026-12", label: "Dec" },
] as const;

export const PROGRAM_TYPES = [
  "Mature Circle",
  "Mature Woodies & Steno",
  "Pruning",
  "Raking",
  "Mature_VOPs",
  "Mature_Epiphytes",
  "Rat Baiting",
  "Grasscut Path",
  "Path Repair",
  "Desilting MD",
  "Desilting CD",
  "Road Grading",
  "Road resurfacing",
] as const;

export type ProgramName = (typeof PROGRAM_TYPES)[number];

export const PROGRAM_COLORS: Record<string, string> = {
  "Mature Circle": "#2563eb",
  "Mature Woodies & Steno": "#8b5cf6",
  Pruning: "#22a65a",
  Raking: "#d8912b",
  Mature_VOPs: "#0f766e",
  Mature_Epiphytes: "#16a34a",
  "Rat Baiting": "#dc2626",
  "Grasscut Path": "#ca8a04",
  "Path Repair": "#7c3aed",
  "Desilting MD": "#0891b2",
  "Desilting CD": "#0284c7",
  "Road Grading": "#6b7280",
  "Road resurfacing": "#111827",
};

export type MapStatus = "green" | "yellow" | "red" | "grey";

export type MapRule = {
  greenText: string;
  yellowText: string;
  redText: string;
  greenBelow: number | null;
  yellowTo: number | null;
};

export const MAP_STATUS_RULES: Record<string, MapRule> = {
  "Mature Circle": {
    greenText: "<3 months",
    yellowText: "3-4 months",
    redText: ">4 months",
    greenBelow: 3,
    yellowTo: 4,
  },
  "Mature Woodies & Steno": {
    greenText: "<6 months",
    yellowText: "6-10 months",
    redText: ">10 months",
    greenBelow: 6,
    yellowTo: 10,
  },
  Pruning: {
    greenText: "<5 months",
    yellowText: "5-7 months",
    redText: ">7 months",
    greenBelow: 5,
    yellowTo: 7,
  },
  Raking: {
    greenText: "<7 months",
    yellowText: "7-8 months",
    redText: ">8 months",
    greenBelow: 7,
    yellowTo: 8,
  },
};

export const DEFAULT_RECORD_GPS = { latitude: "2.86667", longitude: "101.36667" };
export const EXCEL_RECORD_SOURCE = "Excel Main actual";
