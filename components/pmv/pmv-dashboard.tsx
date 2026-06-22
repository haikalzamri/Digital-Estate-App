"use client";

import { AlertTriangle, CheckCircle2, CirclePause, Download, ListChecks, Truck, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { usePmvData } from "@/components/pmv/use-pmv-data";
import {
  countValues,
  dateWindow,
  filterPmvRecords,
  filterPmvWindow,
  formatPmvDate,
  groupMachineReporters,
  hasPmvActionIssue,
  latestPmvDate,
  pmvActionReasons,
  pmvExportHeaders,
  pmvExportRow,
  uniqueMachineCount,
} from "@/lib/pmv/dashboard";
import { PMV_CHECKLIST_ITEMS, PMV_STATUS_LABELS } from "@/lib/pmv/config";
import { sortPmvRecordsDescending } from "@/lib/pmv/records";
import type { PmvRecord, PmvStatus } from "@/lib/types/pmv";

type SummaryType = "reported" | "working" | "breakdown" | "idle" | "action";

export function PmvDashboard() {
  const data = usePmvData();
  const [selectedDate, setSelectedDate] = useState("");
  const [machineFilter, setMachineFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<PmvStatus | "">("");
  const [summaryType, setSummaryType] = useState<SummaryType | null>(null);
  const [syncing, setSyncing] = useState(false);

  const dashboardDate = selectedDate || latestPmvDate(data.records);
  const machineValues = useMemo(
    () => [...new Set(data.records.map((record) => record.machineNumber).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [data.records],
  );
  const dailyRecords = useMemo(
    () => filterPmvRecords(data.records, { date: dashboardDate, machine: machineFilter, status: statusFilter }),
    [dashboardDate, data.records, machineFilter, statusFilter],
  );
  const working = dailyRecords.filter((record) => record.machineStatus === "working");
  const breakdown = dailyRecords.filter((record) => record.machineStatus === "breakdown");
  const idle = dailyRecords.filter((record) => record.machineStatus === "idle");
  const attention = dailyRecords.filter(hasPmvActionIssue);
  const window30 = useMemo(
    () => filterPmvWindow(data.records, dashboardDate, 30, { machine: machineFilter, status: statusFilter }),
    [dashboardDate, data.records, machineFilter, statusFilter],
  );

  const modalRecords = summaryType === "working" ? working
    : summaryType === "breakdown" ? breakdown
      : summaryType === "idle" ? idle
        : summaryType === "action" ? attention
          : dailyRecords;

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await data.syncPending();
    } finally {
      setSyncing(false);
    }
  }, [data]);

  const exportDashboard = () => {
    if (!dailyRecords.length) return;
    const headers = pmvExportHeaders();
    const csv = [headers, ...[...dailyRecords].sort(sortPmvRecordsDescending).map((record) => {
      const row = pmvExportRow(record);
      return headers.map((header) => row[header] || "");
    })].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `pmv-dashboard-${dashboardDate}${machineFilter ? `-${machineFilter}` : ""}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModuleShell
      audience="management"
      title="PMV Dashboard"
      subtitle="Daily machine readiness, breakdown causes, idle status and manager action tracking"
      onSync={sync}
      syncBusy={syncing}
    >
      <section className="pmv-dashboard-workspace" aria-labelledby="pmv-dashboard-heading">
        <div className="workspace-toolbar">
          <div className="section-heading">
            <p>Management overview</p>
            <h2 id="pmv-dashboard-heading">Fleet readiness and action</h2>
          </div>
          <div className="toolbar-actions pmv-dashboard-filters">
            <label className="compact-select"><span>Report date</span><input type="date" value={dashboardDate} onChange={(event) => setSelectedDate(event.target.value)} /></label>
            <label className="compact-select"><span>Machine</span><select value={machineFilter} onChange={(event) => setMachineFilter(event.target.value)}><option value="">All machines</option>{machineValues.map((machine) => <option key={machine}>{machine}</option>)}</select></label>
            <label className="compact-select"><span>Status</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as PmvStatus | "")}><option value="">All statuses</option><option value="working">Working</option><option value="breakdown">Breakdown</option><option value="idle">Idle</option></select></label>
            <button className="command-button" type="button" onClick={exportDashboard} disabled={!dailyRecords.length}><Download size={16} /> Export</button>
          </div>
        </div>

        <div className="pmv-data-state"><span className={data.loading ? "loading-dot" : "online-dot"} />{data.loading ? "Loading PMV records" : `${data.source} · ${formatPmvDate(dashboardDate)}`}</div>

        <div className="pmv-metric-strip">
          <Metric label="Machines Reported" value={uniqueMachineCount(dailyRecords)} helper={`${dailyRecords.length} reports`} tone="neutral" icon={<Truck size={19} />} onClick={() => setSummaryType("reported")} />
          <Metric label="Working" value={uniqueMachineCount(working)} helper={`${working.length} reports`} tone="good" icon={<CheckCircle2 size={19} />} onClick={() => setSummaryType("working")} />
          <Metric label="Breakdown" value={uniqueMachineCount(breakdown)} helper={`${breakdown.length} reports`} tone="bad" icon={<AlertTriangle size={19} />} onClick={() => setSummaryType("breakdown")} />
          <Metric label="Idle" value={uniqueMachineCount(idle)} helper={`${idle.length} reports`} tone="warn" icon={<CirclePause size={19} />} onClick={() => setSummaryType("idle")} />
          <Metric label="Need Action" value={attention.length} helper="Issues requiring review" tone="bad" icon={<ListChecks size={19} />} onClick={() => setSummaryType("action")} />
        </div>

        <div className="pmv-management-grid">
          <section className="data-panel pmv-action-panel">
            <PanelHeading title="Manager Action Queue" description="Breakdown, idle, low battery and Kurang Baik reports for the selected date." />
            <ActionQueue records={attention} />
          </section>

          <section className="data-panel">
            <PanelHeading title="Breakdown Reasons" description="Components reported for the selected date." />
            <RankList rows={countValues(breakdown.flatMap((record) => record.damagedComponents?.length ? record.damagedComponents : ["No component captured"]))} empty="No breakdown reasons for this selection." />
          </section>

          <section className="data-panel">
            <PanelHeading title="14-Day Status Trend" description="Daily mix of Working, Breakdown and Idle reports." />
            <StatusTrend records={data.records} endDate={dashboardDate} machine={machineFilter} status={statusFilter} />
          </section>

          <section className="data-panel">
            <PanelHeading title="Repeated Machine Issues" description="Machines with action issues in the previous 30 days." />
            <RepeatIssues records={window30.filter(hasPmvActionIssue)} />
          </section>

          <section className="data-panel">
            <PanelHeading title="Checklist Risk" description="Most frequent Kurang Baik checks in the previous 30 days." />
            <RankList rows={countValues(PMV_CHECKLIST_ITEMS.flatMap((item) => window30.filter((record) => record.checklist?.[item.key] === "Kurang Baik").map(() => item.label)))} empty="No Kurang Baik checklist item in this period." />
          </section>
        </div>

        <section className="data-panel pmv-record-table-panel">
          <PanelHeading title="Daily Reports" description="Latest reports matching the selected filters." />
          <div className="wide-table-scroll">
            <table className="pmv-dashboard-table">
              <thead><tr><th>Date</th><th>Machine</th><th>Status</th><th>Reporter</th><th>Issue / Action</th><th>Notes</th></tr></thead>
              <tbody>
                {dailyRecords.length ? [...dailyRecords].sort(sortPmvRecordsDescending).slice(0, 30).map((record) => (
                  <tr key={record.id}><td>{formatPmvDate(record.reportDate)}</td><td><strong>{record.machineNumber || "-"}</strong></td><td><StatusPill status={record.machineStatus} /></td><td>{record.reporterName || "-"}</td><td>{pmvActionReasons(record).join(", ") || "No issue reported"}</td><td>{record.assistantNotes || "-"}</td></tr>
                )) : <tr><td className="pmv-empty" colSpan={6}>No PMV records match the selected filters.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>

      {summaryType ? <SummaryModal type={summaryType} records={modalRecords} date={dashboardDate} onClose={() => setSummaryType(null)} /> : null}
    </ModuleShell>
  );
}

function Metric({ label, value, helper, tone, icon, onClick }: { label: string; value: number; helper: string; tone: string; icon: React.ReactNode; onClick: () => void }) {
  return <button className={`pmv-dashboard-metric ${tone}`} type="button" onClick={onClick}><span>{icon}{label}</span><strong>{value}</strong><small>{helper}</small></button>;
}

function PanelHeading({ title, description }: { title: string; description: string }) {
  return <div className="panel-heading"><div><h3>{title}</h3><p>{description}</p></div></div>;
}

function StatusPill({ status }: { status: PmvStatus }) {
  return <span className={`pmv-dashboard-status ${status}`}>{PMV_STATUS_LABELS[status]}</span>;
}

function ActionQueue({ records }: { records: PmvRecord[] }) {
  const sorted = [...records].sort((a, b) => ({ breakdown: 0, idle: 1, working: 2 }[a.machineStatus] - { breakdown: 0, idle: 1, working: 2 }[b.machineStatus]) || a.machineNumber.localeCompare(b.machineNumber, undefined, { numeric: true })).slice(0, 12);
  if (!sorted.length) return <div className="pmv-empty"><CheckCircle2 size={21} />No manager action required for this selection.</div>;
  return <div className="pmv-action-list">{sorted.map((record) => <div className="pmv-action-row" key={record.id}><StatusPill status={record.machineStatus} /><div><strong>{record.machineNumber}</strong><span>{record.reporterName} · {formatPmvDate(record.reportDate)}</span></div><p>{pmvActionReasons(record).join(", ")}</p>{record.assistantNotes ? <em>{record.assistantNotes}</em> : null}</div>)}</div>;
}

function RankList({ rows, empty }: { rows: Array<{ label: string; count: number }>; empty: string }) {
  if (!rows.length) return <div className="pmv-empty">{empty}</div>;
  const max = Math.max(...rows.map((row) => row.count), 1);
  return <div className="pmv-rank-list">{rows.map((row) => <div className="pmv-rank-row-next" key={row.label}><span>{row.label}</span><div><i style={{ width: `${(row.count / max) * 100}%` }} /></div><strong>{row.count}</strong></div>)}</div>;
}

function StatusTrend({ records, endDate, machine, status }: { records: PmvRecord[]; endDate: string; machine: string; status: PmvStatus | "" }) {
  const rows = dateWindow(endDate, 14).map((date) => {
    const day = filterPmvRecords(records, { date, machine, status });
    return { date, working: day.filter((record) => record.machineStatus === "working").length, breakdown: day.filter((record) => record.machineStatus === "breakdown").length, idle: day.filter((record) => record.machineStatus === "idle").length };
  });
  return <div className="pmv-trend"><div className="pmv-trend-legend"><span className="working">Working</span><span className="breakdown">Breakdown</span><span className="idle">Idle</span></div>{rows.map((row) => { const total = row.working + row.breakdown + row.idle; return <div className="pmv-trend-row-next" key={row.date}><span>{formatPmvDate(row.date, true)}</span><div aria-label={`${formatPmvDate(row.date)}: ${total} reports`}>{total ? <><i className="working" style={{ width: `${(row.working / total) * 100}%` }} /><i className="breakdown" style={{ width: `${(row.breakdown / total) * 100}%` }} /><i className="idle" style={{ width: `${(row.idle / total) * 100}%` }} /></> : null}</div><strong>{total}</strong></div>; })}</div>;
}

function RepeatIssues({ records }: { records: PmvRecord[] }) {
  const grouped = new Map<string, PmvRecord[]>();
  records.forEach((record) => grouped.set(record.machineNumber, [...(grouped.get(record.machineNumber) || []), record]));
  const rows = [...grouped.entries()].map(([machine, machineRecords]) => ({ machine, count: machineRecords.length, breakdowns: machineRecords.filter((record) => record.machineStatus === "breakdown").length, reasons: countValues(machineRecords.flatMap(pmvActionReasons), 3).map((item) => item.label) })).sort((a, b) => b.count - a.count || a.machine.localeCompare(b.machine, undefined, { numeric: true })).slice(0, 8);
  if (!rows.length) return <div className="pmv-empty">No repeated machine issue in the previous 30 days.</div>;
  return <div className="pmv-repeat-list-next">{rows.map((row) => <div key={row.machine}><strong>{row.machine}</strong><span>{row.count} issue reports · {row.breakdowns} breakdown</span><small>{row.reasons.join(", ") || "No reason captured"}</small></div>)}</div>;
}

function SummaryModal({ type, records, date, onClose }: { type: SummaryType; records: PmvRecord[]; date: string; onClose: () => void }) {
  const titles: Record<SummaryType, string> = { reported: "Machines Reported", working: "Working Machines", breakdown: "Breakdown Machines", idle: "Idle Machines", action: "Machines Needing Action" };
  const rows = groupMachineReporters(records);
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal-card pmv-summary-modal" role="dialog" aria-modal="true" aria-labelledby="pmv-summary-title" onMouseDown={(event) => event.stopPropagation()}><div className="modal-heading"><div><p className="eyebrow">{formatPmvDate(date)} · {rows.length} machines</p><h2 id="pmv-summary-title">{titles[type]}</h2></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close machine list"><X size={18} /></button></div><div className="pmv-summary-list-next">{rows.length ? rows.map((row) => <div key={row.machine}><strong>{row.machine}</strong><span>{row.names.join(", ")}</span></div>) : <div className="pmv-empty">No machine found for this selection.</div>}</div></div></div>;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
