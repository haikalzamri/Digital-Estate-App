"use client";

import { CalendarDays, Download, Grid2X2, Sprout } from "lucide-react";
import { useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import sourceJson from "@/lib/data/harvesting-interval-source.json";
import {
  formatHarvestingMonth,
  getDefaultHarvestingMonth,
  getHarvestingDayGroups,
  getHarvestingIntervalReport,
} from "@/lib/harvesting-interval/report";
import type { HarvestingIntervalSource } from "@/lib/types/harvesting-interval";

const source = sourceJson as HarvestingIntervalSource;

export function HarvestingIntervalDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(getDefaultHarvestingMonth(source));
  const report = useMemo(() => getHarvestingIntervalReport(source, selectedMonth), [selectedMonth]);
  const dayGroups = useMemo(() => getHarvestingDayGroups(report.fields), [report.fields]);

  const exportCsv = () => {
    const headers = ["Date", "Day", ...report.fields.map((field) => field.field)];
    const rows = report.days.map((day, rowIndex) => [
      day.date,
      day.dayName,
      ...report.fields.map((field) => {
        const cell = field.cells[rowIndex];
        return cell.harvest ? "H" : String(cell.interval);
      }),
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `harvesting-interval-${selectedMonth}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      audience="management"
      title="Harvesting Interval"
      subtitle="Monthly field interval report using QC and C1 harvesting activity"
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
            <button className="command-button" type="button" onClick={exportCsv}>
              <Download aria-hidden="true" size={16} /> Export
            </button>
          </div>
        </div>

        <div className="kpi-strip harvesting-kpi-strip">
          <Kpi label="Selected month" value={report.monthLabel} helper={`${report.days.length} calendar days`} icon={<CalendarDays size={18} />} />
          <Kpi label="QC + C1 activities" value={report.sourceActivityCount.toString()} helper={`${report.sourceActiveFields} active fields`} icon={<Sprout size={18} />} />
          <Kpi label="Display fields" value={report.fields.length.toString()} helper="Screenshot template fields" icon={<Grid2X2 size={18} />} />
          <div className="kpi-item data-source-kpi">
            <span>Data source</span>
            <strong>{source.metadata.activitySourceFile}</strong>
            <small>Data through {source.metadata.lastActivityDate}</small>
          </div>
        </div>

        <section className="data-panel harvesting-report-panel">
          <div className="panel-heading">
            <div>
              <h3>Monthly Interval Grid</h3>
              <p>Base date {source.metadata.baseDate} | H = QC or C1 harvesting activity</p>
            </div>
          </div>
          <div className="wide-table-scroll harvesting-table-scroll">
            <table className="harvesting-table" style={{ minWidth: `${135 + report.fields.length * 58}px` }}>
              <thead>
                <tr className="harvesting-report-title">
                  <th colSpan={report.fields.length + 1}>DIGITAL ESTATE HARVESTING INTERVAL | {report.monthLabel.toUpperCase()}</th>
                </tr>
                <tr>
                  <th className="harvesting-sticky-col" rowSpan={3}>Date</th>
                  {dayGroups.map((group, index) => (
                    <th className="harvesting-block-heading" colSpan={group.span} key={`${group.block}-${index}`}>
                      {group.label}
                    </th>
                  ))}
                </tr>
                <tr>
                  {dayGroups.map((group, index) => (
                    <th className="harvesting-group-ha" colSpan={group.span} key={`${group.block}-ha-${index}`}>
                      {group.totalHectares == null ? "-" : group.totalHectares.toFixed(2)}
                    </th>
                  ))}
                </tr>
                <tr>
                  {report.fields.map((field) => (
                    <th key={`${field.id}-field`}>{field.field}</th>
                  ))}
                </tr>
                <tr>
                  <th className="harvesting-sticky-col">HA</th>
                  {report.fields.map((field) => (
                    <th key={`${field.id}-ha`}>{field.hectares == null ? "-" : field.hectares.toFixed(2)}</th>
                  ))}
                </tr>
                <tr>
                  <th className="harvesting-sticky-col">B/F</th>
                  {report.fields.map((field) => (
                    <th className={field.hasReferenceBaseline ? "" : "baseline-missing"} key={`${field.id}-bf`}>
                      {field.bfDisplay || field.baseInterval}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.days.map((day, rowIndex) => (
                  <tr className={day.isSunday ? "sunday-row" : ""} key={day.date}>
                    <th className="harvesting-sticky-col">
                      <span>{day.day}</span>
                      <small>{day.dayName}</small>
                    </th>
                    {report.fields.map((field) => {
                      const cell = field.cells[rowIndex];
                      return (
                        <td
                          className={cell.harvest ? "harvest-cell" : ""}
                          key={`${field.id}-${cell.date}`}
                          title={`${field.field} · ${cell.date} · interval ${cell.interval}`}
                        >
                          {cell.harvest ? "H" : cell.interval}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </ModuleShell>
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

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
