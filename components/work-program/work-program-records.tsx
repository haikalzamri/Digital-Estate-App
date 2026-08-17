"use client";

import { Check, Edit3, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RecordEditor } from "@/components/work-program/record-editor";
import { useApprovedProgrammeNames } from "@/components/work-program/use-programme-plans";
import { dashboardSourceRows, fieldKey, formatDate, formatNumber, type FieldFeatureCollection } from "@/lib/work-program/analytics";
import { PROGRAM_TYPES } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type RecordsProps = {
  fieldMap: FieldFeatureCollection;
  records: WorkProgramRecord[];
  loading: boolean;
  source: string;
  onSave: (record: WorkProgramRecord) => Promise<WorkProgramRecord>;
  onApprove: (record: WorkProgramRecord) => Promise<WorkProgramRecord>;
  onDelete: (record: WorkProgramRecord) => Promise<void>;
};

type ApprovalTab = "Pending Approval" | "Approved";

export function WorkProgramRecords({ fieldMap, records, loading, source, onSave, onApprove, onDelete }: RecordsProps) {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const approvedProgramOptions = useApprovedProgrammeNames();
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("All");
  const [fieldFilter, setFieldFilter] = useState("All");
  const [dateFilter, setDateFilter] = useState("");
  const [roundFilter, setRoundFilter] = useState("All");
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>("Approved");
  const [trackingProgram, setTrackingProgram] = useState<string>(PROGRAM_TYPES[0]);
  const [trackingMonth, setTrackingMonth] = useState(currentMonth);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [openTrackingCell, setOpenTrackingCell] = useState("");
  const [editingRecord, setEditingRecord] = useState<WorkProgramRecord | null>(null);
  const trackingPanelRef = useRef<HTMLDivElement>(null);
  const activeProgramFilter = programFilter === "All" || approvedProgramOptions.includes(programFilter) ? programFilter : "All";
  const activeTrackingProgram = approvedProgramOptions.includes(trackingProgram) ? trackingProgram : (approvedProgramOptions[0] || PROGRAM_TYPES[0]);

  const fieldNames = useMemo(
    () => fieldMap.features
      .map((feature) => feature.properties.field_no || feature.properties.field_gis)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [fieldMap.features],
  );
  const fieldHaByKey = useMemo(
    () => {
      const referenceHa = new Map<string, number>();
      dashboardSourceRows
        .filter((row) => row.programType === "Mature Circle")
        .forEach((row) => {
          const key = fieldKey(row.field);
          if (key && !referenceHa.has(key) && Number(row.hect) > 0) {
            referenceHa.set(key, Number(row.hect));
          }
        });
      fieldMap.features.forEach((feature) => {
        const key = fieldKey(feature.properties.field_no || feature.properties.field_gis);
        if (key && !referenceHa.has(key)) {
          referenceHa.set(key, Number(feature.properties.ha_gis) || 0);
        }
      });
      return referenceHa;
    },
    [fieldMap.features],
  );

  const broadlyFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (activeProgramFilter !== "All" && record.programType !== activeProgramFilter) return false;
      if (fieldFilter !== "All" && fieldKey(record.blockField) !== fieldKey(fieldFilter)) return false;
      if (dateFilter && (record.actualCompletionDate || record.deadline || "") !== dateFilter) return false;
      if (roundFilter !== "All" && String(normaliseActivityRound(record.activityRound)) !== roundFilter) return false;
      if (!term) return true;
      return [record.blockField, record.programType, record.taskName, record.reporterName, record.remarks, record.actualCompletionDate]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [activeProgramFilter, dateFilter, fieldFilter, records, roundFilter, search]);

  const listRecords = broadlyFiltered.filter((record) => record.approvalStatus === approvalTab);
  const pendingGroups = useMemo(() => groupPendingApprovalRecords(listRecords), [listRecords]);
  const roundOptions = useMemo(
    () => [...new Set(records.map((record) => normaliseActivityRound(record.activityRound)).filter((round) => round > 0))]
      .sort((a, b) => a - b),
    [records],
  );
  const pendingCount = broadlyFiltered.filter((record) => record.approvalStatus !== "Approved").length;
  const approvedCount = broadlyFiltered.filter((record) => record.approvalStatus === "Approved").length;
  const selectedRecord = records.find((record) => record.id === selectedRecordId) || null;
  const selectRecord = useCallback((record: WorkProgramRecord) => {
    const recordMonth = record.actualCompletionDate.slice(0, 7);
    const recordDay = Number(record.actualCompletionDate.slice(8, 10));

    setSelectedRecordId(record.id);
    setTrackingProgram(record.programType);
    if (/^\d{4}-\d{2}$/.test(recordMonth)) setTrackingMonth(recordMonth);
    setOpenTrackingCell(recordDay ? `${record.blockField}-${recordDay}` : "");
  }, []);
  const handleTrackingCellClick = useCallback((field: string, day: number, entries: WorkProgramRecord[]) => {
    const cellKey = `${field}-${day}`;
    const date = `${trackingMonth}-${String(day).padStart(2, "0")}`;
    const isCurrentCellFilter = (
      openTrackingCell === cellKey &&
      activeProgramFilter === activeTrackingProgram &&
      fieldKey(fieldFilter) === fieldKey(field) &&
      dateFilter === date &&
      roundFilter === "All"
    );

    if (isCurrentCellFilter) {
      setSelectedRecordId("");
      setOpenTrackingCell("");
      setDateFilter("");
      setProgramFilter("All");
      setFieldFilter("All");
      setRoundFilter("All");
      return;
    }

    setSelectedRecordId(entries[0]?.id || "");
    setOpenTrackingCell(cellKey);
    setDateFilter(date);
    setProgramFilter(activeTrackingProgram);
    setFieldFilter(field);
    setRoundFilter("All");
  }, [activeProgramFilter, activeTrackingProgram, dateFilter, fieldFilter, openTrackingCell, roundFilter, trackingMonth]);

  const monthRecords = useMemo(
    () => records.filter((record) => record.programType === activeTrackingProgram && record.actualCompletionDate.slice(0, 7) === trackingMonth),
    [activeTrackingProgram, records, trackingMonth],
  );
  const days = daysInMonth(trackingMonth);
  const trackingFields = fieldNames.length
    ? fieldNames
    : [...new Set(monthRecords.map((record) => record.blockField))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const totalTrackingHa = trackingFields.reduce((sum, field) => sum + (fieldHaByKey.get(fieldKey(field)) || 0), 0);
  const monthTotalHa = monthRecords.reduce((sum, record) => sum + Number(record.hectares || 0), 0);
  const selectedDay = selectedRecord?.programType === activeTrackingProgram && selectedRecord.actualCompletionDate.slice(0, 7) === trackingMonth
    ? Number(selectedRecord.actualCompletionDate.slice(8, 10))
    : 0;

  useEffect(() => {
    if (!selectedRecord) return;
    if (selectedRecord.programType !== activeTrackingProgram) return;
    if (selectedRecord.actualCompletionDate.slice(0, 7) !== trackingMonth) return;

    const target = trackingPanelRef.current?.querySelector<HTMLElement>("[data-selected-tracking-cell='true']");
    target?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [activeTrackingProgram, selectedRecord, trackingMonth]);

  return (
    <section className="workspace-section" aria-labelledby="work-program-records-title">
      <div className="workspace-toolbar">
        <div className="section-heading">
          <p>Daily approval and field records</p>
          <h2 id="work-program-records-title">Work Program Daily View</h2>
        </div>
        <div className="toolbar-actions">
          <Link className="primary-button" href="/input/work-program">
            <Plus aria-hidden="true" size={16} /> New Input
          </Link>
          <div className="source-status"><span className={loading ? "loading-dot" : "online-dot"} />{loading ? "Loading" : source}</div>
        </div>
      </div>

      <div className="data-panel records-panel">
        <div className="records-filter-bar">
          <label className="compact-select"><span>Date</span><input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} /></label>
          <label className="compact-select"><span>Activity</span><select value={activeProgramFilter} onChange={(event) => setProgramFilter(event.target.value)}><option>All</option>{approvedProgramOptions.map((program) => <option key={program}>{program}</option>)}</select></label>
          <label className="compact-select"><span>Field</span><select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)}><option>All</option>{fieldNames.map((field) => <option key={field}>{field}</option>)}</select></label>
          <label className="compact-select"><span>Round</span><select value={roundFilter} onChange={(event) => setRoundFilter(event.target.value)}><option>All</option>{roundOptions.map((round) => <option key={round} value={round}>R{round}</option>)}</select></label>
          <label className="search-control"><Search aria-hidden="true" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>
        </div>
        <div className="approval-tabs" role="tablist" aria-label="Record approval status">
          <button className={approvalTab === "Pending Approval" ? "active pending" : ""} type="button" onClick={() => setApprovalTab("Pending Approval")}>Not approved <span>{pendingCount}</span></button>
          <button className={approvalTab === "Approved" ? "active approved" : ""} type="button" onClick={() => setApprovalTab("Approved")}>Approved <span>{approvedCount}</span></button>
        </div>
        <div className="record-list" aria-live="polite">
          {approvalTab === "Pending Approval" ? (
            pendingGroups.length ? pendingGroups.map((dateGroup) => (
              <section className="pending-date-group" key={dateGroup.date}>
                <header className="pending-date-heading">
                  <strong>{formatDate(dateGroup.date)}</strong>
                  <span>{dateGroup.totalRecords} field{dateGroup.totalRecords === 1 ? "" : "s"} pending</span>
                </header>
                <div className="pending-activity-list">
                  {dateGroup.activities.map((activity) => (
                    <article className="pending-activity-group" key={activity.id}>
                      <div className="pending-activity-heading">
                        <span className="program-swatch" style={{ backgroundColor: programColour(activity.programType) }} />
                        <div>
                          <strong>{activity.label}</strong>
                          <small>{activity.records.length} field{activity.records.length === 1 ? "" : "s"} · {formatNumber(activity.totalHa, 8)} ha</small>
                        </div>
                      </div>
                      <div className="pending-field-list">
                        {activity.records.map((record) => (
                          <article
                            className={`pending-field-row${selectedRecordId === record.id ? " selected" : ""}`}
                            key={record.id}
                            onClick={() => selectRecord(record)}
                          >
                            <div className="pending-field-main">
                              <strong>{record.blockField}</strong>
                              <span>R{normaliseActivityRound(record.activityRound)} · {formatNumber(record.hectares, 8)} ha</span>
                              {record.remarks ? <small>{record.remarks}</small> : null}
                            </div>
                            <div className="record-actions">
                              <button type="button" onClick={(event) => { event.stopPropagation(); void onApprove(record); }} title="Approve record" aria-label="Approve record"><Check size={16} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); setEditingRecord(record); }} title="Edit record" aria-label="Edit record"><Edit3 size={16} /></button>
                              <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm("Delete this record?")) void onDelete(record); }} title="Delete record" aria-label="Delete record"><Trash2 size={16} /></button>
                            </div>
                          </article>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )) : <p className="empty-state">No records match these filters.</p>
          ) : listRecords.length ? listRecords.map((record) => (
            <article
              className={`record-row${selectedRecordId === record.id ? " selected" : ""}`}
              key={record.id}
              onClick={() => selectRecord(record)}
            >
              <span className="program-swatch" style={{ backgroundColor: programColour(record.programType) }} />
              <div className="record-main">
                <strong>{record.blockField} - {record.programType}</strong>
                <span>{formatDate(record.actualCompletionDate)} | Round {normaliseActivityRound(record.activityRound)} | {formatNumber(record.hectares, 8)} ha | {record.reporterName}</span>
              </div>
              <span className={`status-pill ${record.approvalStatus === "Approved" ? "approved" : "pending"}`}>{record.approvalStatus}</span>
              <div className="record-actions">
                {record.approvalStatus !== "Approved" ? <button type="button" onClick={(event) => { event.stopPropagation(); void onApprove(record); }} title="Approve record" aria-label="Approve record"><Check size={16} /></button> : null}
                <button type="button" onClick={(event) => { event.stopPropagation(); setEditingRecord(record); }} title="Edit record" aria-label="Edit record"><Edit3 size={16} /></button>
                <button type="button" onClick={(event) => { event.stopPropagation(); if (window.confirm("Delete this record?")) void onDelete(record); }} title="Delete record" aria-label="Delete record"><Trash2 size={16} /></button>
              </div>
            </article>
          )) : <p className="empty-state">No records match these filters.</p>}
        </div>
      </div>

      <div className="data-panel tracking-panel" ref={trackingPanelRef}>
        <div className="panel-heading">
          <div><h3>Monthly Field Tracking</h3><p>Approved values are green; not-approved values are orange.</p></div>
          <div className="toolbar-actions">
            <label className="compact-select"><span>Program</span><select value={activeTrackingProgram} onChange={(event) => setTrackingProgram(event.target.value)}>{approvedProgramOptions.map((program) => <option key={program}>{program}</option>)}</select></label>
            <label className="compact-select"><span>Month</span><input type="month" value={trackingMonth} onChange={(event) => setTrackingMonth(event.target.value)} /></label>
          </div>
        </div>
        <div className="wide-table-scroll tracking-scroll">
          <table className="tracking-table">
            <thead><tr><th>Field No</th><th>Ha</th>{Array.from({ length: days }, (_, index) => <th className={selectedDay === index + 1 ? "column-selected" : ""} key={index + 1}>{index + 1}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {trackingFields.map((field) => {
                const fieldRecords = monthRecords.filter((record) => fieldKey(record.blockField) === fieldKey(field));
                const fieldHa = fieldHaByKey.get(fieldKey(field)) || 0;
                const monthTotal = fieldRecords.reduce((sum, record) => sum + Number(record.hectares || 0), 0);
                const selectedRow = Boolean(
                  selectedRecord &&
                  selectedRecord.programType === activeTrackingProgram &&
                  selectedRecord.actualCompletionDate.slice(0, 7) === trackingMonth &&
                  fieldKey(selectedRecord.blockField) === fieldKey(field),
                );
                return (
                  <tr className={selectedRow ? "row-selected" : ""} key={field}>
                    <th>{field}</th>
                    <td className="tracking-ha-cell">{fieldHa ? formatNumber(fieldHa, 8) : "-"}</td>
                    {Array.from({ length: days }, (_, index) => {
                      const day = index + 1;
                      const entries = fieldRecords.filter((record) => Number(record.actualCompletionDate.slice(8, 10)) === day);
                      const total = entries.reduce((sum, record) => sum + Number(record.hectares || 0), 0);
                      const cellKey = `${field}-${day}`;
                      const selectedCell = Boolean(selectedRow && selectedDay === day);
                      return (
                        <td className={`${selectedDay === day ? "column-selected" : ""}${selectedCell ? " cell-selected" : ""} tracking-cell`} data-selected-tracking-cell={selectedCell || undefined} key={day}>
                          {total ? <button className={`tracking-value ${approvalClass(entries)}`} type="button" onClick={() => handleTrackingCellClick(field, day, entries)}>{formatNumber(total, 8)}</button> : null}
                          {openTrackingCell === cellKey && entries.length ? <div className="tracking-popover"><strong>{field} · Day {day}</strong><div className={entries.length > 5 ? "tracking-entry-scroll" : ""}>{entries.map((record) => <button type="button" key={record.id} onClick={() => { setSelectedRecordId(record.id); setEditingRecord(record); }}><span>R{normaliseActivityRound(record.activityRound)} · {formatNumber(record.hectares, 8)} ha</span><small>{record.approvalStatus}</small><Edit3 size={14} /></button>)}</div></div> : null}
                        </td>
                      );
                    })}
                    <td className="row-total">{formatNumber(monthTotal, 8)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><th>Total</th><td>{formatNumber(totalTrackingHa, 8)}</td>{Array.from({ length: days }, (_, index) => { const day = index + 1; const total = monthRecords.filter((record) => Number(record.actualCompletionDate.slice(8, 10)) === day).reduce((sum, record) => sum + Number(record.hectares || 0), 0); return <td key={day}>{total ? formatNumber(total, 8) : ""}</td>; })}<td>{formatNumber(monthTotalHa, 8)}</td></tr></tfoot>
          </table>
        </div>
      </div>

      {editingRecord ? <RecordEditor key={editingRecord.id} record={editingRecord} fieldMap={fieldMap} onClose={() => setEditingRecord(null)} onSave={onSave} /> : null}
    </section>
  );
}

function daysInMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return 31;
  return new Date(year, monthNumber, 0).getDate();
}

function approvalClass(records: WorkProgramRecord[]) {
  const approved = records.filter((record) => record.approvalStatus === "Approved").length;
  if (approved === records.length) return "approved";
  if (!approved) return "pending";
  return "mixed";
}

type PendingActivityGroup = {
  id: string;
  label: string;
  programType: string;
  totalHa: number;
  records: WorkProgramRecord[];
};

type PendingDateGroup = {
  date: string;
  totalRecords: number;
  activities: PendingActivityGroup[];
};

function groupPendingApprovalRecords(records: WorkProgramRecord[]): PendingDateGroup[] {
  const dateGroups = new Map<string, Map<string, PendingActivityGroup>>();

  records
    .filter((record) => record.approvalStatus !== "Approved")
    .forEach((record) => {
      const date = record.actualCompletionDate || record.deadline || "";
      const activityLabel = activityLabelForRecord(record);
      const activityKey = `${normaliseGroupValue(record.taskName || record.programType)}|${normaliseGroupValue(record.programType)}`;
      const activities = dateGroups.get(date) || new Map<string, PendingActivityGroup>();
      const activity = activities.get(activityKey) || {
        id: `${date}-${activityKey}`,
        label: activityLabel,
        programType: record.programType,
        totalHa: 0,
        records: [],
      };
      activity.totalHa += Number(record.hectares || 0);
      activity.records.push(record);
      activities.set(activityKey, activity);
      dateGroups.set(date, activities);
    });

  return [...dateGroups.entries()]
    .sort(([dateA], [dateB]) => dateB.localeCompare(dateA))
    .map(([date, activities]) => ({
      date,
      activities: [...activities.values()]
        .map((activity) => ({
          ...activity,
          records: [...activity.records].sort((a, b) => a.blockField.localeCompare(b.blockField, undefined, { numeric: true })),
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
      totalRecords: [...activities.values()].reduce((total, activity) => total + activity.records.length, 0),
    }));
}

function activityLabelForRecord(record: WorkProgramRecord) {
  const activityCode = String(record.taskName || "").trim();
  if (activityCode && fieldKey(activityCode) !== fieldKey(record.programType)) return `${activityCode} · ${record.programType}`;
  return record.programType;
}

function normaliseGroupValue(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function programColour(program: string) {
  const colours: Record<string, string> = {
    "Mature Circle": "#2563eb", "Mature Woodies & Steno": "#8b5cf6", Pruning: "#22a65a", Raking: "#d8912b",
  };
  return colours[program] || "#176b4d";
}

function normaliseActivityRound(value: unknown) {
  const round = Number(value);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}
