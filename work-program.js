// Work Program configuration, dashboard, records, map, and capture logic.

const DASHBOARD_YEAR = 2026;
const DASHBOARD_MAP_DEFAULT_ZOOM_OFFSET = 0;
const MONTHS_2026 = [
  { key: "2026-01", label: "Jan" },
  { key: "2026-02", label: "Feb" },
  { key: "2026-03", label: "Mar" },
  { key: "2026-04", label: "Apr" },
  { key: "2026-05", label: "May" },
  { key: "2026-06", label: "Jun" },
  { key: "2026-07", label: "Jul" },
  { key: "2026-08", label: "Aug" },
  { key: "2026-09", label: "Sep" },
  { key: "2026-10", label: "Oct" },
  { key: "2026-11", label: "Nov" },
  { key: "2026-12", label: "Dec" },
];
const APPROVAL_STATUSES = ["Pending Approval", "Approved"];
const MATURE_CIRCLE_PROGRAM = "Mature Circle";
const MATURE_WOODIES_PROGRAM = "Mature Woodies & Steno";

const DEFAULT_PROGRAM_TYPES = [
  {
    id: "programme-mature-circle",
    name: MATURE_CIRCLE_PROGRAM,
    group: "Estate Operations",
    criteria: "Mature circle completion captured by field, hectares, actual date, and GPS evidence",
  },
  {
    id: "programme-mature-woodies-steno",
    name: MATURE_WOODIES_PROGRAM,
    group: "Estate Operations",
    criteria: "Woodies and steno completion captured by field, hectares, actual date, and remarks",
  },
  {
    id: "programme-pruning",
    name: "Pruning",
    group: "Estate Operations",
    criteria: "Photo evidence and remarks required for work completion review",
  },
  {
    id: "programme-raking",
    name: "Raking",
    group: "Estate Operations",
    criteria: "Field completion captured by block, hectares, and actual completion date",
  },
  {
    id: "programme-mature-vops",
    name: "Mature_VOPs",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-mature-epiphytes",
    name: "Mature_Epiphytes",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-rat-baiting",
    name: "Rat Baiting",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-grasscut-path",
    name: "Grasscut Path",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-path-repair",
    name: "Path Repair",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-desilting-md",
    name: "Desilting MD",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-desilting-cd",
    name: "Desilting CD",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-road-grading",
    name: "Road Grading",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
  {
    id: "programme-road-resurfacing",
    name: "Road resurfacing",
    group: "Estate Operations",
    criteria: "Template ready for field-level capture once programme data is available",
  },
];
const ALLOWED_PROGRAM_NAMES = new Set(DEFAULT_PROGRAM_TYPES.map((type) => type.name));
const PROGRAM_COLORS = {
  "Mature Circle": "#2563eb",
  "Mature Woodies & Steno": "#8b5cf6",
  Pruning: "#22a65a",
  Raking: "#d8912b",
  Mature_VOPs: "#0f766e",
  Mature_Epiphytes: "#16a34a",
  "Rat Baiting": "#dc2626",
  "Grasscut Path": "#ca8a04",
  "Path Repair": "#7c3aed",
  "Desilting MD": "#0891b2",
  "Desilting CD": "#0284c7",
  "Road Grading": "#6b7280",
  "Road resurfacing": "#111827",
};
const MAP_STATUS_RULES = {
  [MATURE_CIRCLE_PROGRAM]: {
    greenText: "<3 months",
    yellowText: "3-4 months",
    redText: ">4 months",
    greenBelow: 3,
    yellowTo: 4,
    redFrom: 4,
  },
  [MATURE_WOODIES_PROGRAM]: {
    greenText: "<6 months",
    yellowText: "6-10 months",
    redText: ">10 months",
    greenBelow: 6,
    yellowTo: 10,
    redFrom: 10,
  },
  Pruning: {
    greenText: "<5 months",
    yellowText: "5-7 months",
    redText: ">7 months",
    greenBelow: 5,
    yellowTo: 7,
    redFrom: 7,
  },
  Raking: {
    greenText: "<7 months",
    yellowText: "7-8 months",
    redText: ">8 months",
    greenBelow: 7,
    yellowTo: 8,
    redFrom: 8,
  },
};
const DEFAULT_MAP_STATUS_RULE = {
  greenText: "Not configured",
  yellowText: "Not configured",
  redText: "Not configured",
  greenBelow: null,
  yellowTo: null,
  redFrom: null,
  isConfigured: false,
};
const EXCEL_RECORD_SOURCE = "Excel Main actual";
const EXCEL_RECORD_PREFIX = "excel-main";
const DEFAULT_RECORD_GPS = {
  latitude: 2.86667,
  longitude: 101.36667,
};
let dashboardSourceCache = null;

function getDashboardSourceRows(programType = "") {
  if (!dashboardSourceCache) {
    dashboardSourceCache = DASHBOARD_SOURCE_ROWS.map(
      ([sourceProgram, field, category, hect, actualBudget, frequencyMonths, completedRounds, intervalMonths, proposedNextDate, values]) => ({
        id: `${normaliseKey(sourceProgram)}-${normaliseKey(field)}-${normaliseKey(actualBudget)}`,
        programType: sourceProgram,
        field,
        category,
        hect: Number(hect) || 0,
        actualBudget,
        frequencyMonths,
        completedRounds,
        intervalMonths,
        proposedNextDate,
        months: MONTHS_2026.reduce((months, month, index) => {
          months[month.key] = Number(values[index]) || 0;
          return months;
        }, {}),
      }),
    );
  }

  return programType ? dashboardSourceCache.filter((row) => row.programType === programType) : dashboardSourceCache;
}

function getDashboardRowsByType(programType, actualBudget) {
  return getDashboardSourceRows(programType).filter((row) => row.actualBudget === actualBudget);
}

function buildDefaultRecords() {
  return getDashboardRowsByType("", "Completed")
    .flatMap((row) =>
      MONTHS_2026.map((month) => {
        const hectares = Number(row.months[month.key]) || 0;
        if (hectares <= 0) return null;
        const completionDate = getMonthEndDate(month.key);
        return {
          id: `${EXCEL_RECORD_PREFIX}-${normaliseKey(row.programType)}-${normaliseKey(row.field)}-${month.key}`,
          source: EXCEL_RECORD_SOURCE,
          reporterName: "Haikal",
          programType: row.programType,
          blockField: row.field,
          taskName: row.programType,
          schedulerStage: "Completed",
          hectares,
          actualCompletionDate: completionDate,
          deadline: completionDate,
          priority: "Must",
          approvalStatus: "Approved",
          remarks: "",
          latitude: DEFAULT_RECORD_GPS.latitude,
          longitude: DEFAULT_RECORD_GPS.longitude,
          gpsAccuracy: "",
          photoData: "",
          syncStatus: "Synced",
          updatedAt: `${completionDate}T12:00:00.000Z`,
          category: row.category,
        };
      }),
    )
    .filter(Boolean)
    .sort((a, b) => new Date(b.actualCompletionDate) - new Date(a.actualCompletionDate) || a.programType.localeCompare(b.programType));
}

function getDefaultProgramTypes() {
  return DEFAULT_PROGRAM_TYPES.map((type) => ({ ...type }));
}

function normalizeRecord(record) {
  const normalized = {
    reporterName: record.reporterName || "Not captured",
    taskName: record.taskName || record.schedulerStage || "Completion",
    actualCompletionDate: record.actualCompletionDate || record.deadline || todayDate(),
    approvalStatus:
      record.approvalStatus || (["Completed", "Verified"].includes(record.schedulerStage) ? "Approved" : "Pending Approval"),
    schedulerStage: record.schedulerStage || "Completed",
    priority: record.priority || "Must",
    gpsAccuracy: "",
    photoData: "",
    remarks: "",
    ...record,
  };
  normalized.programType = normalizeProgramTypeName(normalized.programType);
  normalized.blockField = normalizeFieldName(normalized.blockField);
  return normalized;
}

function getInitialApprovalStatus() {
  return state.records.some((record) => record.approvalStatus === "Pending Approval") ? "Pending Approval" : "Approved";
}

function mergeDefaultRecords(records) {
  const importedRecords = buildDefaultRecords().map(normalizeRecord);
  const importedIds = new Set(importedRecords.map((record) => record.id));
  const manualRecords = records
    .map(normalizeRecord)
    .filter((record) => !importedIds.has(record.id) && !isExcelImportedRecord(record) && !isFirstDraftDemoRecord(record));
  return [...importedRecords, ...manualRecords];
}

function isExcelImportedRecord(record) {
  return record.source === EXCEL_RECORD_SOURCE || String(record.id || "").startsWith(`${EXCEL_RECORD_PREFIX}-`);
}

function isFirstDraftDemoRecord(record) {
  return (
    (record.reporterName === "Rahman Mandore" && record.taskName === "Mature circle completion") ||
    (record.reporterName === "Siti Field Officer" && record.taskName === "Mature circle partial completion")
  );
}

async function syncWorkProgramRecordsFromApi() {
  if (!window.digitalEstateApi?.listWorkProgramRecords) return;
  try {
    const remoteRecords = (await window.digitalEstateApi.listWorkProgramRecords()).map(normalizeRecord);
    state.records = remoteRecords;
    selectedApprovalStatus = getInitialApprovalStatus();
    if (selectedRecordId && !state.records.some((record) => record.id === selectedRecordId)) selectedRecordId = "";
    persist();
    renderAll();
  } catch (error) {
    console.warn("Work Program Supabase sync unavailable:", error.message);
  }
}

function normalizePlannedProgrammes(plannedProgrammes) {
  return buildDefaultPlannedProgrammes();
}

function normalizeProgramTypeName(programType) {
  const value = String(programType || "").trim();
  const directMatch = DEFAULT_PROGRAM_TYPES.find((type) => type.name.toLowerCase() === value.toLowerCase());
  if (directMatch) return directMatch.name;
  const legacyValue = value.toLowerCase();
  if (legacyValue === "spraying" || legacyValue === "circle spraying") return MATURE_CIRCLE_PROGRAM;
  return DEFAULT_PROGRAM_TYPES[0].name;
}

function normalizeFieldName(fieldName) {
  const value = String(fieldName || "").trim();
  if (!value) return "";
  const match = findFieldByInput(value);
  return match ? getFieldDisplayName(match) : value;
}

function findFieldByInput(fieldName) {
  const key = fieldKey(fieldName);
  return getFieldMapItems().find((field) =>
    [field.fieldNo, field.fieldGis, field.fieldSem].some((candidate) => fieldKey(candidate) === key),
  );
}

function isListedFieldName(fieldName) {
  const value = String(fieldName || "").trim();
  return getTrackingFields().some((field) => getFieldDisplayName(field) === value);
}

function renderApprovalTabs() {
  const labels = {
    "Pending Approval": "Not Approved",
    Approved: "Approved",
  };
  const counts = Object.fromEntries(APPROVAL_STATUSES.map((status) => [status, 0]));
  state.records.forEach((record) => {
    if (recordMatchesSearchAndType(record)) counts[record.approvalStatus] = (counts[record.approvalStatus] || 0) + 1;
  });

  dom.approvalTabs.innerHTML = APPROVAL_STATUSES.map(
    (status) => `
      <button class="approval-tab ${selectedApprovalStatus === status ? "active" : ""}" type="button" data-approval-status="${escapeHtml(status)}">
        ${labels[status] || status}
        <span>${counts[status] || 0}</span>
      </button>
    `,
  ).join("");
}

function setDashboardMode(mode) {
  selectedDashboardMode = mode;
  renderDashboardMode();
  if (mode === "map" && dashboardLeafletMap) {
    window.setTimeout(fitLeafletDashboardMap, 0);
  }
}

function toggleProgrammeRows() {
  showProgrammeRows = !showProgrammeRows;
  renderProgrammeTable();
}

function renderDashboardMode() {
  const isMap = selectedDashboardMode === "map";
  dom.dashboardMapButton.classList.toggle("active", isMap);
  dom.dashboardTableButton.classList.toggle("active", !isMap);
  dom.dashboardMapView.classList.toggle("active", isMap);
  dom.dashboardTableView.classList.toggle("active", !isMap);
}

function renderDashboardTabs() {
  dom.dashboardProgramSelect.value = selectedDashboardProgram;
}

function renderProgrammeSummary() {
  const rows = getDashboardRows(selectedDashboardProgram);
  const plannedTotal = sumDashboardRowsByType(rows, "Programme");
  const completedTotal = sumDashboardRowsByType(rows, "Completed");
  const variance = completedTotal - plannedTotal;
  const completion = plannedTotal ? (completedTotal / plannedTotal) * 100 : 0;

  dom.programmeDashboardTitle.textContent = `${selectedDashboardProgram.toUpperCase()} PROGRAMME FY ${DASHBOARD_YEAR}`;
  dom.programmeSummary.innerHTML = `
    <article>
      <span>Programme</span>
      <strong>${formatNumber(plannedTotal)}</strong>
      <small>Planned hectares where programme data is available</small>
    </article>
    <article>
      <span>Completed</span>
      <strong>${formatNumber(completedTotal)}</strong>
      <small>Approved completed hectares from Records</small>
    </article>
    <article>
      <span>Actual vs Programme</span>
      <strong>${formatPercent(completion)}</strong>
      <small>Completion percentage for selected programme</small>
    </article>
    <article>
      <span>Variance</span>
      <strong class="${variance < 0 ? "negative" : "positive"}">${formatSignedNumber(variance)}</strong>
      <small>Completed minus programme for FY ${DASHBOARD_YEAR}</small>
    </article>
  `;
}

function renderProgrammeTable() {
  const rows = getDashboardRows(selectedDashboardProgram);
  const rowGroups = getDashboardTableRowGroups(rows);

  dom.programmeRowsToggle.setAttribute("aria-expanded", String(showProgrammeRows));
  dom.programmeRowsToggle.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true" class="${showProgrammeRows ? "expanded" : ""}">
      <path d="M6 9l6 6 6-6" />
    </svg>
    ${showProgrammeRows ? "Hide Programme Rows" : "Show Programme Rows"}
  `;

  dom.programmeDashboardHead.innerHTML = `
    <tr>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("field")}" data-dashboard-column="field">Field</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("category")}" data-dashboard-column="category">Category</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("hect")}" data-dashboard-column="hect">Ha</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("actualBudget")}" data-dashboard-column="actualBudget">Actual / Budget</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("frequencyMonths")}" data-dashboard-column="frequencyMonths">Frequency (Months)</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("completedRounds")}" data-dashboard-column="completedRounds">Completed Rounds</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("intervalMonths")}" data-dashboard-column="intervalMonths">Interval (Months)</th>
      <th rowspan="2" class="${getDashboardHeaderHighlightClass("proposedNextDate")}" data-dashboard-column="proposedNextDate">Proposed Next Date</th>
      <th colspan="${MONTHS_2026.length}">${DASHBOARD_YEAR}</th>
    </tr>
    <tr>
      ${MONTHS_2026.map((month) => renderMonthHeader(month)).join("")}
    </tr>
  `;

  if (!rowGroups.length) {
    dom.programmeDashboardBody.innerHTML = `
      <tr>
        <td colspan="${8 + MONTHS_2026.length}" class="programme-empty">No planned programme rows available.</td>
      </tr>
    `;
    bindDashboardBreakdownCells();
    return;
  }

  dom.programmeDashboardBody.innerHTML = rowGroups
    .map((group) => renderProgrammeTableGroup(group))
    .join("");
  bindDashboardBreakdownCells();
}

function getDashboardTableRowGroups(rows) {
  const groups = new Map();
  rows.forEach((row, index) => {
    const key = fieldKey(row.field);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        firstIndex: index,
        completed: null,
        programme: null,
        fallback: row,
      });
    }
    const group = groups.get(key);
    if (row.actualBudget === "Completed") group.completed = row;
    if (row.actualBudget === "Programme") group.programme = row;
  });

  return [...groups.values()].sort((a, b) => a.firstIndex - b.firstIndex);
}

function renderProgrammeTableGroup(group) {
  const primaryRow = group.completed || group.programme || group.fallback;
  const visibleRows = [group.completed || group.programme].filter(Boolean);
  if (showProgrammeRows && group.programme && group.programme !== visibleRows[0]) visibleRows.push(group.programme);
  const sharedRowspan = showProgrammeRows && group.programme && visibleRows.length > 1 ? visibleRows.length : 1;

  return visibleRows
    .map((row, index) => renderProgrammeTableRow(row, primaryRow, index === 0, sharedRowspan))
    .join("");
}

function renderProgrammeTableRow(row, primaryRow, includeSharedCells, sharedRowspan) {
  const fieldValue = primaryRow.field;
  return `
    <tr class="${row.actualBudget === "Programme" ? "programme-source-row" : "completed-source-row"} ${getDashboardRowHighlightClass(fieldValue)}">
      ${
        includeSharedCells
          ? `
            <td class="field-cell merged-field-cell ${getDashboardCellHighlightClass(fieldValue, "field")}" rowspan="${sharedRowspan}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="field">${escapeHtml(primaryRow.field)}</td>
            <td class="merged-field-cell ${getDashboardCellHighlightClass(fieldValue, "category")}" rowspan="${sharedRowspan}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="category">${escapeHtml(primaryRow.category)}</td>
            <td class="merged-field-cell ${getDashboardCellHighlightClass(fieldValue, "hect")}" rowspan="${sharedRowspan}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="hect">${formatNumber(primaryRow.hect)}</td>
          `
          : ""
      }
      <td class="${row.actualBudget === "Programme" ? "programme-label" : "completed-label"} ${getDashboardCellHighlightClass(fieldValue, "actualBudget")}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="actualBudget">${escapeHtml(row.actualBudget)}</td>
      <td class="${getDashboardCellHighlightClass(fieldValue, "frequencyMonths")}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="frequencyMonths">${formatDashboardTemplateValue(row, "frequencyMonths")}</td>
      <td class="${getDashboardCellHighlightClass(fieldValue, "completedRounds")}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="completedRounds">${formatDashboardTemplateValue(row, "completedRounds")}</td>
      <td class="${getDashboardCellHighlightClass(fieldValue, "intervalMonths")}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="intervalMonths">${formatDashboardTemplateValue(row, "intervalMonths")}</td>
      <td class="${getDashboardCellHighlightClass(fieldValue, "proposedNextDate")}" data-dashboard-field="${escapeHtml(fieldValue)}" data-dashboard-column="proposedNextDate">${formatDashboardTemplateDate(row, "proposedNextDate")}</td>
      ${MONTHS_2026.map((month) => renderDashboardMonthCell(row, month)).join("")}
    </tr>
  `;
}

function renderMonthHeader(month) {
  return `
    <th class="month-head ${getDashboardHeaderHighlightClass(month.key)}" data-dashboard-column="${month.key}">
      <span>${month.label}</span>
    </th>
  `;
}

function bindDashboardBreakdownCells() {
  dom.programmeDashboardBody.querySelectorAll(".dashboard-month-cell-button").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      selectedDashboardTableField = button.dataset.field;
      selectedDashboardTableColumn = button.dataset.month;
      selectedDashboardBreakdown = {
        programType: button.dataset.programType,
        field: button.dataset.field,
        monthKey: button.dataset.month,
        total: Number(button.dataset.total) || 0,
      };
      renderProgrammeTable();
      renderDailyTrackingPanel();
    });
  });
}

function handleProgrammeTableHighlightClick(event) {
  const cell = event.target.closest("[data-dashboard-column]");
  if (!cell) return;
  if (!dom.programmeDashboardHead.contains(cell) && !dom.programmeDashboardBody.contains(cell)) return;
  selectedDashboardTableField = cell.dataset.dashboardField || "";
  selectedDashboardTableColumn = cell.dataset.dashboardColumn || "";
  renderProgrammeTable();
}

function renderDashboardMonthCell(row, month) {
  const value = row.months[month.key] || 0;
  const filledClass = row.actualBudget === "Programme" ? "planned-month" : "completed-month";
  const isSelected =
    selectedDashboardBreakdown &&
    selectedDashboardBreakdown.programType === row.programType &&
    fieldKey(selectedDashboardBreakdown.field) === fieldKey(row.field) &&
    selectedDashboardBreakdown.monthKey === month.key;
  const isClickable = row.actualBudget === "Completed" && value > 0;
  const highlightClass = getDashboardCellHighlightClass(row.field, month.key);
  if (!isClickable) {
    return `<td class="${value ? filledClass : "blank-completed-month"} ${highlightClass}" data-dashboard-field="${escapeHtml(row.field)}" data-dashboard-column="${month.key}">${value ? formatNumber(value) : ""}</td>`;
  }

  return `
    <td class="${filledClass} ${highlightClass} ${isSelected ? "dashboard-breakdown-active" : ""}" data-dashboard-field="${escapeHtml(row.field)}" data-dashboard-column="${month.key}">
      <button
        class="dashboard-month-cell-button"
        type="button"
        data-program-type="${escapeHtml(row.programType)}"
        data-field="${escapeHtml(row.field)}"
        data-month="${month.key}"
        data-total="${value}"
        aria-label="Show daily breakdown for ${escapeHtml(row.field)} ${escapeHtml(formatMonthLabel(month.key))}"
      >
        ${formatNumber(value)}
      </button>
    </td>
  `;
}

function getDashboardRowHighlightClass(field) {
  return selectedDashboardTableField && fieldKey(field) === fieldKey(selectedDashboardTableField) ? "dashboard-row-active" : "";
}

function getDashboardHeaderHighlightClass(column) {
  return selectedDashboardTableColumn === column ? "dashboard-column-active" : "";
}

function getDashboardCellHighlightClass(field, column) {
  const isRowActive = selectedDashboardTableField && fieldKey(field) === fieldKey(selectedDashboardTableField);
  const isColumnActive = selectedDashboardTableColumn === column;
  return [
    isRowActive ? "dashboard-row-active" : "",
    isColumnActive ? "dashboard-column-active" : "",
    isRowActive && isColumnActive ? "dashboard-cell-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

function renderDailyTrackingPanel() {
  if (!selectedDashboardBreakdown) {
    dom.dailyTrackingPanel.classList.add("hidden");
    dom.dailyTrackingPanel.innerHTML = "";
    return;
  }

  const { programType, field, monthKey, total } = selectedDashboardBreakdown;
  const month = MONTHS_2026.find((item) => item.key === monthKey);
  const records = getDashboardBreakdownRecords(programType, field, monthKey);
  const distributedTotal = sumRecordHectares(records);
  const variance = distributedTotal - total;

  dom.dailyTrackingPanel.classList.remove("hidden");
  dom.dailyTrackingPanel.innerHTML = `
    <div class="daily-tracking-content" role="dialog" aria-modal="true" aria-label="Daily activity breakdown">
      <div class="daily-tracking-header">
        <div>
          <p class="eyebrow">Daily Breakdown</p>
          <h3>${escapeHtml(field)} - ${escapeHtml(programType)} - ${escapeHtml(month?.label || "")} ${DASHBOARD_YEAR}</h3>
        </div>
        <button class="secondary-button compact" type="button" id="closeDailyTrackingButton">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
          Close
        </button>
      </div>

      <div class="daily-summary">
        <article>
          <span>Dashboard Cell Total</span>
          <strong>${formatMonthlyHectares(total)}</strong>
        </article>
        <article>
          <span>Daily Distribution</span>
          <strong>${formatMonthlyHectares(distributedTotal)}</strong>
        </article>
        <article>
          <span>Variance</span>
          <strong class="${variance < 0 ? "negative" : "positive"}">${formatSignedMonthlyHectares(variance)}</strong>
        </article>
        <article>
          <span>Entries</span>
          <strong>${records.length}</strong>
        </article>
      </div>

      ${
        records.length
          ? renderDailyRecordsTable(records)
          : `
            <div class="daily-empty">
              <h4>No daily distribution captured</h4>
              <p>The dashboard cell has ${formatMonthlyHectares(total)} ha, but no matching Records entries are available for this field and month.</p>
            </div>
          `
      }
    </div>
  `;

  document.querySelector("#closeDailyTrackingButton")?.addEventListener("click", closeDashboardBreakdown);
  dom.dailyTrackingPanel.addEventListener(
    "click",
    (event) => {
      if (event.target === dom.dailyTrackingPanel) closeDashboardBreakdown();
    },
    { once: true },
  );
}

function renderDailyRecordsTable(records) {
  return `
    <div class="daily-table-wrap">
      <table class="daily-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Week</th>
            <th>Hectares</th>
            <th>Reporter</th>
            <th>Status</th>
            <th>Evidence</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td><strong>${formatDate(record.actualCompletionDate, "No date")}</strong></td>
                  <td>${escapeHtml(getWeekOfMonthLabel(record.actualCompletionDate))}</td>
                  <td>${formatMonthlyHectares(record.hectares)}</td>
                  <td>${escapeHtml(record.reporterName)}</td>
                  <td>${escapeHtml(record.approvalStatus)}</td>
                  <td>${record.photoData ? "Attached" : "None"}</td>
                  <td>${escapeHtml(record.remarks || "-")}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function closeDashboardBreakdown() {
  selectedDashboardBreakdown = null;
  dom.dailyTrackingPanel.classList.add("hidden");
  dom.dailyTrackingPanel.innerHTML = "";
  renderProgrammeTable();
}

