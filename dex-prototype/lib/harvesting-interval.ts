import musterScenario from "@/data/scenarios/muster-chit.json";
import type { Session } from "@/lib/workshop";
// Adapted within DEX from the preserved Digital Estate interval calculation.
export type HarvestingIntervalField = {
  id: string;
  field: string;
  block: string;
  hectares: number | null;
  blockHectares: number | null;
  baseInterval: number;
  bfDisplay?: string;
  hasReferenceBaseline: boolean;
};

export type HarvestingIntervalMetricKey = "hectare" | "bunches" | "tonnage";

export type HarvestingIntervalActivityMetrics = {
  hectare: number;
  bunches: number | null;
  tonnage: number | null;
  activityCode?: string;
  monthHectare?: number;
};

export type HarvestingIntervalDispatchMetrics = {
  hectare: number;
  bunches: number;
  kg: number;
  tonnage?: number;
  unit?: string;
  plantedHectare?: number;
  harvestingDay?: number;
  harvestingRound?: number;
};

export type HarvestingIntervalBalanceMetrics = {
  hectare: number;
  bunches: number | null;
  tonnage: number | null;
};

export type HarvestingIntervalSource = {
  metadata: {
    module: string;
    activitySourceFile: string;
    referenceTemplateFile: string;
    sourceDescription: string;
    baseDate: string;
    startDate: string;
    lastActivityDate: string;
    defaultMonth: string;
    availableMonths: string[];
    activityRows?: number;
    dispatchRows?: number;
    dispatchSourceFile?: string;
    lastDispatchDate?: string;
    overlaySourceFile?: string;
    overlaySourceSheet?: string;
    overlayRows?: number;
    overlayActivities?: string[];
  };
  fields: HarvestingIntervalField[];
  activityByField: Record<string, Record<string, HarvestingIntervalActivityMetrics>>;
  dailyTotals: Record<string, HarvestingIntervalActivityMetrics>;
  dispatchByField: Record<string, Record<string, HarvestingIntervalDispatchMetrics>>;
  dispatchDailyTotals: Record<string, HarvestingIntervalDispatchMetrics>;
  overlayByField: Record<string, Record<string, string[]>>;
  overlayValuesByField?: Record<string, Record<string, Record<string, number>>>;
};

export type HarvestingIntervalCell = {
  date: string;
  day: number;
  dayName: string;
  harvest: boolean;
  interval: number;
  isSunday: boolean;
  activity: HarvestingIntervalActivityMetrics | null;
  dispatch: HarvestingIntervalDispatchMetrics | null;
  balance: HarvestingIntervalBalanceMetrics;
  overlays: string[];
  overlayValues: Record<string, number>;
};

export type HarvestingIntervalFieldReport = HarvestingIntervalField & {
  cells: HarvestingIntervalCell[];
  harvestCount: number;
  monthlyHectareTotal: number;
  monthlyDispatchHectareTotal: number;
  endInterval: number;
  maxInterval: number;
};

export type HarvestingIntervalMonthReport = {
  month: string;
  monthLabel: string;
  days: HarvestingIntervalCell[];
  fields: HarvestingIntervalFieldReport[];
  dailyTotals: Record<string, HarvestingIntervalActivityMetrics>;
  dispatchDailyTotals: Record<string, HarvestingIntervalDispatchMetrics>;
  dailyBalances: Record<string, HarvestingIntervalBalanceMetrics>;
  dailyProductionDataDates: Record<string, boolean>;
  dailyDispatchDataDates: Record<string, boolean>;
  hasMonthlyProductionData: boolean;
  hasMonthlyDispatchData: boolean;
  monthlyTotals: HarvestingIntervalActivityMetrics;
  monthlyDispatchTotals: HarvestingIntervalDispatchMetrics;
  monthlyBalances: HarvestingIntervalBalanceMetrics;
  activeFields: number;
  totalHarvests: number;
  sourceActiveFields: number;
  sourceActivityCount: number;
  highestInterval: number;
};


