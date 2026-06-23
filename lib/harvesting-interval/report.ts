import type {
  HarvestingIntervalCell,
  HarvestingIntervalField,
  HarvestingIntervalMonthReport,
  HarvestingIntervalSource,
} from "@/lib/types/harvesting-interval";

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
  const activitySets = new Map(
    Object.entries(source.activityByField).map(([field, dates]) => [field, new Set(dates)]),
  );

  const templateFields = source.fields.filter((field) => field.hasReferenceBaseline);
  const fields = templateFields.map((field) =>
    buildFieldReport(field, activitySets.get(field.field) || new Set<string>(), baseDate, calculationStart, monthStart, monthEnd),
  );
  const days = fields[0]?.cells.map((cell) => ({ ...cell })) || buildMonthDays(monthStart, monthEnd);
  const visibleFieldNames = new Set(fields.map((field) => field.field));
  const sourceMonthActivity = [...visibleFieldNames].map((field) =>
    (source.activityByField[field] || []).filter((date) => date.startsWith(selectedMonth)).length,
  );

  return {
    month: selectedMonth,
    monthLabel: formatHarvestingMonth(selectedMonth),
    days,
    fields,
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
  activityDates: Set<string>,
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
    const harvest = activityDates.has(isoDate);

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
      });
    }
  }

  return {
    ...field,
    bfDisplay,
    cells,
    harvestCount: cells.filter((cell) => cell.harvest).length,
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
    });
  }
  return days;
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