function downloadDashboardTableExport() {
  const rows = getDashboardExportRows(selectedDashboardProgram);
  if (!rows.length) {
    showToast("No dashboard data available to export.");
    return;
  }

  const headers = ["Field", "Category", "Ha", "Actual/Budget", "Frequency", "Completed Rounds", "Interval (months)", "Proposed Next Date", "Month", "Value"];
  const csv = [
    headers,
    ...rows.map((row) => headers.map((header) => row[header])),
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `dashboard-table-${normaliseKey(selectedDashboardProgram)}-${DASHBOARD_YEAR}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("Dashboard table export downloaded.");
}

function getDashboardExportRows(programType) {
  const programmeRows = getDashboardProgrammeRows(programType);
  const completedRows = getDashboardCompletedRows(programType, programmeRows);
  const completedRowByField = new Map(completedRows.map((row) => [fieldKey(row.field), row]));
  const programmeExportRows = programmeRows.flatMap((row) =>
    MONTHS_2026.map((month) => {
      const value = Number(row.months[month.key]) || 0;
      if (value <= 0) return null;
      return toDashboardExportRow(row, month.key, value);
    }).filter(Boolean),
  );
  const completedExportRows = getApprovedDashboardRecords(programType)
    .slice()
    .sort((a, b) => new Date(a.actualCompletionDate || a.deadline || 0) - new Date(b.actualCompletionDate || b.deadline || 0))
    .map((record) => {
      const completedRow = completedRowByField.get(fieldKey(record.blockField)) || buildDashboardCompletedRow(programType, record.blockField, null, [record]);
      return toDashboardExportRow(completedRow, getMonthKey(record.actualCompletionDate || record.deadline), Number(record.hectares) || 0);
    });

  return [...programmeExportRows, ...completedExportRows];
}

function toDashboardExportRow(row, monthKey, value) {
  return {
    Field: row.field,
    Category: row.category,
    Ha: formatRawNumber(row.hect),
    "Actual/Budget": row.actualBudget,
    Frequency: formatRawNumber(row.frequencyMonths),
    "Completed Rounds": formatRawNumber(row.completedRounds),
    "Interval (months)": formatRawNumber(row.intervalMonths),
    "Proposed Next Date": row.proposedNextDate || "",
    Month: monthKey,
    Value: formatRawNumber(value),
  };
}

function csvEscape(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getDashboardBreakdownRecords(programType, field, monthKey) {
  return state.records
    .filter(
      (record) =>
        record.approvalStatus === "Approved" &&
        record.programType === programType &&
        fieldKey(record.blockField) === fieldKey(field) &&
        getMonthKey(record.actualCompletionDate || record.deadline) === monthKey,
    )
    .sort((a, b) => new Date(a.actualCompletionDate || a.deadline || 0) - new Date(b.actualCompletionDate || b.deadline || 0));
}

function getWeekOfMonthLabel(dateString) {
  const day = Number((dateString || "").slice(8, 10));
  if (!day) return "-";
  return `Week ${Math.ceil(day / 7)}`;
}

function getDashboardRows(programType) {
  const programmeRows = getDashboardProgrammeRows(programType);
  const completedRows = getDashboardCompletedRows(programType, programmeRows);
  return [...completedRows, ...programmeRows];
}

function getDashboardProgrammeRows(programType) {
  const sourceRows = getDashboardRowsByType(programType, "Programme");
  if (sourceRows.length) return sourceRows.map((row) => ({ ...row, months: { ...row.months } }));
  return buildDashboardTemplateRows(programType, "Programme");
}

function buildDashboardTemplateRows(programType, actualBudget) {
  return getTrackingFields().map((field) => buildDashboardTemplateRow(programType, field, actualBudget));
}

function buildDashboardTemplateRow(programType, field, actualBudget) {
  return {
    id: `${normaliseKey(programType)}-${normaliseKey(getFieldDisplayName(field))}-${normaliseKey(actualBudget)}-template`,
    programType,
    field: getFieldDisplayName(field),
    category: getFieldCategory(field),
    hect: Number(field.ha) || 0,
    actualBudget,
    frequencyMonths: "",
    completedRounds: "",
    intervalMonths: "",
    proposedNextDate: "",
    months: createEmptyDashboardMonths(),
    isTemplate: true,
  };
}

function createEmptyDashboardMonths() {
  return MONTHS_2026.reduce((months, month) => {
    months[month.key] = 0;
    return months;
  }, {});
}

function getDashboardCompletedRows(programType, programmeRows = getDashboardProgrammeRows(programType)) {
  const recordsByField = groupApprovedDashboardRecordsByField(programType);
  const seenFields = new Set();
  const rows = programmeRows.map((programmeRow) => {
    const key = fieldKey(programmeRow.field);
    seenFields.add(key);
    return buildDashboardCompletedRow(programType, programmeRow.field, programmeRow, recordsByField.get(key) || []);
  });

  recordsByField.forEach((records, key) => {
    if (seenFields.has(key)) return;
    const field = records[0]?.blockField || key;
    rows.push(buildDashboardCompletedRow(programType, field, null, records));
  });

  return rows;
}

function groupApprovedDashboardRecordsByField(programType) {
  return getApprovedDashboardRecords(programType).reduce((groups, record) => {
    const key = fieldKey(record.blockField);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
    return groups;
  }, new Map());
}

function getApprovedDashboardRecords(programType) {
  return state.records.filter((record) => record.programType === programType && record.approvalStatus === "Approved");
}

function buildDashboardCompletedRow(programType, field, programmeRow, records) {
  const sourceCompletedRow = findSourceDashboardRow(programType, field, "Completed");
  const metadataRow = programmeRow || sourceCompletedRow || getDashboardFieldFallbackRow(programType, field, records[0]);
  const manualRecords = records.filter((record) => !isExcelImportedRecord(record));
  const latestRecord = getLatestDashboardRecord(records);
  const shouldPreserveSourceMetadata = !manualRecords.length && sourceCompletedRow;
  const frequencyMonths = shouldPreserveSourceMetadata ? sourceCompletedRow.frequencyMonths : sourceCompletedRow?.frequencyMonths || programmeRow?.frequencyMonths || "";
  const completedRounds = shouldPreserveSourceMetadata ? sourceCompletedRow.completedRounds : records.length || sourceCompletedRow?.completedRounds || "";
  const intervalMonths = shouldPreserveSourceMetadata ? sourceCompletedRow.intervalMonths : getDashboardRecordIntervalMonths(latestRecord);
  const proposedNextDate = shouldPreserveSourceMetadata ? sourceCompletedRow.proposedNextDate : getDashboardRecordProposedNextDate(latestRecord, frequencyMonths);

  return {
    id: `${normaliseKey(programType)}-${normaliseKey(field)}-completed-approved`,
    programType,
    field: metadataRow.field,
    category: metadataRow.category,
    hect: Number(metadataRow.hect) || 0,
    actualBudget: "Completed",
    frequencyMonths,
    completedRounds,
    intervalMonths,
    proposedNextDate,
    isTemplate: Boolean(metadataRow.isTemplate && !records.length && !sourceCompletedRow),
    months: MONTHS_2026.reduce((months, month) => {
      months[month.key] = records
        .filter((record) => getMonthKey(record.actualCompletionDate || record.deadline) === month.key)
        .reduce((total, record) => total + (Number(record.hectares) || 0), 0);
      return months;
    }, {}),
  };
}

function findSourceDashboardRow(programType, field, actualBudget) {
  return getDashboardRowsByType(programType, actualBudget).find((row) => fieldKey(row.field) === fieldKey(field));
}

function getDashboardFieldFallbackRow(programType, field, record) {
  const mapField = getFieldMapItems().find((item) => fieldKey(item.fieldGis) === fieldKey(field) || fieldKey(item.fieldNo) === fieldKey(field));
  return {
    programType,
    field: record?.blockField || mapField?.fieldNo || field,
    category: record?.category || getFieldCategory(mapField) || "-",
    hect: Number(mapField?.ha || record?.hectares) || 0,
    actualBudget: "Completed",
    frequencyMonths: "",
    completedRounds: 0,
    intervalMonths: "",
    proposedNextDate: "",
    months: {},
  };
}

function getLatestDashboardRecord(records) {
  return [...records].sort((a, b) => new Date(b.actualCompletionDate || b.deadline || 0) - new Date(a.actualCompletionDate || a.deadline || 0))[0] || null;
}

function getDashboardRecordIntervalMonths(record) {
  if (!record) return "";
  return Math.max(0, monthDiff(getMonthKey(record.actualCompletionDate || record.deadline), currentMonthKey()));
}

function getDashboardRecordProposedNextDate(record, frequencyMonths) {
  if (!record) return "";
  const frequency = Number(frequencyMonths);
  if (!Number.isFinite(frequency) || frequency <= 0) return "";
  return addMonthsToDateString(record.actualCompletionDate || record.deadline, frequency);
}

function sumDashboardRowsByType(rows, actualBudget) {
  return rows.filter((row) => row.actualBudget === actualBudget).reduce((total, row) => total + sumDashboardRowMonths(row), 0);
}

function sumDashboardRowMonths(row) {
  return MONTHS_2026.reduce((total, month) => total + (Number(row.months[month.key]) || 0), 0);
}

function renderDashboardMap() {
  const mapItems = getFieldMapItems();
  const statuses = mapItems.map((field) => {
    const row = findPlannedRowForMapField(field, selectedDashboardProgram);
    return {
      ...getMapFieldStatus(row, field),
      field,
      labelPoint: getFieldLabelPoint(field),
      row,
    };
  });

  if (!selectedMapField || !statuses.some((item) => item.field.fieldGis === selectedMapField)) {
    selectedMapField = statuses[0]?.field.fieldGis || "";
  }

  const counts = statuses.reduce(
    (summary, item) => {
      summary[item.status] += 1;
      return summary;
    },
    { green: 0, yellow: 0, red: 0, grey: 0 },
  );

  renderDashboardMapLegend();
  renderDashboardMapRules();

  dom.dashboardMapSummary.innerHTML = `
    <article><span>Green</span><strong>${counts.green}</strong></article>
    <article><span>Yellow</span><strong>${counts.yellow}</strong></article>
    <article><span>Red</span><strong>${counts.red}</strong></article>
    <article><span>No Interval</span><strong>${counts.grey}</strong></article>
  `;

  if (window.L) {
    renderLeafletDashboardMap(statuses);
  } else {
    renderStaticDashboardMap(statuses);
  }

  renderMapFieldDetail(statuses.find((item) => item.field.fieldGis === selectedMapField) || statuses[0]);
}

function renderDashboardMapLegend() {
  const rule = getMapStatusRule(selectedDashboardProgram);
  dom.dashboardMapLegend.innerHTML = `
    <span><i class="legend-dot green"></i>Green ${escapeHtml(rule.greenText)}</span>
    <span><i class="legend-dot yellow"></i>Yellow ${escapeHtml(rule.yellowText)}</span>
    <span><i class="legend-dot red"></i>Red ${escapeHtml(rule.redText)}</span>
    <span><i class="legend-dot grey"></i>No interval</span>
  `;
}

function renderDashboardMapRules() {
  const isOpen = !dom.dashboardMapRulesPopover.classList.contains("hidden");
  dom.dashboardMapRulesButton.setAttribute("aria-expanded", String(isOpen));
  dom.dashboardMapRulesPopover.innerHTML = `
    <h4>Map Colour Rules</h4>
    <p>Colours are based on each field's Interval value.</p>
    <p>Non-numeric interval values such as TBC or Immature are shown as No Interval.</p>
    <p>Boundary months between the stated bands are treated as the next higher risk colour.</p>
    <table>
      <thead>
        <tr>
          <th>Programme</th>
          <th>Green</th>
          <th>Yellow</th>
          <th>Red</th>
        </tr>
      </thead>
      <tbody>
        ${Object.entries(MAP_STATUS_RULES)
          .map(
            ([program, rule]) => `
              <tr class="${program === selectedDashboardProgram ? "active" : ""}">
                <th scope="row">${escapeHtml(program)}</th>
                <td>${escapeHtml(rule.greenText)}</td>
                <td>${escapeHtml(rule.yellowText)}</td>
                <td>${escapeHtml(rule.redText)}</td>
              </tr>
            `,
          )
          .join("")}
      </tbody>
    </table>
  `;
}

function toggleDashboardMapRules() {
  dom.dashboardMapRulesPopover.classList.toggle("hidden");
  renderDashboardMapRules();
}

function renderLeafletDashboardMap(statuses) {
  destroyDashboardLeafletMap();
  dom.dashboardMap.innerHTML = "";

  if (!statuses.length) {
    dom.dashboardMap.innerHTML = `
      <div class="map-detail-empty">
        <h3>No field map</h3>
        <p>Field map data will appear here once a KMZ or GeoJSON layer is available.</p>
      </div>
    `;
    return;
  }

  dashboardLeafletMap = L.map(dom.dashboardMap, {
    attributionControl: true,
    scrollWheelZoom: false,
    tap: true,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 22,
  }).addTo(dashboardLeafletMap);

  const geoJson = buildDashboardGeoJson(statuses);
  const statusLookup = new Map(statuses.map((item) => [item.field.fieldGis, item]));

  dashboardFieldLayer = L.geoJSON(geoJson, {
    style: (feature) => getLeafletFieldStyle(feature.properties.status, feature.properties.fieldGis === selectedMapField),
    onEachFeature: (feature, layer) => {
      const item = statusLookup.get(feature.properties.fieldGis);
      layer.on("add", () => {
        const element = layer.getElement();
        if (!element) return;
        element.classList.add("leaflet-field-polygon");
        element.dataset.field = feature.properties.fieldGis;
      });
      layer.bindTooltip(feature.properties.fieldNo || feature.properties.fieldGis, {
        className: "field-map-tooltip",
        direction: "center",
        permanent: true,
        sticky: false,
      });
      layer.bindPopup(renderLeafletPopup(item));
      layer.on("click", () => {
        selectedMapField = feature.properties.fieldGis;
        refreshLeafletFieldStyles();
        renderMapFieldDetail(item);
      });
    },
  }).addTo(dashboardLeafletMap);

  fitLeafletDashboardMap();
  window.setTimeout(fitLeafletDashboardMap, 0);
}

function renderStaticDashboardMap(statuses) {
  destroyDashboardLeafletMap();
  dom.dashboardMap.innerHTML = `
    <svg class="kml-map-svg" viewBox="0 0 1000 1000" role="img" aria-label="Digital Estate field map">
      <g>
        ${statuses
          .map(
            (item) => `
              <g class="field-shape-wrap">
                ${item.field.polygons
                  .map(
                    (polygon) => `
                      <path
                        class="field-polygon ${item.status} ${item.field.fieldGis === selectedMapField ? "selected" : ""}"
                        d="${polygonToPath(polygon)}"
                        data-field="${escapeHtml(item.field.fieldGis)}"
                        tabindex="0"
                        role="button"
                        aria-label="${escapeHtml(item.field.fieldGis)} ${escapeHtml(item.label)}"
                      ></path>
                    `,
                  )
                  .join("")}
                <text class="field-map-label" x="${item.labelPoint.x}" y="${item.labelPoint.y}">${escapeHtml(getFieldDisplayName(item.field))}</text>
              </g>
            `,
          )
          .join("")}
      </g>
    </svg>
  `;

  dom.dashboardMap.querySelectorAll(".field-polygon").forEach((button) => {
    button.addEventListener("click", () => {
      selectedMapField = button.dataset.field;
      renderDashboardMap();
    });
    button.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectedMapField = button.dataset.field;
      renderDashboardMap();
    });
  });
}

function destroyDashboardLeafletMap() {
  if (!dashboardLeafletMap) return;
  dashboardLeafletMap.remove();
  dashboardLeafletMap = null;
  dashboardFieldLayer = null;
}

function refreshLeafletFieldStyles() {
  if (!dashboardFieldLayer) return;
  dashboardFieldLayer.eachLayer((layer) => {
    const isSelected = layer.feature?.properties?.fieldGis === selectedMapField;
    layer.setStyle(getLeafletFieldStyle(layer.feature?.properties?.status, isSelected));
    if (isSelected) layer.bringToFront();
  });
}

function fitLeafletDashboardMap() {
  if (!dashboardLeafletMap || !dashboardFieldLayer) return;
  dashboardLeafletMap.invalidateSize();
  const bounds = dashboardFieldLayer.getBounds();
  if (bounds.isValid()) {
    dashboardLeafletMap.fitBounds(bounds, { maxZoom: 16, padding: [22, 22] });
    const fittedZoom = dashboardLeafletMap.getZoom();
    const maxZoom = dashboardLeafletMap.getMaxZoom();
    const offsetZoom = fittedZoom + DASHBOARD_MAP_DEFAULT_ZOOM_OFFSET;
    const targetZoom = Math.min(offsetZoom, Number.isFinite(maxZoom) ? maxZoom : offsetZoom);
    dashboardLeafletMap.setZoom(targetZoom, { animate: false });
    dom.dashboardMap.dataset.fitZoom = String(fittedZoom);
    dom.dashboardMap.dataset.defaultZoom = String(targetZoom);
  }
}

function getLeafletFieldStyle(status, selected = false) {
  const fillColors = {
    green: "#22a65a",
    yellow: "#f4c542",
    red: "#d94a38",
    grey: "#9da5a0",
  };

  return {
    color: selected ? "#ffffff" : "#263a2f",
    fillColor: fillColors[status] || fillColors.grey,
    fillOpacity: selected ? 0.86 : 0.68,
    opacity: 1,
    weight: selected ? 4 : 1.4,
  };
}

function buildDashboardGeoJson(statuses) {
  return {
    type: "FeatureCollection",
    features: statuses.map((item) => ({
      type: "Feature",
      properties: {
        fieldGis: item.field.fieldGis,
        fieldNo: getFieldDisplayName(item.field),
        status: item.status,
        statusLabel: item.label,
        estate: item.field.estate || "Digital Estate",
        division: item.field.division || "-",
        ha: item.field.ha,
      },
      geometry: getFieldGeometry(item.field),
    })),
  };
}

function getFieldGeometry(field) {
  const polygons = field.polygons.map((polygon) => [closeGeoJsonRing(polygon)]);
  if (polygons.length === 1) {
    return {
      type: "Polygon",
      coordinates: polygons[0],
    };
  }

  return {
    type: "MultiPolygon",
    coordinates: polygons,
  };
}

function closeGeoJsonRing(polygon) {
  if (!polygon.length) return polygon;
  const first = polygon[0];
  const last = polygon[polygon.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return polygon;
  return [...polygon, first];
}

function renderLeafletPopup(item) {
  if (!item) return "";
  return `
    <div class="field-popup">
      <strong>${escapeHtml(getFieldDisplayName(item.field))}</strong>
      <span>${escapeHtml(item.label)}</span>
      <dl>
        <div><dt>GIS ha</dt><dd>${formatNumber(item.field.ha)}</dd></div>
        <div><dt>Proposed</dt><dd>${formatDashboardDate(item.proposedNextDate)}</dd></div>
        <div><dt>Interval</dt><dd>${formatMapInterval(item.intervalValue, item.intervalMonths)}</dd></div>
      </dl>
    </div>
  `;
}

function renderMapFieldDetail(item) {
  if (!item) {
    dom.dashboardMapDetail.innerHTML = `
      <div class="map-detail-empty">
        <h3>No planned fields</h3>
        <p>Planned field blocks will appear here once data is available.</p>
      </div>
    `;
    return;
  }

  dom.dashboardMapDetail.innerHTML = `
    <div class="map-detail-status ${item.status}">
      <span>${escapeHtml(item.label)}</span>
    </div>
    <h3>${escapeHtml(getFieldDisplayName(item.field))}</h3>
    <dl>
      <div><dt>Field No.</dt><dd>${escapeHtml(getFieldDisplayName(item.field))}</dd></div>
      <div><dt>GIS ID</dt><dd>${escapeHtml(item.field.fieldGis)}</dd></div>
      <div><dt>Programme</dt><dd>${escapeHtml(selectedDashboardProgram)}</dd></div>
      <div><dt>Estate</dt><dd>${escapeHtml(item.field.estate || "Digital Estate")}</dd></div>
      <div><dt>Division</dt><dd>${escapeHtml(item.field.division || "-")}</dd></div>
      <div><dt>GIS Hectares</dt><dd>${formatNumber(item.field.ha)}</dd></div>
      <div><dt>Planned Hectares To Date</dt><dd>${formatNumber(item.plannedToDate)}</dd></div>
      <div><dt>Completed To Date</dt><dd>${formatNumber(item.completedToDate)}</dd></div>
      <div><dt>Proposed Next Date</dt><dd>${formatDashboardDate(item.proposedNextDate)}</dd></div>
      <div><dt>Interval</dt><dd>${formatMapInterval(item.intervalValue, item.intervalMonths)}</dd></div>
      <div><dt>Rule Applied</dt><dd>${escapeHtml(item.ruleLabel)}</dd></div>
    </dl>
    <p>${escapeHtml(item.message)}</p>
  `;
}

function getMapFieldStatus(row, field) {
  const currentMonth = currentMonthKey();
  const completedRow = findDashboardRowForMapField(field, selectedDashboardProgram, "Completed");
  const rule = getMapStatusRule(selectedDashboardProgram);
  const plannedToDate = MONTHS_2026.filter((month) => month.key <= currentMonth).reduce(
    (total, month) => total + (Number(row?.months?.[month.key]) || 0),
    0,
  );
  const completedToDate = MONTHS_2026.filter((month) => month.key <= currentMonth).reduce(
    (total, month) => total + (Number(completedRow?.months?.[month.key]) || 0),
    0,
  );
  const latestPlannedMonth = row ? getLatestPlannedMonth(row, currentMonth) : "";
  const latestCompletedMonth = completedRow ? getLatestCompletedMonth(completedRow, currentMonth) : "";
  const proposedNextDate = completedRow?.proposedNextDate || row?.proposedNextDate || "";
  const intervalMonths = completedRow?.intervalMonths || row?.intervalMonths || "";
  const intervalValue = getIntervalValue(intervalMonths);
  const ruleLabel = getMapRuleLabel(rule);

  if (!row && !completedRow) {
    return {
      status: "grey",
      label: "No planned data",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      latestCompletedMonth,
      proposedNextDate,
      intervalMonths,
      intervalValue,
      ruleLabel,
      message: "No programme data is available for this field.",
    };
  }

  if (intervalValue === null) {
    return {
      status: "grey",
      label: "No interval",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      latestCompletedMonth,
      proposedNextDate,
      intervalMonths,
      intervalValue,
      ruleLabel,
      message: "No valid Interval value is available, so this field is not colour-rated.",
    };
  }

  if (rule.isConfigured === false) {
    return {
      status: "grey",
      label: "No rule configured",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      latestCompletedMonth,
      proposedNextDate,
      intervalMonths,
      intervalValue,
      ruleLabel,
      message: "No colour rule has been configured for this work programme yet.",
    };
  }

  const status = getRuleStatus(intervalValue, rule);
  const label = getRuleStatusLabel(status);

  return {
    status,
    label,
    plannedToDate,
    completedToDate,
    latestPlannedMonth,
    latestCompletedMonth,
    proposedNextDate,
    intervalMonths,
    intervalValue,
    ruleLabel,
    message: `${label} based on ${formatMapInterval(intervalValue, intervalMonths)} interval.`,
  };
}

function getMapStatusRule(programType) {
  return MAP_STATUS_RULES[programType] || DEFAULT_MAP_STATUS_RULE;
}

function getRuleStatus(intervalValue, rule) {
  if (intervalValue < rule.greenBelow) return "green";
  if (intervalValue <= rule.yellowTo) return "yellow";
  return "red";
}

function getRuleStatusLabel(status) {
  const labels = {
    green: "Green",
    yellow: "Yellow",
    red: "Red",
    grey: "No interval",
  };
  return labels[status] || labels.grey;
}

function getMapRuleLabel(rule) {
  if (rule.isConfigured === false) return "Not configured";
  return `Green ${rule.greenText}; Yellow ${rule.yellowText}; Red ${rule.redText}`;
}

function getIntervalValue(intervalMonths) {
  const value = Number(intervalMonths);
  return Number.isFinite(value) ? value : null;
}

function formatMapInterval(value, rawValue) {
  if (value === null || value === undefined) return formatDashboardValue(rawValue);
  return `${formatDashboardValue(value)} month${Number(value) === 1 ? "" : "s"}`;
}

function getLatestPlannedMonth(row, currentMonth) {
  const plannedMonths = MONTHS_2026.map((month) => month.key).filter((key) => key <= currentMonth && Number(row.months[key]) > 0);
  return plannedMonths[plannedMonths.length - 1];
}

function getLatestCompletedMonth(row, currentMonth) {
  const completedMonths = MONTHS_2026.map((month) => month.key).filter((key) => key <= currentMonth && Number(row.months[key]) > 0);
  return completedMonths[completedMonths.length - 1];
}

function getFirstUnmetPlannedMonth(row, currentMonth, completedToDate) {
  let cumulativePlanned = 0;
  for (const month of MONTHS_2026) {
    if (month.key > currentMonth) break;
    cumulativePlanned += Number(row?.months?.[month.key]) || 0;
    if (cumulativePlanned > completedToDate) return month.key;
  }
  return "";
}

function getFieldMapItems() {
  return window.FIELD_MAP_DATA?.fields || [];
}

function getTrackingFields() {
  return [...getFieldMapItems()].sort((a, b) => getFieldDisplayName(a).localeCompare(getFieldDisplayName(b), undefined, { numeric: true }));
}

function getFieldDisplayName(field) {
  return field?.fieldNo || field?.fieldGis || "-";
}

function getFieldCategory(field) {
  if (!field?.fieldType) return "";
  return String(field.fieldType).includes("IMMATURE") ? "Immature" : "Mature";
}

function getFieldGpsDefaults(fieldCode) {
  const field = getFieldMapItems().find((item) => fieldKey(item.fieldGis) === fieldKey(fieldCode) || fieldKey(item.fieldNo) === fieldKey(fieldCode));
  const center = field ? getFieldCenterLatLng(field) : null;
  return center
    ? {
        latitude: Number(center.lat.toFixed(6)),
        longitude: Number(center.lng.toFixed(6)),
      }
    : {
        latitude: "",
        longitude: "",
      };
}

function getFieldCenterLatLng(field) {
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  field.polygons.forEach((polygon) => {
    polygon.forEach(([lng, lat]) => {
      totalLat += lat;
      totalLng += lng;
      count += 1;
    });
  });
  return count ? { lat: totalLat / count, lng: totalLng / count } : null;
}

function findPlannedRowForMapField(field, programType) {
  return findDashboardRowForMapField(field, programType, "Programme");
}

function findDashboardRowForMapField(field, programType, actualBudget) {
  const rows =
    actualBudget === "Completed"
      ? getDashboardRows(programType).filter((row) => row.actualBudget === "Completed")
      : getDashboardProgrammeRows(programType);
  return rows.find(
    (row) => fieldKey(row.field) === fieldKey(field.fieldGis) || fieldKey(row.field) === fieldKey(field.fieldNo),
  );
}

function polygonToPath(polygon) {
  return polygon
    .map((point, index) => {
      const projected = projectCoordinate(point);
      return `${index === 0 ? "M" : "L"} ${projected.x.toFixed(2)} ${projected.y.toFixed(2)}`;
    })
    .join(" ") + " Z";
}

function projectCoordinate(point) {
  const bounds = window.FIELD_MAP_DATA?.bounds;
  if (!bounds) return { x: 0, y: 0 };
  const [lng, lat] = point;
  const lngRange = Math.max(bounds.maxLng - bounds.minLng, 0.000001);
  const latRange = Math.max(bounds.maxLat - bounds.minLat, 0.000001);
  return {
    x: ((lng - bounds.minLng) / lngRange) * 1000,
    y: ((bounds.maxLat - lat) / latRange) * 1000,
  };
}

function getFieldLabelPoint(field) {
  let totalX = 0;
  let totalY = 0;
  let count = 0;
  field.polygons.forEach((polygon) => {
    polygon.forEach((point) => {
      const projected = projectCoordinate(point);
      totalX += projected.x;
      totalY += projected.y;
      count += 1;
    });
  });
  return {
    x: count ? totalX / count : 0,
    y: count ? totalY / count : 0,
  };
}

function renderRecordsOutputs() {
  renderApprovalTabs();
  renderRecords();
  renderMapOutput();
}

function recordMatchesSearchAndType(record) {
  const query = dom.searchInput.value.trim().toLowerCase();
  const typeFilter = dom.typeFilter.value;
  const fieldFilter = dom.fieldFilter.value;

  const matchesText = [record.reporterName, record.programType, record.blockField, record.taskName, record.approvalStatus, record.remarks]
    .join(" ")
    .toLowerCase()
    .includes(query);
  const matchesType = !typeFilter || record.programType === typeFilter;
  const matchesField = !fieldFilter || fieldKey(record.blockField) === fieldKey(fieldFilter);
  return matchesText && matchesType && matchesField;
}

function getFilteredRecords() {
  return state.records.filter((record) => recordMatchesSearchAndType(record) && record.approvalStatus === selectedApprovalStatus);
}

function getMapRecords() {
  return state.records.filter(recordMatchesSearchAndType);
}

function renderRecords() {
  const filtered = getFilteredRecords();

  dom.recordsTable.innerHTML = "";
  dom.recordsCardList.innerHTML = "";
  dom.recordsEmpty.classList.toggle("hidden", filtered.length > 0);
  dom.recordsScrollButton.classList.toggle("hidden", filtered.length <= 5);

  filtered.forEach((record) => {
    const tr = document.createElement("tr");
    tr.className = selectedRecordId === record.id ? "record-row-active" : "";
    tr.dataset.recordId = record.id;
    tr.tabIndex = 0;
    const gps =
      record.latitude && record.longitude
        ? `${Number(record.latitude).toFixed(5)}, ${Number(record.longitude).toFixed(5)}${record.gpsAccuracy ? ` | +/- ${Number(record.gpsAccuracy).toFixed(1)}m` : ""}`
        : "Not captured";
    const approvalClass = record.approvalStatus === "Approved" ? "pill" : "pill warning";
    tr.innerHTML = `
      <td><strong>${escapeHtml(record.reporterName)}</strong><br><span>${escapeHtml(record.syncStatus)}</span></td>
      <td><strong>${escapeHtml(record.programType)}</strong><br><span>${escapeHtml(record.taskName)}</span></td>
      <td>${escapeHtml(record.blockField)}</td>
      <td>${Number(record.hectares).toFixed(2)}</td>
      <td>${formatDate(record.actualCompletionDate, "No date")}</td>
      <td><span class="${approvalClass}">${escapeHtml(record.approvalStatus)}</span></td>
      <td>${record.photoData ? "Attached" : "None"}</td>
      <td>${escapeHtml(gps)}</td>
      <td>
        <div class="row-actions">
          <button type="button" data-action="edit" data-id="${record.id}" title="Edit record" aria-label="Edit record">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/></svg>
          </button>
          ${
            record.approvalStatus === "Approved"
              ? ""
              : `<button type="button" data-action="approve" data-id="${record.id}" title="Approve record" aria-label="Approve record">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>
                </button>`
          }
          <button class="danger" type="button" data-action="delete" data-id="${record.id}" title="Delete record" aria-label="Delete record">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"/><path d="M9 7V5h6v2"/><path d="M9 11v6"/><path d="M15 11v6"/><path d="M8 7l1 13h6l1-13"/></svg>
          </button>
        </div>
      </td>
    `;
    tr.addEventListener("click", (event) => {
      if (event.target.closest("[data-action]")) return;
      selectRecord(record.id, { focusMap: false, scrollRecords: false });
    });
    tr.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectRecord(record.id, { focusMap: false, scrollRecords: false });
    });
    dom.recordsTable.append(tr);

    const card = renderRecordCard(record, gps);
    card.addEventListener("click", (event) => {
      if (event.target.closest("[data-action]")) return;
      selectRecord(record.id, { focusMap: false, scrollRecords: false });
    });
    card.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      selectRecord(record.id, { focusMap: false, scrollRecords: false });
    });
    dom.recordsCardList.append(card);
  });
}

function renderMonthlyTrackingTable() {
  const fields = getTrackingFields();
  const dayCount = getDaysInMonth(selectedMonthlyMonth);
  const recordsByFieldDay = getMonthlyRecordsByFieldDay(selectedMonthlyProgram, selectedMonthlyMonth);
  const dayTotals = Array(dayCount).fill(0);
  let grandTotal = 0;

  dom.monthlyTrackingHead.innerHTML = `
    <tr>
      <th class="monthly-field-head">Field No</th>
      ${Array.from(
        { length: dayCount },
        (_, index) => `
          <th data-monthly-day="${index + 1}">
            <button class="monthly-day-button" type="button" data-monthly-day="${index + 1}" aria-label="Highlight day ${index + 1}">
              ${index + 1}
            </button>
          </th>
        `,
      ).join("")}
      <th class="monthly-total-head">Total</th>
    </tr>
  `;

  if (!fields.length) {
    dom.monthlyTrackingBody.innerHTML = `
      <tr>
        <td colspan="${dayCount + 2}" class="monthly-empty">No field map data available.</td>
      </tr>
    `;
    dom.monthlyTrackingFoot.innerHTML = "";
    return;
  }

  dom.monthlyTrackingBody.innerHTML = fields
    .map((field) => {
      const fieldRecords = recordsByFieldDay.get(fieldKey(field.fieldGis)) || new Map();
      const fieldId = fieldKey(field.fieldGis);
      const fieldLabel = getFieldDisplayName(field);
      let fieldTotal = 0;
      const firstRecordDay = [...fieldRecords.keys()].sort((a, b) => a - b)[0] || "";
      const firstRecord = firstRecordDay ? getPrimaryMonthlyRecord(fieldRecords.get(firstRecordDay) || []) : null;
      const dayCells = Array.from({ length: dayCount }, (_, index) => {
        const day = index + 1;
        const records = fieldRecords.get(day) || [];
        const cellTotal = sumRecordHectares(records);
        fieldTotal += cellTotal;
        dayTotals[index] += cellTotal;
        return renderMonthlyTrackingCell(records, fieldId, day, fieldLabel);
      }).join("");
      grandTotal += fieldTotal;
      return `
        <tr data-monthly-field="${escapeHtml(fieldId)}">
          <th scope="row">
            <button class="monthly-field-button" type="button" data-monthly-field="${escapeHtml(fieldId)}" data-monthly-day="${firstRecordDay}" data-record-id="${escapeHtml(firstRecord?.id || "")}" aria-label="Highlight field ${escapeHtml(fieldLabel)}">
              ${escapeHtml(fieldLabel)}
            </button>
          </th>
          ${dayCells}
          <td class="monthly-total-cell">${fieldTotal ? formatMonthlyHectares(fieldTotal) : ""}</td>
        </tr>
      `;
    })
    .join("");

  dom.monthlyTrackingFoot.innerHTML = `
    <tr>
      <th scope="row">Total</th>
      ${dayTotals
        .map((total, index) => `<td class="monthly-total-cell" data-monthly-day="${index + 1}">${total ? formatMonthlyHectares(total) : ""}</td>`)
        .join("")}
      <td class="monthly-total-cell monthly-grand-total">${grandTotal ? formatMonthlyHectares(grandTotal) : ""}</td>
    </tr>
  `;

  bindMonthlyTrackingSelection();
  const selectedRecord = state.records.find((record) => record.id === selectedRecordId);
  if (selectedRecord) applySelectedRecordHighlights(selectedRecord);
}

function getMonthlyRecordsByFieldDay(programType, monthKey) {
  return state.records
    .filter((record) => record.programType === programType && getMonthKey(record.actualCompletionDate || record.deadline) === monthKey)
    .reduce((lookup, record) => {
      const day = Number((record.actualCompletionDate || record.deadline || "").slice(8, 10));
      const key = fieldKey(record.blockField);
      if (!key || !day) return lookup;
      if (!lookup.has(key)) lookup.set(key, new Map());
      const dayLookup = lookup.get(key);
      dayLookup.set(day, [...(dayLookup.get(day) || []), record]);
      return lookup;
    }, new Map());
}

function sumRecordHectares(records) {
  return sumDecimalValues(records.map((record) => record.hectares));
}

function getPrimaryMonthlyRecord(records) {
  return [...records].sort((a, b) => {
    const statusWeight = (a.approvalStatus === "Approved" ? 1 : 0) - (b.approvalStatus === "Approved" ? 1 : 0);
    if (statusWeight) return statusWeight;
    return new Date(b.updatedAt || b.actualCompletionDate || 0) - new Date(a.updatedAt || a.actualCompletionDate || 0);
  })[0] || null;
}

function getMonthlyStatusClass(records) {
  if (!records.length) return "";
  return records.some((record) => record.approvalStatus !== "Approved") ? "pending" : "approved";
}

function renderMonthlyTrackingCell(records, fieldId, day, fieldLabel) {
  const hectares = sumRecordHectares(records);
  const primaryRecord = getPrimaryMonthlyRecord(records);
  const statusClass = getMonthlyStatusClass(records);
  const details = records
    .map(
      (record) =>
        `${record.approvalStatus} | ${record.programType} | ${record.blockField} | ${formatDate(record.actualCompletionDate, "No date")} | ${formatMonthlyHectares(record.hectares)} ha | ${record.reporterName} | ${record.taskName}`,
    )
    .join("\n");
  const title = details || `${fieldLabel} | Day ${day} | No keyed-in record`;
  return `
    <td class="${records.length ? `monthly-entry-cell ${statusClass}` : ""}" data-monthly-field="${escapeHtml(fieldId)}" data-monthly-day="${day}" data-record-id="${escapeHtml(primaryRecord?.id || "")}">
      <button class="monthly-cell-button" type="button" data-monthly-field="${escapeHtml(fieldId)}" data-monthly-day="${day}" data-record-id="${escapeHtml(primaryRecord?.id || "")}" title="${escapeHtml(title)}" aria-label="Highlight ${escapeHtml(fieldLabel)} day ${day}">
        ${records.length ? `<span class="monthly-entry ${statusClass}">${formatMonthlyHectares(hectares)}</span>` : ""}
      </button>
    </td>
  `;
}

function bindMonthlyTrackingSelection() {
  const table = dom.monthlyTrackingBody.closest(".monthly-tracking-table");
  if (!table) return;

  table.querySelectorAll(".monthly-field-button, .monthly-day-button, .monthly-cell-button").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.recordId) {
        selectRecord(button.dataset.recordId, { syncMonthly: false, focusMap: false, scrollRecords: false, syncApproval: true });
        return;
      }
      selectedRecordId = "";
      applyMonthlyTrackingHighlight(button.dataset.monthlyField || "", button.dataset.monthlyDay || "");
    });
  });
}

function applyMonthlyTrackingHighlight(fieldId, day, recordId = "") {
  const table = dom.monthlyTrackingBody.closest(".monthly-tracking-table");
  if (!table) return;

  table.querySelectorAll("tbody tr").forEach((row) => {
    row.classList.toggle("monthly-row-active", Boolean(fieldId) && row.dataset.monthlyField === fieldId);
  });

  table.querySelectorAll("[data-monthly-day]").forEach((element) => {
    element.classList.toggle("monthly-column-active", Boolean(day) && element.dataset.monthlyDay === day);
  });

  table.querySelectorAll("td[data-monthly-field][data-monthly-day]").forEach((cell) => {
    cell.classList.toggle("monthly-cell-active", Boolean(fieldId && day) && cell.dataset.monthlyField === fieldId && cell.dataset.monthlyDay === day);
    cell.classList.toggle("monthly-record-active", Boolean(recordId) && cell.dataset.recordId === recordId);
  });
}

function selectRecord(recordId, options = {}) {
  const { syncMonthly = true, syncApproval = true, focusMap = true, scrollRecords = false, preserveViewport = true } = options;
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return;
  const previousScrollX = window.scrollX;
  const previousScrollY = window.scrollY;

  selectedRecordId = recordId;
  let shouldRenderRecords = false;
  let shouldRenderMonthly = false;

  if (syncApproval && selectedApprovalStatus !== record.approvalStatus) {
    selectedApprovalStatus = record.approvalStatus;
    shouldRenderRecords = true;
  }

  if (syncMonthly) {
    const recordMonth = getMonthKey(record.actualCompletionDate || record.deadline);
    if (record.programType !== selectedMonthlyProgram) {
      selectedMonthlyProgram = record.programType;
      dom.monthlyProgramFilter.value = selectedMonthlyProgram;
      shouldRenderMonthly = true;
    }
    if (MONTHS_2026.some((month) => month.key === recordMonth) && recordMonth !== selectedMonthlyMonth) {
      selectedMonthlyMonth = recordMonth;
      dom.monthlyMonthFilter.value = selectedMonthlyMonth;
      shouldRenderMonthly = true;
    }
  }

  if (shouldRenderRecords) renderRecordsOutputs();
  if (shouldRenderMonthly) renderMonthlyTrackingTable();

  applySelectedRecordHighlights(record);
  if (focusMap) focusRecordsMapPin(recordId);
  if (scrollRecords) scrollSelectedRecordIntoView(recordId);
  if (preserveViewport && !scrollRecords) {
    window.requestAnimationFrame(() => window.scrollTo(previousScrollX, previousScrollY));
  }
}

function applySelectedRecordHighlights(record) {
  if (!record) return;
  const day = Number((record.actualCompletionDate || record.deadline || "").slice(8, 10)) || "";
  const fieldId = fieldKey(record.blockField);

  document.querySelectorAll("[data-record-id], [data-record-card]").forEach((element) => {
    const id = element.dataset.recordId || element.dataset.recordCard;
    if (!id) return;
    element.classList.toggle("record-selected", id === record.id);
  });

  document.querySelectorAll("tr[data-record-id]").forEach((row) => {
    row.classList.toggle("record-row-active", row.dataset.recordId === record.id);
  });

  document.querySelectorAll(".map-record[data-record-id]").forEach((item) => {
    item.classList.toggle("active", item.dataset.recordId === record.id);
  });

  applyMonthlyTrackingHighlight(fieldId, String(day), record.id);
  refreshRecordsMarkerStyles();
}

function scrollRecordsList() {
  const tableWrap = document.querySelector(".records-table-wrap");
  const tableVisible = tableWrap && getComputedStyle(tableWrap).display !== "none";
  const target = tableVisible ? tableWrap : dom.recordsCardList;
  target.scrollBy({ top: Math.max(220, target.clientHeight * 0.8), behavior: "smooth" });
}

function scrollSelectedRecordIntoView(recordId) {
  const row = Array.from(document.querySelectorAll("tr[data-record-id]")).find((item) => item.dataset.recordId === recordId);
  const card = Array.from(document.querySelectorAll("[data-record-card]")).find((item) => item.dataset.recordCard === recordId);
  const target = row || card;
  if (target) target.scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function renderRecordCard(record, gps) {
  const article = document.createElement("article");
  article.className = selectedRecordId === record.id ? "record-card record-selected" : "record-card";
  article.dataset.recordCard = record.id;
  article.tabIndex = 0;
  article.innerHTML = `
    <div class="record-card-header">
      <div>
        <strong>${escapeHtml(record.programType)}</strong>
        <span>${escapeHtml(record.taskName)}</span>
      </div>
      <span class="${record.approvalStatus === "Approved" ? "pill" : "pill warning"}">${escapeHtml(record.approvalStatus)}</span>
    </div>
    <dl>
      <div><dt>Reporter</dt><dd>${escapeHtml(record.reporterName)}</dd></div>
      <div><dt>Field</dt><dd>${escapeHtml(record.blockField)}</dd></div>
      <div><dt>Hectares</dt><dd>${formatNumber(record.hectares)}</dd></div>
      <div><dt>Completion Date</dt><dd>${formatDate(record.actualCompletionDate, "No date")}</dd></div>
      <div><dt>GPS</dt><dd>${escapeHtml(gps)}</dd></div>
      <div><dt>Evidence</dt><dd>${record.photoData ? "Attached" : "None"}</dd></div>
      <div><dt>Remarks</dt><dd>${escapeHtml(record.remarks || "No remarks")}</dd></div>
    </dl>
    <div class="record-card-actions">
      <button class="secondary-button compact" type="button" data-action="edit" data-id="${record.id}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/></svg>
        Edit
      </button>
      ${
        record.approvalStatus === "Approved"
          ? ""
          : `<button class="primary-button compact" type="button" data-action="approve" data-id="${record.id}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>
              Approve
            </button>`
      }
    </div>
  `;
  return article;
}

function renderMapOutput() {
  const mapOutput = document.querySelector("#mapOutput");
  const fields = getFieldMapItems();
  const points = getMapRecords().map(getRecordMapPoint).filter(Boolean);
  destroyRecordsLeafletMap();

  mapOutput.innerHTML = `
    <div class="records-map-canvas" id="recordsMapCanvas"></div>
    <aside class="records-map-panel">
      <div class="records-map-legend">
        ${state.programTypes
          .map(
            (type) => `
              <span>
                <i style="background:${getProgramColor(type.name)}"></i>
                ${escapeHtml(type.name)}
              </span>
            `,
          )
          .join("")}
      </div>
      <div class="map-records" id="mapRecords"></div>
    </aside>
  `;

  if (window.L && fields.length) {
    renderLeafletRecordsMap(fields, points);
  } else {
    renderStaticRecordsMap(fields, points);
  }

  renderRecordsMapList(points);
}

function renderLeafletRecordsMap(fields, points) {
  const mapCanvas = document.querySelector("#recordsMapCanvas");
  recordsLeafletMap = L.map(mapCanvas, {
    attributionControl: true,
    scrollWheelZoom: false,
    tap: true,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 22,
  }).addTo(recordsLeafletMap);

  recordsFieldLayer = L.geoJSON(buildFieldBoundaryGeoJson(fields), {
    style: () => getLeafletFieldStyle("grey"),
    onEachFeature: (feature, layer) => {
      layer.bindTooltip(feature.properties.fieldNo || feature.properties.fieldGis, {
        className: "field-map-tooltip",
        direction: "center",
        permanent: false,
        sticky: true,
      });
      layer.bindPopup(renderFieldBoundaryPopup(feature.properties));
    },
  }).addTo(recordsLeafletMap);

  recordsMarkerLayer = L.layerGroup().addTo(recordsLeafletMap);
  recordsMarkerLookup = new Map();
  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng], {
      icon: createRecordPinIcon(point.record.programType, selectedRecordId === point.record.id),
      keyboard: true,
      title: `${point.record.blockField} - ${point.record.programType}`,
    })
      .bindTooltip(renderRecordMapTooltip(point.record), {
        direction: "top",
        opacity: 0.95,
        sticky: true,
      })
      .bindPopup(renderRecordMapPopup(point.record))
      .addTo(recordsMarkerLayer);
    marker.on("click", () => selectRecord(point.record.id, { syncMonthly: true, syncApproval: true, focusMap: true, scrollRecords: false }));
    recordsMarkerLookup.set(point.record.id, marker);
  });

  fitRecordsLeafletMap();
  window.setTimeout(fitRecordsLeafletMap, 0);
  refreshRecordsMarkerStyles();
}

function renderStaticRecordsMap(fields, points) {
  const mapCanvas = document.querySelector("#recordsMapCanvas");
  if (!fields.length) {
    mapCanvas.innerHTML = `
      <div class="map-detail-empty">
        <h3>No field map</h3>
        <p>Field map data will appear here once a KMZ or GeoJSON layer is available.</p>
      </div>
    `;
    return;
  }

  mapCanvas.innerHTML = `
    <svg class="kml-map-svg" viewBox="0 0 1000 1000" role="img" aria-label="Records field map">
      ${fields
        .map(
          (field) => `
            <g>
              ${field.polygons.map((polygon) => `<path class="field-polygon grey" d="${polygonToPath(polygon)}"></path>`).join("")}
              <text class="field-map-label" x="${getFieldLabelPoint(field).x}" y="${getFieldLabelPoint(field).y}">${escapeHtml(getFieldDisplayName(field))}</text>
            </g>
          `,
        )
        .join("")}
      ${points
        .map((point) => {
          const projected = projectCoordinate([point.lng, point.lat]);
          return `
            <g class="static-map-pin" transform="translate(${(projected.x - 12).toFixed(2)} ${(projected.y - 24).toFixed(2)})">
              <path style="fill:${getProgramColor(point.record.programType)}" d="M12 22s7-6.1 7-12A7 7 0 0 0 5 10c0 5.9 7 12 7 12Z"><title>${escapeHtml(renderRecordMapTooltip(point.record))}</title></path>
              <circle cx="12" cy="10" r="3.2"></circle>
            </g>
          `;
        })
        .join("")}
    </svg>
  `;
}

function renderRecordsMapList(points) {
  const mapRecords = document.querySelector("#mapRecords");
  if (!points.length) {
    mapRecords.innerHTML = `
      <div class="map-record-empty">
        <strong>No GPS records</strong>
        <span>Capture latitude and longitude to show programme pins.</span>
      </div>
    `;
    return;
  }

  mapRecords.innerHTML = points
    .map(
      ({ record }) => `
        <article class="map-record ${selectedRecordId === record.id ? "active" : ""}" data-record-id="${escapeHtml(record.id)}">
          <button class="map-record-main" type="button" data-record-id="${escapeHtml(record.id)}" aria-label="View ${escapeHtml(record.blockField)} ${escapeHtml(record.programType)} on map">
            <strong><i style="background:${getProgramColor(record.programType)}"></i>${escapeHtml(record.blockField)} - ${escapeHtml(record.programType)}</strong>
            <span>${formatDate(record.actualCompletionDate, "No date")} | ${formatNumber(record.hectares)} ha | ${escapeHtml(record.reporterName)}</span>
            <span>${Number(record.latitude).toFixed(5)}, ${Number(record.longitude).toFixed(5)}${record.gpsAccuracy ? ` | +/- ${Number(record.gpsAccuracy).toFixed(1)}m` : ""}</span>
          </button>
          <div class="map-record-actions">
            <button class="secondary-button compact" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/></svg>
              Edit
            </button>
            ${
              record.approvalStatus === "Approved"
                ? ""
                : `<button class="primary-button compact" type="button" data-action="approve" data-id="${escapeHtml(record.id)}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>
                    Approve
                  </button>`
            }
          </div>
        </article>
      `,
    )
    .join("");

  mapRecords.querySelectorAll(".map-record-main[data-record-id]").forEach((button) => {
    button.addEventListener("click", () => selectRecord(button.dataset.recordId, { focusMap: true, scrollRecords: false }));
  });
}

function destroyRecordsLeafletMap() {
  recordsMarkerLookup = new Map();
  if (!recordsLeafletMap) {
    recordsFieldLayer = null;
    recordsMarkerLayer = null;
    return;
  }
  recordsLeafletMap.remove();
  recordsLeafletMap = null;
  recordsFieldLayer = null;
  recordsMarkerLayer = null;
}

function focusRecordsMapPin(recordId) {
  if (!recordsLeafletMap || !recordId) return;
  const marker = recordsMarkerLookup.get(recordId);
  if (!marker) return;

  const latLng = marker.getLatLng();
  const targetZoom = Math.max(recordsLeafletMap.getZoom(), 18);
  recordsLeafletMap.setView(latLng, targetZoom, { animate: true });
  marker.openTooltip();
  marker.openPopup();

  refreshRecordsMarkerStyles();
  document.querySelectorAll(".map-record[data-record-id]").forEach((item) => item.classList.toggle("active", item.dataset.recordId === recordId));
}

function refreshRecordsMarkerStyles() {
  recordsMarkerLookup.forEach((marker, recordId) => {
    const isSelected = recordId === selectedRecordId;
    const record = state.records.find((item) => item.id === recordId);
    if (record) marker.setIcon(createRecordPinIcon(record.programType, isSelected));
    marker.setZIndexOffset(isSelected ? 1000 : 0);
  });
}

function createRecordPinIcon(programType, selected = false) {
  const size = selected ? [34, 42] : [28, 36];
  const anchor = selected ? [17, 41] : [14, 35];
  return L.divIcon({
    className: `record-pin-icon ${selected ? "selected" : ""}`,
    html: `
      <svg class="record-pin" viewBox="0 0 24 24" style="--pin-color:${getProgramColor(programType)}" aria-hidden="true">
        <path class="record-pin-fill" d="M12 22s7-6.1 7-12A7 7 0 0 0 5 10c0 5.9 7 12 7 12Z"></path>
        <circle class="record-pin-dot" cx="12" cy="10" r="3.2"></circle>
      </svg>
    `,
    iconSize: size,
    iconAnchor: anchor,
    popupAnchor: [0, -anchor[1] + 4],
    tooltipAnchor: [0, -anchor[1] + 4],
  });
}

function fitRecordsLeafletMap() {
  if (!recordsLeafletMap || !recordsFieldLayer) return;
  recordsLeafletMap.invalidateSize();
  const bounds = recordsFieldLayer.getBounds();
  if (bounds.isValid()) {
    recordsLeafletMap.fitBounds(bounds, { maxZoom: 16, padding: [22, 22] });
  }
}

function buildFieldBoundaryGeoJson(fields) {
  return {
    type: "FeatureCollection",
    features: fields.map((field) => ({
      type: "Feature",
      properties: {
        fieldGis: field.fieldGis,
        fieldNo: getFieldDisplayName(field),
        estate: field.estate || "Digital Estate",
        division: field.division || "-",
        ha: field.ha,
      },
      geometry: getFieldGeometry(field),
    })),
  };
}

function getRecordMapPoint(record) {
  const lat = Number(record.latitude);
  const lng = Number(record.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { record, lat, lng };
}

function renderRecordMapTooltip(record) {
  return `${record.programType} | ${record.blockField} | ${formatDate(record.actualCompletionDate, "No date")} | ${formatNumber(record.hectares)} ha`;
}

function renderRecordMapPopup(record) {
  return `
    <div class="field-popup">
      <strong>${escapeHtml(record.blockField)} - ${escapeHtml(record.programType)}</strong>
      <span>${escapeHtml(record.taskName)}</span>
      <dl>
        <div><dt>Date</dt><dd>${formatDate(record.actualCompletionDate, "No date")}</dd></div>
        <div><dt>Hectares</dt><dd>${formatNumber(record.hectares)}</dd></div>
        <div><dt>Reporter</dt><dd>${escapeHtml(record.reporterName)}</dd></div>
        <div><dt>Status</dt><dd>${escapeHtml(record.approvalStatus)}</dd></div>
      </dl>
      <p>${escapeHtml(record.remarks || "No remarks")}</p>
      <div class="popup-actions">
        <button class="secondary-button compact" type="button" data-action="edit" data-id="${escapeHtml(record.id)}">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z"/><path d="m14 7 3 3"/></svg>
          Edit
        </button>
        ${
          record.approvalStatus === "Approved"
            ? ""
            : `<button class="primary-button compact" type="button" data-action="approve" data-id="${escapeHtml(record.id)}">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>
                Approve
              </button>`
        }
      </div>
    </div>
  `;
}

function renderFieldBoundaryPopup(properties) {
  return `
    <div class="field-popup">
      <strong>${escapeHtml(properties.fieldNo || properties.fieldGis)}</strong>
      <span>${escapeHtml(properties.estate)} | ${escapeHtml(properties.division)}</span>
      <dl>
        <div><dt>Source</dt><dd>KMZ field boundary</dd></div>
        <div><dt>Hectares</dt><dd>${formatNumber(properties.ha)}</dd></div>
      </dl>
    </div>
  `;
}

function renderConfiguration() {
  dom.typeList.innerHTML = "";
  state.programTypes.forEach((type) => {
    const item = document.createElement("article");
    item.className = "config-item";
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(type.name)}</strong>
        <span>${escapeHtml(type.group || "Ungrouped")} | ${escapeHtml(type.criteria)}</span>
      </div>
      <span class="pill">Fixed</span>
    `;
    dom.typeList.append(item);
  });
}

