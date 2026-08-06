"use client";

import { CalendarDays, Database, Download, Eye, EyeOff, Info, MapPinned, Pencil, Plus, RotateCcw, Save, Table2, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { DashboardFieldMap } from "@/components/maps/work-program-map";
import {
  dashboardYearLabel,
  fieldKey,
  formatDate,
  formatNumber,
  getDashboardRows,
  getMapStatuses,
  normaliseKey,
  recordsForMonthCell,
  sumRowMonths,
  type DashboardRow,
  type FieldFeature,
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
type ProgrammeRowsByName = Record<string, DashboardRow[]>;
type ChangeLogEntry = {
  id: string;
  programme: string;
  action: string;
  detail: string;
  day: string;
  time: string;
};

export function WorkProgramDashboard({ fieldMap, records, loading, source }: DashboardProps) {
  const [programOptions, setProgramOptions] = useState<string[]>(() => [...PROGRAM_TYPES]);
  const [programmeRowsByProgram, setProgrammeRowsByProgram] = useState<ProgrammeRowsByName>({});
  const [draftProgramOptions, setDraftProgramOptions] = useState<string[]>([]);
  const [draftRowsByProgram, setDraftRowsByProgram] = useState<ProgrammeRowsByName>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [programType, setProgramType] = useState<string>(PROGRAM_TYPES[0]);
  const [view, setView] = useState<"table" | "map">("table");
  const [showProgramme, setShowProgramme] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedField, setSelectedField] = useState("");
  const [showRules, setShowRules] = useState(false);

  const baseDashboard = useMemo(
    () => getDashboardRows(programType, records, fieldMap.features),
    [fieldMap.features, programType, records],
  );
  const activeProgramOptions = editMode ? draftProgramOptions : programOptions;
  const currentProgrammeRows = useMemo(() => {
    const rows = editMode ? draftRowsByProgram[programType] : programmeRowsByProgram[programType];
    return cloneRows(rows || baseDashboard.programmeRows);
  }, [baseDashboard.programmeRows, draftRowsByProgram, editMode, programType, programmeRowsByProgram]);
  const dashboard = useMemo(
    () => ({ ...baseDashboard, programmeRows: currentProgrammeRows }),
    [baseDashboard, currentProgrammeRows],
  );
  const tablePairs = useMemo(
    () => buildTablePairs(baseDashboard.completedRows, dashboard.programmeRows),
    [baseDashboard.completedRows, dashboard.programmeRows],
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
  const shouldShowProgramme = editMode || showProgramme;
  const logChange = useCallback((programme: string, action: string, detail: string) => {
    const loggedAt = new Date();
    setChangeLogs((current) => [
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        programme,
        action,
        detail,
        day: formatLogDay(loggedAt),
        time: formatLogTime(loggedAt),
      },
      ...current,
    ].slice(0, 40));
  }, []);
  const visibleChangeLogs = useMemo(
    () => changeLogs.filter((log) => log.programme === programType),
    [changeLogs, programType],
  );

  const seedDraftRows = useCallback((programme: string, current: ProgrammeRowsByName) => {
    if (current[programme]) return current[programme];
    return cloneRows(programmeRowsByProgram[programme] || (programme === programType ? baseDashboard.programmeRows : templateRowsFromFields(programme, fieldMap.features)));
  }, [baseDashboard.programmeRows, fieldMap.features, programType, programmeRowsByProgram]);

  const startEditMode = () => {
    setView("table");
    setShowProgramme(true);
    setDraftProgramOptions(programOptions);
    setDraftRowsByProgram({
      ...cloneRowsByProgram(programmeRowsByProgram),
      [programType]: cloneRows(currentProgrammeRows),
    });
    setEditMode(true);
  };

  const saveTemplateChanges = () => {
    const nextRows = {
      ...programmeRowsByProgram,
      ...cloneRowsByProgram(draftRowsByProgram),
    };
    Object.keys(nextRows).forEach((programme) => {
      if (!draftProgramOptions.includes(programme)) delete nextRows[programme];
    });
    setProgramOptions(draftProgramOptions);
    setProgrammeRowsByProgram(nextRows);
    setEditMode(false);
    setNewProgramName("");
    logChange(programType, "Saved template", `${draftProgramOptions.length} programmes available in prototype setup.`);
  };

  const cancelTemplateChanges = () => {
    setEditMode(false);
    setDraftProgramOptions([]);
    setDraftRowsByProgram({});
    setNewProgramName("");
  };

  const updateProgrammeRows = (updater: (rows: DashboardRow[]) => DashboardRow[]) => {
    setDraftRowsByProgram((current) => {
      const rows = seedDraftRows(programType, current);
      return { ...current, [programType]: updater(cloneRows(rows)) };
    });
  };

  const updateProgrammeRow = (rowId: string, updater: (row: DashboardRow) => DashboardRow) => {
    updateProgrammeRows((rows) => rows.map((row) => (row.id === rowId ? updater(row) : row)));
  };

  const addProgramme = () => {
    const name = newProgramName.trim();
    if (!name) return;
    if (draftProgramOptions.some((program) => program.toLowerCase() === name.toLowerCase())) {
      const existing = draftProgramOptions.find((program) => program.toLowerCase() === name.toLowerCase()) || name;
      setProgramType(existing);
      setNewProgramName("");
      return;
    }
    setDraftProgramOptions((current) => [...current, name]);
    setDraftRowsByProgram((current) => ({ ...current, [name]: templateRowsFromFields(name, fieldMap.features) }));
    setProgramType(name);
    setNewProgramName("");
    logChange(name, "Programme created", "New programme template created with field, category, ha, and monthly planning cells.");
  };

  const deleteProgramme = () => {
    if (draftProgramOptions.length <= 1) return;
    const deleted = programType;
    const nextOptions = draftProgramOptions.filter((program) => program !== deleted);
    setDraftProgramOptions(nextOptions);
    setDraftRowsByProgram((current) => {
      const next = { ...current };
      delete next[deleted];
      return next;
    });
    setProgramType(nextOptions[0] || "");
    logChange(deleted, "Programme deleted", "Removed from the prototype work programme listing.");
  };

  const clearProgrammeMonths = () => {
    updateProgrammeRows((rows) => rows.map((row) => ({ ...row, months: emptyMonthValues() })));
    logChange(programType, "Monthly plan cleared", "Cleared all monthly programme values for this programme.");
  };

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
          <h2 id="work-program-dashboard-title">Work Program Monthly View</h2>
        </div>
        <div className="toolbar-actions">
          <label className="select-control">
            <span>Work Program</span>
            <select value={programType} onChange={(event) => setProgramType(event.target.value)}>
              {activeProgramOptions.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>
          <div className="segmented-control" aria-label="Monthly view display">
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
          {editMode ? (
            <>
              <button className="command-button" type="button" onClick={saveTemplateChanges}>
                <Save aria-hidden="true" size={16} /> Save
              </button>
              <button className="secondary-button" type="button" onClick={cancelTemplateChanges}>
                <X aria-hidden="true" size={16} /> Cancel
              </button>
            </>
          ) : (
            <button className="command-button" type="button" onClick={startEditMode}>
              <Pencil aria-hidden="true" size={16} /> Edit
            </button>
          )}
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
        <div className={editMode ? "dashboard-edit-workspace" : ""}>
        <div className="data-panel dashboard-table-panel">
          <div className="panel-heading">
            <div>
              <h3>{dashboardYearLabel()} field plan and completion</h3>
              <p>{editMode ? "Edit programme planning values in the Programme rows, then save the prototype setup." : "Click a completed month value to review its daily entries."}</p>
            </div>
            <button className="secondary-button" type="button" onClick={() => setShowProgramme((current) => !current)} disabled={editMode}>
              {showProgramme ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
              {showProgramme ? "Hide programme rows" : "Show programme rows"}
            </button>
          </div>
          {editMode ? (
            <div className="template-editor-bar">
              <label>
                <span>New programme</span>
                <input value={newProgramName} onChange={(event) => setNewProgramName(event.target.value)} placeholder="Programme name" />
              </label>
              <button className="secondary-button" type="button" onClick={addProgramme}>
                <Plus aria-hidden="true" size={15} /> Add
              </button>
              <button className="secondary-button" type="button" onClick={clearProgrammeMonths}>
                <RotateCcw aria-hidden="true" size={15} /> Clear months
              </button>
              <button className="secondary-button danger-button" type="button" onClick={deleteProgramme} disabled={draftProgramOptions.length <= 1}>
                <Trash2 aria-hidden="true" size={15} /> Delete programme
              </button>
            </div>
          ) : null}
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
                  <th>Completion Index</th>
                </tr>
              </thead>
              {tablePairs.map(({ completed, programme }) => {
                const completedDisplay = programme ? { ...completed, field: programme.field, category: programme.category, hect: programme.hect } : completed;
                const selected = selectedCell?.field === completedDisplay.field;
                return (
                  <tbody className={selected ? "row-selected" : ""} key={`${completed.id}-${programme?.id || "actual"}`}>
                    <DashboardTableRow
                      row={completedDisplay}
                      records={records}
                      selectedCell={selectedCell}
                      setSelectedCell={setSelectedCell}
                      rowSpan={shouldShowProgramme && programme ? 2 : 1}
                      showSharedCells
                      editMode={editMode}
                      completionTarget={programme}
                      onUpdateProgrammeRow={updateProgrammeRow}
                      onLogChange={logChange}
                    />
                    {shouldShowProgramme && programme ? (
                      <DashboardTableRow
                        row={programme}
                        records={records}
                        selectedCell={selectedCell}
                        setSelectedCell={setSelectedCell}
                        rowSpan={1}
                        showSharedCells={false}
                        editMode={editMode}
                        completionTarget={programme}
                        onUpdateProgrammeRow={updateProgrammeRow}
                        onLogChange={logChange}
                      />
                    ) : null}
                  </tbody>
                );
              })}
            </table>
          </div>
        </div>
        {editMode ? <ProgrammeChangeLog logs={visibleChangeLogs} programType={programType} /> : null}
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
  editMode,
  completionTarget,
  onUpdateProgrammeRow,
  onLogChange,
}: {
  row: DashboardRow;
  records: WorkProgramRecord[];
  selectedCell: SelectedCell;
  setSelectedCell: (cell: SelectedCell) => void;
  rowSpan: number;
  showSharedCells: boolean;
  editMode: boolean;
  completionTarget: DashboardRow | null;
  onUpdateProgrammeRow: (rowId: string, updater: (row: DashboardRow) => DashboardRow) => void;
  onLogChange: (programme: string, action: string, detail: string) => void;
}) {
  const completion = getCompletionIndex(row, completionTarget);

  return (
    <tr className={row.actualBudget === "Programme" ? "programme-row" : "completed-row"}>
      {showSharedCells ? <th className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{row.field}</th> : null}
      {showSharedCells ? <td className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{row.category || "-"}</td> : null}
      {showSharedCells ? <td className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{formatNumber(row.hect)}</td> : null}
      <td className={editMode ? "locked-template-cell" : ""}><span className={`row-type ${row.actualBudget.toLowerCase()}`}>{row.actualBudget}</span></td>
      <td>{row.frequencyMonths || "-"}</td>
      <td>{row.completedRounds || "-"}</td>
      <td>{row.intervalMonths === "" ? "-" : row.intervalMonths}</td>
      <td>{formatDate(row.proposedNextDate)}</td>
      {MONTHS_2026.map((month) => {
        const value = Number(row.months[month.key]) || 0;
        const open = selectedCell?.field === row.field && selectedCell.month === month.key;
        const entries = row.actualBudget === "Completed" ? recordsForMonthCell(records, row.programType, row.field, month.key) : [];
        const canSelectMonth = !editMode;
        const toggleMonthCell = () => {
          if (!canSelectMonth) return;
          setSelectedCell(open ? null : { field: row.field, month: month.key });
        };
        return (
          <td
            className={`${selectedCell?.month === month.key ? "column-selected" : ""} ${canSelectMonth ? "selectable-month-cell" : ""} month-cell`}
            key={month.key}
            onClick={canSelectMonth ? toggleMonthCell : undefined}
          >
            {editMode && row.actualBudget === "Programme" ? (
              <div className="month-edit-cell">
                <button
                  aria-label={`${value ? "Keep" : "Fill"} ${row.field} ${month.label} from row ha`}
                  className={value ? "month-fill-button filled" : "month-fill-button"}
                  type="button"
                  onClick={() => {
                    const nextValue = value || Number(row.hect) || 0;
                    onUpdateProgrammeRow(row.id, (current) => ({
                      ...current,
                      months: { ...current.months, [month.key]: nextValue },
                    }));
                    onLogChange(row.programType, value ? "Monthly value selected" : "Monthly value filled", `${row.field} · ${month.label}: ${formatNumber(nextValue)} ha from Ha column.`);
                  }}
                >
                  {value ? formatNumber(value) : "+"}
                </button>
                {value ? (
                  <button
                    aria-label={`Clear ${row.field} ${month.label}`}
                    className="month-clear-button"
                    type="button"
                    onClick={() => {
                      onUpdateProgrammeRow(row.id, (current) => ({
                        ...current,
                        months: { ...current.months, [month.key]: 0 },
                      }));
                      onLogChange(row.programType, "Monthly value deleted", `${row.field} · ${month.label} cleared.`);
                    }}
                  >
                    <X aria-hidden="true" size={10} />
                  </button>
                ) : null}
              </div>
            ) : value ? (
              <button
                className="month-value"
                type="button"
                onClick={toggleMonthCell}
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
      {showSharedCells ? (
        <td className="completion-index-cell" rowSpan={rowSpan}>
          <strong>{completion.percent}</strong>
          <div className="completion-progress" aria-label={`${completion.percent} completion`}>
            <span style={{ width: `${completion.progress}%` }} />
          </div>
          <small>{completion.hectares}</small>
        </td>
      ) : null}
    </tr>
  );
}

function ProgrammeChangeLog({ logs, programType }: { logs: ChangeLogEntry[]; programType: string }) {
  const groupedLogs = groupLogsByDay(logs);

  return (
    <aside className="data-panel programme-log-panel">
      <div className="panel-heading">
        <div>
          <h3>Change logs</h3>
          <p>Showing prototype edit activity for {programType}.</p>
        </div>
      </div>
      <div className="programme-log-list">
        {groupedLogs.length ? groupedLogs.map(([day, entries]) => (
          <section className="programme-log-day" key={day}>
            <h4>{day}</h4>
            {entries.map((log) => (
              <article key={log.id}>
                <span>{log.time}</span>
                <strong>{log.action}</strong>
                <small>{log.programme}</small>
                <p>{log.detail}</p>
              </article>
            ))}
          </section>
        )) : <p className="empty-state">No edit activity for this work program yet.</p>}
      </div>
    </aside>
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

function getCompletionIndex(row: DashboardRow, programmeRow: DashboardRow | null) {
  const targetRow = programmeRow || row;
  const plannedHa = sumRowMonths(targetRow);
  const completedHa = row.actualBudget === "Completed" ? sumRowMonths(row) : plannedHa;
  const percentage = plannedHa > 0 ? Math.min(999, (completedHa / plannedHa) * 100) : 0;

  if (row.actualBudget === "Programme") {
    return {
      percent: plannedHa ? "100%" : "-",
      hectares: plannedHa ? `${formatNumber(plannedHa)} ha target` : "No target",
      progress: plannedHa ? 100 : 0,
    };
  }

  return {
    percent: plannedHa ? `${formatNumber(percentage, 0)}%` : "-",
    hectares: plannedHa ? `${formatNumber(completedHa)} / ${formatNumber(plannedHa)} ha` : `${formatNumber(completedHa)} ha`,
    progress: Math.min(100, percentage),
  };
}

function buildTablePairs(completedRows: DashboardRow[], programmeRows: DashboardRow[]): Array<{ completed: DashboardRow; programme: DashboardRow | null }> {
  const completedByField = new Map(completedRows.map((row) => [fieldKey(row.field), row]));
  const used = new Set<string>();
  const pairs: Array<{ completed: DashboardRow; programme: DashboardRow | null }> = programmeRows.map((programme) => {
    const completed = completedByField.get(fieldKey(programme.field)) || completedPlaceholder(programme);
    used.add(fieldKey(completed.field));
    return { completed, programme };
  });
  completedRows.forEach((completed) => {
    const key = fieldKey(completed.field);
    if (!used.has(key)) pairs.push({ completed, programme: null });
  });
  return pairs;
}

function completedPlaceholder(programme: DashboardRow): DashboardRow {
  return {
    ...programme,
    id: `${programme.id}-completed-placeholder`,
    actualBudget: "Completed",
    frequencyMonths: "",
    completedRounds: "",
    intervalMonths: "",
    proposedNextDate: "",
    months: emptyMonthValues(),
    isTemplate: true,
  };
}

function templateRowsFromFields(programme: string, fields: FieldFeature[]): DashboardRow[] {
  return [...fields]
    .sort((a, b) => (a.properties.field_no || a.properties.field_gis).localeCompare(b.properties.field_no || b.properties.field_gis, undefined, { numeric: true }))
    .map((field, index) => ({
      id: `${normaliseKey(programme)}-${normaliseKey(field.properties.field_no || field.properties.field_gis)}-programme-${index}`,
      programType: programme,
      field: field.properties.field_no || field.properties.field_gis,
      category: fieldCategoryLabel(field),
      hect: Number(field.properties.ha_gis) || 0,
      actualBudget: "Programme",
      frequencyMonths: "",
      completedRounds: "",
      intervalMonths: "",
      proposedNextDate: "",
      months: emptyMonthValues(),
      isTemplate: true,
    }));
}

function emptyMonthValues() {
  return Object.fromEntries(MONTHS_2026.map((month) => [month.key, 0]));
}

function cloneRows(rows: DashboardRow[]) {
  return rows.map((row) => ({ ...row, months: { ...row.months } }));
}

function cloneRowsByProgram(rowsByProgram: ProgrammeRowsByName) {
  return Object.fromEntries(Object.entries(rowsByProgram).map(([programme, rows]) => [programme, cloneRows(rows)]));
}

function fieldCategoryLabel(field: FieldFeature) {
  return String(field.properties.field_type || "").includes("IMMATURE") ? "Immature" : "Mature";
}

function groupLogsByDay(logs: ChangeLogEntry[]) {
  const groups = new Map<string, ChangeLogEntry[]>();
  logs.forEach((log) => groups.set(log.day, [...(groups.get(log.day) || []), log]));
  return [...groups.entries()];
}

function formatLogDay(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatLogTime(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
