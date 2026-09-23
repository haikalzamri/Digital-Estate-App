"use client";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, ArrowRightLeft, CalendarDays, ChevronRight, Download, Info, Layers, Map, Scale, Sprout, Table2, Truck, X } from "lucide-react";
import sourceJson from "@/lib/minamas-harvesting-interval/source.json";
import { DIVISIONS, STATUS, dateNumber, divisionLabel, formatBunches, formatDate, formatSigned, getDayMetrics, getFields, getInterval, getTotals, getWeightTotals, isValidDate, monthDays, monthLabel } from "@/lib/minamas-harvesting-interval/report";
import type { DivisionFilter, FieldInterval, IntervalStatus, MinamasField, MinamasSource } from "@/lib/minamas-harvesting-interval/types";
import { FieldMap } from "./field-map";
import styles from "./dashboard.module.css";

const source = sourceJson as MinamasSource;
const bandKeys: IntervalStatus[] = ["onTrack", "watch", "caution", "overdue", "uncertain"];
type View = "map" | "report";
type SelectedCell = { field: MinamasField; date: string };

export function MinamasDashboard() {
  const [view, setView] = useState<View>("map");
  const [division, setDivision] = useState<DivisionFilter>("DIV01");
  const [asAt, setAsAt] = useState(source.metadata.defaultDate);
  const [month, setMonth] = useState(source.metadata.defaultDate.slice(0, 7));
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const dispatchCheckbox = useRef<HTMLInputElement>(null);
  const reportDays = monthDays(month);
  const expandedCount = reportDays.filter((date) => expandedDates.has(date)).length;
  useEffect(() => {
    if (dispatchCheckbox.current) dispatchCheckbox.current.indeterminate = expandedCount > 0 && expandedCount < reportDays.length;
  }, [expandedCount, reportDays.length, view]);
  const [cell, setCell] = useState<SelectedCell | null>(null);
  const fields = useMemo(() => getFields(source, division), [division]);
  const masterFields = useMemo(() => getFields(source, division, false), [division]);
  const statusDate = view === "map" ? asAt : [monthDays(month).at(-1)!, source.metadata.productionEnd].sort()[0];
  const statuses = useMemo(() => Object.fromEntries(source.fields.map((field) => [field.code, getInterval(source, field.code, statusDate)])), [statusDate]);
  const chosen = masterFields.find((field) => field.code === selected) || null;
  const periodStart = view === "map" ? asAt.slice(0, 7) + "-01" : month + "-01";
  const periodEnd = view === "map" ? asAt : monthDays(month).at(-1)!;
  const totals = useMemo(() => getTotals(source, fields.map((field) => field.code), periodStart, periodEnd), [fields, periodStart, periodEnd]);
  const counts = Object.fromEntries(bandKeys.map((key) => [key, fields.filter((field) => statuses[field.code].status === key).length]));
  const historyCount = fields.filter((field) => statuses[field.code].interval !== null).length;
  const portal = process.env.NEXT_PUBLIC_MANAGEMENT_PORTAL_URL || "https://palm-digital.vercel.app/hub/manager/";

  const insightCodes = chosen ? [chosen.code] : fields.map((field) => field.code);
  const insightLabel = chosen ? `${chosen.label} · YoP ${chosen.yop}` : divisionLabel(division);
  function toggleDate(date: string) {
    setExpandedDates((previous) => { const next = new Set(previous); if (next.has(date)) next.delete(date); else next.add(date); return next; });
  }
  function selectField(code: string) { setSelected((previous) => previous === code ? null : code); }
  function changeDivision(value: DivisionFilter) { setDivision(value); setSelected(null); setCell(null); }
  function changeView(next: View) { setView(next); setCell(null); }
  function exportReport() {
    const rows = [["Date", "Estate", "Division", "Field", "SAP block", "YoP", "Production bunches", "Dispatch bunches", "Difference", "Calculated interval", "Interval status"]];
    for (const date of monthDays(month)) for (const field of fields) {
      const metrics = getDayMetrics(source, field.code, date), interval = getInterval(source, field.code, date);
      rows.push([date, "E450", field.division, field.label, field.code, String(field.yop), ...[metrics.production, metrics.dispatch, metrics.difference, interval.interval].map((n) => n === null ? "" : String(n)), STATUS[interval.status].label]);
    }
    const csv = "\uFEFF" + rows.map((row) => row.map((value) => '"' + value.replaceAll('"', '""') + '"').join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = `minamas-E450-${division}-${month}.csv`; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className={styles.page}>
    <header className={styles.topbar}>
      <div className={styles.brand}><span className={styles.brandIcon}><Sprout size={25} /></span><div><strong>MINAMAS</strong><span>ESTATE OPERATIONS</span></div></div>
      <div className={styles.topActions}><span className={styles.prototype}>Presentation prototype</span><a className={styles.backLink} href={portal}><ArrowLeft size={16} />Back to Portal</a></div>
    </header>
    <main className={styles.main}>
      <div className={styles.heading}><div><p className={styles.eyebrow}>TELUK SIAK ESTATE · E450</p><h1>Harvesting Interval</h1><p>See the harvesting rhythm, field by field.</p></div><div className={styles.datasetBadge}><CalendarDays size={17} /><div><strong>July–September 2026</strong><span>Static presentation dataset</span></div></div></div>
      <div className={styles.tabs} role="tablist" aria-label="Minamas module views">
        {([{ id: "map", label: "Field Status & Map", Icon: Map }, { id: "report", label: "Harvesting Report", Icon: Table2 }] as const).map(({ id, label, Icon }) => <button key={id} id={`minamas-tab-${id}`} role="tab" aria-selected={view === id} aria-controls={`minamas-panel-${id}`} tabIndex={view === id ? 0 : -1} className={view === id ? styles.activeTab : ""} onClick={() => changeView(id)} onKeyDown={(event) => { if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); const next = event.key === "Home" ? "map" : event.key === "End" ? "report" : view === "map" ? "report" : "map"; changeView(next); document.getElementById(`minamas-tab-${next}`)?.focus(); } }}><Icon size={18} />{label}</button>)}
      </div>
      <div className={styles.filters}>
        <label>Estate<select aria-label="Estate" value="E450" onChange={() => undefined}><option value="E450">E450 — Teluk Siak Estate</option><option value="E451" disabled>E451 — Not available</option><option value="DEMO-01" disabled>DEMO-01 — Demo estate</option><option value="DEMO-02" disabled>DEMO-02 — Demo estate</option></select></label>
        <label>Division<select aria-label="Division" value={division} onChange={(event) => changeDivision(event.target.value as DivisionFilter)}>{DIVISIONS.map((id) => <option value={id} key={id}>{divisionLabel(id)}</option>)}<option value="all">All divisions</option></select></label>
        {view === "map" ? <label>As-at date<input type="date" aria-label="As-at date" value={asAt} min={source.metadata.productionStart} max={source.metadata.productionEnd} onChange={(event) => { const value = event.target.value; if (isValidDate(value) && value >= source.metadata.productionStart && value <= source.metadata.productionEnd) setAsAt(value); }} /></label> : <label>Report month<select aria-label="Report month" value={month} onChange={(event) => { setMonth(event.target.value); setExpandedDates(new Set()); }}>{source.metadata.availableMonths.map((value) => <option value={value} key={value}>{monthLabel(value)}</option>)}</select></label>}
        <div className={styles.filterNote}><span className={styles.dot} />{view === "map" ? "Bunches & weight insights" : "Bunches only"}<span>{division === "DIV01" ? "Manual field sequence" : division === "all" ? "Manual & inferred sequences" : "Sequence inferred from production"}</span></div>
      </div>
      {view === "map" ? <section role="tabpanel" id="minamas-panel-map" aria-labelledby="minamas-tab-map">
        <WeightOverview codes={insightCodes} label={insightLabel} asAt={asAt} />
        <div className={styles.kpis}>
          <div className={styles.kpi}><span>Fields with history</span><strong>{historyCount}<small> / {fields.length}</small></strong><p>Selected report fields</p></div>
          {bandKeys.map((key) => <div key={key} className={styles.kpi}><span><i style={{ background: STATUS[key].color }} />{STATUS[key].label}</span><strong>{counts[key]}</strong><p>{STATUS[key].range}</p></div>)}
        </div>
        <div className={styles.mapLayout}>
          <section className={styles.card}>
            <div className={styles.cardHeader}><div><h2>Estate field map</h2><p>{divisionLabel(division)} · {formatDate(asAt)}</p></div><span className={styles.smallBadge}><Layers size={14} />Interval status</span></div>
            <FieldMap key={division} fields={source.fields} division={division} statuses={statuses} selected={selected} onSelect={selectField} />
            <div className={styles.legend}>{Object.entries(STATUS).map(([key, value]) => <span key={key}><i style={{ background: value.color }} />{value.label}<small>{value.range}</small></span>)}</div>
          </section>
          <aside className={styles.sidePanel} aria-label="Field details">
            <div className={styles.card}>
              <div className={styles.cardHeader}><h2>Field details</h2>{chosen && <button className={styles.iconButton} onClick={() => setSelected(null)} aria-label="Clear selected field"><X size={16} /></button>}</div>
              <div className={styles.detailBody}>
                <label className={styles.fieldPicker}>Find a field<select aria-label="Find a field" value={selected || ""} onChange={(event) => setSelected(event.target.value || null)}><option value="">Select a field on the map</option>{masterFields.map((field) => <option value={field.code} key={field.code}>{field.label} · YoP {field.yop}</option>)}</select></label>
                {chosen ? <FieldDetails field={chosen} state={statuses[chosen.code]} asAt={asAt} onReport={fields.some((field) => field.code === chosen.code) ? () => { setMonth(asAt.slice(0, 7)); changeView("report"); } : undefined} /> : <div className={styles.emptyDetails}><span><Map size={29} /></span><h3>Explore a field</h3><p>Select a coloured parcel to see its interval, last harvest and bunch totals.</p><small>The grey parcels have no recorded harvest history or an unconfirmed round.</small></div>}
              </div>
            </div>
            {!chosen && <div className={styles.periodCard}><p className={styles.eyebrow}>MONTH TO DATE</p><h3>{monthLabel(asAt.slice(0, 7))}</h3><div><span>Production</span><strong>{formatBunches(totals.production)}<small> bunches</small></strong></div><div><span>Dispatch</span><strong>{formatBunches(totals.dispatch)}<small>{totals.dispatch === null ? " unavailable" : " bunches"}</small></strong></div><p>Through {formatDate(asAt, true)} · {divisionLabel(division)}</p></div>}
          </aside>
        </div>
        {(division === "DIV03" || division === "all") && <div className={styles.notice}><Info size={18} /><p><strong>H017: round boundary unclear.</strong> Its calculated interval is provisional. It is shown in grey and excluded from confirmed interval bands.</p></div>}
        <ActivityTrend codes={insightCodes} label={insightLabel} asAt={asAt} />
        <section className={styles.card + " " + styles.overview}>
          <div className={styles.cardHeader}><div><h2>Field overview</h2><p>Report fields in the agreed harvesting sequence</p></div><button className={styles.textButton} onClick={() => { setMonth(asAt.slice(0, 7)); changeView("report"); }}>Open harvesting report<ArrowRight size={16} /></button></div>
          <div className={styles.tableScroll} tabIndex={0} aria-label="Field overview table"><table className={styles.overviewTable}><thead><tr><th>Field</th><th>YoP</th><th>Division</th><th>Interval</th><th>Last harvest</th><th>Status</th><th>Production MTD</th></tr></thead><tbody>{fields.map((field) => { const status = statuses[field.code]; return <tr key={field.code} className={selected === field.code ? styles.selectedRow : ""}><td><button className={styles.fieldButton} onClick={() => selectField(field.code)}>{field.label}<small>{field.code}</small></button></td><td>{field.yop}</td><td>{divisionLabel(field.division)}</td><td>{status.interval === null ? "—" : `${status.interval}${status.status === "uncertain" ? "*" : ""} days`}</td><td>{formatDate(status.lastHarvest, true)}</td><td><StatusPill status={status.status} /></td><td>{formatBunches(getTotals(source, [field.code], periodStart, asAt).production)}</td></tr>; })}</tbody></table></div>
        </section>
      </section> : <section role="tabpanel" id="minamas-panel-report" aria-labelledby="minamas-tab-report">
        <div className={styles.reportTotals}>{([{ label: "Production", value: totals.production, note: `Through ${formatDate([periodEnd, source.metadata.productionEnd].sort()[0], true)}` }, { label: "Dispatch", value: totals.dispatch, note: totals.dispatch === null ? "No dispatch supplied for this month" : `Through ${formatDate([periodEnd, source.metadata.dispatchEnd].sort()[0], true)}` }, { label: "Production − dispatch", value: totals.difference, note: totals.comparisonThrough ? `Matched period through ${formatDate(totals.comparisonThrough, true)}` : "Comparison unavailable" }]).map((item) => <div className={styles.kpi} key={item.label}><span>{item.label}</span><strong>{formatBunches(item.value)}<small>{item.value === null ? "" : " bunches"}</small></strong><p>{item.note}</p></div>)}</div>
        {month === "2026-09" && <div className={styles.notice}><Info size={18} /><p>Production is available through <strong>19 September</strong>. September dispatch was not supplied. Unavailable values and later dates are shown as dashes.</p></div>}
        <section className={styles.card}>
          <div className={styles.reportHeader}><div><h2>Monthly harvesting grid</h2><p>{monthLabel(month)} · {divisionLabel(division)} · {fields.length} fields</p></div><div className={styles.reportActions}><label className={styles.checkbox}><input ref={dispatchCheckbox} type="checkbox" checked={expandedCount === reportDays.length} aria-checked={expandedCount > 0 && expandedCount < reportDays.length ? "mixed" : expandedCount === reportDays.length} onChange={(event) => setExpandedDates(event.target.checked ? new Set(reportDays) : new Set())} />Show dispatch & difference</label><button className={styles.secondaryButton} onClick={exportReport}><Download size={15} />Export CSV</button></div></div>
          <div className={styles.gridKey}><span><i />Harvested bunches</span><span>Plain number = interval days</span><span>* Provisional interval</span><span>— No history / unavailable</span><span><ChevronRight size={12} />Click a day to compare dispatch</span></div>
          <HarvestingGrid fields={fields} month={month} expandedDates={expandedDates} onToggleDate={toggleDate} selected={selected} onCell={setCell} />
          <div className={styles.reportFoot}>Fields are rows; days are columns. Use the checkbox for all days or a day arrow for individual comparisons. July history carries into August and September. Differences compare the same date and are not a pending-dispatch balance.</div>
        </section>
      </section>}
      <details className={styles.method}><summary>Data coverage & interval rules</summary><div><p>Production: {formatDate(source.metadata.productionStart)}–{formatDate(source.metadata.productionEnd)}. Dispatch: {formatDate(source.metadata.dispatchStart)}–{formatDate(source.metadata.dispatchEnd)}.</p><p>Weights in KG come from ESTATE_WEIGHT and MILL_DECL_WEIGHT on the same dispatch detail records. Weight difference is mill minus estate; percentage uses estate weight as the base. Weight insights cover the selected month through the as-at date.</p><p>Only CUTTER and SD1 (C1R2) - CUTTER records are included. The unclassified 743-bunch E450 record is excluded. Quantities are summed by full SAP block and date; planting years remain separate.</p><p>The interval increases daily. A harvest after a gap greater than five days resets it to 1; activity within five days continues the cycle. The first cycle can be provisional because no June baseline was provided. H017 remains provisional pending round validation.</p><p>Division 1 follows the manual field order without a/b splits. Divisions 2 and 3 use a fixed order inferred from production. Map boundaries are illustrative. This Minamas prototype uses a static dataset and has no database connection.</p></div></details>
      <footer className={styles.footer}><span>MINAMAS · HARVESTING INTERVAL</span><span>Presentation prototype · July–September 2026</span></footer>
    </main>
    {cell && <CellDialog selected={cell} onClose={() => setCell(null)} />}
  </div>;
}

