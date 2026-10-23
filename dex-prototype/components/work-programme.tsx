"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, ChevronRight, Info, Leaf, MapPinned, Search, Table2 } from "lucide-react";
import type { FeatureCollection } from "geojson";
import type { GeoJSON, Map as LeafletMap, Path } from "leaflet";
import {
  AS_OF_DATE, WORKSHOP_YEAR, MONTH_LABELS, completedRounds,
  delayMonths, fieldStatus, mapRating, monthName, monthlyValues, nextRound, programmeSummary,
  recommendedProgrammes, roundActual, roundComplete, statusTone,
  type Programme, type ProgrammeField, type ProgrammeStatus,
} from "@/lib/work-programme";
import { programmesForSession, completionWorks, latestReport } from "@/lib/work-completion";
import { formatDate, formatHa, type Session, type PlanItem } from "@/lib/workshop";

type Props = {
  session: Session; programmeId: string | null; onProgrammeChange: (id: string | null) => void;
  view: "table" | "map"; onViewChange: (view: "table" | "map") => void;
  year: number; onYearChange: (year: number) => void;
  selectedField: string; onFieldChange: (field: string) => void;
  onToggleField: (programmeId: string, fieldNo: string) => void;
  items: PlanItem[]; canEdit: boolean; onContinue: () => void; compact?: boolean; readOnly?: boolean;
};
function Status({ value }: { value: ProgrammeStatus }) {
  return <span className={"badge badge-" + statusTone(value)}>{value}</span>;
}
function Meter({ value }: { value: number }) {
  return <span className="wp-meter"><span style={{ width: Math.min(100, Math.max(0, value)) + "%" }} /></span>;
}