async function saveRecord(event) {
  event.preventDefault();
  clearFieldErrors();
  const programType = dom.programType.value;

  let data = {
    id: dom.recordId.value || createId(),
    reporterName: dom.reporterName.value.trim(),
    programType,
    blockField: dom.blockField.value.trim(),
    taskName: getDefaultTaskName(programType),
    schedulerStage: "Completed",
    hectares: Number(dom.hectares.value),
    actualCompletionDate: dom.actualCompletionDate.value,
    deadline: dom.actualCompletionDate.value,
    priority: "Must",
    remarks: dom.remarks.value.trim(),
    latitude: dom.latitude.value,
    longitude: dom.longitude.value,
    gpsAccuracy: dom.gpsAccuracy.value,
    photoData: currentPhotoData,
    approvalStatus: state.records.find((record) => record.id === dom.recordId.value)?.approvalStatus || "Pending Approval",
    syncStatus: offlineSaveMode || !navigator.onLine ? "Pending Sync" : "Synced",
    updatedAt: new Date().toISOString(),
  };

  const errors = validateRecord(data);
  if (errors.length) {
    errors.forEach(({ field, message }) => setFieldError(field, message));
    showToast("Please complete the required fields before saving.");
    return;
  }

  let savedToSupabase = false;
  if (window.digitalEstateApi?.upsertWorkProgramRecord) {
    try {
      const remoteRecord = await window.digitalEstateApi.upsertWorkProgramRecord(data);
      if (remoteRecord) data = normalizeRecord(remoteRecord);
      savedToSupabase = true;
    } catch (error) {
      data.syncStatus = "Pending Sync";
      console.warn("Work Program Supabase save unavailable:", error.message);
    }
  } else {
    data.syncStatus = "Pending Sync";
  }

  const existingIndex = state.records.findIndex((record) => record.id === data.id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = data;
  } else {
    state.records.unshift(data);
  }

  persist();
  selectedApprovalStatus = data.approvalStatus;
  selectedRecordId = data.id;
  renderAll();
  selectRecord(data.id, { syncMonthly: true, syncApproval: false, focusMap: false, scrollRecords: false, preserveViewport: false });
  resetForm();
  setView("records");
  showToast(savedToSupabase ? "Record submitted for approval." : "Record saved locally. Supabase sync unavailable.");
}

