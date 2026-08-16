"use client";

import { CalendarDays, Database, Download, Eye, EyeOff, Info, MapPinned, Pencil, Plus, RotateCcw, Save, Table2, Trash2, X } from "lucide-react";
import { useCallback, useMemo, useState, useSyncExternalStore } from "react";
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
  type DashboardRow,
  type FieldFeature,
  type FieldFeatureCollection,
  type MapFieldStatus,
} from "@/lib/work-program/analytics";
import { DASHBOARD_YEAR, MAP_STATUS_RULES, monthsForYear, PROGRAM_TYPES, WORK_PROGRAM_YEARS, type DashboardMonth } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type DashboardProps = {
  fieldMap: FieldFeatureCollection;
  records: WorkProgramRecord[];
  loading: boolean;
  source: string;
};

type SelectedCell = { field: string; month: string } | null;
type ProgrammeRowsByName = Record<string, DashboardRow[]>;
type RoundDefinition = {
  id: string;
  label: string;
  index: number;
  monthKey: string;
  plannedMonth: string;
  targetHa: number;
};
type RoundCompletion = ReturnType<typeof getRoundCompletionIndexes>[number];
type MapRoundContext = {
  programmeRow: DashboardRow | null;
  completedRow: DashboardRow | null;
  rounds: RoundCompletion[];
  activeRound: RoundCompletion | null;
  completedRoundCount: number;
  totalRounds: number;
  proposedNextMonth: string;
  roundFrequencyText: string;
};
type ChangeLogEntry = {
  id: string;
  programme: string;
  action: string;
  detail: string;
  day: string;
  time: string;
};

function subscribeCurrentMonth() {
  return () => {};
}

function currentMonthSnapshot() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function serverMonthSnapshot() {
  return "";
}

