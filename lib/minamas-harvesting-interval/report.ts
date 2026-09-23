import type { DayMetrics, DivisionFilter, FieldInterval, IntervalStatus, MinamasField, MinamasSource } from "./types";

// Independent of Digital Estate: Minamas rules can evolve without changing that module.
export const CONTINUATION_GAP_DAYS = 5;
const DAY = 86_400_000;
export const DIVISIONS = ["DIV01", "DIV02", "DIV03"] as const;
export const STATUS = {
  onTrack: { label: "On track", range: "0–12 days", color: "#22c55e" },
  watch: { label: "Watch", range: "13–15 days", color: "#facc15" },
  caution: { label: "Caution", range: "16–20 days", color: "#fb923c" },
  overdue: { label: "Overdue", range: "21+ days", color: "#ef4444" },
  uncertain: { label: "Provisional", range: "Round unclear", color: "#9da5a0" },
  noData: { label: "No history", range: "No recorded harvest", color: "#dce3df" },
} satisfies Record<IntervalStatus, { label: string; range: string; color: string }>;

// I follows the manual. II and III are fixed prototype orders inferred from production.
export const FIELD_ORDER: Record<string, readonly string[]> = {
  DIV01: ["17G007", "17G008", "17G009", "17G010", "17H011", "23I012", "09I013", "98J011", "98J010"],
  DIV02: ["15G015", "14E008", "14E009", "14F010", "14F008", "13E011", "14E010", "14F009", "13E012", "11E014", "20E014", "13E013", "13F013", "15F014", "15G014", "15F016", "18H016", "15F015"],
  DIV03: ["04H020", "03H018", "06G017", "18G016", "23H017", "16I020", "16I021", "17J022", "17J023", "97I017"],
};
export function divisionLabel(value: DivisionFilter) {
  return value === "all" ? "All divisions" : `Division ${Number(value.slice(-2))}`;
}
export function dateNumber(value: string) { return Date.parse(`${value}T00:00:00Z`); }
export function isValidDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(dateNumber(value)) && new Date(dateNumber(value)).toISOString().slice(0, 10) === value;
}
export function formatDate(value: string | null, short = false) {
  if (!value || !isValidDate(value)) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", ...(short ? {} : { year: "numeric" as const }), timeZone: "UTC" }).format(new Date(dateNumber(value)));
}
export function monthLabel(month: string) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-01T00:00:00Z`));
}
export function monthDays(month: string) {
  const [year, number] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, number, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}
export function getFields(source: MinamasSource, division: DivisionFilter, activeOnly = true): MinamasField[] {
  const codes = (division === "all" ? DIVISIONS : [division]).flatMap((id) => [...FIELD_ORDER[id]]);
  const eligible = source.fields.filter((field) => division === "all" || field.division === division);
  const ordered = codes.map((code) => eligible.find((field) => field.code === code)).filter((field): field is MinamasField => Boolean(field));
  return activeOnly ? ordered : [...ordered, ...eligible.filter((field) => !codes.includes(field.code)).sort((a, b) => a.label.localeCompare(b.label) || a.yop - b.yop)];
}
export function intervalStatus(interval: number): IntervalStatus {
  if (interval <= 12) return "onTrack";
  if (interval <= 15) return "watch";
  if (interval <= 20) return "caution";
  return "overdue";
}
export function getInterval(source: MinamasSource, code: string, asAt: string): FieldInterval {
  const empty: FieldInterval = { interval: null, lastHarvest: null, cycleStart: null, status: "noData", explanation: "No recorded harvest on or before this date." };
  if (!isValidDate(asAt) || asAt < source.metadata.productionStart || asAt > source.metadata.productionEnd) {
    return { ...empty, explanation: "This date is outside the supplied production period." };
  }
  const dates = Object.entries(source.production[code] || {}).filter(([date, bunches]) => bunches > 0 && date <= asAt && date >= source.metadata.productionStart).map(([date]) => date).sort();
  if (!dates.length) return empty;
  let start = dates[0];
  let previous = dates[0];
  // Six observed days without harvesting establish a cycle even without June history.
  let confirmed = (dateNumber(start) - dateNumber(source.metadata.productionStart)) / DAY > CONTINUATION_GAP_DAYS;
  for (const date of dates.slice(1)) {
    if ((dateNumber(date) - dateNumber(previous)) / DAY > CONTINUATION_GAP_DAYS) {
      start = date;
      confirmed = true;
    }
    previous = date;
  }
  const interval = Math.round((dateNumber(asAt) - dateNumber(start)) / DAY) + 1;
  const unclear = code === "23H017";
  return {
    interval, lastHarvest: previous, cycleStart: start,
    status: unclear || !confirmed ? "uncertain" : intervalStatus(interval),
    explanation: unclear ? "Round boundary unclear. Frequent harvesting is recorded; the calculated interval is provisional." : !confirmed ? "Opening history is incomplete. The initial interval is provisional until a new cycle is observed." : "A harvest after a gap greater than five days starts a new cycle at day 1.",
  };
}
export function getDayMetrics(source: MinamasSource, code: string, date: string): DayMetrics {
  const valid = isValidDate(date);
  const production = valid && date >= source.metadata.productionStart && date <= source.metadata.productionEnd ? source.production[code]?.[date] || 0 : null;
  const dispatch = valid && date >= source.metadata.dispatchStart && date <= source.metadata.dispatchEnd ? source.dispatch[code]?.[date] || 0 : null;
  return { production, dispatch, difference: production === null || dispatch === null ? null : production - dispatch };
}
export function getTotals(source: MinamasSource, codes: string[], from: string, through: string): DayMetrics & { comparedProduction: number; comparedDispatch: number; comparisonThrough: string | null } {
  const sum = (records: Record<string, Record<string, number>>, end: string) => codes.reduce((total, code) => total + Object.entries(records[code] || {}).reduce((subtotal, [date, value]) => subtotal + (date >= from && date <= end ? value : 0), 0), 0);
  const production = through < source.metadata.productionStart || from > source.metadata.productionEnd ? null : sum(source.production, through);
  const dispatch = through < source.metadata.dispatchStart || from > source.metadata.dispatchEnd ? null : sum(source.dispatch, through);
  const overlapEnd = [through, source.metadata.productionEnd, source.metadata.dispatchEnd].sort()[0];
  const comparisonThrough = overlapEnd >= from ? overlapEnd : null;
  const comparedProduction = comparisonThrough ? sum(source.production, comparisonThrough) : 0;
  const comparedDispatch = comparisonThrough ? sum(source.dispatch, comparisonThrough) : 0;
  return { production, dispatch, comparedProduction, comparedDispatch, comparisonThrough, difference: comparisonThrough ? comparedProduction - comparedDispatch : null };
}
export function formatBunches(value: number | null) { return value === null ? "—" : new Intl.NumberFormat("en-GB").format(value); }

export function getWeightTotals(source: MinamasSource, codes: string[], from: string, through: string) {
  const empty = { estate: null, mill: null, variance: null, variancePercent: null, through: null };
  if (!isValidDate(from) || !isValidDate(through) || from > through || through < source.metadata.dispatchStart || from > source.metadata.dispatchEnd) return empty;
  const end = [through, source.metadata.dispatchEnd].sort()[0];
  let estate = 0, mill = 0;
  for (const code of new Set(codes)) for (const [date, weight] of Object.entries(source.weights[code] || {})) {
    if (date >= from && date <= end) { estate += weight.estate; mill += weight.mill; }
  }
  const variance = mill - estate;
  return { estate, mill, variance, variancePercent: estate > 0 ? variance / estate * 100 : null, through: end };
}

export function formatSigned(value: number | null, percent = false) {
  if (value === null) return "—";
  return new Intl.NumberFormat("en-GB", { signDisplay: "exceptZero", maximumFractionDigits: percent ? 2 : 0 }).format(value) + (percent ? "%" : "");
}