function validateRecord(data) {
  const errors = [];
  if (!data.reporterName) errors.push({ field: dom.reporterName, message: "Enter reporter name." });
  if (!data.programType) errors.push({ field: dom.programType, message: "Select a Work Program type." });
  if (data.programType && !ALLOWED_PROGRAM_NAMES.has(data.programType)) errors.push({ field: dom.programType, message: "Select an approved Work Program type." });
  if (!data.blockField) errors.push({ field: dom.blockField, message: "Enter the block or field." });
  if (data.blockField && !isListedFieldName(data.blockField)) errors.push({ field: dom.blockField, message: "Select a field from the list." });
  if (!data.hectares || data.hectares <= 0) errors.push({ field: dom.hectares, message: "Enter hectares above zero." });
  if (!data.actualCompletionDate) errors.push({ field: dom.actualCompletionDate, message: "Select actual completion date." });
  return errors;
}

function getDefaultTaskName(programType) {
  return programType ? `${programType} completion` : "Completion";
}

function setFieldError(field, message) {
  const error = field.parentElement.querySelector(".field-error");
  if (error) error.textContent = message;
  field.setAttribute("aria-invalid", "true");
}

function clearFieldErrors() {
  document.querySelectorAll(".field-error").forEach((error) => {
    error.textContent = "";
  });
  document.querySelectorAll("[aria-invalid]").forEach((field) => {
    field.removeAttribute("aria-invalid");
  });
}

