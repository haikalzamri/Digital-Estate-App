"use client";

import { Check, Edit3, MapPinned, Search, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { RecordsFieldMap } from "@/components/maps/work-program-map";
import { RecordEditor } from "@/components/work-program/record-editor";
import { fieldKey, formatDate, formatNumber, type FieldFeatureCollection } from "@/lib/work-program/analytics";
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
  const [search, setSearch] = useState("");
  const [programFilter, setProgramFilter] = useState("All");
  const [fieldFilter, setFieldFilter] = useState("All");
  const [approvalTab, setApprovalTab] = useState<ApprovalTab>("Approved");
  const [trackingProgram, setTrackingProgram] = useState<string>(PROGRAM_TYPES[0]);
  const [trackingMonth, setTrackingMonth] = useState(currentMonth);
  const [selectedRecordId, setSelectedRecordId] = useState("");
  const [openTrackingCell, setOpenTrackingCell] = useState("");
  const [editingRecord, setEditingRecord] = useState<WorkProgramRecord | null>(null);

  const fieldNames = useMemo(
    () => fieldMap.features
      .map((feature) => feature.properties.field_no || feature.properties.field_gis)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [fieldMap.features],
  );

  const broadlyFiltered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return records.filter((record) => {
      if (programFilter !== "All" && record.programType !== programFilter) return false;
      if (fieldFilter !== "All" && fieldKey(record.blockField) !== fieldKey(fieldFilter)) return false;
      if (!term) return true;
      return [record.blockField, record.programType, record.reporterName, record.remarks]
        .some((value) => String(value || "").toLowerCase().includes(term));
    });
  }, [fieldFilter, programFilter, records, search]);

  const listRecords = broadlyFiltered.filter((record) => record.approvalStatus === approvalTab);
  const pendingCount = broadlyFiltered.filter((record) => record.approvalStatus !== "Approved").length;
  const approvedCount = broadlyFiltered.filter((record) => record.approvalStatus === "Approved").length;
  const mapRecords = broadlyFiltered;
  const selectedRecord = records.find((record) => record.id === selectedRecordId) || null;
  const selectRecord = useCallback((record: WorkProgramRecord) => setSelectedRecordId(record.id), []);
  const editFromMap = useCallback((record: WorkProgramRecord) => {
    setSelectedRecordId(record.id);
    setEditingRecord(record);
  }, []);

  const monthRecords = useMemo(
    () => records.filter((record) => record.programType === trackingProgram && record.actualCompletionDate.slice(0, 7) === trackingMonth),
    [records, trackingMonth, trackingProgram],
  );
  const days = daysInMonth(trackingMonth);
  const trackingFields = fieldNames.length
    ? fieldNames
    : [...new Set(monthRecords.map((record) => record.blockField))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const selectedDay = selectedRecord?.actualCompletionDate.slice(0, 7) === trackingMonth
    ? Number(selectedRecord.actualCompletionDate.slice(8, 10))
    : 0;

  return (
    <section className="workspace-section" aria-labelledby="work-program-records-title">
      <div className="workspace-toolbar">
        <div className="section-heading">
          <p>Approval and field records</p>
          <h2 id="work-program-records-title">Work Program Records</h2>
        </div>
        <div className="source-status"><span className={loading ? "loading-dot" : "online-dot"} />{loading ? "Loading" : source}</div>
      </div>

      <div className="data-panel records-panel">
        <div className="records-filter-bar">
          <label className="search-control"><Search aria-hidden="true" size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search records" /></label>
          <label className="compact-select"><span>Program</span><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)}><option>All</option>{PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}</select></label>
          <label className="compact-select"><span>Field</span><select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value)}><option>All</option>{fieldNames.map((field) => <option key={field}>{field}</option>)}</select></label>
        </div>
        <div className="approval-tabs" role="tablist" aria-label="Record approval status">
          <button className={approvalTab === "Pending Approval" ? "active pending" : ""} type="button" onClick={() => setApprovalTab("Pending Approval")}>Not approved <span>{pendingCount}</span></button>
          <button className={approvalTab === "Approved" ? "active approved" : ""} type="button" onClick={() => setApprovalTab("Approved")}>Approved <span>{approvedCount}</span></button>
        </div>
        <div className="record-list" aria-live="polite">
          {listRecords.length ? listRecords.map((record) => (
            <article
              className={`record-row${selectedRecordId === record.id ? " selected" : ""}`}
              key={record.id}
              onClick={() => selectRecord(record)}
            >
              <span className="program-swatch" style={{ backgroundColor: programColour(record.programType) }} />
              <div className="record-main">
                <strong>{record.blockField} - {record.programType}</strong>
                <span>{formatDate(record.actualCompletionDate)} | {formatNumber(record.hectares, 8)} ha | {record.reporterName}</span>
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

      <div className="data-panel tracking-panel">
        <div className="panel-heading">
          <div><h3>Monthly Field Tracking</h3><p>Approved values are green; not-approved values are orange.</p></div>
          <div className="toolbar-actions">
            <label className="compact-select"><span>Program</span><select value={trackingProgram} onChange={(event) => setTrackingProgram(event.target.value)}>{PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}</select></label>
            <label className="compact-select"><span>Month</span><input type="month" value={trackingMonth} onChange={(event) => setTrackingMonth(event.target.value)} /></label>
          </div>
        </div>
        <div className="wide-table-scroll tracking-scroll">
          <table className="tracking-table">
            <thead><tr><th>Field No</th>{Array.from({ length: days }, (_, index) => <th className={selectedDay === index + 1 ? "column-selected" : ""} key={index + 1}>{index + 1}</th>)}<th>Total</th></tr></thead>
            <tbody>
              {trackingFields.map((field) => {
                const fieldRecords = monthRecords.filter((record) => fieldKey(record.blockField) === fieldKey(field));
                const selectedRow = selectedRecord && fieldKey(selectedRecord.blockField) === fieldKey(field);
                return (
                  <tr className={selectedRow ? "row-selected" : ""} key={field}>
                    <th>{field}</th>
                    {Array.from({ length: days }, (_, index) => {
                      const day = index + 1;
                      const entries = fieldRecords.filter((record) => Number(record.actualCompletionDate.slice(8, 10)) === day);
                      const total = entries.reduce((sum, record) => sum + Number(record.hectares || 0), 0);
                      const cellKey = `${field}-${day}`;
                      return (
                        <td className={`${selectedDay === day ? "column-selected" : ""} tracking-cell`} key={day}>
                          {total ? <button className={`tracking-value ${approvalClass(entries)}`} type="button" onClick={() => { setSelectedRecordId(entries[0].id); setOpenTrackingCell(openTrackingCell === cellKey ? "" : cellKey); }}>{formatNumber(total, 8)}</button> : null}
                          {openTrackingCell === cellKey && entries.length ? <div className="tracking-popover"><strong>{field} · Day {day}</strong><div className={entries.length > 5 ? "tracking-entry-scroll" : ""}>{entries.map((record) => <button type="button" key={record.id} onClick={() => { setSelectedRecordId(record.id); setEditingRecord(record); }}><span>{formatNumber(record.hectares, 8)} ha</span><small>{record.approvalStatus}</small><Edit3 size={14} /></button>)}</div></div> : null}
                        </td>
                      );
                    })}
                    <td className="row-total">{formatNumber(fieldRecords.reduce((sum, record) => sum + Number(record.hectares || 0), 0), 8)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot><tr><th>Total</th>{Array.from({ length: days }, (_, index) => { const day = index + 1; const total = monthRecords.filter((record) => Number(record.actualCompletionDate.slice(8, 10)) === day).reduce((sum, record) => sum + Number(record.hectares || 0), 0); return <td key={day}>{total ? formatNumber(total, 8) : ""}</td>; })}<td>{formatNumber(monthRecords.reduce((sum, record) => sum + Number(record.hectares || 0), 0), 8)}</td></tr></tfoot>
          </table>
        </div>
      </div>

      <div className="data-panel records-map-panel">
        <div className="panel-heading">
          <div><h3>Map Output</h3><p>All filtered records appear regardless of approval status.</p></div>
          <div className="map-selection-actions">
            <MapPinned aria-hidden="true" size={17} />
            <span>{selectedRecord ? `${selectedRecord.blockField} - ${selectedRecord.programType}` : "Select a pin to edit"}</span>
            {selectedRecord ? <button className="secondary-button" type="button" onClick={() => setEditingRecord(selectedRecord)}><Edit3 size={15} /> Edit selected</button> : null}
          </div>
        </div>
        <RecordsFieldMap fieldMap={fieldMap} records={mapRecords} selectedRecordId={selectedRecordId} onSelectRecord={editFromMap} />
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

function programColour(program: string) {
  const colours: Record<string, string> = {
    "Mature Circle": "#2563eb", "Mature Woodies & Steno": "#8b5cf6", Pruning: "#22a65a", Raking: "#d8912b",
  };
  return colours[program] || "#176b4d";
}