import scenario from "@/data/scenarios/harvesting-interval.json";
export const harvestSource = scenario as HarvestingIntervalSource;
export const HARVEST_ACTIVITY = "PH4018";
export const harvestFieldNames = [...new Set(harvestSource.fields.map((f) => f.field))];
export function harvestingFieldArea(field: string) {
  return Math.round(harvestSource.fields.filter((f) => f.field === field).reduce((sum, f) => sum + (f.hectares || 0), 0) * 100) / 100;
}
export function harvestingFieldInterval(field: string, date = harvestSource.metadata.lastActivityDate) {
  const report = getHarvestingIntervalReport(harvestSource, date.slice(0, 7));
  return Math.max(0, ...report.fields.filter((f) => f.field === field).map((f) => f.cells.find((c) => c.date === date)?.interval || 0));
}
export function harvestStatus(interval: number) {
  return interval <= 12 ? "On track" : interval <= 15 ? "Watch" : interval <= 20 ? "Caution" : "Overdue";
}
export function harvestTone(interval: number) {
  return interval <= 12 ? "green" : interval <= 15 ? "yellow" : interval <= 20 ? "orange" : "red";
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_LABEL_FORMAT = new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric", timeZone: "UTC" });
const DAY_NAME_FORMAT = new Intl.DateTimeFormat("en-MY", { weekday: "short", timeZone: "UTC" });

export function getDefaultHarvestingMonth(source: HarvestingIntervalSource) {
  return source.metadata.defaultMonth || source.metadata.availableMonths[0] || source.metadata.startDate.slice(0, 7);
}

export function formatHarvestingMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_LABEL_FORMAT.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function getHarvestingIntervalReport(source: HarvestingIntervalSource, selectedMonth: string): HarvestingIntervalMonthReport {
  const baseDate = parseIsoDate(source.metadata.baseDate);
  const [year, monthNumber] = selectedMonth.split("-").map(Number);
  const monthStart = new Date(Date.UTC(year, monthNumber - 1, 1));
  const monthEnd = new Date(Date.UTC(year, monthNumber, 0));
  const calculationStart = addDays(baseDate, 1);

  const templateFields = source.fields.filter((field) => field.hasReferenceBaseline);
  const fields = templateFields.map((field) =>
    buildFieldReport(
      field,
      source.activityByField[field.field] || {},
      source.dispatchByField?.[field.field] || {},
      source.overlayByField?.[field.field] || {},
      source.overlayValuesByField?.[field.field] || {},
      baseDate,
      calculationStart,
      monthStart,
      monthEnd,
    ),
  );
  const days = fields[0]?.cells.map((cell) => ({ ...cell })) || buildMonthDays(monthStart, monthEnd);
  const visibleFieldNames = new Set(fields.map((field) => field.field));
  const sourceMonthActivity = [...visibleFieldNames].map((field) =>
    Object.keys(source.activityByField[field] || {}).filter((date) => date.startsWith(selectedMonth)).length,
  );
  const dailyProductionDataDates = Object.fromEntries(
    days.map((day) => [day.date, Boolean(source.dailyTotals?.[day.date])]),
  );
  const dailyDispatchDataDates = Object.fromEntries(
    days.map((day) => [day.date, Boolean(source.dispatchDailyTotals?.[day.date])]),
  );
  const dailyTotals = Object.fromEntries(
    days.map((day) => [day.date, source.dailyTotals?.[day.date] || emptyMetrics()]),
  );
  const dispatchDailyTotals = Object.fromEntries(
    days.map((day) => [day.date, normalizeDispatchMetrics(source.dispatchDailyTotals?.[day.date])]),
  );
  const dailyBalances = Object.fromEntries(
    days.map((day) => [day.date, calculateBalance(dailyTotals[day.date], dispatchDailyTotals[day.date])]),
  );
  const monthlyTotals = sumMetrics(Object.values(dailyTotals));
  const monthlyDispatchTotals = sumDispatchMetrics(Object.values(dispatchDailyTotals));
  const monthlyBalances = calculateBalance(monthlyTotals, monthlyDispatchTotals);

  return {
    month: selectedMonth,
    monthLabel: formatHarvestingMonth(selectedMonth),
    days,
    fields,
    dailyTotals,
    dispatchDailyTotals,
    dailyBalances,
    dailyProductionDataDates,
    dailyDispatchDataDates,
    hasMonthlyProductionData: Object.values(dailyProductionDataDates).some(Boolean),
    hasMonthlyDispatchData: Object.values(dailyDispatchDataDates).some(Boolean),
    monthlyTotals,
    monthlyDispatchTotals,
    monthlyBalances,
    activeFields: fields.filter((field) => field.harvestCount > 0).length,
    totalHarvests: fields.reduce((total, field) => total + field.harvestCount, 0),
    sourceActiveFields: sourceMonthActivity.filter((count) => count > 0).length,
    sourceActivityCount: sourceMonthActivity.reduce((total, count) => total + count, 0),
    highestInterval: Math.max(...fields.flatMap((field) => field.cells.map((cell) => cell.interval)), 0),
  };
}

export function getHarvestingBlockGroups(fields: HarvestingIntervalField[]) {
  return fields.reduce<Array<{ block: string; span: number }>>((groups, field) => {
    const last = groups.at(-1);
    if (last?.block === field.block) {
      last.span += 1;
    } else {
      groups.push({ block: field.block, span: 1 });
    }
    return groups;
  }, []);
}

export function getHarvestingDayGroups(fields: HarvestingIntervalField[]) {
  return fields.reduce<Array<{ block: string; label: string; totalHectares: number | null; span: number }>>((groups, field) => {
    const last = groups.at(-1);
    if (last?.block === field.block) {
      last.span += 1;
    } else {
      groups.push({
        block: field.block,
        label: field.block.replace(/^D(\d+)$/, "DAY $1"),
        totalHectares: field.blockHectares,
        span: 1,
      });
    }
    return groups;
  }, []);
}

function buildFieldReport(
  field: HarvestingIntervalField,
  activityByDate: Record<string, HarvestingIntervalActivityMetrics>,
  dispatchByDate: Record<string, HarvestingIntervalDispatchMetrics>,
  overlayByDate: Record<string, string[]>,
  overlayValuesByDate: Record<string, Record<string, number>>,
  baseDate: Date,
  calculationStart: Date,
  monthStart: Date,
  monthEnd: Date,
) {
  let currentInterval = field.baseInterval;
  let lastHarvestIndex: number | null = currentInterval >= 1 && currentInterval <= 5 ? 0 : null;
  let bfDisplay = field.bfDisplay || String(field.baseInterval);
  const cells: HarvestingIntervalCell[] = [];

  for (let day = new Date(calculationStart); day <= monthEnd; day = addDays(day, 1)) {
    const isoDate = toIsoDate(day);
    const dayIndex = diffDays(day, baseDate);
    const activity = activityByDate[isoDate] || null;
    const dispatch = dispatchByDate[isoDate] ? normalizeDispatchMetrics(dispatchByDate[isoDate]) : null;
    const overlays = overlayByDate[isoDate] || [];
    const overlayValues = overlayValuesByDate[isoDate] || {};
    const harvest = Boolean(activity);

    if (harvest) {
      currentInterval = lastHarvestIndex === null || dayIndex - lastHarvestIndex > 5 ? 1 : currentInterval + 1;
      lastHarvestIndex = dayIndex;
    } else {
      currentInterval += 1;
    }

    if (day < monthStart) {
      bfDisplay = String(currentInterval);
    } else {
      cells.push({
        date: isoDate,
        day: day.getUTCDate(),
        dayName: DAY_NAME_FORMAT.format(day),
        harvest,
        interval: currentInterval,
        isSunday: day.getUTCDay() === 0,
        activity,
        dispatch,
        balance: calculateBalance(activity || emptyMetrics(), dispatch || emptyDispatchMetrics()),
        overlays,
        overlayValues,
      });
    }
  }

  return {
    ...field,
    bfDisplay,
    cells,
    harvestCount: cells.filter((cell) => cell.harvest).length,
    monthlyHectareTotal: roundMetric(cells.reduce((total, cell) => total + (cell.activity?.hectare || 0), 0), 2),
    monthlyDispatchHectareTotal: roundMetric(cells.reduce((total, cell) => total + (cell.dispatch?.hectare || 0), 0), 2),
    endInterval: cells.at(-1)?.interval || currentInterval,
    maxInterval: Math.max(...cells.map((cell) => cell.interval), 0),
  };
}

function buildMonthDays(monthStart: Date, monthEnd: Date): HarvestingIntervalCell[] {
  const days: HarvestingIntervalCell[] = [];
  for (let day = new Date(monthStart); day <= monthEnd; day = addDays(day, 1)) {
    days.push({
      date: toIsoDate(day),
      day: day.getUTCDate(),
      dayName: DAY_NAME_FORMAT.format(day),
      harvest: false,
      interval: 0,
      isSunday: day.getUTCDay() === 0,
      activity: null,
      dispatch: null,
      balance: { hectare: 0, bunches: 0, tonnage: 0 },
      overlays: [],
      overlayValues: {},
    });
  }
  return days;
}

function emptyMetrics(): HarvestingIntervalActivityMetrics {
  return { hectare: 0, bunches: 0, tonnage: 0 };
}

function emptyDispatchMetrics(): HarvestingIntervalDispatchMetrics {
  return { hectare: 0, bunches: 0, kg: 0, tonnage: 0 };
}

function calculateBalance(
  production: HarvestingIntervalActivityMetrics,
  dispatch: HarvestingIntervalDispatchMetrics,
): HarvestingIntervalBalanceMetrics {
  return {
    hectare: roundMetric(production.hectare - dispatch.hectare, 2),
    bunches: production.bunches == null ? null : roundMetric(production.bunches - dispatch.bunches, 0),
    tonnage: production.tonnage == null ? null : roundMetric(production.tonnage - (dispatch.tonnage || 0), 3),
  };
}

function sumMetrics(metrics: HarvestingIntervalActivityMetrics[]): HarvestingIntervalActivityMetrics {
  return {
    hectare: roundMetric(metrics.reduce((total, value) => total + value.hectare, 0), 2),
    bunches: metrics.some((value) => value.bunches == null) ? null : roundMetric(metrics.reduce((total, value) => total + (value.bunches || 0), 0), 0),
    tonnage: metrics.some((value) => value.tonnage == null) ? null : roundMetric(metrics.reduce((total, value) => total + (value.tonnage || 0), 0), 3),
  };
}

function sumDispatchMetrics(metrics: HarvestingIntervalDispatchMetrics[]): HarvestingIntervalDispatchMetrics {
  return {
    hectare: roundMetric(metrics.reduce((total, value) => total + value.hectare, 0), 2),
    bunches: roundMetric(metrics.reduce((total, value) => total + value.bunches, 0), 0),
    kg: roundMetric(metrics.reduce((total, value) => total + value.kg, 0), 0),
    tonnage: roundMetric(metrics.reduce((total, value) => total + (value.tonnage || 0), 0), 3),
  };
}

function normalizeDispatchMetrics(
  metrics: HarvestingIntervalDispatchMetrics | undefined,
): HarvestingIntervalDispatchMetrics {
  if (!metrics) return emptyDispatchMetrics();

  return {
    ...metrics,
    tonnage: calculateDispatchTonnage(metrics.kg),
  };
}

function calculateDispatchTonnage(kg: number) {
  if (!kg) return 0;
  return roundMetric(kg / 1000, 3);
}

function roundMetric(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function diffDays(a: Date, b: Date) {
  return Math.round((Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()) - Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate())) / DAY_MS);
}

function toIsoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function withHarvestCredits(credits: { fieldNo: string; date: string; ha: number }[]): HarvestingIntervalSource {
  const source = structuredClone(harvestSource);
  const dates = new Set<string>();
  for (const credit of credits) {
    if (!harvestFieldNames.includes(credit.fieldNo) || !(credit.ha > 0)) continue;
    const records = source.activityByField[credit.fieldNo] ||= {};
    const prior = records[credit.date];
    records[credit.date] = { hectare: roundMetric((prior?.hectare || 0) + credit.ha, 2), bunches: null, tonnage: null, activityCode: HARVEST_ACTIVITY };
    dates.add(credit.date);
  }
  for (const date of dates) source.dailyTotals[date] = sumMetrics(harvestFieldNames.flatMap((field) => source.activityByField[field]?.[date] ? [source.activityByField[field][date]] : []));
  source.metadata.lastActivityDate = [source.metadata.lastActivityDate, ...dates].sort().at(-1)!;
  return source;
}

/** Days since a recorded FFB visit or a separately labelled LF reference, before the planned day. */
export function plannedHarvestInterval(field: string, date: string, type: "FFB" | "LF", session?: Session): { days: number | null; illustrative: boolean } {
  const dates = type === "LF" ? [musterScenario.looseFruitLastDates[field as keyof typeof musterScenario.looseFruitLastDates]].filter((v): v is string => !!v && v < date) : Object.entries(harvestSource.activityByField[field] || {}).filter(([d,v]) => d < date && v.hectare > 0).map(([d]) => d);
  for (const work of session?.completions || []) {
    if (work.kind !== "harvesting" || (work.harvestType || "FFB") !== type || work.fieldNo !== field || work.date >= date) continue;
    const validated = work.reports.findLast((r) => r.status === "Validated");
    if ((validated?.ha || 0) > 0) dates.push(work.date);
  }
  const last = dates.sort().at(-1);
  const demoLast = musterScenario.looseFruitLastDates[field as keyof typeof musterScenario.looseFruitLastDates];
  return { days: last ? Math.round((Date.parse(date + "T12:00:00Z") - Date.parse(last + "T12:00:00Z")) / 86400000) : null, illustrative: type === "LF" && last != null && last === demoLast };
}