function StatusPill({ status }: { status: IntervalStatus }) {
  return <span className={styles.statusPill}><i style={{ background: STATUS[status].color }} />{STATUS[status].label}</span>;
}
function FieldDetails({ field, state, asAt, onReport }: { field: MinamasField; state: FieldInterval; asAt: string; onReport?: () => void }) {
  const totals = getTotals(source, [field.code], asAt.slice(0, 7) + "-01", asAt);
  const weights = getWeightTotals(source, [field.code], asAt.slice(0, 7) + "-01", asAt);
  return <div className={styles.fieldDetails}>
    <div className={styles.fieldTitle}><h3>{field.label}</h3><StatusPill status={state.status} /></div>
    <p>{divisionLabel(field.division)} · YoP {field.yop}<br /><span>SAP block {field.code}</span></p>
    <div className={styles.intervalNumber}><strong>{state.interval ?? "—"}{state.status === "uncertain" ? "*" : ""}</strong><span>{state.interval === null ? "No harvest history" : "days in the current interval"}</span></div>
    <dl><div><dt>Last harvest</dt><dd>{formatDate(state.lastHarvest)}</dd></div><div><dt>Cycle start{state.status === "uncertain" ? " (provisional)" : ""}</dt><dd>{formatDate(state.cycleStart)}</dd></div><div><dt>Production MTD</dt><dd>{formatBunches(totals.production)} bunches</dd></div><div><dt>Dispatch MTD</dt><dd>{totals.dispatch === null ? "Unavailable" : formatBunches(totals.dispatch) + " bunches"}</dd></div><div><dt>Estate weight MTD</dt><dd>{weights.estate === null ? "Unavailable" : formatBunches(weights.estate) + " KG"}</dd></div><div><dt>Mill weight MTD</dt><dd>{weights.mill === null ? "Unavailable" : formatBunches(weights.mill) + " KG"}</dd></div><div><dt>Weight difference</dt><dd>{weights.variance === null ? "Unavailable" : formatSigned(weights.variance) + " KG"}</dd></div></dl>
    {state.status === "uncertain" && <p className={styles.detailNotice}>{state.explanation}</p>}
    {onReport && <button className={styles.primaryButton} onClick={onReport}>View in report<ArrowRight size={16} /></button>}
  </div>;
}