export function WorkProgramme(props: Props) {
  const { programmeId, onProgrammeChange, view, onViewChange, year, onYearChange, selectedField, onFieldChange, onToggleField, items, canEdit, onContinue, compact = false, readOnly = false } = props;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All statuses");
  const tableScroll = useRef<HTMLDivElement>(null);
  const programmes = useMemo(() => programmesForSession(props.session), [props.session]);
  const p = programmes.find((r) => r.id === programmeId);
  const openProgramme = (programme: Programme) => {
    onProgrammeChange(programme.id);
    onFieldChange(programme.fields.find((f) => fieldStatus(f) === "Overdue")?.fieldNo || programme.fields.find((f) => fieldStatus(f) === "Due this month")?.fieldNo || programme.fields[0].fieldNo);
  };
  if (!p) {
    const recommended = recommendedProgrammes(programmes);
    const shown = programmes.filter((r) => (r.title + " " + r.activityCode).toLowerCase().includes(query.toLowerCase().trim()) && (filter === "All statuses" || programmeSummary(r).status === filter));
    if (compact) {
      const priority: Record<ProgrammeStatus, number> = { Overdue: 0, "Due this month": 1, "On time": 2, Upcoming: 3, Completed: 4 };
      shown.sort((a, b) => priority[programmeSummary(a).status] - priority[programmeSummary(b).status]);
    }
    const overdue = programmes.filter((r) => programmeSummary(r).overdueFields > 0).length;
    return <div className="wp-workspace">
      <div className="page-heading wp-catalogue-heading"><div><p className="eyebrow">M1 · WORK PROGRAMME</p><h1>Work Programme</h1></div><span className="badge badge-lime"><CalendarDays size={13} /> {WORKSHOP_YEAR}</span></div>
      {!compact ? <><div className="wp-section-heading"><div><h2>Recommended work <span>{recommended.length}</span></h2><p>Priorities as of {formatDate(AS_OF_DATE, true)}</p></div><span className="wp-priority-note">{overdue} programmes with overdue fields</span></div>
      <div className="wp-recommendations" aria-label="Recommended work">
        {recommended.map((r) => { const summary = programmeSummary(r); return <button key={r.id} className={"wp-recommendation wp-priority-" + statusTone(summary.status)} onClick={() => openProgramme(r)} aria-label={"Open recommended " + r.title}>
          <div className="wp-card-top"><span className="wp-card-icon"><Leaf size={18} /></span><Status value={summary.status} /></div>
          <h3>{r.title}</h3><p>{summary.priorityFields} fields to prioritise</p>
          <div className="wp-card-bottom"><span><strong>{formatHa(summary.priorityHa)}</strong> ha remaining</span><ArrowRight size={16} /></div>
        </button>; })}
      </div>
      </> : null}
      <section className="panel wp-catalogue">
        <div className="wp-catalogue-toolbar"><div><h2>All programmes <span className="wp-count">{programmes.length}</span></h2><p>Select a programme to explore its fields and monthly schedule.</p></div>
          <div className="wp-filters"><label className="wp-search"><Search size={15} /><input aria-label="Search programmes" placeholder="Find a programme" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
            <select aria-label="Filter programme status" value={filter} onChange={(e) => setFilter(e.target.value)}>{["All statuses", "Overdue", "Due this month", "On time", "Upcoming", "Completed"].map((s) => <option key={s}>{s}</option>)}</select></div>
        </div>
        <div className="wp-catalogue-scroll"><table className="wp-programme-table"><thead><tr><th>Programme</th><th>Fields</th><th>Rounds / year</th><th>Annual progress</th><th>Next due</th><th>Priority</th><th aria-label="Open programme" /></tr></thead><tbody>
          {shown.map((r, i) => { const summary = programmeSummary(r); return <tr key={r.id} data-programme={r.id} onClick={() => openProgramme(r)}>
            <td><div className="wp-programme-name"><span className="wp-list-number">{String(i + 1).padStart(2, "0")}</span><div><button className="wp-name-button" onClick={(e) => { e.stopPropagation(); openProgramme(r); }}>{r.title}</button><small>{r.activityCode}</small>{compact && summary.status === "Overdue" ? <span className="wp-recommended-tag">Recommended</span> : null}</div></div></td>
            <td>{r.fields.length}</td><td>{summary.roundCount}</td><td><div className="wp-list-progress"><span>{Math.round(summary.progress)}%</span><Meter value={summary.progress} /></div><small>{formatHa(summary.actual)} / {formatHa(summary.planned)} ha</small></td>
            <td>{summary.nextDue ? formatDate(summary.nextDue, true) : <span className="wp-complete-label"><Check size={12} /> Complete</span>}</td>
            <td><Status value={summary.status} />{summary.overdueFields ? <small>{summary.overdueFields} overdue fields</small> : null}</td><td><ChevronRight size={17} /></td>
          </tr>; })}
        </tbody></table></div>
        {!shown.length ? <p className="wp-no-results">No programmes match. Try another name or status.</p> : null}
        <div className="wp-catalogue-footer"><span>{shown.length} of {programmes.length} programmes · E063</span><span>Schedules and completion values are illustrative.</span></div>
      </section>
      {!compact ? <button className="text-button continue-link" onClick={onContinue}>{readOnly?"View daily work":"Continue to Daily Pre-Plan"} <ArrowRight size={15} /></button> : null}
    </div>;
  }
  const fields = p.fields.filter((f) => f.rounds.some((r) => r.dueDate.startsWith(String(year))));
  const selected = fields.find((f) => f.fieldNo === selectedField) || fields[0];
  const inPlan = (fieldNo: string) => items.some((i) => i.programmeId === p.id && i.fieldNo === fieldNo);
  const chooseField = (f: ProgrammeField) => { if(readOnly) {onFieldChange(f.fieldNo);return;} if (canEdit && (nextRound(f) || inPlan(f.fieldNo))) { onFieldChange(f.fieldNo); onToggleField(p.id, f.fieldNo); } };
  return <div className="wp-workspace">
    <button className="text-button wp-back" onClick={() => onProgrammeChange(null)}><ArrowLeft size={14} /> All programmes</button>
    <div className="wp-detail-heading"><div><p className="eyebrow">M1 · WORK PROGRAMME MONTHLY VIEW</p><h1>{p.title}</h1><p>{p.activityCode} · {p.fields.length} fields · Ldg Digital</p></div>
      <div className="wp-detail-controls"><label><span>Programme</span><select aria-label="Selected work programme" value={p.id} onChange={(e) => openProgramme(programmes.find((r) => r.id === e.target.value)!)}>{programmes.map((r) => <option value={r.id} key={r.id}>{r.title}</option>)}</select></label>
        <label><span>Year</span><select aria-label="Programme year" value={year} onChange={(e) => onYearChange(Number(e.target.value))}><option>{WORKSHOP_YEAR}</option><option>{WORKSHOP_YEAR + 1}</option></select></label>
        <div className="wp-view-toggle" role="group" aria-label="Work programme view"><button aria-pressed={view === "table"} onClick={() => onViewChange("table")}><Table2 size={14} /> Table</button><button aria-pressed={view === "map"} onClick={() => onViewChange("map")}><MapPinned size={14} /> Map</button></div>
      </div>
    </div>
    {!fields.length ? <section className="panel wp-empty-year"><CalendarDays size={30} /><h2>No {year} schedule loaded</h2><p>This workshop sample covers {WORKSHOP_YEAR}. Select {WORKSHOP_YEAR} to explore the table and map.</p><button className="button button-primary" onClick={() => onYearChange(WORKSHOP_YEAR)}>Show {WORKSHOP_YEAR}</button></section>
      : view === "table" ? <section className="panel wp-monthly-panel">
        <div className="wp-table-heading"><div><h2>{year} field plan and completion</h2><p>{compact || readOnly ? "Field schedule and completed hectares." : "Select several fields to add to tomorrow’s activities. Continue browsing other programmes."}</p></div><button className="wp-current-jump" onClick={() => { const wrap = tableScroll.current; const cell = wrap?.querySelector<HTMLElement>(".wp-current-month"); if (wrap && cell) wrap.scrollTo({ left: wrap.scrollLeft + cell.getBoundingClientRect().left - wrap.getBoundingClientRect().left - wrap.clientWidth / 2, behavior: "smooth" }); }}>Show {MONTH_LABELS[Number(AS_OF_DATE.slice(5, 7)) - 1]} <ArrowRight size={12} /></button></div>
        {!canEdit && !compact ? <p className="wp-readonly-note"><Info size={14} /> {readOnly?"View only":"Choose Amend pre-plan to change the shared plan. Existing morning work and tickets are retained."}</p> : null}
        <div ref={tableScroll} className="wp-monthly-scroll" tabIndex={0} aria-label="Scrollable monthly field schedule">
          <table className="wp-monthly-table"><thead><tr><th>Field</th><th>Category</th><th>Ha</th><th>Rounds / year</th><th>Completed rounds</th><th>Next programme</th><th>Delay (months)</th><th>Plan / actual</th>{MONTH_LABELS.map((month, index) => <th key={month} className={index === Number(AS_OF_DATE.slice(5, 7)) - 1 ? "wp-current-month" : ""}>{month}</th>)}<th>Round completion</th><th>Pre-plan</th></tr></thead>
            {fields.map((f) => { const next = nextRound(f), status = fieldStatus(f), plannedMonths = monthlyValues(f, year, false), actualMonths = monthlyValues(f, year, true), existing = inPlan(f.fieldNo), available = canEdit && (!!next || existing);
              return <tbody key={f.fieldNo} className={"wp-field-pair " + ((existing ? "wp-field-in-basket " : "") + (selectedField === f.fieldNo ? "wp-field-selected" : ""))} data-field={f.fieldNo} data-programme={p.id}>
                <tr className={available || readOnly ? "wp-field-clickable" : ""} onClick={() => { if (available || readOnly) chooseField(f); }}>
                  <th rowSpan={2} scope="rowgroup"><label className="wp-field-select" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={"Select " + p.title + " field " + f.fieldNo} checked={existing} disabled={!available} onChange={() => chooseField(f)} /><span>{f.fieldNo}</span></label>{completionWorks(props.session).filter((w) => w.programmeId === p.id && w.fieldNo === f.fieldNo && latestReport(w)?.status === "Reported").map((w) => <small className="wc-pending-field" key={w.id}>{formatHa(latestReport(w)!.ha || 0)} ha reported · pending</small>)}</th>
                  <td rowSpan={2}>{f.category}</td><td rowSpan={2}>{formatHa(f.hectares)}</td><td rowSpan={2}>{f.rounds.length}</td><td rowSpan={2}>{completedRounds(f)}/{f.rounds.length}<small><Status value={status} /></small></td><td rowSpan={2}>{next ? monthName(next.dueDate) : "Complete"}</td><td rowSpan={2}>{delayMonths(f) || "—"}</td>
                  <th scope="row" className="wp-planned-label">Programme</th>{plannedMonths.map((value, m) => <td key={m}>{value > 0 ? <span className="wp-month-value wp-month-planned">{formatHa(value)}</span> : "—"}</td>)}
                  <td rowSpan={2}><div className="wp-rounds-inline">{f.rounds.map((r) => <div key={r.number} className={"wp-round-mini " + (roundComplete(r) ? "wp-round-complete" : roundActual(r) ? "wp-round-partial" : "")}><span>R{r.number}<strong>{Math.round(roundActual(r) / r.targetHa * 100)}%</strong></span><Meter value={roundActual(r) / r.targetHa * 100} /></div>)}</div></td>
                  <td rowSpan={2}><span className={"wp-plan-hint " + (existing ? "wp-plan-linked" : "")}>{readOnly ? "View only" : existing ? "In basket" : next ? "Select field" : "All complete"}</span></td>
                </tr>
                <tr className={available || readOnly ? "wp-field-clickable" : ""} onClick={() => { if (available || readOnly) chooseField(f); }}><th scope="row" className="wp-actual-label">Completed</th>{actualMonths.map((value, m) => <td key={m}>{value > 0 ? <span className={"wp-month-value " + (value >= f.hectares - 0.005 ? "wp-month-complete" : "wp-month-partial")}>{formatHa(value)}</span> : "—"}</td>)}</tr>
              </tbody>;
            })}
          </table>
        </div>
        <p className="wp-table-footnote"><span><i className="wp-legend-plan" /> Programme</span><span><i className="wp-legend-complete" /> Completed field coverage</span><span><i className="wp-legend-partial" /> Partial coverage</span><span>Hectares shown per round. Completed annual coverage can exceed the field area.</span></p>
      </section> : <section className="panel wp-map-panel"><div className="wp-table-heading"><div><h2>{p.title} · estate map</h2><p>Select a field to see its schedule and round progress.</p></div><details className="wp-colour-rules"><summary><Info size={14} /> Colour rules</summary><div><strong>Months since last completed round</strong><p>Green: below {p.mapRule.greenBelow} months<br />Yellow: {p.mapRule.greenBelow}–{p.mapRule.yellowTo} months<br />Red: above {p.mapRule.yellowTo} months<br />Grey: no completed round</p><small>{p.mapRule.source} thresholds. Colours describe the completion interval; deadline status is shown separately.</small></div></details></div>
        <div className="wp-map-layout"><div className="wp-map-surface"><ProgrammeMap programme={p} selectedField={selected?.fieldNo || ""} onSelectField={onFieldChange} /><div className="wp-map-legend"><span><i style={{ background: "#22a65a" }} /> Green</span><span><i style={{ background: "#f4c542" }} /> Yellow</span><span><i style={{ background: "#d94a38" }} /> Red</span><span><i style={{ background: "#9da5a0" }} /> No interval</span></div></div>
          {selected ? <aside className="wp-map-details" aria-label="Selected field details"><div className="wp-map-field-heading"><Status value={fieldStatus(selected)} /><strong>{selected.fieldNo}</strong></div>
            <dl><Fact label="Category">{selected.category}</Fact><Fact label="Programme hectares">{formatHa(selected.hectares)} ha</Fact><Fact label="Completed rounds">{completedRounds(selected)}/{selected.rounds.length}</Fact><Fact label="Next programme">{monthName(nextRound(selected)?.dueDate || "")}</Fact><Fact label="Delay from next programme">{delayMonths(selected)} months</Fact><Fact label="Completion interval">{mapRating(p, selected).interval == null ? "No completed round" : mapRating(p, selected).interval + " months"}</Fact></dl>
            <h3>Programme rounds</h3><div className="wp-map-rounds">{selected.rounds.map((r) => <div key={r.number}><div><strong>R{r.number} <small>{monthName(r.dueDate)}</small></strong><span>{Math.round(roundActual(r) / r.targetHa * 100)}%</span></div><Meter value={roundActual(r) / r.targetHa * 100} /><small>{formatHa(roundActual(r))} / {formatHa(r.targetHa)} ha</small></div>)}</div>
            {!compact && !readOnly ? <button className="button button-primary" disabled={!canEdit || (!nextRound(selected) && !inPlan(selected.fieldNo))} onClick={() => chooseField(selected)}>{inPlan(selected.fieldNo) ? "Remove from basket" : nextRound(selected) ? "Add to basket" : "All rounds complete"}<ArrowRight size={14} /></button> : null}
          </aside> : null}
        </div><p className="panel-footnote">Historical field boundaries · illustrative schedules and actuals · programme hectares differ from GIS polygon area.</p>
      </section>}
    {!compact ? <p className="wp-data-note">Validated Ha updates round completion. Reported Ha stays pending until the Field Officer validates it.</p> : null}
  </div>;
}

