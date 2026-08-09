"use client";

import { BarChart3, CalendarDays, Check, ChevronDown, Download, Minus, Plus, Truck } from "lucide-react";
import { useMemo, useRef, useState, type ReactNode } from "react";
import { ModuleShell } from "@/components/module-shell";
import sourceJson from "@/lib/data/costbook-source.json";
import {
  formatCostbookCurrency,
  formatCostbookDate,
  formatCostbookMonth,
  formatCostbookNumber,
  getCostbookEvitNumbers,
  getCostbookFieldCodes,
  getCostbookReport,
  getDefaultCostbookActivity,
  getDefaultCostbookMonth,
} from "@/lib/costbook/report";
import type { CostbookDayReport, CostbookSource } from "@/lib/types/costbook";

const source = sourceJson as CostbookSource;
type CostbookDetailSection = "labour" | "material" | "evit";
type CostbookViewMode = "all" | CostbookDetailSection | "summary";
type CostbookVisibleSections = Record<CostbookDetailSection | "summary", boolean>;

const costbookViewModes: Array<{ value: CostbookViewMode; label: string }> = [
  { value: "all", label: "All" },
  { value: "labour", label: "Labour" },
  { value: "material", label: "Material" },
  { value: "evit", label: "EVIT" },
  { value: "summary", label: "Summary" },
];

function detailSectionKey(recordId: string, section: CostbookDetailSection) {
  return `${recordId}:${section}`;
}

