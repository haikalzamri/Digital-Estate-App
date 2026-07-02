"use client";

import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Download, Grid2X2, Sprout } from "lucide-react";
import { Fragment, useMemo, useState, type CSSProperties } from "react";
import { ModuleShell } from "@/components/module-shell";
import sourceJson from "@/lib/data/harvesting-interval-source.json";
import {
  formatHarvestingMonth,
  getDefaultHarvestingMonth,
  getHarvestingDayGroups,
  getHarvestingIntervalReport,
} from "@/lib/harvesting-interval/report";
import type {
  HarvestingIntervalActivityMetrics,
  HarvestingIntervalBalanceMetrics,
  HarvestingIntervalCell,
  HarvestingIntervalDispatchMetrics,
  HarvestingIntervalMetricKey,
  HarvestingIntervalMonthReport,
  HarvestingIntervalSource,
} from "@/lib/types/harvesting-interval";

const source = sourceJson as HarvestingIntervalSource;

const METRIC_OPTIONS: Array<{ key: HarvestingIntervalMetricKey; label: string; longLabel: string }> = [
  { key: "hectare", label: "Ha", longLabel: "Actual Covered Ha" },
  { key: "bunches", label: "Bunches", longLabel: "Harvesting Bunches" },
  { key: "tonnage", label: "Tonnage", longLabel: "Tonnage" },
];

const OVERLAY_COLORS: Record<string, string> = {
  HM: "#2563eb",
  QF: "#0891b2",
  QG: "#dc2626",
  R1: "#9333ea",
  PM1501: "#16a34a",
};

const RAINFALL_DATA_LABEL = "Rainfall Data";
const RAINFALL_PLACEHOLDER = "-";
const RAINFALL_COLUMN_WIDTH = 96;

type TotalColumnKind = "production" | "dispatch" | "balance";

type TotalColumn = {
  id: string;
  label: string;
  kind: TotalColumnKind;
  group: HarvestingIntervalMetricKey;
  metric: HarvestingIntervalMetricKey | "kg";
  getDailyValue: (date: string) => string;
  getMonthlyValue: () => string;
};

type SelectedActivity = {
  field: string;
  date: string;
  day: number;
  dayName: string;
  interval: number;
  production: HarvestingIntervalActivityMetrics;
  dispatch: HarvestingIntervalDispatchMetrics;
  balance: HarvestingIntervalBalanceMetrics;
};

