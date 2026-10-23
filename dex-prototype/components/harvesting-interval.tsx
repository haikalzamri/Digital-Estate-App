"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ClipboardList, Table2 } from "lucide-react";
import {
  harvestSource, harvestFieldNames, harvestingFieldArea, harvestStatus, harvestTone,
  getHarvestingIntervalReport, getHarvestingDayGroups,
  type HarvestingIntervalMetricKey, type HarvestingIntervalActivityMetrics,
} from "@/lib/harvesting-interval";
import { harvestForSession, completionWorks, latestReport } from "@/lib/work-completion";
import { activities, formatHa, formatDate, type Session, type PlanItem } from "@/lib/workshop";

type Props = {
  session: Session; items: PlanItem[]; planningDate: string; canEdit: boolean; activityCode: string;
  onActivity: (code: string) => void; onToggleField: (field: string) => void;
};
const metrics: { key: HarvestingIntervalMetricKey; label: string }[] = [
  { key: "hectare", label: "Ha" }, { key: "bunches", label: "Bunches" }, { key: "tonnage", label: "Tonnage" },
];
function value(n: number | null, metric: HarvestingIntervalMetricKey) {
  if (n == null) return "Pending";
  return n.toLocaleString("en-MY", { maximumFractionDigits: metric === "bunches" ? 0 : metric === "tonnage" ? 3 : 2 });
}