export function CostbookDashboard() {
  const [selectedActivityCode, setSelectedActivityCode] = useState(getDefaultCostbookActivity(source));
  const [selectedMonth, setSelectedMonth] = useState(getDefaultCostbookMonth(source));
  const [selectedFieldCodes, setSelectedFieldCodes] = useState(() =>
    getCostbookFieldCodes(source, getDefaultCostbookActivity(source)),
  );
  const [selectedEvitNumbers, setSelectedEvitNumbers] = useState(() =>
    getCostbookEvitNumbers(source, getDefaultCostbookActivity(source)),
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<CostbookViewMode>("all");
  const [activeDetail, setActiveDetail] = useState<{ recordId: string; section: CostbookDetailSection } | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const availableFieldCodes = useMemo(
    () => getCostbookFieldCodes(source, selectedActivityCode),
    [selectedActivityCode],
  );
  const availableEvitNumbers = useMemo(
    () => getCostbookEvitNumbers(source, selectedActivityCode),
    [selectedActivityCode],
  );
  const report = useMemo(
    () => getCostbookReport(source, selectedActivityCode, selectedMonth, selectedFieldCodes, selectedEvitNumbers),
    [selectedActivityCode, selectedEvitNumbers, selectedFieldCodes, selectedMonth],
  );
  const dateGroups = useMemo(() => groupCostbookDays(report.days), [report.days]);
  const visibleSections = getCostbookVisibleSections(viewMode);
  const uniqueDateCount = new Set(report.days.map((day) => day.date)).size;

  const changeActivity = (activityCode: string) => {
    setSelectedActivityCode(activityCode);
    setSelectedFieldCodes(getCostbookFieldCodes(source, activityCode));
    setSelectedEvitNumbers(getCostbookEvitNumbers(source, activityCode));
    setExpandedSections(new Set());
    setActiveDetail(null);
  };

  const changeMonth = (month: string) => {
    setSelectedMonth(month);
    setExpandedSections(new Set());
    setActiveDetail(null);
  };

  const changeFields = (fieldCodes: string[]) => {
    setSelectedFieldCodes(fieldCodes);
    setExpandedSections(new Set());
    setActiveDetail(null);
  };

  const toggleSection = (recordId: string, section: CostbookDetailSection) => {
    const key = detailSectionKey(recordId, section);
    const willExpand = !expandedSections.has(key);
    setExpandedSections((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
    if (willExpand) {
      setActiveDetail({ recordId, section });
      focusCostbookSection(tableScrollRef.current, key);
    } else if (activeDetail?.recordId === recordId && activeDetail.section === section) {
      setActiveDetail(null);
    }
  };

  const changeViewMode = (nextViewMode: CostbookViewMode) => {
    setViewMode(nextViewMode);
    setActiveDetail(null);
    requestAnimationFrame(() => tableScrollRef.current?.scrollTo({ left: 0, behavior: "smooth" }));
  };

  const exportCsv = () => {
    if (!report.days.length) return;
    const rows = report.days.flatMap(buildCsvRows);
    const csv = [csvHeaders(), ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `costbook-${selectedActivityCode}-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      audience="management"
      title="Costbook"
      subtitle="Monthly activity cost review across labour, material and EVIT machine usage"
    >
      <section className="costbook-workspace workspace-section" aria-labelledby="costbook-report-heading">
        <div className="workspace-toolbar">
          <div className="section-heading">
            <p>Management overview</p>
            <h2 id="costbook-report-heading">Costbook Report</h2>
          </div>
          <button className="command-button" type="button" onClick={exportCsv} disabled={!report.days.length}>
            <Download aria-hidden="true" size={16} /> Export
          </button>
        </div>

        <div className="costbook-prototype-notice" role="note">
          <strong>Prototype dummy data</strong>
          <span>{source.metadata.sourceDescription}</span>
        </div>

        <section className="data-panel costbook-filter-panel" aria-label="Costbook report filters">
          <div className="costbook-filter-grid">
            <label className="select-control">
              <span>Activity Code <em aria-hidden="true">*</em></span>
              <select required value={selectedActivityCode} onChange={(event) => changeActivity(event.target.value)}>
                {source.activities.map((activity) => (
                  <option value={activity.code} key={activity.code}>
                    {activity.code} · {activity.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="select-control">
              <span>Month <em aria-hidden="true">*</em></span>
              <select required value={selectedMonth} onChange={(event) => changeMonth(event.target.value)}>
                {source.metadata.availableMonths.map((month) => (
                  <option value={month} key={month}>{formatCostbookMonth(month)}</option>
                ))}
              </select>
            </label>
            <CostbookMultiSelect
              allLabel="All Fields"
              label="Field"
              options={availableFieldCodes}
              selected={selectedFieldCodes}
              selectionNoun="fields"
              onChange={changeFields}
            />
            <CostbookMultiSelect
              allLabel="All EVIT"
              label="EVIT Number"
              options={availableEvitNumbers}
              selected={selectedEvitNumbers}
              selectionNoun="EVIT"
              onChange={setSelectedEvitNumbers}
            />
          </div>
          <p className="costbook-filter-helper">
            Activity and month are mandatory. Select one or more fields and EVIT numbers, or use Select All.
          </p>
        </section>

        <div className="kpi-strip costbook-kpi-strip">
          <Kpi
            icon={<CalendarDays size={18} />}
            label="Selected Period"
            value={report.monthLabel}
            helper={`${uniqueDateCount} dates · ${report.days.length} field rows`}
          />
          <Kpi
            icon={<BarChart3 size={18} />}
            label="Total Cost"
            value={`RM ${formatCostbookCurrency(report.totals.cost)}`}
            helper={report.activity ? `${report.activity.code} · ${report.activity.name}` : "No activity"}
          />
          <Kpi
            icon={<Truck size={18} />}
            label="EVIT Selection"
            value={report.selectedEvitNumbers.length.toString()}
            helper={report.selectedEvitNumbers.join(", ") || "No EVIT selected"}
          />
          <Kpi
            icon={<BarChart3 size={18} />}
            label="Cost per Ha"
            value={`RM ${formatCostbookCurrency(report.totals.costPerHectare)}`}
            helper={`${formatCostbookNumber(report.totals.hectares)} Ha covered`}
          />
        </div>

        <section className="data-panel costbook-report-panel">
          <div className="panel-heading">
            <div>
              <h3>{report.activity ? `${report.activity.code} · ${report.activity.name}` : "Costbook detail"}</h3>
              <p>{report.monthLabel} · {itemCountLabel(report.selectedFieldCodes.length, "field")} selected · Values shown in RM · Use + to expand supporting rows</p>
            </div>
          </div>
          <div className="costbook-section-focus" role="group" aria-label="Costbook section focus">
            <span>Section focus</span>
            <div>
              {costbookViewModes.map((mode) => (
                <button
                  className={mode.value}
                  type="button"
                  aria-pressed={viewMode === mode.value}
                  key={mode.value}
                  onClick={() => changeViewMode(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
          {report.days.length ? (
            <div className="wide-table-scroll costbook-table-scroll" ref={tableScrollRef}>
              <table className={`costbook-table costbook-view-${viewMode}${activeDetail ? ` costbook-active-${activeDetail.section}` : ""}`}>
                <thead>
                  <tr className="costbook-group-heading">
                    <th className="costbook-date-heading" rowSpan={2} scope="col">Date</th>
                    <th className="costbook-field-heading" rowSpan={2} scope="col">Field</th>
                    <th className="costbook-hectare-heading" rowSpan={2} scope="col">Hectare (Ha)</th>
                    {visibleSections.labour ? <th className={`costbook-labour-heading${activeDetail?.section === "labour" ? " is-active" : ""}`} colSpan={10} scope="colgroup">Labour</th> : null}
                    {visibleSections.material ? <th className={`costbook-material-heading${activeDetail?.section === "material" ? " is-active" : ""}`} colSpan={7} scope="colgroup">Material</th> : null}
                    {visibleSections.evit ? <th className={`costbook-evit-heading${activeDetail?.section === "evit" ? " is-active" : ""}`} colSpan={8} scope="colgroup">EVIT</th> : null}
                    {visibleSections.summary ? <th className={`costbook-summary-heading${viewMode === "summary" ? " is-active" : ""}`} colSpan={7} scope="colgroup">Summary</th> : null}
                  </tr>
                  <tr className="costbook-column-heading">
                    {visibleSections.labour ? (
                      <>
                        <th scope="col">Mandays</th>
                        <th scope="col">Rate Type</th>
                        <th scope="col">Rate</th>
                        <th scope="col">Amount</th>
                        <th scope="col">OT Rate</th>
                        <th scope="col">OT Hours</th>
                        <th scope="col">OT Amount</th>
                        <th scope="col">Labour Total Today</th>
                        <th scope="col">Month to Date</th>
                        <th scope="col">Cost/Ha</th>
                      </>
                    ) : null}
                    {visibleSections.material ? (
                      <>
                        <th scope="col">Material / Fertiliser</th>
                        <th scope="col">Material Number</th>
                        <th scope="col">Unit Price</th>
                        <th scope="col">Quantity</th>
                        <th scope="col">Material Cost</th>
                        <th scope="col">Month to Date</th>
                        <th scope="col">Cost/Ha</th>
                      </>
                    ) : null}
                    {visibleSections.evit ? (
                      <>
                        <th scope="col">EVIT No.</th>
                        <th scope="col">Hours</th>
                        <th scope="col">Rate/Hour</th>
                        <th scope="col">Running Hour Cost</th>
                        <th scope="col">EVIT Cost</th>
                        <th scope="col">EVIT Total Today</th>
                        <th scope="col">Month to Date</th>
                        <th scope="col">Cost/Ha</th>
                      </>
                    ) : null}
                    {visibleSections.summary ? (
                      <>
                        <th scope="col">Total Cost Today</th>
                        <th scope="col">Total Cost to Date</th>
                        <th scope="col">Ha Cover Today</th>
                        <th scope="col">Ha Cover to Date</th>
                        <th scope="col">Cost/Ha Today</th>
                        <th scope="col">Cost/Ha to Date</th>
                        <th scope="col">Remark</th>
                      </>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {dateGroups.map((days, dateGroupIndex) => (
                    <CostbookDateRows
                      activeDetail={activeDetail}
                      days={days}
                      dateGroupIndex={dateGroupIndex}
                      expandedSections={expandedSections}
                      key={days[0].date}
                      onToggle={toggleSection}
                      visibleSections={visibleSections}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th scope="row">Month Total</th>
                    <td className="costbook-field-total-cell">{itemCountLabel(report.selectedFieldCodes.length, "field")}</td>
                    <td className="costbook-hectare-total-cell">{formatCostbookNumber(report.totals.hectares)}</td>
                    {visibleSections.labour ? (
                      <>
                        <td colSpan={7}>Labour</td>
                        <td>—</td>
                        <td>{formatCostbookCurrency(report.totals.labour)}</td>
                        <td>{formatCostbookCurrency(report.totals.labourCostPerHectare)}</td>
                      </>
                    ) : null}
                    {visibleSections.material ? (
                      <>
                        <td colSpan={4}>Material</td>
                        <td>{formatCostbookCurrency(report.totals.material)}</td>
                        <td>{formatCostbookCurrency(report.totals.material)}</td>
                        <td>{formatCostbookCurrency(report.totals.materialCostPerHectare)}</td>
                      </>
                    ) : null}
                    {visibleSections.evit ? (
                      <>
                        <td colSpan={5}>Selected EVIT</td>
                        <td>{formatCostbookCurrency(report.totals.evit)}</td>
                        <td>{formatCostbookCurrency(report.totals.evit)}</td>
                        <td>{formatCostbookCurrency(report.totals.evitCostPerHectare)}</td>
                      </>
                    ) : null}
                    {visibleSections.summary ? (
                      <>
                        <td>—</td>
                        <td>{formatCostbookCurrency(report.totals.cost)}</td>
                        <td>—</td>
                        <td>{formatCostbookNumber(report.totals.hectares)}</td>
                        <td>—</td>
                        <td>{formatCostbookCurrency(report.totals.costPerHectare)}</td>
                        <td>Prototype</td>
                      </>
                    ) : null}
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <div className="costbook-empty">No dummy Costbook records match the selected activity, month and fields.</div>
          )}
        </section>
      </section>
    </ModuleShell>
  );
}

function CostbookMultiSelect({
  allLabel,
  label,
  options,
  selected,
  selectionNoun,
  onChange,
}: {
  allLabel: string;
  label: string;
  options: string[];
  selected: string[];
  selectionNoun: string;
  onChange: (next: string[]) => void;
}) {
  const validSelected = selected.filter((value) => options.includes(value));
  const allSelected = options.length > 0 && validSelected.length === options.length;
  const selectionLabel = allSelected
    ? `${allLabel} (${options.length})`
    : validSelected.length === 1
      ? validSelected[0]
      : `${validSelected.length} ${selectionNoun} selected`;

  const toggle = (option: string) => {
    if (validSelected.includes(option)) {
      if (validSelected.length === 1) return;
      onChange(validSelected.filter((value) => value !== option));
    } else {
      onChange([...validSelected, option].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })));
    }
  };

  return (
    <div className="costbook-multi-select-control">
      <span>{label}</span>
      <details>
        <summary>
          <span>{selectionLabel}</span>
          <ChevronDown aria-hidden="true" size={16} />
        </summary>
        <div className="costbook-multi-select-menu">
          <button className={allSelected ? "selected" : ""} type="button" onClick={() => onChange([...options])}>
            <span className="costbook-check-box">{allSelected ? <Check size={13} /> : null}</span>
            <strong>Select All</strong>
          </button>
          {options.map((option) => {
            const checked = validSelected.includes(option);
            return (
              <label key={option}>
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={checked && validSelected.length === 1}
                  onChange={() => toggle(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </details>
    </div>
  );
}

function Kpi({ icon, label, value, helper }: { icon: ReactNode; label: string; value: string; helper: string }) {
  return (
    <div className="kpi-item costbook-kpi-item">
      <span>{icon}{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}

function CostbookDateRows({
  activeDetail,
  days,
  dateGroupIndex,
  expandedSections,
  onToggle,
  visibleSections,
}: {
  activeDetail: { recordId: string; section: CostbookDetailSection } | null;
  days: CostbookDayReport[];
  dateGroupIndex: number;
  expandedSections: Set<string>;
  onToggle: (recordId: string, section: CostbookDetailSection) => void;
  visibleSections: CostbookVisibleSections;
}) {
  const expandedByRecord = days.map((day) => ({
    labour: expandedSections.has(detailSectionKey(day.id, "labour")),
    material: expandedSections.has(detailSectionKey(day.id, "material")),
    evit: expandedSections.has(detailSectionKey(day.id, "evit")),
  }));
  const dateRowSpan = days.reduce(
    (total, day, index) => total + getCostbookRecordRowCount(day, expandedByRecord[index], visibleSections),
    0,
  );

  return (
    <>
      {days.map((day, fieldIndex) => (
        <CostbookDayRows
          activeSection={activeDetail?.recordId === day.id ? activeDetail.section : null}
          day={day}
          dayIndex={dateGroupIndex}
          dateRowSpan={dateRowSpan}
          expanded={expandedByRecord[fieldIndex]}
          key={day.id}
          onToggle={(section) => onToggle(day.id, section)}
          showDate={fieldIndex === 0}
          visibleSections={visibleSections}
        />
      ))}
    </>
  );
}

function CostbookDayRows({
  activeSection,
  day,
  dayIndex,
  dateRowSpan,
  expanded,
  onToggle,
  showDate,
  visibleSections,
}: {
  activeSection: CostbookDetailSection | null;
  day: CostbookDayReport;
  dayIndex: number;
  dateRowSpan: number;
  expanded: Record<CostbookDetailSection, boolean>;
  onToggle: (section: CostbookDetailSection) => void;
  showDate: boolean;
  visibleSections: CostbookVisibleSections;
}) {
  const detailIds = {
    labour: `costbook-details-${day.id}-labour`,
    material: `costbook-details-${day.id}-material`,
    evit: `costbook-details-${day.id}-evit`,
  };
  const hasExpandedSection = (
    (visibleSections.labour && expanded.labour)
    || (visibleSections.material && expanded.material)
    || (visibleSections.evit && expanded.evit)
  );
  const recordRowSpan = getCostbookRecordRowCount(day, expanded, visibleSections);
  const evitHours = day.evitLines.reduce((total, line) => total + line.hours, 0);
  const evitRunningHourCost = day.evitLines.reduce((total, line) => total + line.operatingCost, 0);
  const evitAdditionalCost = day.evitLines.reduce((total, line) => total + line.evitCost, 0);

  return (
    <>
      <tr className={`${dayIndex % 2 ? "costbook-day-alt" : ""} ${showDate ? "costbook-day-start" : ""} costbook-summary-row`}>
        {showDate ? (
          <th className="costbook-date-cell" rowSpan={dateRowSpan} scope="rowgroup">
            <span>{formatCostbookDate(day.date)}</span>
          </th>
        ) : null}
        <td className="costbook-field-cell"><strong>{day.fieldCode}</strong></td>
        <td className="costbook-hectare-cell" rowSpan={recordRowSpan}>
          <strong>{formatCostbookNumber(day.hectaresCovered)}</strong>
        </td>
        {visibleSections.labour ? (
          <>
            <td
              className={`costbook-expandable-summary-cell labour${activeSection === "labour" ? " is-active" : ""}`}
              data-section-anchor={detailSectionKey(day.id, "labour")}
            >
              <SummaryExpandControl
                expanded={expanded.labour}
                label="labour"
                controls={detailIds.labour}
                date={day.date}
                fieldCode={day.fieldCode}
                onToggle={() => onToggle("labour")}
              >
                {formatCostbookNumber(day.mandays)}
              </SummaryExpandControl>
            </td>
            <td>—</td>
            <td>—</td>
            <td>{formatCostbookCurrency(day.labourAmount)}</td>
            <td>—</td>
            <td>{formatCostbookNumber(day.overtimeHours)}</td>
            <td>{formatCostbookCurrency(day.overtimeAmount)}</td>
            <td className="costbook-daily-total-cell labour">{formatCostbookCurrency(day.labourCostToday)}</td>
            <td className="costbook-mtd-cell">{formatCostbookCurrency(day.labourMonthToDate)}</td>
            <td>{formatCostbookCurrency(day.labourCostPerHectare)}</td>
          </>
        ) : null}
        {visibleSections.material ? (
          <>
            <td
              className={`costbook-line-label costbook-expandable-summary-cell material${activeSection === "material" ? " is-active" : ""}`}
              data-section-anchor={detailSectionKey(day.id, "material")}
            >
              <SummaryExpandControl
                expanded={expanded.material}
                label="material"
                controls={detailIds.material}
                date={day.date}
                fieldCode={day.fieldCode}
                onToggle={() => onToggle("material")}
              >
                {itemCountLabel(day.materialLines.length, "item")}
              </SummaryExpandControl>
            </td>
            <td>—</td>
            <td>—</td>
            <td>—</td>
            <td className="costbook-daily-total-cell material">{formatCostbookCurrency(day.materialCostToday)}</td>
            <td className="costbook-mtd-cell">{formatCostbookCurrency(day.materialMonthToDate)}</td>
            <td>{formatCostbookCurrency(day.materialCostPerHectare)}</td>
          </>
        ) : null}
        {visibleSections.evit ? (
          <>
            <td
              className={`costbook-evit-number costbook-expandable-summary-cell evit${activeSection === "evit" ? " is-active" : ""}`}
              data-section-anchor={detailSectionKey(day.id, "evit")}
            >
              <SummaryExpandControl
                expanded={expanded.evit}
                label="EVIT"
                controls={detailIds.evit}
                date={day.date}
                fieldCode={day.fieldCode}
                onToggle={() => onToggle("evit")}
              >
                {itemCountLabel(day.evitLines.length, "machine")}
              </SummaryExpandControl>
            </td>
            <td>{formatCostbookNumber(evitHours)}</td>
            <td>—</td>
            <td className="costbook-running-cost-cell">{formatCostbookCurrency(evitRunningHourCost)}</td>
            <td>{formatCostbookCurrency(evitAdditionalCost)}</td>
            <td className="costbook-daily-total-cell evit">{formatCostbookCurrency(day.evitCostToday)}</td>
            <td className="costbook-mtd-cell">{formatCostbookCurrency(day.evitMonthToDate)}</td>
            <td>{formatCostbookCurrency(day.evitCostPerHectare)}</td>
          </>
        ) : null}
        {visibleSections.summary ? (
          <>
            <td className="costbook-summary-value">{formatCostbookCurrency(day.totalCostToday)}</td>
            <td className="costbook-summary-value">{formatCostbookCurrency(day.totalCostToDate)}</td>
            <td>{formatCostbookNumber(day.hectaresCovered)}</td>
            <td>{formatCostbookNumber(day.hectaresToDate)}</td>
            <td>{formatCostbookCurrency(day.costPerHectareToday)}</td>
            <td>{formatCostbookCurrency(day.costPerHectareToDate)}</td>
            <td className="costbook-remark">{day.remark || "-"}</td>
          </>
        ) : null}
      </tr>
      {hasExpandedSection ? (
        <CostbookInlineDetailRows
          activeSection={activeSection}
          day={day}
          expanded={expanded}
          ids={detailIds}
          visibleSections={visibleSections}
        />
      ) : null}
    </>
  );
}

function SummaryExpandControl({
  children,
  controls,
  date,
  expanded,
  fieldCode,
  label,
  onToggle,
}: {
  children: ReactNode;
  controls: string;
  date: string;
  expanded: boolean;
  fieldCode: string;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className="costbook-summary-expand-control">
      <span>{children}</span>
      <button
        className="costbook-cell-expand-button"
        type="button"
        aria-controls={controls}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${label} details for ${formatCostbookDate(date)}, field ${fieldCode}`}
        onClick={onToggle}
      >
        {expanded ? <Minus aria-hidden="true" size={13} /> : <Plus aria-hidden="true" size={13} />}
      </button>
    </div>
  );
}

function CostbookInlineDetailRows({
  activeSection,
  day,
  expanded,
  ids,
  visibleSections,
}: {
  activeSection: CostbookDetailSection | null;
  day: CostbookDayReport;
  expanded: Record<CostbookDetailSection, boolean>;
  ids: Record<CostbookDetailSection, string>;
  visibleSections: CostbookVisibleSections;
}) {
  return (
    <>
      {visibleSections.labour && expanded.labour ? (
        <>
          {day.workerLines.map((worker, index) => (
            <tr
              className={`costbook-inline-detail-row labour${activeSection === "labour" ? " is-active-detail" : ""}${worker.rateType === "Supervision Rate" ? " supervision" : ""}${worker.overtimeHours > 0 ? " has-overtime" : ""}`}
              id={index === 0 ? ids.labour : undefined}
              key={`labour-${worker.workerId}`}
            >
              <InlineDetailLabel
                category={worker.rateType === "Supervision Rate" ? "Supervisor" : "Worker"}
                code={worker.workerId}
                fieldCode={day.fieldCode}
                name={worker.workerName}
              />
              <td>{formatCostbookNumber(worker.mandays)}</td>
              <td className="costbook-rate-type">{worker.rateType}</td>
              <td>{formatCostbookCurrency(worker.rate)}</td>
              <td>{formatCostbookCurrency(worker.labourAmount)}</td>
              <td>{worker.overtimeRate > 0 ? formatCostbookCurrency(worker.overtimeRate) : "—"}</td>
              <td>{formatCostbookNumber(worker.overtimeHours)}</td>
              <td>{formatCostbookCurrency(worker.overtimeAmount)}</td>
              <td className="costbook-inline-line-total">{formatCostbookCurrency(worker.totalAmount)}</td>
              <td>—</td>
              <td>{formatCostbookCurrency(divideForDisplay(worker.totalAmount, day.hectaresCovered))}</td>
              {visibleSections.material ? <td className="costbook-inline-empty" colSpan={7} /> : null}
              {visibleSections.evit ? <td className="costbook-inline-empty" colSpan={8} /> : null}
              {visibleSections.summary ? <td className="costbook-inline-empty" colSpan={7} /> : null}
            </tr>
          ))}
        </>
      ) : null}

      {visibleSections.material && expanded.material ? day.materialLines.map((material, index) => (
        <tr
          className={`costbook-inline-detail-row material${activeSection === "material" ? " is-active-detail" : ""}`}
          id={index === 0 ? ids.material : undefined}
          key={`material-${material.id}`}
        >
          <InlineDetailLabel category="Material" code={`Line ${index + 1}`} fieldCode={day.fieldCode} />
          {visibleSections.labour ? <td className="costbook-inline-empty" colSpan={10} /> : null}
          <td className="costbook-inline-text-value"><strong>{material.name}</strong></td>
          <td className="costbook-material-number"><strong>{material.id}</strong></td>
          <td>{formatCostbookCurrency(material.unitPrice)}</td>
          <td>{formatCostbookNumber(material.quantity)} {material.unit}</td>
          <td>{formatCostbookCurrency(material.materialCost)}</td>
          <td>—</td>
          <td>{formatCostbookCurrency(material.costPerHectare)}</td>
          {visibleSections.evit ? <td className="costbook-inline-empty" colSpan={8} /> : null}
          {visibleSections.summary ? <td className="costbook-inline-empty" colSpan={7} /> : null}
        </tr>
      )) : null}

      {visibleSections.evit && expanded.evit ? (
        day.evitLines.length ? day.evitLines.map((evit, index) => (
          <tr
            className={`costbook-inline-detail-row evit${activeSection === "evit" ? " is-active-detail" : ""}`}
            id={index === 0 ? ids.evit : undefined}
            key={`evit-${evit.evitNumber}`}
          >
            <InlineDetailLabel category="Machine" code={`Line ${index + 1}`} fieldCode={day.fieldCode} />
            {visibleSections.labour ? <td className="costbook-inline-empty" colSpan={10} /> : null}
            {visibleSections.material ? <td className="costbook-inline-empty" colSpan={7} /> : null}
            <td className="costbook-inline-text-value"><strong>{evit.evitNumber}</strong></td>
            <td>{formatCostbookNumber(evit.hours)}</td>
            <td>{formatCostbookCurrency(evit.ratePerHour)}</td>
            <td>{formatCostbookCurrency(evit.operatingCost)}</td>
            <td>{formatCostbookCurrency(evit.evitCost)}</td>
            <td className="costbook-inline-line-total">{formatCostbookCurrency(evit.totalCost)}</td>
            <td>—</td>
            <td>{formatCostbookCurrency(evit.costPerHectare)}</td>
            {visibleSections.summary ? <td className="costbook-inline-empty" colSpan={7} /> : null}
          </tr>
        )) : (
          <tr className={`costbook-inline-detail-row evit${activeSection === "evit" ? " is-active-detail" : ""}`} id={ids.evit}>
            <InlineDetailLabel category="EVIT" code="No usage" fieldCode={day.fieldCode} />
            {visibleSections.labour ? <td className="costbook-inline-empty" colSpan={10} /> : null}
            {visibleSections.material ? <td className="costbook-inline-empty" colSpan={7} /> : null}
            <td className="costbook-inline-empty-message" colSpan={8}>No selected EVIT usage for this date.</td>
            {visibleSections.summary ? <td className="costbook-inline-empty" colSpan={7} /> : null}
          </tr>
        )
      ) : null}
    </>
  );
}

function InlineDetailLabel({
  category,
  code,
  fieldCode,
  name,
  note,
}: {
  category: string;
  code: string;
  fieldCode: string;
  name?: string;
  note?: string;
}) {
  return (
    <th className="costbook-inline-detail-label" scope="row">
      <span>{fieldCode} · {category}</span>
      <strong>{code}</strong>
      {name ? <small>{name}</small> : null}
      {note ? <em>{note}</em> : null}
    </th>
  );
}

function groupCostbookDays(days: CostbookDayReport[]) {
  return days.reduce<CostbookDayReport[][]>((groups, day) => {
    const currentGroup = groups.at(-1);
    if (currentGroup?.[0].date === day.date) {
      currentGroup.push(day);
    } else {
      groups.push([day]);
    }
    return groups;
  }, []);
}

function getCostbookRecordRowCount(
  day: CostbookDayReport,
  expanded: Record<CostbookDetailSection, boolean>,
  visibleSections: CostbookVisibleSections,
) {
  return 1
    + (visibleSections.labour && expanded.labour ? day.workerLines.length : 0)
    + (visibleSections.material && expanded.material ? day.materialLines.length : 0)
    + (visibleSections.evit && expanded.evit ? Math.max(day.evitLines.length, 1) : 0);
}

function getCostbookVisibleSections(viewMode: CostbookViewMode): CostbookVisibleSections {
  return {
    labour: viewMode === "all" || viewMode === "labour",
    material: viewMode === "all" || viewMode === "material",
    evit: viewMode === "all" || viewMode === "evit",
    summary: viewMode === "all" || viewMode === "summary",
  };
}

function focusCostbookSection(container: HTMLDivElement | null, sectionKey: string) {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const anchor = Array.from(container?.querySelectorAll<HTMLElement>("[data-section-anchor]") || [])
        .find((element) => element.dataset.sectionAnchor === sectionKey);
      if (!container || !anchor) return;
      const fixedColumnWidth = window.matchMedia("(max-width: 720px)").matches ? 192 : 344;
      const relativeLeft = anchor.getBoundingClientRect().left - container.getBoundingClientRect().left;
      container.scrollTo({
        left: Math.max(0, container.scrollLeft + relativeLeft - fixedColumnWidth - 12),
        behavior: "smooth",
      });
    });
  });
}