export function WorkProgramDashboard({ fieldMap, records, loading, source }: DashboardProps) {
  const [programOptions, setProgramOptions] = useState<string[]>(() => [...PROGRAM_TYPES]);
  const [programmeRowsByProgram, setProgrammeRowsByProgram] = useState<ProgrammeRowsByName>({});
  const [draftProgramOptions, setDraftProgramOptions] = useState<string[]>([]);
  const [draftRowsByProgram, setDraftRowsByProgram] = useState<ProgrammeRowsByName>({});
  const [editBaselineProgramOptions, setEditBaselineProgramOptions] = useState<string[]>([]);
  const [editBaselineRowsByProgram, setEditBaselineRowsByProgram] = useState<ProgrammeRowsByName>({});
  const [changeLogs, setChangeLogs] = useState<ChangeLogEntry[]>([]);
  const [programType, setProgramType] = useState<string>(PROGRAM_TYPES[0]);
  const [selectedYear, setSelectedYear] = useState(DASHBOARD_YEAR);
  const [view, setView] = useState<"table" | "map">("map");
  const [expandedProgrammeFields, setExpandedProgrammeFields] = useState<Set<string>>(() => new Set());
  const [editMode, setEditMode] = useState(false);
  const [newProgramName, setNewProgramName] = useState("");
  const [selectedCell, setSelectedCell] = useState<SelectedCell>(null);
  const [selectedField, setSelectedField] = useState("");
  const [showRules, setShowRules] = useState(false);
  const currentMonthKey = useSyncExternalStore(subscribeCurrentMonth, currentMonthSnapshot, serverMonthSnapshot);
  const dashboardMonths = useMemo(() => monthsForYear(selectedYear), [selectedYear]);

  const baseDashboard = useMemo(
    () => getDashboardRows(programType, records, fieldMap.features, selectedYear),
    [fieldMap.features, programType, records, selectedYear],
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
  const programmeFieldKeys = useMemo(
    () => tablePairs.filter(({ programme }) => programme).map(({ completed, programme }) => fieldKey(programme?.field || completed.field)),
    [tablePairs],
  );
  const allProgrammeRowsExpanded = programmeFieldKeys.length > 0 && programmeFieldKeys.every((key) => expandedProgrammeFields.has(key));
  const mapStatuses = useMemo(
    () => getMapStatuses(programType, records, fieldMap.features, selectedYear),
    [fieldMap.features, programType, records, selectedYear],
  );
  const mapRoundContexts = useMemo(
    () => buildMapRoundContexts(mapStatuses, dashboard.programmeRows, baseDashboard.completedRows, dashboardMonths, records),
    [baseDashboard.completedRows, dashboard.programmeRows, dashboardMonths, mapStatuses, records],
  );
  const approved = useMemo(
    () =>
      records.filter(
        (record) =>
          record.programType === programType &&
          record.approvalStatus === "Approved" &&
          (record.actualCompletionDate || record.deadline || "").startsWith(`${selectedYear}-`),
      ),
    [programType, records, selectedYear],
  );
  const totalHectares = approved.reduce((total, record) => total + Number(record.hectares || 0), 0);
  const activeFields = new Set(approved.map((record) => fieldKey(record.blockField))).size;
  const selectedStatus =
    mapStatuses.find((item) => item.field.properties.field_gis === selectedField) || mapStatuses[0] || null;
  const selectedMapContext = selectedStatus ? mapRoundContexts.get(mapStatusFieldKey(selectedStatus)) || null : null;
  const selectMapField = useCallback((fieldGis: string) => setSelectedField(fieldGis), []);
  const toggleAllProgrammeRows = useCallback(() => {
    setExpandedProgrammeFields((current) => {
      if (programmeFieldKeys.length && programmeFieldKeys.every((key) => current.has(key))) return new Set();
      return new Set([...current, ...programmeFieldKeys]);
    });
  }, [programmeFieldKeys]);
  const toggleProgrammeRow = useCallback((field: string) => {
    const key = fieldKey(field);
    const closing = expandedProgrammeFields.has(key);
    setExpandedProgrammeFields((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    if (closing) {
      setSelectedCell((current) => current && fieldKey(current.field) === key ? null : current);
    }
  }, [expandedProgrammeFields]);
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
    const baselineRows = buildEditableRowsByProgram(programOptions, {
      activeProgramme: programType,
      activeRows: currentProgrammeRows,
      fieldMap,
      records,
      rowsByProgram: programmeRowsByProgram,
      year: selectedYear,
    });
    setView("table");
    setExpandedProgrammeFields(new Set(programmeFieldKeys));
    setDraftProgramOptions(programOptions);
    setDraftRowsByProgram(cloneRowsByProgram(baselineRows));
    setEditBaselineProgramOptions([...programOptions]);
    setEditBaselineRowsByProgram(cloneRowsByProgram(baselineRows));
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
    logChange(
      programType,
      "Saved edit session",
      buildSavedEditLogDetail({
        afterOptions: draftProgramOptions,
        afterRowsByProgram: nextRows,
        beforeOptions: editBaselineProgramOptions,
        beforeRowsByProgram: editBaselineRowsByProgram,
        months: dashboardMonths,
        year: selectedYear,
      }),
    );
    setEditBaselineProgramOptions([]);
    setEditBaselineRowsByProgram({});
  };

  const cancelTemplateChanges = () => {
    setEditMode(false);
    setDraftProgramOptions([]);
    setDraftRowsByProgram({});
    setEditBaselineProgramOptions([]);
    setEditBaselineRowsByProgram({});
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
  };

  const clearProgrammeMonths = () => {
    updateProgrammeRows((rows) =>
      rows.map((row) => ({
        ...row,
        months: {
          ...row.months,
          ...Object.fromEntries(dashboardMonths.map((month) => [month.key, 0])),
        },
      })),
    );
  };

  const downloadDataset = () => {
    const headers = [
      "Field",
      "Category",
      "Ha",
      "Actual/Budget",
      "Programme Frequency / Year",
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
      dashboardMonths.filter((month) => Number(row.months[month.key]) > 0).map((month) => [
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
    link.download = `work-program-${programType.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${dashboardYearLabel(selectedYear)}.csv`;
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
            <select
              value={programType}
              onChange={(event) => {
                setProgramType(event.target.value);
                setExpandedProgrammeFields(new Set());
              }}
            >
              {activeProgramOptions.map((program) => (
                <option key={program} value={program}>
                  {program}
                </option>
              ))}
            </select>
          </label>
          <label className="select-control year-select-control">
            <span>Year</span>
            <select
              value={selectedYear}
              onChange={(event) => {
                setSelectedYear(Number(event.target.value));
                setSelectedCell(null);
                setSelectedField("");
                setExpandedProgrammeFields(new Set());
              }}
            >
              {WORK_PROGRAM_YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
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
              <h3>{dashboardYearLabel(selectedYear)} field plan and completion</h3>
              <p>{editMode ? "Edit programme planning values in the Programme rows, then save the prototype setup." : "Click a row to show or hide its Programme row. Click a completed month value to review daily entries."}</p>
            </div>
            <button className="secondary-button" type="button" onClick={toggleAllProgrammeRows} disabled={editMode || !programmeFieldKeys.length}>
              {allProgrammeRowsExpanded ? <EyeOff aria-hidden="true" size={16} /> : <Eye aria-hidden="true" size={16} />}
              {allProgrammeRowsExpanded ? "Hide programme rows" : "Show programme rows"}
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
                  <th>Programme Frequency / Year</th>
                  <th>Completed Rounds</th>
                  <th>Next Programme (Month)</th>
                  <th>Delay in Months (from Next Programme)</th>
                  <th>Actual / Budget</th>
                  {dashboardMonths.map((month) => (
                    <th
                      aria-label={month.key === currentMonthKey ? `${month.label}, current month` : month.label}
                      className={`month-header-cell ${month.key === currentMonthKey ? "current-month-cell" : ""} ${selectedCell?.month === month.key ? "column-selected" : ""}`}
                      key={month.key}
                    >
                      {month.key === currentMonthKey ? <span aria-hidden="true" className="current-month-marker">*</span> : null}
                      {month.label}
                    </th>
                  ))}
                  <th className="round-index-header">Round Completion</th>
                </tr>
              </thead>
              {tablePairs.map(({ completed, programme }) => {
                const plannedRounds = getProgrammeRoundDefinitions(programme, dashboardMonths);
                const completedDisplay = programme ? { ...completed, field: programme.field, category: programme.category, hect: programme.hect, frequencyMonths: plannedRounds.length || completed.frequencyMonths } : completed;
                const selected = selectedCell?.field === completedDisplay.field;
                const rowKey = fieldKey(completedDisplay.field);
                const rowExpanded = editMode || expandedProgrammeFields.has(rowKey);
                const canToggleProgrammeRow = Boolean(programme) && !editMode;
                return (
                  <tbody className={selected ? "row-selected" : ""} key={`${completed.id}-${programme?.id || "actual"}`}>
                    {rowExpanded && programme ? (
                      <>
                        <DashboardTableRow
                          row={programme}
                          records={records}
                          selectedCell={selectedCell}
                          setSelectedCell={setSelectedCell}
                          rowSpan={2}
                          showSharedCells
                          editMode={editMode}
                          completionTarget={programme}
                          roundCompletionRow={completedDisplay}
                          months={dashboardMonths}
                          currentMonthKey={currentMonthKey}
                          showProgrammeIndicator={false}
                          canToggleProgrammeRow={canToggleProgrammeRow}
                          isProgrammeExpanded={rowExpanded}
                          onToggleProgrammeRow={() => toggleProgrammeRow(completedDisplay.field)}
                          onUpdateProgrammeRow={updateProgrammeRow}
                        />
                        <DashboardTableRow
                          row={completedDisplay}
                          records={records}
                          selectedCell={selectedCell}
                          setSelectedCell={setSelectedCell}
                          rowSpan={1}
                          showSharedCells={false}
                          editMode={editMode}
                          completionTarget={programme}
                          months={dashboardMonths}
                          currentMonthKey={currentMonthKey}
                          showProgrammeIndicator={false}
                          canToggleProgrammeRow={canToggleProgrammeRow}
                          isProgrammeExpanded={rowExpanded}
                          onToggleProgrammeRow={() => toggleProgrammeRow(completedDisplay.field)}
                          onUpdateProgrammeRow={updateProgrammeRow}
                        />
                      </>
                    ) : (
                      <DashboardTableRow
                        row={completedDisplay}
                        records={records}
                        selectedCell={selectedCell}
                        setSelectedCell={setSelectedCell}
                        rowSpan={1}
                        showSharedCells
                        editMode={editMode}
                        completionTarget={programme}
                        months={dashboardMonths}
                        currentMonthKey={currentMonthKey}
                        showProgrammeIndicator={Boolean(programme && !rowExpanded)}
                        canToggleProgrammeRow={canToggleProgrammeRow}
                        isProgrammeExpanded={rowExpanded}
                        onToggleProgrammeRow={() => toggleProgrammeRow(completedDisplay.field)}
                        onUpdateProgrammeRow={updateProgrammeRow}
                      />
                    )}
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
                <h3>{programType}</h3>
                <p>Field colours follow the current interval rules for the selected year.</p>
              </div>
              <button className="secondary-button" type="button" onClick={() => setShowRules(true)}>
                <Info aria-hidden="true" size={16} /> Colour Rules
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
                  <Detail label="Category" value={selectedMapContext?.programmeRow?.category || selectedStatus.row?.category || selectedStatus.completedRow?.category || "-"} />
                  <Detail label="Hectares (Ha)" value={formatNumber(selectedMapContext?.programmeRow?.hect || selectedStatus.row?.hect || selectedStatus.completedRow?.hect || selectedStatus.field.properties.ha_gis)} />
                  <Detail label="Round Completion" value={selectedMapContext?.roundFrequencyText || "-"} />
                  <Detail label="Next Programme (Month)" value={selectedMapContext?.proposedNextMonth || formatMonthYear(selectedStatus.proposedNextDate)} />
                  <Detail label="Delay in Months (from Next Programme)" value={formatDelay(selectedStatus.intervalValue)} />
                </dl>
                <MapRoundDetails context={selectedMapContext} />
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
                <h2 id="map-rules-title">Map Colour Rules</h2>
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
  roundCompletionRow,
  months,
  currentMonthKey,
  showProgrammeIndicator,
  canToggleProgrammeRow,
  isProgrammeExpanded,
  onToggleProgrammeRow,
  onUpdateProgrammeRow,
}: {
  row: DashboardRow;
  records: WorkProgramRecord[];
  selectedCell: SelectedCell;
  setSelectedCell: (cell: SelectedCell) => void;
  rowSpan: number;
  showSharedCells: boolean;
  editMode: boolean;
  completionTarget: DashboardRow | null;
  roundCompletionRow?: DashboardRow;
  months: DashboardMonth[];
  currentMonthKey: string;
  showProgrammeIndicator: boolean;
  canToggleProgrammeRow: boolean;
  isProgrammeExpanded: boolean;
  onToggleProgrammeRow: () => void;
  onUpdateProgrammeRow: (rowId: string, updater: (row: DashboardRow) => DashboardRow) => void;
}) {
  const programmeReference = row.actualBudget === "Programme" ? row : completionTarget;
  const metricsReference = roundCompletionRow || row;
  const plannedRounds = getProgrammeRoundDefinitions(programmeReference, months);
  const rowRoundCompletions = row.actualBudget === "Completed" ? getRoundCompletionIndexes(row, programmeReference, months, records) : [];
  const metricsRoundCompletions = metricsReference.actualBudget === "Completed" ? getRoundCompletionIndexes(metricsReference, programmeReference, months, records) : rowRoundCompletions;
  const monthRoundStatuses = row.actualBudget === "Completed" ? getRoundMonthStatusMap(rowRoundCompletions) : new Map<string, string>();
  const frequencyDisplay = plannedRounds.length || metricsReference.frequencyMonths || row.frequencyMonths || "-";
  const completedRoundsDisplay = metricsReference.actualBudget === "Completed" && plannedRounds.length
    ? `${metricsRoundCompletions.filter(isRoundComplete).length}/${plannedRounds.length}`
    : metricsReference.completedRounds || row.completedRounds || "-";

  return (
    <tr
      aria-expanded={canToggleProgrammeRow ? isProgrammeExpanded : undefined}
      className={`${row.actualBudget === "Programme" ? "programme-row" : "completed-row"} ${canToggleProgrammeRow ? "programme-toggle-row" : ""}`}
      onClick={canToggleProgrammeRow ? onToggleProgrammeRow : undefined}
      onKeyDown={canToggleProgrammeRow ? (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        onToggleProgrammeRow();
      } : undefined}
      tabIndex={canToggleProgrammeRow ? 0 : undefined}
    >
      {showSharedCells ? <th className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{row.field}</th> : null}
      {showSharedCells ? <td className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{row.category || "-"}</td> : null}
      {showSharedCells ? <td className={editMode ? "locked-template-cell" : ""} rowSpan={rowSpan}>{formatNumber(row.hect)}</td> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{frequencyDisplay}</td> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{completedRoundsDisplay}</td> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{formatMonthYear(metricsReference.proposedNextDate || row.proposedNextDate)}</td> : null}
      {showSharedCells ? <td rowSpan={rowSpan}>{formatIntervalDelay(metricsReference.intervalMonths || row.intervalMonths)}</td> : null}
      <td className={editMode ? "locked-template-cell" : ""}><span className={`row-type ${row.actualBudget.toLowerCase()}`}>{row.actualBudget}</span></td>
      {months.map((month) => {
        const isCurrentMonth = month.key === currentMonthKey;
        const value = Number(row.months[month.key]) || 0;
        const plannedRound = showProgrammeIndicator ? plannedRounds.find((round) => round.monthKey === month.key) : null;
        const open = selectedCell?.field === row.field && selectedCell.month === month.key;
        const entries = row.actualBudget === "Completed" ? recordsForMonthCell(records, row.programType, row.field, month.key) : [];
        const roundMonthStatus = monthRoundStatuses.get(month.key);
        const canSelectMonth = !editMode;
        const toggleMonthCell = () => {
          if (!canSelectMonth) return;
          setSelectedCell(open ? null : { field: row.field, month: month.key });
        };
        return (
          <td
            className={`${isCurrentMonth ? "current-month-column" : ""} ${plannedRound ? "planned-programme-cell" : ""} ${selectedCell?.month === month.key ? "column-selected" : ""} ${canSelectMonth ? "selectable-month-cell" : ""} month-cell`}
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
                    }}
                  >
                    <X aria-hidden="true" size={10} />
                  </button>
                ) : null}
              </div>
            ) : value ? (
              <button
                className={`month-value ${roundMonthStatus ? `month-value-${roundMonthStatus}` : ""}`}
                type="button"
                onClick={toggleMonthCell}
                aria-expanded={open}
              >
                {formatNumber(value)}
              </button>
            ) : null}
            {open && row.actualBudget === "Completed" ? (
              <div className="month-popover" onClick={(event) => event.stopPropagation()}>
                <strong>{row.field} · {month.label}</strong>
                {plannedRound ? (
                  <span><b>Programme {plannedRound.label}</b>{formatNumber(plannedRound.targetHa)} ha planned</span>
                ) : null}
                <div className={entries.length > 5 ? "month-entry-scroll" : ""}>
                  {entries.length ? entries.map((entry) => (
                    <span key={entry.id}><b>{formatDate(entry.actualCompletionDate)}</b>R{normaliseActivityRound(entry.activityRound)} · {formatNumber(entry.hectares)} ha</span>
                  )) : <span>No daily entries</span>}
                </div>
              </div>
            ) : null}
          </td>
        );
      })}
      {showSharedCells ? <RoundCompletionOverview row={roundCompletionRow || row} programmeRow={completionTarget} rowSpan={rowSpan} months={months} records={records} /> : null}
    </tr>
  );
}

function RoundCompletionOverview({
  row,
  programmeRow,
  rowSpan,
  months,
  records,
}: {
  row: DashboardRow;
  programmeRow: DashboardRow | null;
  rowSpan: number;
  months: DashboardMonth[];
  records: WorkProgramRecord[];
}) {
  const completions = getRoundCompletionIndexes(row, programmeRow, months, records);

  return (
    <td className="completion-index-cell round-completion-cell" rowSpan={rowSpan}>
      {completions.length ? <div className="round-completion-list">
        {completions.map((completion) => (
          <button className={`round-cycle-card round-${completion.status}`} key={completion.id} type="button">
            <span>{completion.shortLabel}</span>
            <strong>{completion.percent}</strong>
            <div className="completion-progress" aria-label={`${completion.label} ${completion.percent} completion`}>
              <span style={{ width: `${completion.progress}%` }} />
            </div>
            <small>{completion.hectares}</small>
            <em>{completion.statusLabel}</em>
            <div className="round-cycle-popover">
              <strong>{completion.label}</strong>
              <span>Status: {completion.statusLabel}</span>
              <span>Programme: {completion.plannedMonth}</span>
              <span>Ha: {completion.hectares}</span>
            </div>
          </button>
        ))}
      </div> : <span className="round-empty-message">No programme dates</span>}
    </td>
  );
}

function MapRoundDetails({ context }: { context: MapRoundContext | null }) {
  if (!context?.rounds.length) {
    return (
      <section className="map-round-summary">
        <div className="map-round-heading">
          <h4>Programme Rounds</h4>
          <span>No Programme Dates</span>
        </div>
      </section>
    );
  }

  return (
    <section className="map-round-summary">
      <div className="map-round-heading">
        <h4>Programme Rounds</h4>
        <span>{context.completedRoundCount}/{context.totalRounds} Completed</span>
      </div>
      <div className="map-round-list">
        {context.rounds.map((round) => (
          <article className={`map-round-card round-${round.status}`} key={round.id}>
            <div>
              <strong>{round.shortLabel}</strong>
              <span>{formatMonthYearFromKey(round.monthKey)}</span>
            </div>
            <b>{round.percent}</b>
            <div className="completion-progress" aria-label={`${round.label} ${round.percent} completion`}>
              <span style={{ width: `${round.progress}%` }} />
            </div>
            <small>{round.statusLabel}</small>
            <em>{round.hectares}</em>
          </article>
        ))}
      </div>
    </section>
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

function formatMonthYear(date: string) {
  if (!date || !/^\d{4}-\d{2}/.test(date)) return date || "-";
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(`${date.slice(0, 7)}-01T00:00:00`));
}

function formatMonthYearFromKey(monthKeyValue: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKeyValue)) return monthKeyValue || "-";
  return formatMonthYear(`${monthKeyValue}-01`);
}

function formatDelay(value: number | null | undefined) {
  if (value == null) return "-";
  return `${formatNumber(value)} month${value === 1 ? "" : "s"}`;
}

function formatIntervalDelay(value: number | string) {
  if (value === "" || value == null) return "-";
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return String(value);
  return formatDelay(numericValue);
}

function getProgrammeRoundDefinitions(programmeRow: DashboardRow | null, months: DashboardMonth[]): RoundDefinition[] {
  if (!programmeRow) return [];

  return months.filter((month) => Number(programmeRow.months[month.key]) > 0).map((month, index) => ({
    id: `${programmeRow.id}-${month.key}`,
    label: `Round ${index + 1}`,
    index,
    monthKey: month.key,
    plannedMonth: month.label,
    targetHa: Number(programmeRow.months[month.key]) || 0,
  }));
}

function getRoundCompletionIndexes(
  row: DashboardRow,
  programmeRow: DashboardRow | null,
  months: DashboardMonth[],
  records: WorkProgramRecord[] = [],
) {
  const rounds = getProgrammeRoundDefinitions(programmeRow, months);
  const fallbackTargetHa = Number(programmeRow?.hect || row.hect || 0);
  const allocations = rounds.map((round) => ({
    ...round,
    completedHa: 0,
    allocations: [] as Array<{ month: string; monthKey: string; value: number }>,
  }));

  const monthByKey = new Map(months.map((month) => [month.key, month]));
  const recordAllocations = records.filter(
    (record) =>
      record.approvalStatus === "Approved" &&
      record.programType === row.programType &&
      fieldKey(record.blockField) === fieldKey(row.field) &&
      monthByKey.has((record.actualCompletionDate || record.deadline || "").slice(0, 7)),
  );

  if (recordAllocations.length) {
    recordAllocations.forEach((record) => {
      const monthKeyValue = (record.actualCompletionDate || record.deadline || "").slice(0, 7);
      const month = monthByKey.get(monthKeyValue);
      const roundIndex = Math.min(Math.max(normaliseActivityRound(record.activityRound) - 1, 0), Math.max(allocations.length - 1, 0));
      const round = allocations[roundIndex];
      if (!month || !round) return;
      const value = Number(record.hectares) || 0;
      round.completedHa += value;
      round.allocations.push({ month: month.label, monthKey: month.key, value });
    });
  } else {
    months.forEach((month) => {
      const value = Number(row.months[month.key]) || 0;
      const firstRound = allocations[0];
      if (!firstRound || value <= 0) return;
      firstRound.completedHa += value;
      firstRound.allocations.push({ month: month.label, monthKey: month.key, value });
    });
  }

  return allocations.map((round) => {
    const targetHa = round.targetHa || fallbackTargetHa;
    const percentage = targetHa > 0 ? Math.min(999, (round.completedHa / targetHa) * 100) : 0;
    const status = getRoundStatus(percentage, round.completedHa, targetHa);
    return {
      ...round,
      shortLabel: `R${round.index + 1}`,
      percent: targetHa ? `${formatNumber(percentage, 0)}%` : "-",
      hectares: targetHa ? `${formatNumber(round.completedHa)} / ${formatNumber(targetHa)} ha` : `${formatNumber(round.completedHa)} ha`,
      progress: Math.min(100, percentage),
      status,
      statusLabel: roundStatusLabel(status),
      targetHa,
    };
  });
}

function getRoundMonthStatusMap(rounds: ReturnType<typeof getRoundCompletionIndexes>) {
  const monthStatuses = new Map<string, string>();

  rounds.forEach((round) => {
    const monthStatus = round.status === "complete" || round.status === "over" ? "complete" : "partial";
    round.allocations.forEach((allocation) => monthStatuses.set(allocation.monthKey, monthStatus));
  });

  return monthStatuses;
}

function getRoundStatus(percentage: number, completedHa: number, targetHa: number) {
  const completeTolerance = Math.max(0.01, targetHa * 0.0001);
  if (completedHa > targetHa + completeTolerance) return "over";
  if (targetHa > 0 && completedHa >= targetHa - completeTolerance) return "complete";
  if (completedHa > 0) return "partial";
  if (percentage >= 100) return "complete";
  return "empty";
}

function isRoundComplete(round: RoundCompletion) {
  return round.status === "complete" || round.status === "over";
}

function normaliseActivityRound(value: unknown) {
  const round = Number(value);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}

function roundStatusLabel(status: string) {
  if (status === "complete") return "Completed";
  if (status === "over") return "Over target";
  if (status === "partial") return "In progress";
  return "Not started";
}

function buildMapRoundContexts(
  statuses: MapFieldStatus[],
  programmeRows: DashboardRow[],
  completedRows: DashboardRow[],
  months: DashboardMonth[],
  records: WorkProgramRecord[],
) {
  const contexts = new Map<string, MapRoundContext>();

  statuses.forEach((status) => {
    const key = mapStatusFieldKey(status);
    const programmeRow = programmeRows.find((row) => fieldKey(row.field) === key) || status.row || null;
    const matchedCompletedRow = completedRows.find((row) => fieldKey(row.field) === key) || status.completedRow || null;
    const completedRow = matchedCompletedRow && programmeRow
      ? {
          ...matchedCompletedRow,
          field: programmeRow.field,
          category: programmeRow.category,
          hect: programmeRow.hect,
        }
      : matchedCompletedRow;
    const rounds = completedRow ? getRoundCompletionIndexes(completedRow, programmeRow, months, records) : [];
    const activeRound = rounds.find((round) => !isRoundComplete(round)) || rounds.at(-1) || null;
    const completedRoundCount = rounds.filter(isRoundComplete).length;
    const totalRounds = rounds.length;

    contexts.set(key, {
      programmeRow,
      completedRow,
      rounds,
      activeRound,
      completedRoundCount,
      totalRounds,
      proposedNextMonth: formatMonthYear(status.proposedNextDate),
      roundFrequencyText: totalRounds ? `${completedRoundCount}/${totalRounds} Completed` : "-",
    });
  });

  return contexts;
}

function mapStatusFieldKey(status: MapFieldStatus) {
  return fieldKey(status.field.properties.field_no || status.field.properties.field_gis);
}

function buildEditableRowsByProgram(
  options: string[],
  {
    activeProgramme,
    activeRows,
    fieldMap,
    records,
    rowsByProgram,
    year,
  }: {
    activeProgramme: string;
    activeRows: DashboardRow[];
    fieldMap: FieldFeatureCollection;
    records: WorkProgramRecord[];
    rowsByProgram: ProgrammeRowsByName;
    year: number;
  },
) {
  return Object.fromEntries(options.map((programme) => {
    const rows = rowsByProgram[programme] || (programme === activeProgramme ? activeRows : getDashboardRows(programme, records, fieldMap.features, year).programmeRows);
    return [programme, cloneRows(rows)];
  }));
}

function buildSavedEditLogDetail({
  afterOptions,
  afterRowsByProgram,
  beforeOptions,
  beforeRowsByProgram,
  months,
  year,
}: {
  afterOptions: string[];
  afterRowsByProgram: ProgrammeRowsByName;
  beforeOptions: string[];
  beforeRowsByProgram: ProgrammeRowsByName;
  months: DashboardMonth[];
  year: number;
}) {
  const beforeSet = new Set(beforeOptions);
  const afterSet = new Set(afterOptions);
  const addedProgrammes = afterOptions.filter((programme) => !beforeSet.has(programme));
  const deletedProgrammes = beforeOptions.filter((programme) => !afterSet.has(programme));
  const monthlyChanges = afterOptions.flatMap((programme) =>
    getMonthlyPlanChanges(programme, beforeRowsByProgram[programme] || [], afterRowsByProgram[programme] || [], months),
  );
  const parts = [];

  if (addedProgrammes.length) parts.push(`Added programme: ${addedProgrammes.join(", ")}.`);
  if (deletedProgrammes.length) parts.push(`Deleted programme: ${deletedProgrammes.join(", ")}.`);
  if (monthlyChanges.length) {
    const shownChanges = monthlyChanges.slice(0, 8);
    const hiddenCount = monthlyChanges.length - shownChanges.length;
    parts.push(`Monthly plan changes: ${shownChanges.join("; ")}${hiddenCount > 0 ? `; and ${hiddenCount} more` : ""}.`);
  }

  return parts.length
    ? `Saved ${dashboardYearLabel(year)} edit session. ${parts.join(" ")}`
    : `Saved ${dashboardYearLabel(year)} edit session. No net changes detected.`;
}

function getMonthlyPlanChanges(programme: string, beforeRows: DashboardRow[], afterRows: DashboardRow[], months: DashboardMonth[]) {
  const beforeByField = new Map(beforeRows.map((row) => [fieldKey(row.field), row]));
  const changes: string[] = [];

  afterRows.forEach((afterRow) => {
    const beforeRow = beforeByField.get(fieldKey(afterRow.field));
    months.forEach((month) => {
      const beforeValue = Number(beforeRow?.months[month.key]) || 0;
      const afterValue = Number(afterRow.months[month.key]) || 0;
      if (Math.abs(afterValue - beforeValue) < 0.0001) return;
      changes.push(`${programme} · ${afterRow.field} ${month.label}: ${formatNumber(beforeValue)} -> ${formatNumber(afterValue)} ha`);
    });
  });

  return changes;
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
  return Object.fromEntries(monthsForYear(DASHBOARD_YEAR).map((month) => [month.key, 0]));
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