export function HarvestingIntervalDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultHarvestingMonth(source));
  const [selectedMetric, setSelectedMetric] = useState<HarvestingIntervalMetricKey>("hectare");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedTotalGroups, setExpandedTotalGroups] = useState<Set<HarvestingIntervalMetricKey>>(new Set());
  const [selectedOverlays, setSelectedOverlays] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const report = useMemo(() => getHarvestingIntervalReport(source, selectedMonth), [selectedMonth]);
  const dayGroups = useMemo(() => getHarvestingDayGroups(report.fields), [report.fields]);
  const totalColumns = useMemo(() => getTotalColumns(report, expandedTotalGroups), [report, expandedTotalGroups]);
  const overlayCodes = useMemo(() => getOverlayCodes(source), []);
  const metricLabel = METRIC_OPTIONS.find((option) => option.key === selectedMetric)?.longLabel || "Actual Covered Ha";

  const toggleDate = (date: string) => {
    setExpandedDates((current) => {
      const next = new Set(current);
      if (next.has(date)) {
        next.delete(date);
      } else {
        next.add(date);
      }
      return next;
    });
  };

  const toggleTotalGroup = (metric: HarvestingIntervalMetricKey) => {
    setExpandedTotalGroups((current) => {
      const next = new Set(current);
      if (next.has(metric)) {
        next.delete(metric);
      } else {
        next.add(metric);
      }
      return next;
    });
  };

  const toggleOverlay = (code: string) => {
    setSelectedOverlays((current) => {
      const next = new Set(current);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const toggleAllOverlays = () => {
    setSelectedOverlays((current) => current.size === overlayCodes.length ? new Set() : new Set(overlayCodes));
  };

  const exportCsv = () => {
    const headers = [
      "Date",
      "Day",
      ...report.fields.map((field) => `${field.block} ${field.field}`),
      ...totalColumns.map((column) => column.label),
      RAINFALL_DATA_LABEL,
    ];
    const rows = report.days.flatMap((day, rowIndex) => {
      const productionRow = [
        day.date,
        day.dayName,
        ...report.fields.map((field) => {
          const cell = field.cells[rowIndex];
          return cell.harvest && cell.activity ? formatMetricValue(cell.activity[selectedMetric], selectedMetric) : String(cell.interval);
        }),
        ...totalColumns.map((column) => column.getDailyValue(day.date)),
        RAINFALL_PLACEHOLDER,
      ];
      if (!expandedDates.has(day.date)) return [productionRow];

      return [
        productionRow,
        [
          day.date,
          "Dispatch",
          ...report.fields.map((field) => formatDispatchCellValue(field.cells[rowIndex].dispatch, selectedMetric)),
          ...totalColumns.map(() => ""),
          "",
        ],
      ];
    });
    const monthlyTotalRow = [
      "Total Ha",
      report.monthLabel,
      ...report.fields.map((field) => formatMetricValue(field.monthlyHectareTotal, "hectare")),
      ...totalColumns.map((column) => column.getMonthlyValue()),
      RAINFALL_PLACEHOLDER,
    ];
    const csv = [headers, ...rows, monthlyTotalRow].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `harvesting-interval-${selectedMonth}-${selectedMetric}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      audience="management"
      title="Harvesting Interval"
      subtitle="Monthly field interval report using source-system harvesting productivity data"
    >
      <section className="harvesting-workspace workspace-section" aria-labelledby="harvesting-interval-title">
        <div className="workspace-toolbar">
          <div className="section-heading">
            <p>Management overview</p>
            <h2 id="harvesting-interval-title">Harvesting Interval Report</h2>
          </div>
          <div className="toolbar-actions">
            <label className="select-control">
              <span>Month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)}>
                {source.metadata.availableMonths.map((month) => (
                  <option key={month} value={month}>
                    {formatHarvestingMonth(month)}
                  </option>
                ))}
              </select>
            </label>
            <div className="segmented-control harvesting-metric-toggle" aria-label="Activity metric">
              {METRIC_OPTIONS.map((option) => (
                <button
                  className={selectedMetric === option.key ? "active" : ""}
                  type="button"
                  aria-pressed={selectedMetric === option.key}
                  key={option.key}
                  onClick={() => setSelectedMetric(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button className="command-button" type="button" onClick={exportCsv}>
              <Download aria-hidden="true" size={16} /> Export
            </button>
          </div>
        </div>

        <div className="kpi-strip harvesting-kpi-strip">
          <Kpi label="Selected month" value={report.monthLabel} helper={`${report.days.length} calendar days`} icon={<CalendarDays size={18} />} />
          <Kpi label="QC + C1 activities" value={report.sourceActivityCount.toString()} helper={`${report.sourceActiveFields} active fields`} icon={<Sprout size={18} />} />
          <Kpi label="Display metric" value={metricLabel} helper="Orange activity cells" icon={<BarChart3 size={18} />} />
          <Kpi label="Display fields" value={report.fields.length.toString()} helper="Screenshot template fields" icon={<Grid2X2 size={18} />} />
          <div className="kpi-item data-source-kpi">
            <span>Data sources</span>
            <strong>{source.metadata.activitySourceFile}</strong>
            <small>Dispatch: {source.metadata.dispatchSourceFile}</small>
            <small>Production through {source.metadata.lastActivityDate} | Dispatch through {source.metadata.lastDispatchDate}</small>
          </div>
        </div>

        <div className="activity-overlay-bar" aria-label="Activity overlay legend">
          <div className="activity-overlay-actions">
            <span>Activity overlay</span>
            <button
              className={selectedOverlays.size === overlayCodes.length ? "active" : ""}
              type="button"
              aria-pressed={selectedOverlays.size === overlayCodes.length}
              onClick={toggleAllOverlays}
            >
              All
            </button>
            {overlayCodes.map((code) => (
              <button
                className={selectedOverlays.has(code) ? "active" : ""}
                type="button"
                aria-pressed={selectedOverlays.has(code)}
                key={code}
                onClick={() => toggleOverlay(code)}
              >
                <span className="overlay-swatch" style={{ backgroundColor: getOverlayColor(code) }} />
                {code}
              </button>
            ))}
          </div>
          <div className="activity-overlay-legend">
            {overlayCodes.map((code) => (
              <span key={`${code}-legend`}>
                <span className="overlay-swatch" style={{ backgroundColor: getOverlayColor(code) }} />
                {code}
              </span>
            ))}
          </div>
        </div>

        <section className="data-panel harvesting-report-panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Interval Grid</h3>
              <p>Base date {source.metadata.baseDate} | Activity value: {metricLabel}</p>
            </div>
          </div>
          <div className="wide-table-scroll harvesting-table-scroll">
            <table className="harvesting-table" style={{ minWidth: `${135 + report.fields.length * 58 + totalColumns.length * 96 + RAINFALL_COLUMN_WIDTH}px` }}>
              <thead>
                <tr className="harvesting-report-title">
                  <th colSpan={report.fields.length + totalColumns.length + 2}>DIGITAL ESTATE HARVESTING INTERVAL | {report.monthLabel.toUpperCase()}</th>
                </tr>
                <tr>
                  <th className="harvesting-sticky-col" rowSpan={3}>Date</th>
                  {dayGroups.map((group, index) => (
                    <th className="harvesting-block-heading" colSpan={group.span} key={`${group.block}-${index}`}>
                      {group.label}
                    </th>
                  ))}
                  <th className="harvesting-total-heading" colSpan={totalColumns.length}>
                    DAILY TOTAL
                  </th>
                  <th className="rainfall-data-col rainfall-data-heading" rowSpan={3}>{RAINFALL_DATA_LABEL}</th>
                </tr>
                <tr>
                  {dayGroups.map((group, index) => (
                    <th className="harvesting-group-ha" colSpan={group.span} key={`${group.block}-ha-${index}`}>
                      {group.totalHectares == null ? "-" : group.totalHectares.toFixed(2)}
                    </th>
                  ))}
                  <th className="harvesting-total-heading" colSpan={totalColumns.length}>
                    TOTAL
                  </th>
                </tr>
                <tr>
                  {report.fields.map((field) => (
                    <th key={`${field.id}-field`}>{field.field}</th>
                  ))}
                  {totalColumns.map((column, index) => (
                    <th className={getTotalColumnClass(column, index, expandedTotalGroups)} key={column.id}>
                      {renderTotalColumnHeader(column, expandedTotalGroups, toggleTotalGroup)}
                    </th>
                  ))}
                </tr>
                <tr>
                  <th className="harvesting-sticky-col">HA</th>
                  {report.fields.map((field) => (
                    <th key={`${field.id}-ha`}>{field.hectares == null ? "-" : field.hectares.toFixed(2)}</th>
                  ))}
                  {totalColumns.map((column, index) => (
                    <th className={`${getTotalColumnClass(column, index, expandedTotalGroups)} harvesting-total-muted`} key={`${column.id}-ha`}>-</th>
                  ))}
                  <th className="rainfall-data-col harvesting-total-muted">{RAINFALL_PLACEHOLDER}</th>
                </tr>
                <tr>
                  <th className="harvesting-sticky-col">B/F</th>
                  {report.fields.map((field) => (
                    <th className={field.hasReferenceBaseline ? "" : "baseline-missing"} key={`${field.id}-bf`}>
                      {field.bfDisplay || field.baseInterval}
                    </th>
                  ))}
                  {totalColumns.map((column, index) => (
                    <th className={`${getTotalColumnClass(column, index, expandedTotalGroups)} harvesting-total-muted`} key={`${column.id}-bf`}>-</th>
                  ))}
                  <th className="rainfall-data-col harvesting-total-muted">{RAINFALL_PLACEHOLDER}</th>
                </tr>
              </thead>
              <tbody>
                {report.days.map((day, rowIndex) => {
                  const isExpanded = expandedDates.has(day.date);
                  return (
                    <Fragment key={day.date}>
                      <tr className={day.isSunday ? "sunday-row" : ""}>
                        <th className="harvesting-sticky-col">
                          <span className="harvesting-date-cell">
                            <button
                              className="date-expand-button"
                              type="button"
                              aria-expanded={isExpanded}
                              onClick={() => toggleDate(day.date)}
                              title={isExpanded ? `Hide dispatch for ${day.date}` : `Show dispatch for ${day.date}`}
                            >
                              {isExpanded ? <ChevronDown aria-hidden="true" size={13} /> : <ChevronRight aria-hidden="true" size={13} />}
                            </button>
                            <span>
                              <span>{day.day}</span>
                              <small>{day.dayName}</small>
                            </span>
                          </span>
                        </th>
                        {renderFieldCells({
                          day,
                          rowIndex,
                          selectedMetric,
                          selectedOverlays,
                          setSelectedActivity,
                          fields: report.fields,
                        })}
                        {totalColumns.map((column, index) => (
                          <td className={`${getTotalColumnClass(column, index, expandedTotalGroups)} daily-total-cell`} key={`${day.date}-${column.id}`}>
                            {column.getDailyValue(day.date)}
                          </td>
                        ))}
                        <td className="rainfall-data-col rainfall-data-cell">{RAINFALL_PLACEHOLDER}</td>
                      </tr>
                      {isExpanded ? (
                        <tr className="dispatch-layer-row">
                          <th className="harvesting-sticky-col">
                            <span>Dispatch</span>
                            <small>{getDispatchMetricLabel(selectedMetric)}</small>
                          </th>
                          {renderDispatchCells({ fields: report.fields, rowIndex, selectedMetric })}
                          {totalColumns.map((column, index) => (
                            <td className={`${getTotalColumnClass(column, index, expandedTotalGroups)} dispatch-total-cell`} key={`${day.date}-${column.id}-dispatch`}>
                              {" "}
                            </td>
                          ))}
                          <td className="rainfall-data-col dispatch-total-cell">{" "}</td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                <tr className="harvesting-month-total-row">
                  <th className="harvesting-sticky-col">
                    <span>Total Ha</span>
                    <small>Month</small>
                  </th>
                  {renderMonthlyHectareCells(report.fields)}
                  {totalColumns.map((column, index) => (
                    <td className={`${getTotalColumnClass(column, index, expandedTotalGroups)} daily-total-cell month-total-cell`} key={`monthly-${column.id}`}>
                      {column.getMonthlyValue()}
                    </td>
                  ))}
                  <td className="rainfall-data-col rainfall-data-cell month-total-cell">{RAINFALL_PLACEHOLDER}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {selectedActivity ? (
        <ActivityModal activity={selectedActivity} onClose={() => setSelectedActivity(null)} />
      ) : null}
    </ModuleShell>
  );
}

function renderFieldCells({
  day,
  rowIndex,
  selectedMetric,
  selectedOverlays,
  setSelectedActivity,
  fields,
}: {
  day: HarvestingIntervalCell;
  rowIndex: number;
  selectedMetric: HarvestingIntervalMetricKey;
  selectedOverlays: Set<string>;
  setSelectedActivity: (activity: SelectedActivity) => void;
  fields: Array<{ id: string; field: string; cells: HarvestingIntervalCell[] }>;
}) {
  const cells: React.ReactNode[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const cell = field.cells[rowIndex];
    const activeOverlays = getActiveOverlays(cell, selectedOverlays);
    const overlayStyle = getOverlayStyle(activeOverlays);
    const overlayClass = activeOverlays.length ? " overlay-layer-cell" : "";

    if (cell.harvest && cell.activity) {
      let span = 1;
      while (index + span < fields.length) {
        const nextField = fields[index + span];
        const nextCell = nextField.cells[rowIndex];
        if (nextField.field !== field.field || !nextCell.harvest) break;
        span += 1;
      }

      cells.push(
        <td className={`harvest-cell${overlayClass}`} colSpan={span} key={`${field.id}-${cell.date}`} style={overlayStyle}>
          <button
            className="harvest-cell-button"
            type="button"
            onClick={() =>
              setSelectedActivity({
                field: field.field,
                date: cell.date,
                day: day.day,
                dayName: day.dayName,
                interval: cell.interval,
                production: cell.activity as HarvestingIntervalActivityMetrics,
                dispatch: cell.dispatch || emptyDispatchMetrics(),
                balance: cell.balance,
              })
            }
            title={`${field.field} | ${cell.date} | interval ${cell.interval}`}
          >
            {formatMetricValue(cell.activity[selectedMetric], selectedMetric)}
          </button>
        </td>,
      );
      index += span - 1;
      continue;
    }

    if (cell.dispatch) {
      cells.push(
        <td className={`comparison-cell${overlayClass}`} key={`${field.id}-${cell.date}`} title={`${field.field} | ${cell.date} | interval ${cell.interval}`} style={overlayStyle}>
          <button
            className="comparison-cell-button"
            type="button"
            onClick={() =>
              setSelectedActivity({
                field: field.field,
                date: cell.date,
                day: day.day,
                dayName: day.dayName,
                interval: cell.interval,
                production: cell.activity || emptyProductionMetrics(),
                dispatch: cell.dispatch as HarvestingIntervalDispatchMetrics,
                balance: cell.balance,
              })
            }
          >
            {cell.interval}
          </button>
        </td>,
      );
      continue;
    }

    cells.push(
      <td className={activeOverlays.length ? "overlay-layer-cell" : ""} key={`${field.id}-${cell.date}`} title={`${field.field} | ${cell.date} | interval ${cell.interval}`} style={overlayStyle}>
        {cell.interval}
      </td>,
    );
  }

  return cells;
}

function renderDispatchCells({
  fields,
  rowIndex,
  selectedMetric,
}: {
  fields: Array<{ id: string; field: string; cells: HarvestingIntervalCell[] }>;
  rowIndex: number;
  selectedMetric: HarvestingIntervalMetricKey;
}) {
  const cells: React.ReactNode[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    const cell = field.cells[rowIndex];

    if (cell.dispatch) {
      let span = 1;
      while (index + span < fields.length) {
        const nextField = fields[index + span];
        const nextCell = nextField.cells[rowIndex];
        if (nextField.field !== field.field || !nextCell.dispatch) break;
        span += 1;
      }

      cells.push(
        <td className="dispatch-field-cell" colSpan={span} key={`${field.id}-${cell.date}-dispatch`}>
          {formatDispatchCellValue(cell.dispatch, selectedMetric)}
        </td>,
      );
      index += span - 1;
      continue;
    }

    cells.push(
      <td className="dispatch-empty-cell" key={`${field.id}-${cell.date}-dispatch`}>
        -
      </td>,
    );
  }

  return cells;
}

function getOverlayCodes(sourceData: HarvestingIntervalSource) {
  return sourceData.metadata.overlayActivities?.length
    ? sourceData.metadata.overlayActivities
    : ["HM", "QF", "QG", "R1", "PM1501"];
}

function getActiveOverlays(cell: HarvestingIntervalCell, selectedOverlays: Set<string>) {
  if (!selectedOverlays.size) return [];
  return cell.overlays.filter((code) => selectedOverlays.has(code));
}

function getOverlayColor(code: string) {
  return OVERLAY_COLORS[code] || "#334155";
}

function getOverlayStyle(codes: string[]): CSSProperties | undefined {
  if (!codes.length) return undefined;

  return {
    ...(codes.includes("PM1501") ? { backgroundColor: "#bbf7d0", color: "#064e3b" } : {}),
    boxShadow: codes
      .slice(0, 5)
      .map((code, index) => `inset 0 0 0 ${3 + index * 3}px ${getOverlayColor(code)}`)
      .concat(["0 4px 12px rgba(15, 61, 44, 0.18)"])
      .join(", "),
  };
}

function renderTotalColumnHeader(
  column: TotalColumn,
  expandedGroups: Set<HarvestingIntervalMetricKey>,
  toggleTotalGroup: (metric: HarvestingIntervalMetricKey) => void,
) {
  if (column.kind !== "production") {
    return column.label;
  }

  const isExpanded = expandedGroups.has(column.group);
  return (
    <span className="total-column-heading">
      <span>{column.label}</span>
      <button
        className="total-column-expand-button"
        type="button"
        aria-expanded={isExpanded}
        onClick={() => toggleTotalGroup(column.group)}
        title={isExpanded ? `Hide dispatch comparison for ${column.label}` : `Show dispatch comparison for ${column.label}`}
      >
        {isExpanded ? <ChevronDown aria-hidden="true" size={12} /> : <ChevronRight aria-hidden="true" size={12} />}
      </button>
    </span>
  );
}

function getTotalColumnClass(column: TotalColumn, index: number, expandedGroups: Set<HarvestingIntervalMetricKey>) {
  return [
    "daily-total-col",
    `${column.kind}-total-col`,
    index === 0 ? "daily-total-start" : "",
    expandedGroups.has(column.group) ? "expanded-total-group" : "",
  ].filter(Boolean).join(" ");
}

function getTotalColumns(report: HarvestingIntervalMonthReport, expandedGroups: Set<HarvestingIntervalMetricKey>): TotalColumn[] {
  const baseColumns: TotalColumn[] = [
    {
      id: "production-hectare",
      label: "Total Ha Today",
      kind: "production",
      group: "hectare",
      metric: "hectare",
      getDailyValue: (date) => formatMetricValue(report.dailyTotals[date].hectare, "hectare"),
      getMonthlyValue: () => formatMetricValue(report.monthlyTotals.hectare, "hectare"),
    },
    {
      id: "production-bunches",
      label: "Total Harvested Bunches",
      kind: "production",
      group: "bunches",
      metric: "bunches",
      getDailyValue: (date) => formatMetricValue(report.dailyTotals[date].bunches, "bunches"),
      getMonthlyValue: () => formatMetricValue(report.monthlyTotals.bunches, "bunches"),
    },
    {
      id: "production-tonnage",
      label: "Total Tonnage",
      kind: "production",
      group: "tonnage",
      metric: "tonnage",
      getDailyValue: (date) => formatMetricValue(report.dailyTotals[date].tonnage, "tonnage"),
      getMonthlyValue: () => formatMetricValue(report.monthlyTotals.tonnage, "tonnage"),
    },
  ];

  return baseColumns.flatMap((column) => {
    if (!expandedGroups.has(column.group)) return [column];

    if (column.group === "hectare") {
      return [
        column,
        {
          id: "dispatch-hectare",
          label: "Total Ha Dispatch",
          kind: "dispatch" as const,
          group: "hectare" as const,
          metric: "hectare" as const,
          getDailyValue: (date: string) => formatMetricValue(report.dispatchDailyTotals[date].hectare, "hectare"),
          getMonthlyValue: () => formatMetricValue(report.monthlyDispatchTotals.hectare, "hectare"),
        },
        {
          id: "difference-hectare",
          label: "Ha Difference",
          kind: "balance" as const,
          group: "hectare" as const,
          metric: "hectare" as const,
          getDailyValue: (date: string) => formatMetricValue(report.dailyBalances[date].hectare, "hectare"),
          getMonthlyValue: () => formatMetricValue(report.monthlyBalances.hectare, "hectare"),
        },
      ];
    }

    if (column.group === "bunches") {
      return [
        column,
        {
          id: "dispatch-bunches",
          label: "Total Dispatch Bunches",
          kind: "dispatch" as const,
          group: "bunches" as const,
          metric: "bunches" as const,
          getDailyValue: (date: string) => formatMetricValue(report.dispatchDailyTotals[date].bunches, "bunches"),
          getMonthlyValue: () => formatMetricValue(report.monthlyDispatchTotals.bunches, "bunches"),
        },
        {
          id: "difference-bunches",
          label: "Bunch Difference",
          kind: "balance" as const,
          group: "bunches" as const,
          metric: "bunches" as const,
          getDailyValue: (date: string) => formatMetricValue(report.dailyBalances[date].bunches, "bunches"),
          getMonthlyValue: () => formatMetricValue(report.monthlyBalances.bunches, "bunches"),
        },
      ];
    }

    return [
      column,
      {
        id: "dispatch-kg",
        label: "Total Amount (KG) Dispatch",
        kind: "dispatch" as const,
        group: "tonnage" as const,
        metric: "kg" as const,
        getDailyValue: (date: string) => formatKgValue(report.dispatchDailyTotals[date].kg),
        getMonthlyValue: () => formatKgValue(report.monthlyDispatchTotals.kg),
      },
      {
        id: "difference-kg",
        label: "KG Difference",
        kind: "balance" as const,
        group: "tonnage" as const,
        metric: "kg" as const,
        getDailyValue: (date: string) => formatKgValue(report.dailyBalances[date].kg),
        getMonthlyValue: () => formatKgValue(report.monthlyBalances.kg),
      },
    ];
  });
}

function renderMonthlyHectareCells(fields: Array<{ id: string; field: string; monthlyHectareTotal: number }>) {
  const cells: React.ReactNode[] = [];

  for (let index = 0; index < fields.length; index += 1) {
    const field = fields[index];
    let span = 1;

    while (index + span < fields.length && fields[index + span].field === field.field) {
      span += 1;
    }

    cells.push(
      <td className="field-month-total-cell" colSpan={span} key={`${field.id}-monthly-total`}>
        {formatMetricValue(field.monthlyHectareTotal, "hectare")}
      </td>,
    );
    index += span - 1;
  }

  return cells;
}

function ActivityModal({ activity, onClose }: { activity: SelectedActivity; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card harvesting-activity-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="harvesting-activity-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <p className="eyebrow">{activity.field} | {activity.date}</p>
          <h2 id="harvesting-activity-title">Harvesting Activity</h2>
        </div>
        <div className="harvesting-activity-summary">
          <span>{activity.dayName}, day {activity.day}</span>
          <strong>Interval {activity.interval}</strong>
        </div>
        <div className="harvesting-comparison-grid">
          <div className="comparison-grid-heading">
            <span>Metric</span>
            <span>Production</span>
            <span>Dispatch</span>
            <span>Difference</span>
          </div>
          <ComparisonMetricRow
            label="Ha"
            production={formatMetricValue(activity.production.hectare, "hectare")}
            dispatch={formatMetricValue(activity.dispatch.hectare, "hectare")}
            balance={formatMetricValue(activity.balance.hectare, "hectare")}
          />
          <ComparisonMetricRow
            label="Bunches"
            production={formatMetricValue(activity.production.bunches, "bunches")}
            dispatch={formatMetricValue(activity.dispatch.bunches, "bunches")}
            balance={formatMetricValue(activity.balance.bunches, "bunches")}
          />
          <ComparisonMetricRow
            label="KG"
            production={formatKgValue(activity.production.tonnage * 1000)}
            dispatch={formatKgValue(activity.dispatch.kg)}
            balance={formatKgValue(activity.balance.kg)}
          />
        </div>
        <div className="modal-actions">
          <button className="command-button" type="button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function ComparisonMetricRow({
  label,
  production,
  dispatch,
  balance,
}: {
  label: string;
  production: string;
  dispatch: string;
  balance: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong>{production}</strong>
      <strong>{dispatch}</strong>
      <strong>{balance}</strong>
    </div>
  );
}

function Kpi({ label, value, helper, icon }: { label: string; value: string; helper: string; icon: React.ReactNode }) {
  return (
    <div className="kpi-item">
      <span>{icon}{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function formatMetricValue(value: number, metric: HarvestingIntervalMetricKey) {
  if (metric === "bunches") {
    return Math.round(value).toLocaleString("en-MY");
  }

  if (metric === "hectare") {
    return value.toLocaleString("en-MY", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return value.toLocaleString("en-MY", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 3,
    maximumFractionDigits: 3,
  });
}

function formatDispatchCellValue(dispatch: HarvestingIntervalDispatchMetrics | null, metric: HarvestingIntervalMetricKey) {
  if (!dispatch) return "-";
  if (metric === "hectare") return formatMetricValue(dispatch.hectare, "hectare");
  if (metric === "bunches") return formatMetricValue(dispatch.bunches, "bunches");
  return formatKgValue(dispatch.kg);
}

function getDispatchMetricLabel(metric: HarvestingIntervalMetricKey) {
  if (metric === "hectare") return "Ha";
  if (metric === "bunches") return "Bunches";
  return "KG";
}

function formatKgValue(value: number) {
  return Math.round(value).toLocaleString("en-MY");
}

function emptyProductionMetrics(): HarvestingIntervalActivityMetrics {
  return { hectare: 0, bunches: 0, tonnage: 0 };
}

function emptyDispatchMetrics(): HarvestingIntervalDispatchMetrics {
  return { hectare: 0, bunches: 0, kg: 0 };
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
