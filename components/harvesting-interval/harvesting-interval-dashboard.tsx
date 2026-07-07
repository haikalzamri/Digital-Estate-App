"use client";

import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Download, Grid2X2, MapPinned, Sprout, Table2 } from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GeoJsonObject } from "geojson";
import { ModuleShell } from "@/components/module-shell";
import { useFieldMap } from "@/components/work-program/use-field-map";
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
import type { FieldFeatureCollection } from "@/lib/work-program/analytics";

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
  LF: "#16a34a",
};

const RAINFALL_DATA_LABEL = "Rainfall Data";
const RAINFALL_PLACEHOLDER = "-";
const RAINFALL_COLUMN_WIDTH = 96;
const SUMMARY_DATE_LABEL_FORMAT = new Intl.DateTimeFormat("en-MY", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const INTERVAL_BANDS = [
  { id: "lt10", label: "<10", min: 0, max: 10 },
  { id: "11-12", label: "11-12", min: 11, max: 12 },
  { id: "13-15", label: "13-15", min: 13, max: 15 },
  { id: "16-20", label: "16-20", min: 16, max: 20 },
  { id: "21-30", label: "21-30", min: 21, max: 30 },
  { id: "31-40", label: "31-40", min: 31, max: 40 },
  { id: "gt41", label: ">41", min: 41, max: Number.POSITIVE_INFINITY },
] as const;

type IntervalBandId = typeof INTERVAL_BANDS[number]["id"];
type SummaryView = "table" | "map";

const INTERVAL_STATUS_COLOURS = {
  onTrack: "#22c55e",
  watch: "#facc15",
  caution: "#fb923c",
  overdue: "#ef4444",
  grey: "#9da5a0",
};

type TotalColumnKind = "production" | "dispatch" | "balance";

type TotalColumn = {
  id: string;
  label: string;
  kind: TotalColumnKind;
  group: HarvestingIntervalMetricKey;
  metric: HarvestingIntervalMetricKey;
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

type FieldIntervalSummary = {
  field: string;
  totalHectares: number;
  maxInterval: number;
  lastHarvestDate: string | null;
  status: string;
  bandHectares: Record<IntervalBandId, number>;
};

export function HarvestingIntervalDashboard() {
  const fieldMap = useFieldMap();
  const [selectedMonth, setSelectedMonth] = useState(getDefaultHarvestingMonth(source));
  const [summaryAsOfDate, setSummaryAsOfDate] = useState(source.metadata.lastActivityDate);
  const [summaryView, setSummaryView] = useState<SummaryView>("table");
  const [selectedSummaryField, setSelectedSummaryField] = useState("");
  const [selectedMetric, setSelectedMetric] = useState<HarvestingIntervalMetricKey>("hectare");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [expandedTotalGroups, setExpandedTotalGroups] = useState<Set<HarvestingIntervalMetricKey>>(new Set());
  const [selectedOverlays, setSelectedOverlays] = useState<Set<string>>(new Set());
  const [selectedActivity, setSelectedActivity] = useState<SelectedActivity | null>(null);
  const report = useMemo(() => getHarvestingIntervalReport(source, selectedMonth), [selectedMonth]);
  const summaryReport = useMemo(() => getHarvestingIntervalReport(source, summaryAsOfDate.slice(0, 7)), [summaryAsOfDate]);
  const dayGroups = useMemo(() => getHarvestingDayGroups(report.fields), [report.fields]);
  const totalColumns = useMemo(() => getTotalColumns(report, expandedTotalGroups), [report, expandedTotalGroups]);
  const fieldIntervalSummary = useMemo(() => getFieldIntervalSummary(summaryReport, source, summaryAsOfDate), [summaryReport, summaryAsOfDate]);
  const selectedSummaryRow = fieldIntervalSummary.find((row) => row.field === selectedSummaryField) || fieldIntervalSummary[0] || null;
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

        <FieldIntervalSummaryPanel
          asOfDate={summaryAsOfDate}
          maxDate={source.metadata.lastActivityDate}
          minDate={source.metadata.startDate}
          onAsOfDateChange={setSummaryAsOfDate}
          onSelectField={setSelectedSummaryField}
          onViewChange={setSummaryView}
          selectedField={selectedSummaryRow?.field || ""}
          selectedRow={selectedSummaryRow}
          fieldMap={fieldMap}
          rows={fieldIntervalSummary}
          view={summaryView}
        />
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
    const lfOverlayValue = getLfOverlayValue(cell, activeOverlays);
    const overlayClass = activeOverlays.length ? " overlay-layer-cell" : "";
    const displayValue = lfOverlayValue == null ? null : formatOverlayValue(lfOverlayValue);
    const overlayStyle = getOverlayStyle(activeOverlays);

    if (displayValue != null) {
      const span = getLfMergeSpan(fields, rowIndex, index, selectedOverlays);
      const title = `${field.field} | ${cell.date} | LF ${displayValue} | interval ${cell.interval}`;
      const lfOverlayStyle = getOverlayStyle(activeOverlays, {
        productionHarvest: hasHarvestInLfSpan(fields, rowIndex, index, span),
      });

      if (cell.harvest && cell.activity) {
        cells.push(
          <td className={`harvest-cell${overlayClass}`} colSpan={span} key={`${field.id}-${cell.date}-lf`} style={lfOverlayStyle}>
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
              title={title}
            >
              {displayValue}
            </button>
          </td>,
        );
      } else if (cell.dispatch) {
        cells.push(
          <td className={`comparison-cell${overlayClass}`} colSpan={span} key={`${field.id}-${cell.date}-lf`} style={lfOverlayStyle}>
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
              title={title}
            >
              {displayValue}
            </button>
          </td>,
        );
      } else {
        cells.push(
          <td className={activeOverlays.length ? "overlay-layer-cell" : ""} colSpan={span} key={`${field.id}-${cell.date}-lf`} title={title} style={lfOverlayStyle}>
            {displayValue}
          </td>,
        );
      }

      index += span - 1;
      continue;
    }

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
    : ["HM", "QF", "QG", "R1", "LF"];
}

function getActiveOverlays(cell: HarvestingIntervalCell, selectedOverlays: Set<string>) {
  if (!selectedOverlays.size) return [];
  return cell.overlays.filter((code) => selectedOverlays.has(code));
}

function getOverlayColor(code: string) {
  return OVERLAY_COLORS[code] || "#334155";
}

function getOverlayStyle(codes: string[], options: { productionHarvest?: boolean } = {}): CSSProperties | undefined {
  if (!codes.length) return undefined;

  const borderCodes = codes.filter((code) => code !== "LF");
  const showProductionRing = options.productionHarvest && codes.includes("LF");
  const shadowLayers = [
    ...(showProductionRing ? ["inset 0 0 0 3px #f97316"] : []),
    ...borderCodes
      .slice(0, 5)
      .map((code, index) => `inset 0 0 0 ${3 + (index + (showProductionRing ? 1 : 0)) * 3}px ${getOverlayColor(code)}`),
  ];
  const boxShadow = shadowLayers.concat(shadowLayers.length ? ["0 4px 12px rgba(15, 61, 44, 0.18)"] : []).join(", ");

  return {
    ...(codes.includes("LF") ? { backgroundColor: "#bbf7d0", color: "#064e3b" } : {}),
    ...(boxShadow ? { boxShadow } : {}),
  };
}

function getLfOverlayValue(cell: HarvestingIntervalCell, activeOverlays: string[]) {
  if (!activeOverlays.includes("LF")) return null;
  const value = cell.overlayValues?.LF;
  return typeof value === "number" ? value : null;
}

function getLfMergeSpan(
  fields: Array<{ field: string; cells: HarvestingIntervalCell[] }>,
  rowIndex: number,
  startIndex: number,
  selectedOverlays: Set<string>,
) {
  const field = fields[startIndex];
  let span = 1;

  while (startIndex + span < fields.length) {
    const nextField = fields[startIndex + span];
    if (nextField.field !== field.field) break;
    const nextCell = nextField.cells[rowIndex];
    const nextLfValue = getLfOverlayValue(nextCell, getActiveOverlays(nextCell, selectedOverlays));
    if (nextLfValue == null) break;
    span += 1;
  }

  return span;
}

function hasHarvestInLfSpan(
  fields: Array<{ cells: HarvestingIntervalCell[] }>,
  rowIndex: number,
  startIndex: number,
  span: number,
) {
  for (let index = startIndex; index < startIndex + span; index += 1) {
    if (fields[index]?.cells[rowIndex]?.harvest) return true;
  }
  return false;
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
        id: "dispatch-tonnage",
        label: "Total Dispatch Tonnage",
        kind: "dispatch" as const,
        group: "tonnage" as const,
        metric: "tonnage" as const,
        getDailyValue: (date: string) => formatMetricValue(report.dispatchDailyTotals[date].tonnage || 0, "tonnage"),
        getMonthlyValue: () => formatMetricValue(report.monthlyDispatchTotals.tonnage || 0, "tonnage"),
      },
      {
        id: "difference-tonnage",
        label: "Tonnage Difference",
        kind: "balance" as const,
        group: "tonnage" as const,
        metric: "tonnage" as const,
        getDailyValue: (date: string) => formatMetricValue(report.dailyBalances[date].tonnage, "tonnage"),
        getMonthlyValue: () => formatMetricValue(report.monthlyBalances.tonnage, "tonnage"),
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

function FieldIntervalSummaryPanel({
  rows,
  asOfDate,
  fieldMap,
  maxDate,
  minDate,
  selectedField,
  selectedRow,
  view,
  onAsOfDateChange,
  onSelectField,
  onViewChange,
}: {
  rows: FieldIntervalSummary[];
  asOfDate: string;
  fieldMap: FieldFeatureCollection;
  maxDate: string;
  minDate: string;
  selectedField: string;
  selectedRow: FieldIntervalSummary | null;
  view: SummaryView;
  onAsOfDateChange: (date: string) => void;
  onSelectField: (field: string) => void;
  onViewChange: (view: SummaryView) => void;
}) {
  const totalRow = getFieldIntervalTotalRow(rows);

  return (
    <section className="data-panel interval-summary-panel">
      <div className="panel-heading interval-summary-heading">
        <div>
          <h3>Field Interval Status Summary</h3>
          <p>Independent as-at view | {formatSummaryDateLabel(asOfDate)}</p>
        </div>
        <label className="select-control interval-summary-date-control">
          <span>As at date</span>
          <input
            max={maxDate}
            min={minDate}
            type="date"
            value={asOfDate}
            onChange={(event) => {
              if (event.target.value) onAsOfDateChange(event.target.value);
            }}
          />
        </label>
        <div className="segmented-control interval-summary-view-toggle" aria-label="Field interval summary view">
          <button className={view === "table" ? "active" : ""} type="button" onClick={() => onViewChange("table")}>
            <Table2 aria-hidden="true" size={16} /> Table
          </button>
          <button className={view === "map" ? "active" : ""} type="button" onClick={() => onViewChange("map")}>
            <MapPinned aria-hidden="true" size={16} /> Map
          </button>
        </div>
        <div className="interval-status-legend" aria-label="Interval status legend">
          <span><span className="interval-status-dot status-on-track" />On Track: 0-12 days</span>
          <span><span className="interval-status-dot status-watch" />Watch: 13-15 days</span>
          <span><span className="interval-status-dot status-caution" />Caution: 16-20 days</span>
          <span><span className="interval-status-dot status-overdue" />Overdue: 21+ days</span>
        </div>
      </div>
      <FieldIntervalTotalCards totalRow={totalRow} />
      {view === "table" ? (
        <div className="wide-table-scroll interval-summary-scroll">
          <table className="field-interval-summary-table">
            <thead>
              <tr>
                <th rowSpan={2}>Field</th>
                <th rowSpan={2}>Total Mature Ha</th>
                <th rowSpan={2}>Last Harvest Date</th>
                <th rowSpan={2}>Current Interval</th>
                <th rowSpan={2}>Status</th>
                <th colSpan={INTERVAL_BANDS.length * 2}>No. of Days Interval and Percentage (%) of Area</th>
              </tr>
              <tr>
                {INTERVAL_BANDS.map((band) => (
                  <Fragment key={`${band.id}-heading`}>
                    <th>{band.label} Ha</th>
                    <th>{band.label} %</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <FieldIntervalSummaryRow key={row.field} row={row} />
              ))}
              <FieldIntervalSummaryRow isTotal row={totalRow} />
            </tbody>
          </table>
        </div>
      ) : (
        <div className="map-workspace interval-summary-map-workspace">
          <div className="data-panel map-panel interval-summary-map-panel">
            <HarvestingIntervalSummaryMap
              fieldMap={fieldMap}
              rows={rows}
              selectedField={selectedField}
              onSelectField={onSelectField}
            />
          </div>
          <aside className="data-panel field-detail-panel interval-summary-detail-panel">
            {selectedRow ? (
              <>
                <span className={`interval-status-pill ${getIntervalStatusClass(selectedRow.maxInterval)}`}>{selectedRow.status}</span>
                <h3>{selectedRow.field}</h3>
                <dl className="detail-list">
                  <Detail label="Total mature Ha" value={formatMetricValue(selectedRow.totalHectares, "hectare")} />
                  <Detail label="Last harvest date" value={selectedRow.lastHarvestDate || "-"} />
                  <Detail label="Current interval" value={`${selectedRow.maxInterval} days`} />
                  <Detail label="Interval band" value={getIntervalBand(selectedRow.maxInterval).label} />
                </dl>
                <p className="detail-note">Map colours follow the selected as-at date.</p>
              </>
            ) : (
              <p className="empty-state">Map data is loading.</p>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}

function FieldIntervalTotalCards({ totalRow }: { totalRow: FieldIntervalSummary }) {
  const summaryCards = getIntervalTotalCards(totalRow);

  return (
    <div className="interval-total-card-grid" aria-label="Total field interval summary">
      {summaryCards.map((card) => (
        <div className={`interval-total-card ${card.statusClass}`} key={card.label}>
          <span className="interval-total-card-label">
            {card.statusClass ? <span className={`interval-status-dot ${card.statusClass}`} /> : null}
            {card.label}
          </span>
          <strong>{card.value}</strong>
          <small>{card.helper}</small>
        </div>
      ))}
    </div>
  );
}

function FieldIntervalSummaryRow({ row, isTotal = false }: { row: FieldIntervalSummary; isTotal?: boolean }) {
  return (
    <tr className={isTotal ? "interval-summary-total-row" : ""}>
      <th>{row.field}</th>
      <td>{formatMetricValue(row.totalHectares, "hectare")}</td>
      <td>{row.lastHarvestDate || "-"}</td>
      <td>{row.maxInterval}</td>
      <td>
        {isTotal ? "-" : <span className={`interval-status-pill ${getIntervalStatusClass(row.maxInterval)}`}>{row.status}</span>}
      </td>
      {INTERVAL_BANDS.map((band) => {
        const hectares = row.bandHectares[band.id];
        return (
          <Fragment key={`${row.field}-${band.id}`}>
            <td className={hectares ? "" : "interval-zero-cell"}>{formatMetricValue(hectares, "hectare")}</td>
            <td className={hectares ? "" : "interval-zero-cell"}>{formatPercentValue(getIntervalBandPercent(row, band.id))}</td>
          </Fragment>
        );
      })}
    </tr>
  );
}

function HarvestingIntervalSummaryMap({
  fieldMap,
  rows,
  selectedField,
  onSelectField,
}: {
  fieldMap: FieldFeatureCollection;
  rows: FieldIntervalSummary[];
  selectedField: string;
  onSelectField: (field: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let mapInstance: import("leaflet").Map | null = null;

    const renderMap = async () => {
      if (!containerRef.current || !fieldMap.features.length) return;
      const L = await import("leaflet");
      if (disposed || !containerRef.current) return;

      const lookup = new Map(rows.map((row) => [row.field, row]));
      mapInstance = L.map(containerRef.current, { scrollWheelZoom: false, zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 22,
      }).addTo(mapInstance);

      const layer = L.geoJSON(fieldMap as unknown as GeoJsonObject, {
        style: (feature) => {
          const fieldName = String(feature?.properties?.field_no || feature?.properties?.field_gis || "");
          const row = lookup.get(fieldName);
          const selected = fieldName === selectedField;
          return {
            color: selected ? "#ffffff" : "#263a2f",
            fillColor: row ? getIntervalStatusColour(row.maxInterval) : INTERVAL_STATUS_COLOURS.grey,
            fillOpacity: selected ? 0.88 : row ? 0.72 : 0.28,
            weight: selected ? 4 : 1.35,
          };
        },
        onEachFeature: (feature, featureLayer) => {
          const fieldName = String(feature.properties?.field_no || feature.properties?.field_gis || "Field");
          const row = lookup.get(fieldName);
          featureLayer.bindTooltip(fieldName, {
            className: "field-map-tooltip",
            direction: "center",
            permanent: true,
          });
          featureLayer.bindPopup(
            `<div class="map-popup"><strong>${escapeHtml(fieldName)}</strong><span>${escapeHtml(row?.status || "No interval status")}</span><dl><div><dt>Mature Ha</dt><dd>${escapeHtml(formatMetricValue(row?.totalHectares || 0, "hectare"))}</dd></div><div><dt>Last Harvest</dt><dd>${escapeHtml(row?.lastHarvestDate || "-")}</dd></div><div><dt>Interval</dt><dd>${escapeHtml(row ? `${row.maxInterval} days` : "-")}</dd></div><div><dt>Band</dt><dd>${escapeHtml(row ? getIntervalBand(row.maxInterval).label : "-")}</dd></div></dl></div>`,
          );
          featureLayer.on("click", () => {
            if (row) onSelectField(row.field);
          });
        },
      }).addTo(mapInstance);

      const bounds = layer.getBounds();
      if (bounds.isValid()) mapInstance.fitBounds(bounds, { maxZoom: 16, padding: [22, 22] });
    };

    void renderMap();
    return () => {
      disposed = true;
      mapInstance?.remove();
    };
  }, [fieldMap, onSelectField, rows, selectedField]);

  return fieldMap.features.length ? (
    <div className="leaflet-map" ref={containerRef} aria-label="Harvesting interval field status map" />
  ) : (
    <div className="map-empty">Field map data is loading.</div>
  );
}

function getFieldIntervalSummary(report: HarvestingIntervalMonthReport, sourceData: HarvestingIntervalSource, asOfDate: string): FieldIntervalSummary[] {
  const rows = new Map<string, FieldIntervalSummary>();

  for (const field of report.fields) {
    const asOfCell = field.cells.find((cell) => cell.date === asOfDate);
    const row = rows.get(field.field) || {
      field: field.field,
      totalHectares: 0,
      maxInterval: 0,
      lastHarvestDate: getLastHarvestDate(sourceData, field.field, asOfDate),
      status: "",
      bandHectares: getEmptyBandHectares(),
    };
    const hectares = field.hectares || 0;
    const interval = asOfCell?.interval || field.endInterval;
    const band = getIntervalBand(interval);

    row.totalHectares = roundDisplayNumber(row.totalHectares + hectares, 2);
    row.maxInterval = Math.max(row.maxInterval, interval);
    row.bandHectares[band.id] = roundDisplayNumber(row.bandHectares[band.id] + hectares, 2);
    row.status = getIntervalStatus(row.maxInterval);
    rows.set(field.field, row);
  }

  return [...rows.values()];
}

function getFieldIntervalTotalRow(rows: FieldIntervalSummary[]): FieldIntervalSummary {
  const totalRow: FieldIntervalSummary = {
    field: "TOTAL",
    totalHectares: 0,
    maxInterval: 0,
    lastHarvestDate: null,
    status: "",
    bandHectares: getEmptyBandHectares(),
  };

  for (const row of rows) {
    totalRow.totalHectares = roundDisplayNumber(totalRow.totalHectares + row.totalHectares, 2);
    totalRow.maxInterval = Math.max(totalRow.maxInterval, row.maxInterval);
    for (const band of INTERVAL_BANDS) {
      totalRow.bandHectares[band.id] = roundDisplayNumber(totalRow.bandHectares[band.id] + row.bandHectares[band.id], 2);
    }
  }

  return totalRow;
}

function getIntervalTotalCards(totalRow: FieldIntervalSummary) {
  const onTrackHa = roundDisplayNumber(totalRow.bandHectares.lt10 + totalRow.bandHectares["11-12"], 2);
  const watchHa = totalRow.bandHectares["13-15"];
  const cautionHa = totalRow.bandHectares["16-20"];
  const overdueHa = roundDisplayNumber(totalRow.bandHectares["21-30"] + totalRow.bandHectares["31-40"] + totalRow.bandHectares.gt41, 2);

  return [
    {
      label: "Total Mature Ha",
      value: formatMetricValue(totalRow.totalHectares, "hectare"),
      helper: `Max interval ${totalRow.maxInterval} days`,
      statusClass: "",
    },
    {
      label: "0-12 Days",
      value: formatMetricValue(onTrackHa, "hectare"),
      helper: `${formatPercentValue(getTotalIntervalPercent(onTrackHa, totalRow.totalHectares))}% of area`,
      statusClass: "status-on-track",
    },
    {
      label: "13-15 Days",
      value: formatMetricValue(watchHa, "hectare"),
      helper: `${formatPercentValue(getTotalIntervalPercent(watchHa, totalRow.totalHectares))}% of area`,
      statusClass: "status-watch",
    },
    {
      label: "16-20 Days",
      value: formatMetricValue(cautionHa, "hectare"),
      helper: `${formatPercentValue(getTotalIntervalPercent(cautionHa, totalRow.totalHectares))}% of area`,
      statusClass: "status-caution",
    },
    {
      label: "21+ Days",
      value: formatMetricValue(overdueHa, "hectare"),
      helper: `${formatPercentValue(getTotalIntervalPercent(overdueHa, totalRow.totalHectares))}% of area`,
      statusClass: "status-overdue",
    },
  ];
}

function getTotalIntervalPercent(value: number, total: number) {
  if (!total) return 0;
  return value / total * 100;
}

function getEmptyBandHectares(): Record<IntervalBandId, number> {
  return INTERVAL_BANDS.reduce(
    (bands, band) => ({ ...bands, [band.id]: 0 }),
    {} as Record<IntervalBandId, number>,
  );
}

function getIntervalBand(interval: number) {
  return INTERVAL_BANDS.find((band) => interval >= band.min && interval <= band.max) || INTERVAL_BANDS.at(-1)!;
}

function getLastHarvestDate(sourceData: HarvestingIntervalSource, field: string, asOfDate: string) {
  return Object.keys(sourceData.activityByField[field] || {})
    .filter((date) => date <= asOfDate)
    .sort()
    .at(-1) || null;
}

function getIntervalBandPercent(row: FieldIntervalSummary, bandId: IntervalBandId) {
  if (!row.totalHectares) return 0;
  return row.bandHectares[bandId] / row.totalHectares * 100;
}

function getIntervalStatus(interval: number) {
  if (interval <= 12) return "On Track";
  if (interval <= 15) return "Watch";
  if (interval <= 20) return "Caution";
  return "Overdue";
}

function getIntervalStatusClass(interval: number) {
  if (interval <= 12) return "status-on-track";
  if (interval <= 15) return "status-watch";
  if (interval <= 20) return "status-caution";
  return "status-overdue";
}

function getIntervalStatusColour(interval: number) {
  if (interval <= 12) return INTERVAL_STATUS_COLOURS.onTrack;
  if (interval <= 15) return INTERVAL_STATUS_COLOURS.watch;
  if (interval <= 20) return INTERVAL_STATUS_COLOURS.caution;
  return INTERVAL_STATUS_COLOURS.overdue;
}

function formatSummaryDateLabel(value: string) {
  return SUMMARY_DATE_LABEL_FORMAT.format(parseSummaryDate(value));
}

function parseSummaryDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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
            label="Tonnage"
            production={formatMetricValue(activity.production.tonnage, "tonnage")}
            dispatch={formatMetricValue(activity.dispatch.tonnage || 0, "tonnage")}
            balance={formatMetricValue(activity.balance.tonnage, "tonnage")}
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

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
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
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  });
}

function formatDispatchCellValue(dispatch: HarvestingIntervalDispatchMetrics | null, metric: HarvestingIntervalMetricKey) {
  if (!dispatch) return "-";
  if (metric === "hectare") return formatMetricValue(dispatch.hectare, "hectare");
  if (metric === "bunches") return formatMetricValue(dispatch.bunches, "bunches");
  return formatMetricValue(dispatch.tonnage || 0, "tonnage");
}

function getDispatchMetricLabel(metric: HarvestingIntervalMetricKey) {
  if (metric === "hectare") return "Ha";
  if (metric === "bunches") return "Bunches";
  return "Tonnage";
}

function formatPercentValue(value: number) {
  return Math.round(value).toLocaleString("en-MY");
}

function formatOverlayValue(value: number) {
  return value.toLocaleString("en-MY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function roundDisplayNumber(value: number, decimals: number) {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}

function emptyProductionMetrics(): HarvestingIntervalActivityMetrics {
  return { hectare: 0, bunches: 0, tonnage: 0 };
}

function emptyDispatchMetrics(): HarvestingIntervalDispatchMetrics {
  return { hectare: 0, bunches: 0, kg: 0, tonnage: 0 };
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