function itemCountLabel(count: number, singular: string) {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function divideForDisplay(cost: number, hectares: number) {
  return hectares > 0 ? cost / hectares : 0;
}

function csvHeaders() {
  return [
    "Date", "Field", "Hectare (Ha)", "Mandays", "Rate Type", "Labour Rate", "Labour Amount", "OT Rate", "OT Hours", "OT Amount",
    "Labour Total Today", "Labour Month to Date", "Labour Cost/Ha",
    "Material / Fertiliser", "Material Number", "Unit Price", "Quantity", "Unit", "Material Cost", "Material Month to Date", "Material Cost/Ha",
    "EVIT Number", "Hours", "Rate/Hour", "Running Hour Cost", "EVIT Cost", "EVIT Total", "EVIT Month to Date", "EVIT Cost/Ha",
    "Total Cost Today", "Total Cost to Date", "Ha Cover Today", "Ha Cover to Date", "Cost/Ha Today", "Cost/Ha to Date", "Remark",
  ];
}

function buildCsvRows(day: CostbookDayReport) {
  const lineCount = Math.max(day.materialLines.length, day.evitLines.length, 1);
  return Array.from({ length: lineCount }, (_, lineIndex) => {
    const material = day.materialLines[lineIndex];
    const evit = day.evitLines[lineIndex];
    const firstLine = lineIndex === 0;
    return [
      firstLine ? formatCostbookDate(day.date) : "",
      firstLine ? day.fieldCode : "",
      firstLine ? day.hectaresCovered : "",
      firstLine ? day.mandays : "",
      "",
      "",
      firstLine ? day.labourAmount : "",
      "",
      firstLine ? day.overtimeHours : "",
      firstLine ? day.overtimeAmount : "",
      firstLine ? day.labourCostToday : "",
      firstLine ? day.labourMonthToDate : "",
      firstLine ? day.labourCostPerHectare : "",
      material?.name || "",
      material?.id || "",
      material?.unitPrice ?? "",
      material?.quantity ?? "",
      material?.unit || "",
      material?.materialCost ?? "",
      firstLine ? day.materialMonthToDate : "",
      material?.costPerHectare ?? "",
      evit?.evitNumber || "",
      evit?.hours ?? "",
      evit?.ratePerHour ?? "",
      evit?.operatingCost ?? "",
      evit?.evitCost ?? "",
      evit?.totalCost ?? "",
      firstLine ? day.evitMonthToDate : "",
      evit?.costPerHectare ?? "",
      firstLine ? day.totalCostToday : "",
      firstLine ? day.totalCostToDate : "",
      firstLine ? day.hectaresCovered : "",
      firstLine ? day.hectaresToDate : "",
      firstLine ? day.costPerHectareToday : "",
      firstLine ? day.costPerHectareToDate : "",
      firstLine ? day.remark : "",
    ];
  });
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