function handleRecordActionClick(event) {
  const button = event.target.closest("[data-action][data-id]");
  if (!button) return;

  event.preventDefault();
  event.stopPropagation();
  const { action, id } = button.dataset;
  selectRecord(id, { focusMap: false, scrollRecords: false });
  if (action === "edit") editRecord(id);
  if (action === "approve") approveRecord(id);
  if (action === "delete") deleteRecord(id);
}

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  selectedRecordId = id;

  dom.formHeading.textContent = "Edit Work Program";
  dom.recordId.value = record.id;
  dom.reporterName.value = record.reporterName;
  dom.programType.value = record.programType;
  dom.blockField.value = record.blockField;
  dom.taskName.value = record.taskName;
  if (dom.schedulerStage) dom.schedulerStage.value = record.schedulerStage;
  dom.hectares.value = record.hectares;
  dom.actualCompletionDate.value = record.actualCompletionDate || record.deadline || todayDate();
  if (dom.deadline) dom.deadline.value = record.deadline;
  if (dom.priority) dom.priority.value = record.priority;
  dom.remarks.value = record.remarks;
  dom.latitude.value = record.latitude;
  dom.longitude.value = record.longitude;
  dom.gpsAccuracy.value = record.gpsAccuracy || "";
  offlineSaveMode = record.syncStatus === "Pending Sync";
  currentPhotoData = record.photoData || "";
  renderOfflineButton();
  renderPhotoPreview();
  setView("capture");
}