function Fact({ label, children }: { label: string; children: ReactNode }) { return <div><dt>{label}</dt><dd>{children}</dd></div>; }
const colours: Record<string, string> = { green: "#22a65a", yellow: "#f4c542", red: "#d94a38", grey: "#9da5a0" };

function ProgrammeMap({ programme, selectedField, onSelectField }: { programme: Programme; selectedField: string; onSelectField: (fieldNo: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const geometry = useRef<GeoJSON | null>(null);
  const callback = useRef(onSelectField);
  const selected = useRef(selectedField);
  const [error, setError] = useState("");
  const [offline, setOffline] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { callback.current = onSelectField; }, [onSelectField]);
  const applySelection = useCallback(() => {
    geometry.current?.eachLayer((layer) => {
      const path = layer as Path & { feature?: { properties?: { field_no?: string } } };
      const active = path.feature?.properties?.field_no === selected.current;
      path.setStyle({ color: active ? "#122f19" : "#354538", weight: active ? 3.5 : 1.25, fillOpacity: active ? 0.86 : 0.63 });
      if (active) path.bringToFront();
    });
  }, []);
  useEffect(() => { selected.current = selectedField; applySelection(); }, [selectedField, applySelection]);
  useEffect(() => {
    let disposed = false;
    const controller = new AbortController();
    const render = async () => {
      try {
        const [L, response] = await Promise.all([import("leaflet"), fetch((process.env.NEXT_PUBLIC_DEX_BASE_PATH||"")+"/data/field-map-data.geojson", { signal: controller.signal })]);
        if (!response.ok) throw new Error("The local field boundaries could not be loaded.");
        const data = await response.json() as FeatureCollection;
        if (disposed || !container.current) return;
        setError(""); setOffline(false);
        const instance = L.map(container.current, { scrollWheelZoom: false, zoomControl: true });
        map.current = instance;
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 22 })
          .on("tileerror", () => { if (!disposed) setOffline(true); }).addTo(instance);
        const lookup = new Map(programme.fields.map((f) => [f.fieldNo, f]));
        const programmeGeometry = { ...data, features: data.features.filter((f) => lookup.has(String(f.properties?.field_no || ""))) };
        const layer = L.geoJSON(programmeGeometry, {
          style: (feature) => {
            const field = lookup.get(String(feature?.properties?.field_no || ""));
            return { color: "#354538", fillColor: colours[field ? mapRating(programme, field).tone : "grey"], fillOpacity: 0.63, weight: 1.25 };
          },
          onEachFeature: (feature, fieldLayer) => {
            const fieldNo = String(feature.properties?.field_no || "");
            const label = document.createElement("span"); label.textContent = fieldNo;
            fieldLayer.bindTooltip(label, { className: "wp-field-tooltip", direction: "center", permanent: true });
            fieldLayer.on("click", () => callback.current(fieldNo));
          },
        }).addTo(instance);
        geometry.current = layer;
        applySelection();
        const bounds = layer.getBounds(); if (bounds.isValid()) instance.fitBounds(bounds, { padding: [25, 25], maxZoom: 16 });
        const observer = new ResizeObserver(() => instance.invalidateSize({ pan: false }));
        observer.observe(container.current);
        instance.on("unload", () => observer.disconnect());
      } catch (reason) { if (!disposed) setError(reason instanceof Error ? reason.message : "The map could not be loaded."); }
    };
    void render();
    return () => { disposed = true; controller.abort(); map.current?.remove(); map.current = null; geometry.current = null; };
  }, [programme, retry, applySelection]);
  return <div className="wp-map-container"><div ref={container} className="wp-leaflet-map" aria-label="Work programme estate field map" />
    {offline && !error ? <div className="wp-map-offline">Background map unavailable. Local field boundaries and selection remain available.</div> : null}
    {error ? <div className="wp-map-error" role="alert"><p>{error}</p><button className="button" onClick={() => setRetry((n) => n + 1)}>Retry map</button></div> : null}
  </div>;
}