function HarvestingGrid({ fields, month, expandedDates, onToggleDate, selected, onCell }: { fields: MinamasField[]; month: string; expandedDates: Set<string>; onToggleDate: (date: string) => void; selected: string | null; onCell: (cell: SelectedCell) => void }) {
  const days = monthDays(month);
  const scrollRef = useRef<HTMLDivElement>(null);
  const codes = fields.map((field) => field.code);
  const sunday = (date: string) => new Date(dateNumber(date)).getUTCDay() === 0;
  useEffect(() => {
    if (selected) scrollRef.current?.querySelector<HTMLElement>(`[data-minamas-field="${selected}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected, month]);
  return <div ref={scrollRef} className={styles.tableScroll + " " + styles.gridScroll} tabIndex={0} aria-label="Scrollable harvesting interval grid">
    <table className={styles.harvestingGrid} aria-label="Fields by day harvesting report">
      <thead>
        <tr>
          <th rowSpan={2} className={styles.fieldCol} scope="col">Field<small>Year of planting</small></th>
          {days.map((date) => <th key={date} scope="colgroup" colSpan={expandedDates.has(date) ? 3 : 1} className={sunday(date) ? styles.sundayHeader : ""}>
            <button className={styles.dayToggle} type="button" aria-expanded={expandedDates.has(date)} aria-label={`${expandedDates.has(date) ? "Hide" : "Show"} dispatch for ${formatDate(date)}`} onClick={() => onToggleDate(date)}>
              <span>{Number(date.slice(-2))}<small>{new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(new Date(dateNumber(date)))}</small></span>
              <ChevronRight size={13} className={expandedDates.has(date) ? styles.chevronOpen : ""} />
            </button>
          </th>)}
          <th rowSpan={2} scope="col" className={styles.totalCol}>Month total<small>Production bunches</small></th>
        </tr>
        <tr className={styles.metricHeaders}>{days.map((date) => <Fragment key={date}>
          <th scope="col">Production</th>
          {expandedDates.has(date) && <><th scope="col" className={styles.dispatchCol}><div className={styles.revealValue}>Dispatch</div></th><th scope="col" className={styles.differenceCol}><div className={styles.revealValue}>Difference</div></th></>}
        </Fragment>)}</tr>
      </thead>
      <tbody>{fields.map((field) => <tr key={field.code} data-minamas-field={field.code} className={selected === field.code ? styles.gridSelectedRow : ""}>
        <th scope="row" className={styles.fieldCol}>{field.label}<small>YoP {field.yop}</small>{fields.some((other) => other.division !== field.division) && <small>{divisionLabel(field.division)}</small>}</th>
        {days.map((date) => {
          const metrics = getDayMetrics(source, field.code, date), state = getInterval(source, field.code, date);
          return <Fragment key={date}>
            <td className={`${metrics.production ? styles.harvestCell : ""} ${sunday(date) ? styles.sundayCell : ""}`}>
              <button disabled={metrics.production === null} onClick={() => onCell({ field, date })} aria-label={`${field.label}, YoP ${field.yop}, ${formatDate(date)}, ${metrics.production === null ? "unavailable" : metrics.production + " production bunches"}, interval ${state.interval ?? "unknown"}`}>
                {metrics.production ? <><strong>{formatBunches(metrics.production)}</strong><small>{state.interval}d{state.status === "uncertain" ? "*" : ""}</small></> : <span>{state.interval ?? "—"}{state.status === "uncertain" ? "*" : ""}</span>}
              </button>
            </td>
            {expandedDates.has(date) && <><td className={styles.dispatchCol}><div className={styles.revealValue}>{formatBunches(metrics.dispatch)}</div></td><td className={styles.differenceCol}><div className={styles.revealValue}>{formatSigned(metrics.difference)}</div></td></>}
          </Fragment>;
        })}
        <td className={styles.totalCol}>{formatBunches(getTotals(source, [field.code], days[0], days.at(-1)!).production)}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row" className={styles.fieldCol}>Daily total<small>Bunches</small></th>{days.map((date) => {
        const total = getTotals(source, codes, date, date);
        return <Fragment key={date}><td>{formatBunches(total.production)}</td>{expandedDates.has(date) && <><td className={styles.dispatchCol}><div className={styles.revealValue}>{formatBunches(total.dispatch)}</div></td><td className={styles.differenceCol}><div className={styles.revealValue}>{formatSigned(total.difference)}</div></td></>}</Fragment>;
      })}<td className={styles.totalCol}>{formatBunches(getTotals(source, codes, days[0], days.at(-1)!).production)}</td></tr></tfoot>
    </table>
  </div>;
}


function WeightOverview({ codes, label, asAt }: { codes: string[]; label: string; asAt: string }) {
  const weight = getWeightTotals(source, codes, asAt.slice(0, 7) + "-01", asAt);
  return <section className={styles.weightOverview} aria-label="Weight reconciliation">
    <div className={styles.insightHeading}><div><p className={styles.eyebrow}>ESTATE TO MILL</p><h2>Weight reconciliation</h2></div><p><strong>{label}</strong><span>Month to date · through {formatDate(asAt, true)}</span></p></div>
    <div className={styles.weightCards}>
      <div className={styles.weightCard}><div><span>Estate weight</span><Scale size={17} /></div><strong>{formatBunches(weight.estate)}<small> KG</small></strong><p>Recorded at estate</p></div>
      <div className={styles.weightCard}><div><span>Mill-declared weight</span><Truck size={17} /></div><strong>{formatBunches(weight.mill)}<small> KG</small></strong><p>Declared by receiving mill</p></div>
      <div className={styles.weightVariance}><div><span>Weight difference</span><ArrowRightLeft size={17} /></div><strong>{formatSigned(weight.variance)}<small> KG</small></strong><p><b>{formatSigned(weight.variancePercent, true)}</b><span>Mill minus estate</span></p></div>
    </div>
    <p className={styles.weightNote}>{weight.through ? "Both weights use the same dispatch records. A difference is a reconciliation variance." : "Dispatch weights are unavailable for this period. The supplied dispatch data ends on 31 August."}</p>
  </section>;
}

function ActivityTrend({ codes, label, asAt }: { codes: string[]; label: string; asAt: string }) {
  const days = monthDays(asAt.slice(0, 7)).filter((date) => date <= asAt);
  const series = days.map((date) => ({ date, ...getTotals(source, codes, date, date) }));
  const [active, setActive] = useState<string | null>(null);
  const point = series.find((item) => item.date === active) || series.at(-1)!;
  const maximum = Math.max(1, ...series.flatMap((item) => [item.production || 0, item.dispatch || 0]));
  const ceiling = Math.ceil(maximum / (maximum > 1000 ? 1000 : 100)) * (maximum > 1000 ? 1000 : 100);
  const x = (i: number) => 55 + i * 875 / Math.max(days.length - 1, 1);
  const y = (value: number) => 175 - value / ceiling * 140;
  const path = (key: "production" | "dispatch") => {
    let connected = false;
    return series.map((item, i) => {
      if (item[key] === null) { connected = false; return ""; }
      const command = connected ? "L" : "M"; connected = true;
      return `${command}${x(i)},${y(item[key])}`;
    }).join(" ");
  };
  const activeIndex = series.indexOf(point);
  return <section className={styles.card + " " + styles.trendCard} aria-label="Production and dispatch trend">
    <div className={styles.cardHeader}><div><h2>Harvest to dispatch</h2><p>{label} · Daily bunches · {monthLabel(asAt.slice(0, 7))}</p></div><div className={styles.trendLegend}><span><i />Production</span><span><i />Dispatch</span></div></div>
    <div className={styles.trendReadout} aria-live="polite"><strong>{formatDate(point.date, true)}</strong><span>Production <b>{formatBunches(point.production)}</b></span><span>Dispatch <b>{point.dispatch === null ? "Unavailable" : formatBunches(point.dispatch)}</b></span><small>Hover or select a day</small></div>
    <div className={styles.trendCanvas}>
      <svg viewBox="0 0 960 215" role="group" aria-label="Daily production and dispatch chart">
        {[0, .5, 1].map((fraction) => <g key={fraction}><line x1="55" x2="930" y1={y(ceiling * fraction)} y2={y(ceiling * fraction)} stroke="#dfe8e1" strokeDasharray={fraction ? "3 4" : undefined} /><text x="44" y={y(ceiling * fraction) + 4} textAnchor="end" className={styles.chartLabel}>{formatBunches(ceiling * fraction)}</text></g>)}
        <line x1={x(activeIndex)} x2={x(activeIndex)} y1="25" y2="175" stroke="#a2b7a7" strokeDasharray="3 4" />
        <path d={path("production")} fill="none" stroke="#1b6546" strokeWidth="3" strokeLinejoin="round" />
        <path d={path("dispatch")} fill="none" stroke="#4c87af" strokeWidth="3" strokeDasharray="6 4" strokeLinejoin="round" />
        {series.map((item, i) => <g key={item.date}>
          {(i === 0 || i === days.length - 1 || (i + 1) % 5 === 0) && <text x={x(i)} y="199" textAnchor="middle" className={styles.chartLabel}>{Number(item.date.slice(-2))}</text>}
          <g role="button" tabIndex={0} aria-label={`${formatDate(item.date)}, production ${formatBunches(item.production)} bunches, dispatch ${item.dispatch === null ? "unavailable" : formatBunches(item.dispatch) + " bunches"}`} onPointerEnter={() => setActive(item.date)} onFocus={() => setActive(item.date)} onClick={() => setActive(item.date)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setActive(item.date); } }}>
            <rect x={x(i) - (days.length === 1 ? 15 : 437.5 / (days.length - 1))} y="25" width={days.length === 1 ? 30 : 875 / (days.length - 1)} height="155" fill="transparent" />
            {item.date === point.date && item.production !== null && <circle cx={x(i)} cy={y(item.production)} r="4.5" fill="#1b6546" stroke="white" strokeWidth="2" />}
            {item.date === point.date && item.dispatch !== null && <circle cx={x(i)} cy={y(item.dispatch)} r="4.5" fill="#4c87af" stroke="white" strokeWidth="2" />}
          </g>
        </g>)}
      </svg>
    </div>
    <div className={styles.trendFoot}><span>Production and dispatch are shown on their recorded dates.</span><span>{asAt > source.metadata.dispatchEnd ? "September dispatch unavailable" : "Daily movement · bunches"}</span></div>
  </section>;
}

function CellDialog({ selected, onClose }: { selected: SelectedCell; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { ref.current?.showModal(); }, []);
  const metrics = getDayMetrics(source, selected.field.code, selected.date);
  const state = getInterval(source, selected.field.code, selected.date);
  return <dialog ref={ref} className={styles.dialog} aria-labelledby="minamas-cell-title" onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className={styles.cardHeader}><div><p className={styles.eyebrow}>{formatDate(selected.date)}</p><h2 id="minamas-cell-title">{selected.field.label} · YoP {selected.field.yop}</h2></div><button className={styles.iconButton} autoFocus onClick={onClose} aria-label="Close harvesting details"><X size={20} /></button></div>
    <div className={styles.dialogBody}><p>{divisionLabel(selected.field.division)} · SAP block {selected.field.code}</p><div className={styles.dialogMetrics}>{[{ label: "Production", value: metrics.production }, { label: "Dispatch", value: metrics.dispatch }, { label: "Difference", value: metrics.difference }].map((item) => <div key={item.label}><span>{item.label}</span><strong>{formatBunches(item.value)}</strong><small>{item.value === null ? "Unavailable" : "bunches"}</small></div>)}</div><p><strong>Interval: {state.interval ?? "—"} days</strong> · {STATUS[state.status].label}</p><p>{state.explanation}</p></div>
  </dialog>;
}