async function deleteRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  const confirmed = confirm(`Delete ${record.programType} record for ${record.blockField}?`);
  if (!confirmed) return;

  let deletedFromSupabase = false;
  if (window.digitalEstateApi?.deleteWorkProgramRecord) {
    try {
      await window.digitalEstateApi.deleteWorkProgramRecord(id);
      deletedFromSupabase = true;
    } catch (error) {
      console.warn("Work Program Supabase delete unavailable:", error.message);
    }
  }

  state.records = state.records.filter((item) => item.id !== id);
  if (selectedRecordId === id) selectedRecordId = "";
  persist();
  renderAll();
  showToast(deletedFromSupabase ? "Record deleted from Supabase." : "Record deleted locally. Supabase sync unavailable.");
}

async function approveRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  record.approvalStatus = "Approved";
  record.updatedAt = new Date().toISOString();

  let savedToSupabase = false;
  if (window.digitalEstateApi?.upsertWorkProgramRecord) {
    try {
      const remoteRecord = await window.digitalEstateApi.upsertWorkProgramRecord(record);
      if (remoteRecord) {
        const existingIndex = state.records.findIndex((item) => item.id === id);
        if (existingIndex >= 0) state.records[existingIndex] = normalizeRecord(remoteRecord);
      }
      savedToSupabase = true;
    } catch (error) {
      record.syncStatus = "Pending Sync";
      console.warn("Work Program Supabase approval unavailable:", error.message);
    }
  } else {
    record.syncStatus = "Pending Sync";
  }

  selectedApprovalStatus = "Approved";
  selectedRecordId = id;
  persist();
  renderAll();
  selectRecord(id, { syncMonthly: true, syncApproval: false, focusMap: false, scrollRecords: false });
  showToast(savedToSupabase ? "Record approved and included in the dashboard." : "Record approved locally. Supabase sync unavailable.");
}