export function HarvestingInterval({ session, items, planningDate, canEdit, activityCode, onActivity, onToggleField }: Props) {
  const [view, setView] = useState<"interval" | "status">("interval");
  const [metric, setMetric] = useState<HarvestingIntervalMetricKey>("hectare");
  const [dispatchDates, setDispatchDates] = useState<string[]>([]);
  const source = useMemo(() => harvestForSession(session), [session]);
  const report = useMemo(() => getHarvestingIntervalReport(source, source.metadata.defaultMonth), [source]);
  const groups = getHarvestingDayGroups(report.fields);
  const planned = items.filter((i) => i.planningSource === "harvesting-interval");
  const picked = (field: string) => planned.find((i) => i.fieldNo === field);
  const asOf = source.metadata.lastActivityDate;
  const summary = harvestFieldNames.map((field) => {
    const columns = report.fields.filter((f) => f.field === field);
    const interval = Math.max(...columns.map((f) => f.cells.find((c) => c.date === asOf)?.interval || 0));
    const last = Object.keys(source.activityByField[field] || {}).filter((d) => d <= asOf).sort().at(-1);
    return { field, interval, last, area: harvestingFieldArea(field), blocks: [...new Set(columns.map((c) => c.block))] };
  });
  const choose = (field: string, id: string) => <label className={"hi-field-select " + (picked(field) ? "hi-field-picked" : "")}>
    <input type="checkbox" aria-label={"Select harvesting field " + field + " " + id} checked={!!picked(field)} disabled={!canEdit} onChange={() => onToggleField(field)} /><span>{field}</span>
  </label>;
  const toggleDispatch = (date: string) => setDispatchDates((current) => current.includes(date) ? current.filter((d) => d !== date) : [...current, date]);
  const allocated = (n: number | null, field: typeof report.fields[number]) => n == null ? null : n * (field.hectares || 0) / harvestingFieldArea(field.field);
  const sum = (record: HarvestingIntervalActivityMetrics | undefined) => record ? value(record[metric], metric) : "—";
  return <div className="harvesting-workshop">
    <div className="wp-page-heading hi-page-heading"><div><p className="eyebrow">HARVESTING</p><h1>Harvesting interval</h1></div><span className="badge badge-amber">Simulated October history</span></div>
    <div className="hi-toolbar">
      <div className="hi-view-tabs" role="group" aria-label="Harvesting display">
        <button aria-pressed={view === "interval"} onClick={() => setView("interval")}><Table2 size={14} /> Monthly interval</button>
        <button aria-pressed={view === "status"} onClick={() => setView("status")}><ClipboardList size={14} /> Field status</button>
      </div>
      <label className="hi-activity-choice"><span>Harvesting activity</span><select aria-label="Harvesting activity code" value={activityCode} disabled={!canEdit} onChange={(e) => onActivity(e.target.value)}>{activities.filter((a) => a.code.startsWith("PH")).map((a) => <option value={a.code} key={a.code}>{a.code} · {a.name}</option>)}</select></label>
    </div>
    <section className="panel hi-report-panel">
      <div className="hi-report-heading"><div><h2>{view === "interval" ? report.monthLabel + " · Monthly interval" : "Field status"}</h2><p>As at {formatDate(asOf, true)} · {harvestFieldNames.length} fields</p></div>{view === "interval" ? <div className="hi-metric-toggle" role="group" aria-label="Harvesting metric">{metrics.map((m) => <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}>{m.label}</button>)}</div> : null}</div>
      <div className="hi-legend"><span><i className="hi-green" />On track ≤12 days</span><span><i className="hi-yellow" />Watch 13–15</span><span><i className="hi-orange" />Caution 16–20</span><span><i className="hi-red" />Overdue &gt;20</span><span><i className="hi-plan-swatch" />Planned Ha</span></div>
      {view === "interval" ? <div className="hi-table-scroll" tabIndex={0} aria-label="Scrollable harvesting interval grid"><table className="hi-interval-table">
        <thead>
          <tr><th className="hi-sticky-date" rowSpan={2}>Date</th>{groups.map((g, index) => <th colSpan={g.span} key={index} className="hi-day-group">{g.label}<small>{formatHa(g.totalHectares || 0)} ha</small></th>)}<th colSpan={3} className="hi-total-heading">Daily production</th></tr>
          <tr>{report.fields.map((f) => <th key={f.id} className={picked(f.field) ? "hi-selected-column" : ""}>{choose(f.field, f.id)}</th>)}<th>Total Ha</th><th>Bunches</th><th>Tonnage</th></tr>
          <tr><th className="hi-sticky-date">Ha</th>{report.fields.map((f) => <th key={f.id}>{formatHa(f.hectares || 0)}</th>)}<th colSpan={3}>Select field names to add to Pre-plan</th></tr>
          <tr><th className="hi-sticky-date">B/F</th>{report.fields.map((f) => <th key={f.id}>{f.bfDisplay || f.baseInterval}</th>)}<th colSpan={3}>Opening interval · {formatDate(harvestSource.metadata.baseDate, true)}</th></tr>
        </thead>
        <tbody>{report.days.map((day, index) => {
          const recorded = day.date <= asOf;
          const totals = source.dailyTotals[day.date];
          return <Fragment key={day.date}><tr className={day.isSunday ? "hi-sunday" : ""}>
            <th className="hi-sticky-date"><button className="hi-date-button" aria-label={"Show dispatch " + day.date} aria-expanded={dispatchDates.includes(day.date)} disabled={!recorded} onClick={() => toggleDispatch(day.date)}>{dispatchDates.includes(day.date) ? <ChevronDown size={12} /> : <ChevronRight size={12} />}<span>{day.day}<small>{day.dayName}</small></span></button></th>
            {report.fields.map((f) => {
              const cell = f.cells[index], plan = picked(f.field);
              const pending = completionWorks(session).filter((w) => w.kind === "harvesting" && w.fieldNo === f.field && w.date === day.date && latestReport(w)?.status === "Reported");
              const plannedDay = day.date === planningDate && !!plan && !cell.activity;
              return <td key={f.id} data-field={f.field} data-date={day.date} className={(picked(f.field) ? "hi-selected-column " : "") + (plannedDay ? "hi-planned-cell" : recorded && cell.harvest ? "hi-production-cell" : recorded ? "hi-interval-" + harvestTone(cell.interval) : "hi-future-cell")} title={recorded ? f.field + " · " + cell.interval + " day interval" : plannedDay ? "Pre-plan target for " + f.field : "No actuals"}>
                {plannedDay ? <><strong>{plan.targetHa > 0 ? value(allocated(plan.targetHa, f), "hectare") : "Plan"}</strong><small>{plan.targetHa > 0 ? "ha planned" : "Ha to declare"}</small></> : !recorded ? "—" : cell.activity ? value(allocated(cell.activity[metric], f), metric) : cell.interval}{pending.length ? <small className="wc-pending-field">{formatHa(pending.reduce((n, w) => n + (latestReport(w)?.ha || 0), 0))} ha pending</small> : null}
              </td>;
            })}
            <td className="hi-daily-total">{recorded ? totals ? value(totals.hectare, "hectare") : "—" : "—"}</td><td className="hi-daily-total">{recorded ? totals ? value(totals.bunches, "bunches") : "—" : "—"}</td><td className="hi-daily-total">{recorded ? totals ? value(totals.tonnage, "tonnage") : "—" : "—"}</td>
          </tr>{recorded && dispatchDates.includes(day.date) ? <tr className="hi-dispatch-row"><th className="hi-sticky-date">Dispatch</th>{report.fields.map((f) => {
            const d=f.cells[index].dispatch; return <td key={f.id}>{d ? value(allocated(metric === "tonnage" ? (d.tonnage || 0) : d[metric], f), metric) : "—"}</td>;
          })}<td colSpan={3}>{metric === "tonnage" ? value((report.dispatchDailyTotals[day.date]?.kg || 0) / 1000, metric) : value(report.dispatchDailyTotals[day.date]?.[metric] || 0, metric)} {metrics.find((m) => m.key === metric)?.label} dispatched</td></tr> : null}</Fragment>;
        })}<tr className="hi-month-total"><th className="hi-sticky-date">Month total</th>{report.fields.map((f) => <td key={f.id}>{value(allocated(f.monthlyHectareTotal, f), "hectare")} ha</td>)}<td>{sum(report.monthlyTotals)}</td><td colSpan={2}>Selected metric: {metrics.find((m) => m.key === metric)?.label}</td></tr></tbody>
      </table></div> : <div className="hi-status-scroll"><table className="hi-status-table"><thead><tr><th>Field</th><th>Day group</th><th>Ha</th><th>Last harvest</th><th>Interval</th><th>Status</th></tr></thead><tbody>{summary.map((f) => <tr key={f.field} className={picked(f.field) ? "hi-selected-column" : ""}><th>{choose(f.field, "status")}</th><td>{f.blocks.join(" / ")}</td><td>{formatHa(f.area)}</td><td>{f.last ? formatDate(f.last, true) : "Before October"}</td><td>{f.interval} days</td><td><span className={"hi-status hi-status-" + harvestTone(f.interval)}>{harvestStatus(f.interval)}</span></td></tr>)}</tbody></table></div>}
      <p className="hi-footnote">Field columns share one selection per field. Green cells show validated production; orange cells show Pre-plan targets. Pending Ha awaits FO validation; unknown bunches and tonnage remain pending.</p>
    </section>
  </div>;
}

