"use client";

import { CalendarDays, Database, Download, Eye, EyeOff, Info, MapPinned, Table2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DashboardFieldMap } from "@/components/maps/work-program-map";
import {
  dashboardYearLabel,
  fieldKey,
  formatDate,
  formatNumber,
  getDashboardRows,
  getMapStatuses,
  recordsForMonthCell,
  sumRowMonths,
  type DashboardRow,
  type FieldFeatureCollection,
} from "@/lib/work-program/analytics";
import { MAP_STATUS_RULES, MONTHS_2026, PROGRAM_TYPES } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type DashboardProps = {
  fieldMap: FieldFeatureCollection;
  records: WorkProgramRecord[];
  loading: boolean;
  source: string;
};

type SelectedCell = { field: string; month: string } | null;

export function WorkProgramDashboard({ fieldMap, records, loading, source }: DashboardProps) {
  const [programType, setProgramType] = useState<string>(PROGRAM_TYPES[0]);
  const [view, setView] = useState<"table" | "map">("table");
  const [showProgramme, setShowProgramme] = useState(false);
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedField, setSelectedField] = useState("");
  const [showRules, setShowRules] = useState(false);

  const dashboard = useMemo(
    () => getDashboardRows(programType, records, fieldMap.features),
    [fieldMap.features, programType, records],
  );
  const mapStatuses = useMemo(
    () => getMapStatuses(programType, records, fieldMap.features),
    [fieldMap.features, programType, records],
  );
  const approved = useMemo(
    () => records.filter((record) => record.programType === programType && record.approvalStatus === "Approved"),
    [programType, records],
  );
  const totalHectares = approved.reduce((total, record) => total + Number(record.hectares || 0), 0);
  const activeFields = new Set(approved.map((record) => fieldKey(record.blockField))).size;
  const selectedStatus =
    mapStatuses.find((item) => item.field.properties.field_gis === selectedField) || mapStatuses[0] || null;
  const selectMapField = useCallback((fieldGis: string) => setSelectedField(fieldGis), []);

  const downloadDataset = () => {
    const headers = [
      "Field",
      "Category",
      "Ha",
      "Actual/Budget",
      "Frequency",
      "Completed Rounds",
      "Interval (months)",
      "Proposed Next Date",
      "Month",
      "Value",
    ];
    const completedByField = new Map(dashboard.completedRows.map((row) => [fieldKey(row.field), row]));
    const actualRows = approved.map((record) => {
      const row = completedByField.get(fieldKey(record.blockField));
      return [
        record.blockField,
        row?.category || record.category || "",
        row?.hect || record.hectares,
        "Actual",
        row?.frequencyMonths || "",
        row?.completedRounds || "",
        row?.intervalMonths ?? "",
        row?.proposedNextDate || "",
        (record.actualCompletionDate || record.deadline || "").slice(0, 7),
        record.hectares,
      ];
    });
    const budgetRows = dashboard.programmeRows.flatMap((row) =>
      MONTHS_2026.filter((month) => Number(row.months[month.key]) > 0).map((month) => [
        row.field,
        row.category,
        row.hect,
        "Budget",
        row.frequencyMonths,
        row.completedRounds,
        row.intervalMonths,
        row.proposedNextDate,
        month.key,
        row.months[month.key],
      ]),
    );
    const csv = [headers, ...actualRows, ...budgetRows].map((row) => row.map(csvValue).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `work-program-${programType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dashboardYearLabel()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="workspace-section" aria-labelledby="work-program-dashboard-title">
      <div className="workspace-toolbar">
        <div className="section-heading">
          <p>Management overview</p>
          <h2 id="work-program-dashboard-title">Work Program Dashboard</h2>
        </div>
        <div className="toolbar-actions">
          <label className="select-control">
            <span>Work Program</span>
            <select value={programType} onChange={(event) => setProgramType(event.target.value)}>
              {PROGRAM_TYPES.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-control" aria-label="Dashboard display">
            <button className={view === "table" ? "active" : ""} type="button" onClick={() => setView("table")}>
              <Table2 aria-hidden="true" size={16} /> Table
            </button>
            <button className={view === "map" ? "active" : ""} type="button" onClick={() => setView("map")}>
              <MapPinned aria-hidden="true" size={16} /> Map
            </button>
          </div>
          <button className="command-button" type="button" onClick={downloadDataset}>
            <Download aria-hidden="true" size={16} /> Export
          </button>
        </div>
      </div>

      <div className="kpi-strip">
        <Kpi label="Approved entries" value={formatNumber(approved.length)} icon={<Database size={18} />} />
        <Kpi label="Completed hectares" value={formatNumber(totalHectares)} icon={<CalendarDays size={18} />} />
        <Kpi label="Fields with activity" value={formatNumber(activeFields)} icon={<MapPinned size={18} />} />
        <div className="kpi-item data-source-kpi">
          <span>Data source</span>
          <strong>{loading ? "Loading" : source}</strong>
          <small>Approved records only</small>
        </div>
      </div>

      {view === "table" ? (
        <div className="data-panel dashboard-table-panel">
          <div className="panel-heading">
            <div>
              <h3>{dashboardYearLabel()} field plan and completion</h3>
              <p>Click a completed month value to review its daily entries.</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setShowProgramme((current) => !current)}>
              {showProgramme ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
              {showProgramme ? "Hide programme rows" : "Show programme rows"}
            </button>
          </div>
          <div className="wide-table-scroll dashboard-scroll">
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Category</th>
                  <th>Ha</th>
                  <th>Actual / Budget</th>
                  <th>Frequency</th>
                  <th>Completed Rounds</th>
                  <th>Interval</th>
                  <th>Proposed Next Date</th>
                  {MONTHS_2026.map((month) => (
                    <th className={selectedCell?.month === month.key ? "column-selected" : ""} key={month.key}>
                      {month.label}
                    </th>
                  ))}
                  <th>Total</th>
                </tr>
              </thead>
              {dashboard.completedRows.map((completed) => {
                const programme = dashboard.programmeRows.find((row) => fieldKey(row.field) === fieldKey(completed.field));
                const selected = selectedCell?.field === completed.field;
                return (
                  <tbody className={selected ? "row-selected" : ""} key={completed.id}>
                    <DashboardTableRow
                      row={completed}
                      records={records}
                      selectedCell={selectedCell}
                      setSelectedCell={setSelectedCell}
                      rowSpan={showProgramme && programme ? 2 : 1}
                      showSharedCells
                    />
                    {showProgramme && programme ? (
                      <DashboardTableRow
                        row={programme}
                        records={records}
                        selectedCell={selectedCell}
                        setSelectedCell={setSelectedCell}
                        rowSpan={1}
                        showSharedCells={false}
                      />
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
      ) : (
        <div className="map-workspace">
          <div className="data-panel map-panel">
            <div className="panel-heading">
              <div>
                <h3>Estate interval status</h3>
                <p>Field colours are calculated from the current month interval.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setShowRules(true)}>
                <Info aria-hidden="true" size={16} /> Colour rules
              </button>
            </div>
            <DashboardFieldMap
              fieldMap={fieldMap}
              statuses={mapStatuses}
              selectedField={selectedStatus?.field.properties.field_gis || ""}
              onSelectField={selectMapField}
            />
          </div>
          <aside className="data-panel field-detail-panel">
            {selectedStatus ? (
              <>
                <span className={`status-pill status-${selectedStatus.status}`}>{selectedStatus.label}</span>
                <h3>{selectedStatus.field.properties.field_no || selectedStatus.field.properties.field_gis}</h3>
                <dl className="detail-list">
                  <Detail label="GIS ID" value={selectedStatus.field.properties.field_gis} />
                  <Detail label="Programme" value={programType} />
                  <Detail label="Category" value={selectedStatus.row?.category || selectedStatus.completedRow?.category || "-"} />
                  <Detail label="GIS hectares" value={formatNumber(selectedStatus.field.properties.ha_gis)} />
                  <Detail label="Planned to date" value={formatNumber(selectedStatus.plannedToDate)} />
                  <Detail label="Completed to date" value={formatNumber(selectedStatus.completedToDate)} />
                  <Detail label="Proposed next date" value={formatDate(selectedStatus.proposedNextDate)} />
                  <Detail label="Interval" value={selectedStatus.intervalValue == null ? "-" : `${formatNumber(selectedStatus.intervalValue)} months`} />
                </dl>
                <p className="detail-note">{selectedStatus.message}</p>
              </>
            ) : (
              <p className="empty-state">Map data is loading.</p>
            )}
          </aside>
        </div>
      )}

      {showRules ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowRules(false)}>
          <div className="modal-card rules-modal" role="dialog" aria-modal="true" aria-labelledby="map-rules-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Map reference</p>
                <h2 id="map-rules-title">Interval colour rules</h2>
              </div>
              <button className="secondary-button" type="button" onClick={() => setShowRules(false)}>Close</button>
            </div>
            <div className="rules-list">
              {Object.entries(MAP_STATUS_RULES).map(([program, rule]) => (
                <div key={program}>
                  <strong>{program}</strong>
                  <span><i className="rule-dot green" /> Green {rule.greenText}</span>
                  <span><i className="rule-dot yellow" /> Yellow {rule.yellowText}</span>
                  <span><i className="rule-dot red" /> Red {rule.redText}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DashboardTableRow({
  row,
  records,
  selectedCell,
  setSelectedCell,
  rowSpan,
  showSharedCells,
}: {
  row: DashboardRow;
  records: WorkProgramRecord[];
  selectedCell: SelectedCell;
  setSelectedCell: (cell: SelectedCell) => void;
  rowSpan: number;
  showSharedCells: boolean;
}) {
  return (
    <tr className={row.actualBudget === "Programme" ? "programme-row" : "completed-row"}>
      {showSharedCells ? <th rowSpan={rowSpan}>{row.field}</th> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{row.category || "-"}</td> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{formatNumber(row.hect)}</td> : null}
      <td><span className={`row-type ${row.actualBudget.toLowerCase()}`}>{row.actualBudget}</span></td>
      <td>{row.frequencyMonths || "-"}</td>
      <td>{row.completedRounds || "-"}</td>
      <td>{row.intervalMonths === "" ? "-" : row.intervalMonths}</td>
      <td>{formatDate(row.proposedNextDate)}</td>
      {MONTHS_2026.map((month) => {
        const value = Number(row.months[month.key]) || 0;
        const open = selectedCell?.field === row.field && selectedCell.month === month.key;
        const entries = row.actualBudget === "Completed" ? recordsForMonthCell(records, row.programType, row.field, month.key) : [];
        return (
          <td className={`${selectedCell?.month === month.key ? "column-selected" : ""} month-cell`} key={month.key}>
            {value ? (
              <button
                className="month-value"
                type="button"
                onClick={() => setSelectedCell(open ? null : { field: row.field, month: month.key })}
                aria-expanded={open}
              >
                {formatNumber(value)}
              </button>
            ) : null}
            {open && row.actualBudget === "Completed" ? (
              <div className="month-popover">
                <strong>{row.field} · {month.label}</strong>
                <div className={entries.length > 5 ? "month-entry-scroll" : ""}>
                  {entries.length ? entries.map((entry) => (
                    <span key={entry.id}><b>{formatDate(entry.actualCompletionDate)}</b>{formatNumber(entry.hectares)} ha</span>
                  )) : <span>No daily entries</span>}
                </div>
              </div>
            ) : null}
          </td>
        );
      })}
      <td className="row-total">{formatNumber(sumRowMonths(row))}</td>
    </tr>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="kpi-item"><span>{icon}{label}</span><strong>{value}</strong></div>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt>{label}</dt><dd>{value || "-"}</dd></div>;
}

function csvValue(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
