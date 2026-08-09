import type {
  CostbookDayReport,
  CostbookReport,
  CostbookSource,
} from "@/lib/types/costbook";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-MY", {
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-MY", {
  day: "2-digit",
  month: "short",
  year: "2-digit",
  timeZone: "UTC",
});

const CURRENCY_FORMAT = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUMBER_FORMAT = new Intl.NumberFormat("en-MY", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function getDefaultCostbookActivity(source: CostbookSource) {
  return source.activities.some((activity) => activity.code === source.metadata.defaultActivityCode)
    ? source.metadata.defaultActivityCode
    : source.activities[0]?.code || "";
}

export function getDefaultCostbookMonth(source: CostbookSource) {
  return source.metadata.availableMonths.includes(source.metadata.defaultMonth)
    ? source.metadata.defaultMonth
    : source.metadata.availableMonths[0] || "";
}

export function getCostbookEvitNumbers(source: CostbookSource, activityCode: string) {
  return source.activities.find((activity) => activity.code === activityCode)?.evitNumbers || [];
}

export function getCostbookFieldCodes(source: CostbookSource, activityCode: string) {
  return source.activities.find((activity) => activity.code === activityCode)?.fieldCodes || [];
}

export function getCostbookReport(
  source: CostbookSource,
  activityCode: string,
  month: string,
  selectedFieldCodes: string[],
  selectedEvitNumbers: string[],
): CostbookReport {
  const activity = source.activities.find((item) => item.code === activityCode) || null;
  const availableFieldCodes = activity?.fieldCodes || [];
  const validSelectedFieldCodes = selectedFieldCodes.filter((fieldCode) => availableFieldCodes.includes(fieldCode));
  const effectiveFieldCodes = validSelectedFieldCodes.length ? validSelectedFieldCodes : availableFieldCodes;
  const selectedFieldSet = new Set(effectiveFieldCodes);
  const availableEvitNumbers = activity?.evitNumbers || [];
  const validSelectedEvitNumbers = selectedEvitNumbers.filter((evitNumber) => availableEvitNumbers.includes(evitNumber));
  const effectiveEvitNumbers = validSelectedEvitNumbers.length ? validSelectedEvitNumbers : availableEvitNumbers;
  const selectedEvitSet = new Set(effectiveEvitNumbers);
  const sourceRecords = source.records
    .filter((record) => (
      record.activityCode === activityCode
      && record.date.startsWith(`${month}-`)
      && selectedFieldSet.has(record.fieldCode)
    ))
    .sort((a, b) => (
      a.date.localeCompare(b.date)
      || a.fieldCode.localeCompare(b.fieldCode, undefined, { numeric: true })
      || a.id.localeCompare(b.id)
    ));

  let labourMonthToDate = 0;
  let materialMonthToDate = 0;
  let evitMonthToDate = 0;
  let totalCostToDate = 0;
  let hectaresToDate = 0;

  const days: CostbookDayReport[] = sourceRecords.map((record) => {
    const labourPeople = [
      ...record.labour.workers.map((worker) => ({
        ...worker,
        rateType: "Normal Rate" as const,
      })),
      ...record.labour.supervision.map((supervision) => ({
        workerId: supervision.supervisorId,
        workerName: supervision.supervisorName,
        mandays: supervision.hours,
        rateType: "Supervision Rate" as const,
        rate: supervision.rate,
        overtimeHours: 0,
        overtimeRate: 0,
      })),
    ];
    const workerLines = labourPeople.map((worker) => {
      const labourAmount = roundMoney(worker.mandays * worker.rate);
      const overtimeAmount = roundMoney(worker.overtimeHours * worker.overtimeRate);
      return {
        ...worker,
        labourAmount,
        overtimeAmount,
        totalAmount: roundMoney(labourAmount + overtimeAmount),
      };
    });
    const mandays = roundMetric(workerLines.reduce((total, worker) => total + worker.mandays, 0));
    const labourAmount = roundMoney(workerLines.reduce((total, worker) => total + worker.labourAmount, 0));
    const overtimeHours = roundMetric(workerLines.reduce((total, worker) => total + worker.overtimeHours, 0));
    const overtimeAmount = roundMoney(workerLines.reduce((total, worker) => total + worker.overtimeAmount, 0));
    const labourCostToday = roundMoney(labourAmount + overtimeAmount);
    const materialLines = record.materials.map((material) => {
      const materialCost = roundMoney(material.quantity * material.unitPrice);
      return {
        ...material,
        materialCost,
        costPerHectare: divideCost(materialCost, record.hectaresCovered),
      };
    });
    const materialCostToday = roundMoney(materialLines.reduce((total, material) => total + material.materialCost, 0));
    const evitLines = record.evitUsage
      .filter((usage) => selectedEvitSet.has(usage.evitNumber))
      .map((usage) => {
        const operatingCost = roundMoney(usage.hours * usage.ratePerHour);
        const evitCost = roundMoney(usage.transportCost);
        const totalCost = roundMoney(operatingCost + evitCost);
        return {
          ...usage,
          operatingCost,
          evitCost,
          totalCost,
          costPerHectare: divideCost(totalCost, record.hectaresCovered),
        };
      });
    const evitCostToday = roundMoney(evitLines.reduce((total, usage) => total + usage.totalCost, 0));
    const totalCostToday = roundMoney(labourCostToday + materialCostToday + evitCostToday);

    labourMonthToDate = roundMoney(labourMonthToDate + labourCostToday);
    materialMonthToDate = roundMoney(materialMonthToDate + materialCostToday);
    evitMonthToDate = roundMoney(evitMonthToDate + evitCostToday);
    totalCostToDate = roundMoney(totalCostToDate + totalCostToday);
    hectaresToDate = roundMetric(hectaresToDate + record.hectaresCovered);

    return {
      ...record,
      workerLines,
      mandays,
      labourAmount,
      overtimeHours,
      overtimeAmount,
      labourCostToday,
      labourMonthToDate,
      labourCostPerHectare: divideCost(labourCostToday, record.hectaresCovered),
      materialLines,
      materialCostToday,
      materialMonthToDate,
      materialCostPerHectare: divideCost(materialCostToday, record.hectaresCovered),
      evitLines,
      evitCostToday,
      evitMonthToDate,
      evitCostPerHectare: divideCost(evitCostToday, record.hectaresCovered),
      totalCostToday,
      totalCostToDate,
      hectaresToDate,
      costPerHectareToday: divideCost(totalCostToday, record.hectaresCovered),
      costPerHectareToDate: divideCost(totalCostToDate, hectaresToDate),
    };
  });

  return {
    activity,
    month,
    monthLabel: formatCostbookMonth(month),
    selectedFieldCodes: effectiveFieldCodes,
    selectedEvitNumbers: effectiveEvitNumbers,
    days,
    totals: {
      labour: labourMonthToDate,
      labourCostPerHectare: divideCost(labourMonthToDate, hectaresToDate),
      material: materialMonthToDate,
      materialCostPerHectare: divideCost(materialMonthToDate, hectaresToDate),
      evit: evitMonthToDate,
      evitCostPerHectare: divideCost(evitMonthToDate, hectaresToDate),
      cost: totalCostToDate,
      hectares: hectaresToDate,
      costPerHectare: divideCost(totalCostToDate, hectaresToDate),
    },
  };
}

export function formatCostbookMonth(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month || "-";
  const [year, monthNumber] = month.split("-").map(Number);
  return MONTH_FORMAT.format(new Date(Date.UTC(year, monthNumber - 1, 1))).replace(" ", "-");
}

export function formatCostbookDate(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return date || "-";
  return DATE_FORMAT.format(new Date(`${date}T00:00:00Z`)).replaceAll(" ", "-");
}

export function formatCostbookCurrency(value: number) {
  return CURRENCY_FORMAT.format(value);
}

export function formatCostbookNumber(value: number) {
  return NUMBER_FORMAT.format(value);
}

function divideCost(cost: number, hectares: number) {
  return hectares > 0 ? roundMoney(cost / hectares) : 0;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundMetric(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