function resetForm() {
  dom.formHeading.textContent = "Program Tracker";
  dom.recordForm.reset();
  dom.recordId.value = "";
  dom.actualCompletionDate.value = todayDate();
  currentPhotoData = "";
  offlineSaveMode = false;
  clearFieldErrors();
  renderOfflineButton();
  renderPhotoPreview();
}

function captureGps() {
  if (!navigator.geolocation) {
    showToast("GPS is not available in this browser. Enter coordinates manually.");
    return;
  }

  dom.gpsButton.disabled = true;
  dom.gpsButton.textContent = "Capturing GPS";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      dom.latitude.value = position.coords.latitude.toFixed(6);
      dom.longitude.value = position.coords.longitude.toFixed(6);
      dom.gpsAccuracy.value = position.coords.accuracy ? position.coords.accuracy.toFixed(1) : "";
      dom.gpsButton.disabled = false;
      dom.gpsButton.innerHTML = gpsButtonContent();
      showToast("GPS coordinates captured.");
    },
    () => {
      dom.gpsButton.disabled = false;
      dom.gpsButton.innerHTML = gpsButtonContent();
      showToast("GPS permission was not granted. Enter coordinates manually.");
    },
    { enableHighAccuracy: true, timeout: 10000 },
  );
}

function gpsButtonContent() {
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" />
      <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
    </svg>
    Capture GPS
  `;
}

function toggleOfflineSaveMode() {
  offlineSaveMode = !offlineSaveMode;
  renderOfflineButton();
}

function renderOfflineButton() {
  dom.offlineModeButton.classList.toggle("active", offlineSaveMode);
  dom.offlineModeButton.setAttribute("aria-pressed", String(offlineSaveMode));
}

function handlePhotoUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("Please attach an image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    currentPhotoData = reader.result;
    renderPhotoPreview();
  };
  reader.readAsDataURL(file);
}

function renderPhotoPreview() {
  dom.photoPreviewWrap.classList.toggle("hidden", !currentPhotoData);
  if (currentPhotoData) dom.photoPreview.src = currentPhotoData;
  if (!currentPhotoData) dom.photoPreview.removeAttribute("src");
}

function removePhoto() {
  currentPhotoData = "";
  dom.photoInput.value = "";
  renderPhotoPreview();
}

function syncPendingRecords() {
  if (!navigator.onLine) {
    showToast("You are offline. Sync can run when the connection is restored.");
    return;
  }

  const pending = state.records.filter((record) => record.syncStatus === "Pending Sync");
  if (!pending.length) {
    showToast("No offline records pending sync.");
    return;
  }

  state.records = state.records.map((record) =>
    record.syncStatus === "Pending Sync"
      ? {
          ...record,
          syncStatus: "Synced",
          updatedAt: new Date().toISOString(),
        }
      : record,
  );
  persist();
  renderAll();
  showToast(`${pending.length} record${pending.length === 1 ? "" : "s"} synced.`);
}

function buildDefaultPlannedProgrammes() {
  return getDashboardRowsByType("", "Programme").map((row) => ({ ...row, months: { ...row.months } }));
}

