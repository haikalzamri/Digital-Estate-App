const STORAGE_KEY = "sdg-work-program-tracker-v1";
const DASHBOARD_YEAR = 2026;
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
const SPRAYING_PROGRAM = "Spraying";

const DEFAULT_PROGRAM_TYPES = [
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
    id: "programme-spraying",
    name: SPRAYING_PROGRAM,
    group: "Estate Operations",
    criteria: "Actual completion is captured by field and compared against quarterly planned programme",
  },
  {
    id: "programme-harvesting",
    name: "Harvesting",
    group: "Estate Operations",
    criteria: "Harvesting completion captured by field, hectares, evidence, and remarks",
  },
];
const ALLOWED_PROGRAM_NAMES = new Set(DEFAULT_PROGRAM_TYPES.map((type) => type.name));

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultState = {
  programTypes: getDefaultProgramTypes(),
  plannedProgrammes: buildDefaultPlannedProgrammes(),
  records: [
    {
      id: createId(),
      reporterName: "Rahman Mandore",
      programType: SPRAYING_PROGRAM,
      blockField: "P02D1",
      taskName: "Spraying completion",
      schedulerStage: "Completed",
      hectares: 38.17,
      actualCompletionDate: "2026-06-12",
      deadline: futureDate(4),
      priority: "Must",
      approvalStatus: "Approved",
      remarks: "Actual completion captured for dashboard comparison.",
      latitude: 2.9273,
      longitude: 101.6559,
      gpsAccuracy: 18.2,
      photoData: "",
      syncStatus: "Synced",
      updatedAt: new Date().toISOString(),
    },
    {
      id: createId(),
      reporterName: "Siti Field Officer",
      programType: SPRAYING_PROGRAM,
      blockField: "P05C1",
      taskName: "Spraying partial completion",
      schedulerStage: "Completed",
      hectares: 12,
      actualCompletionDate: "2026-01-18",
      deadline: futureDate(9),
      priority: "Should",
      approvalStatus: "Pending Approval",
      remarks: "Partial completion recorded against January programme.",
      latitude: "",
      longitude: "",
      gpsAccuracy: "",
      photoData: "",
      syncStatus: "Pending Sync",
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ],
};

let state = loadState();
let currentView = "dashboard";
let selectedDashboardProgram = state.programTypes.find((type) => type.name === SPRAYING_PROGRAM)?.name || state.programTypes[0]?.name || "";
let selectedDrilldownMonth = "";
let selectedDashboardMode = "map";
let selectedMapField = "";
let dashboardLeafletMap = null;
let dashboardFieldLayer = null;
let offlineSaveMode = false;
let currentPhotoData = "";

const dom = {
  viewTitle: document.querySelector("#viewTitle"),
  navButtons: document.querySelectorAll(".nav-button"),
  views: document.querySelectorAll(".view"),
  searchInput: document.querySelector("#searchInput"),
  newRecordButton: document.querySelector("#newRecordButton"),
  syncButton: document.querySelector("#syncButton"),
  connectionDot: document.querySelector("#connectionDot"),
  connectionText: document.querySelector("#connectionText"),
  dashboardProgramTabs: document.querySelector("#dashboardProgramTabs"),
  programmeDashboardTitle: document.querySelector("#programmeDashboardTitle"),
  dashboardMapButton: document.querySelector("#dashboardMapButton"),
  dashboardTableButton: document.querySelector("#dashboardTableButton"),
  dashboardMapView: document.querySelector("#dashboardMapView"),
  dashboardTableView: document.querySelector("#dashboardTableView"),
  dashboardMapSummary: document.querySelector("#dashboardMapSummary"),
  dashboardMap: document.querySelector("#dashboardMap"),
  dashboardMapDetail: document.querySelector("#dashboardMapDetail"),
  programmeSummary: document.querySelector("#programmeSummary"),
  programmeDashboardHead: document.querySelector("#programmeDashboardHead"),
  programmeDashboardBody: document.querySelector("#programmeDashboardBody"),
  dailyTrackingPanel: document.querySelector("#dailyTrackingPanel"),
  recordsTable: document.querySelector("#recordsTable"),
  recordsCardList: document.querySelector("#recordsCardList"),
  recordsEmpty: document.querySelector("#recordsEmpty"),
  typeFilter: document.querySelector("#typeFilter"),
  stageFilter: document.querySelector("#stageFilter"),
  recordForm: document.querySelector("#recordForm"),
  formHeading: document.querySelector("#formHeading"),
  recordId: document.querySelector("#recordId"),
  reporterName: document.querySelector("#reporterName"),
  programType: document.querySelector("#programType"),
  blockField: document.querySelector("#blockField"),
  taskName: document.querySelector("#taskName"),
  hectares: document.querySelector("#hectares"),
  actualCompletionDate: document.querySelector("#actualCompletionDate"),
  deadline: document.querySelector("#deadline"),
  priority: document.querySelector("#priority"),
  remarks: document.querySelector("#remarks"),
  latitude: document.querySelector("#latitude"),
  longitude: document.querySelector("#longitude"),
  gpsAccuracy: document.querySelector("#gpsAccuracy"),
  photoInput: document.querySelector("#photoInput"),
  photoPreviewWrap: document.querySelector("#photoPreviewWrap"),
  photoPreview: document.querySelector("#photoPreview"),
  removePhotoButton: document.querySelector("#removePhotoButton"),
  gpsButton: document.querySelector("#gpsButton"),
  offlineModeButton: document.querySelector("#offlineModeButton"),
  resetFormButton: document.querySelector("#resetFormButton"),
  typeList: document.querySelector("#typeList"),
  toast: document.querySelector("#toast"),
};

initialize();

function initialize() {
  bindEvents();
  refreshConnectionStatus();
  renderAll();
}

function bindEvents() {
  dom.navButtons.forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });

  dom.searchInput.addEventListener("input", renderRecords);
  dom.typeFilter.addEventListener("change", renderRecords);
  dom.stageFilter.addEventListener("change", renderRecords);
  dom.dashboardMapButton.addEventListener("click", () => setDashboardMode("map"));
  dom.dashboardTableButton.addEventListener("click", () => setDashboardMode("table"));

  dom.newRecordButton.addEventListener("click", () => {
    resetForm();
    setView("capture");
  });

  dom.syncButton.addEventListener("click", syncPendingRecords);
  window.addEventListener("online", refreshConnectionStatus);
  window.addEventListener("offline", refreshConnectionStatus);

  dom.recordForm.addEventListener("submit", saveRecord);
  dom.resetFormButton.addEventListener("click", resetForm);
  dom.gpsButton.addEventListener("click", captureGps);
  dom.offlineModeButton.addEventListener("click", toggleOfflineSaveMode);
  dom.photoInput.addEventListener("change", handlePhotoUpload);
  dom.removePhotoButton.addEventListener("click", removePhoto);

}

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return defaultState;

  try {
    const parsed = JSON.parse(saved);
    return {
      ...defaultState,
      ...parsed,
      programTypes: getDefaultProgramTypes(),
      plannedProgrammes: normalizePlannedProgrammes(parsed.plannedProgrammes?.length ? parsed.plannedProgrammes : defaultState.plannedProgrammes),
      records: (Array.isArray(parsed.records) ? parsed.records : defaultState.records).map(normalizeRecord),
    };
  } catch {
    return defaultState;
  }
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
  return normalized;
}

function normalizePlannedProgrammes(plannedProgrammes) {
  const normalizedProgrammes = plannedProgrammes
    .map((row) => ({ ...row, programType: normalizeProgramTypeName(row.programType) }))
    .filter((row) => ALLOWED_PROGRAM_NAMES.has(row.programType));
  const otherPlans = normalizedProgrammes.filter((row) => row.programType !== SPRAYING_PROGRAM);
  const sprayingPlans = normalizedProgrammes.filter((row) => row.programType === SPRAYING_PROGRAM);
  const mapFields = getFieldMapItems();

  if (mapFields.length) {
    const plannedFields = new Set(sprayingPlans.map((row) => fieldKey(row.field)));
    const hasFullMapCoverage = mapFields.every((field) => plannedFields.has(fieldKey(field.fieldGis)));
    if (!hasFullMapCoverage) {
      return [...buildProgrammeRows(SPRAYING_PROGRAM, getSprayingPlanRows()), ...otherPlans];
    }
  }

  const hasKmlSprayingPlan = sprayingPlans.some((row) => fieldKey(row.field) === fieldKey("P02D1"));
  if (hasKmlSprayingPlan || otherPlans.length) return [...sprayingPlans, ...otherPlans];

  return buildDefaultPlannedProgrammes();
}

function normalizeProgramTypeName(programType) {
  const value = String(programType || "").trim();
  const directMatch = DEFAULT_PROGRAM_TYPES.find((type) => type.name.toLowerCase() === value.toLowerCase());
  if (directMatch) return directMatch.name;
  if (value.toLowerCase() === "circle spraying") return SPRAYING_PROGRAM;
  return DEFAULT_PROGRAM_TYPES[0].name;
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderSelects();
  renderDashboard();
  renderRecords();
  renderMapOutput();
  renderConfiguration();
}

function setView(viewName) {
  currentView = viewName;
  const titleMap = {
    dashboard: "Dashboard",
    records: "Records",
    capture: "Capture",
    settings: "Configuration",
  };

  dom.viewTitle.textContent = titleMap[viewName];
  dom.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  dom.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
}

function renderSelects() {
  if (!state.programTypes.some((type) => type.name === selectedDashboardProgram)) {
    selectedDashboardProgram = state.programTypes[0]?.name || "";
  }
  fillSelect(dom.programType, "Select program type", state.programTypes.map((item) => item.name));
  fillSelect(dom.typeFilter, "All program types", state.programTypes.map((item) => item.name));
  fillSelect(dom.stageFilter, "All approval status", APPROVAL_STATUSES);
}

function fillSelect(element, placeholder, values) {
  const currentValue = element.value;
  element.innerHTML = "";
  element.append(new Option(placeholder, ""));
  values.forEach((value) => element.append(new Option(value, value)));
  if (values.includes(currentValue)) element.value = currentValue;
}

function renderDashboard() {
  renderDashboardTabs();
  renderDashboardMode();
  renderDashboardMap();
  renderProgrammeSummary();
  renderProgrammeTable();
  renderDailyTrackingPanel();
}

function setDashboardMode(mode) {
  selectedDashboardMode = mode;
  renderDashboardMode();
  if (mode === "map" && dashboardLeafletMap) {
    window.setTimeout(fitLeafletDashboardMap, 0);
  }
}

function renderDashboardMode() {
  const isMap = selectedDashboardMode === "map";
  dom.dashboardMapButton.classList.toggle("active", isMap);
  dom.dashboardTableButton.classList.toggle("active", !isMap);
  dom.dashboardMapView.classList.toggle("active", isMap);
  dom.dashboardTableView.classList.toggle("active", !isMap);
}

function renderDashboardTabs() {
  dom.dashboardProgramTabs.innerHTML = "";
  state.programTypes.forEach((type) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = selectedDashboardProgram === type.name ? "dashboard-tab active" : "dashboard-tab";
    button.textContent = type.name;
    button.addEventListener("click", () => {
      selectedDashboardProgram = type.name;
      selectedDrilldownMonth = "";
      selectedMapField = "";
      renderDashboard();
    });
    dom.dashboardProgramTabs.append(button);
  });
}

function renderProgrammeSummary() {
  const rows = getDashboardRows(selectedDashboardProgram);
  const actualLookup = getActualLookup(selectedDashboardProgram);
  const plannedTotal = sumPlannedRows(rows);
  const completedTotal = sumActualRows(rows, actualLookup);
  const variance = completedTotal - plannedTotal;
  const completion = plannedTotal ? (completedTotal / plannedTotal) * 100 : 0;

  dom.programmeDashboardTitle.textContent = `${selectedDashboardProgram.toUpperCase()} PROGRAMME FY ${DASHBOARD_YEAR}`;
  dom.programmeSummary.innerHTML = `
    <article>
      <span>Programme</span>
      <strong>${formatNumber(plannedTotal)}</strong>
      <small>Planned hectares from dummy quarterly schedule</small>
    </article>
    <article>
      <span>Completed</span>
      <strong>${formatNumber(completedTotal)}</strong>
      <small>Approved actual hectares by completion date</small>
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
  const actualLookup = getActualLookup(selectedDashboardProgram);

  dom.programmeDashboardHead.innerHTML = `
    <tr>
      <th rowspan="2">Field</th>
      <th rowspan="2">Hect</th>
      <th rowspan="2">Type</th>
      <th rowspan="2">SPH</th>
      <th rowspan="2">No of Palms</th>
      <th rowspan="2">Machine</th>
      <th rowspan="2">Last Done</th>
      <th rowspan="2">Percent Completion Per Programme</th>
      <th colspan="${MONTHS_2026.length}">${DASHBOARD_YEAR}</th>
    </tr>
    <tr>
      ${MONTHS_2026.map((month) => renderMonthHeader(month)).join("")}
    </tr>
  `;

  if (!rows.length) {
    dom.programmeDashboardBody.innerHTML = `
      <tr>
        <td colspan="${8 + MONTHS_2026.length}" class="programme-empty">No planned programme rows available.</td>
      </tr>
    `;
    bindMonthDrilldowns();
    return;
  }

  dom.programmeDashboardBody.innerHTML = rows
    .map((row) => {
      const plannedTotal = sumRowPlanned(row);
      const completedTotal = sumRowActual(row, actualLookup);
      const completion = plannedTotal ? (completedTotal / plannedTotal) * 100 : 0;
      return `
        <tr>
          <td rowspan="2" class="field-cell">${escapeHtml(row.field)}</td>
          <td rowspan="2">${formatNumber(row.hect)}</td>
          <td class="programme-label">Programme</td>
          <td rowspan="2">${escapeHtml(row.sph)}</td>
          <td rowspan="2">${escapeHtml(row.palms)}</td>
          <td rowspan="2">${escapeHtml(row.machine)}</td>
          <td rowspan="2">${escapeHtml(row.lastDone)}</td>
          <td rowspan="2" class="${completion >= 100 ? "complete-cell" : "pending-cell"}">
            ${plannedTotal ? formatPercent(completion) : "No Plan"}
          </td>
          ${MONTHS_2026.map((month) => renderProgrammeMonthCell(row, month)).join("")}
        </tr>
        <tr>
          <td class="completed-label">Completed</td>
          ${MONTHS_2026.map((month) => renderCompletedMonthCell(row, month, actualLookup)).join("")}
        </tr>
      `;
    })
    .join("");
  bindMonthDrilldowns();
}

function renderMonthHeader(month) {
  const isOpen = selectedDrilldownMonth === month.key;
  return `
    <th class="month-head">
      <button class="month-drilldown-button ${isOpen ? "active" : ""}" type="button" data-month="${month.key}" aria-expanded="${isOpen}">
        <span>${month.label}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </th>
  `;
}

function bindMonthDrilldowns() {
  dom.programmeDashboardHead.querySelectorAll(".month-drilldown-button").forEach((button) => {
    button.addEventListener("click", () => {
      selectedDrilldownMonth = selectedDrilldownMonth === button.dataset.month ? "" : button.dataset.month;
      renderDashboard();
    });
  });
}

function renderProgrammeMonthCell(row, month) {
  const value = row.months[month.key] || 0;
  return `<td class="planned-month">${value ? formatNumber(value) : ""}</td>`;
}

function renderCompletedMonthCell(row, month, actualLookup) {
  const value = actualLookup[`${fieldKey(row.field)}|${month.key}`] || 0;
  return `<td class="${value ? "completed-month" : "blank-completed-month"}">${value ? formatNumber(value) : ""}</td>`;
}

function renderDailyTrackingPanel() {
  if (!selectedDrilldownMonth) {
    dom.dailyTrackingPanel.classList.add("hidden");
    dom.dailyTrackingPanel.innerHTML = "";
    return;
  }

  const month = MONTHS_2026.find((item) => item.key === selectedDrilldownMonth);
  const rows = getDashboardRows(selectedDashboardProgram);
  const records = getActualRecordsForMonth(selectedDashboardProgram, selectedDrilldownMonth);
  const plannedTotal = rows.reduce((total, row) => total + (Number(row.months[selectedDrilldownMonth]) || 0), 0);
  const completedTotal = records.reduce((total, record) => total + (Number(record.hectares) || 0), 0);
  const completion = plannedTotal ? (completedTotal / plannedTotal) * 100 : 0;

  dom.dailyTrackingPanel.classList.remove("hidden");
  dom.dailyTrackingPanel.innerHTML = `
    <div class="daily-tracking-header">
      <div>
        <p class="eyebrow">Daily Tracking</p>
        <h3>${escapeHtml(selectedDashboardProgram)} - ${escapeHtml(month?.label || "")} ${DASHBOARD_YEAR}</h3>
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
        <span>Monthly Programme</span>
        <strong>${formatNumber(plannedTotal)}</strong>
      </article>
      <article>
      <span>Approved Actual Captured</span>
      <strong>${formatNumber(completedTotal)}</strong>
      </article>
      <article>
        <span>Month Completion</span>
        <strong>${formatPercent(completion)}</strong>
      </article>
      <article>
        <span>Actual Entries</span>
        <strong>${records.length}</strong>
      </article>
    </div>

    ${
      records.length
        ? renderDailyRecordsTable(records)
        : `
          <div class="daily-empty">
            <h4>No completion captured for this month</h4>
        <p>Approved actual work will appear here once records dated within ${escapeHtml(month?.label || "")} ${DASHBOARD_YEAR} are approved.</p>
          </div>
        `
    }
  `;

  document.querySelector("#closeDailyTrackingButton")?.addEventListener("click", () => {
    selectedDrilldownMonth = "";
    renderDashboard();
  });
}

function renderDailyRecordsTable(records) {
  return `
    <div class="daily-table-wrap">
      <table class="daily-table">
        <thead>
          <tr>
            <th>Date Done</th>
            <th>Field</th>
            <th>Completed Hectares</th>
            <th>Remarks</th>
            <th>Evidence</th>
            <th>GPS</th>
          </tr>
        </thead>
        <tbody>
          ${records
            .map(
              (record) => `
                <tr>
                  <td>${formatDate(record.actualCompletionDate, "No date")}</td>
                  <td><strong>${escapeHtml(record.blockField)}</strong></td>
                  <td>${formatNumber(record.hectares)}</td>
                  <td>${escapeHtml(record.remarks || "No remarks")}</td>
                  <td>${record.photoData ? "Attached" : "None"}</td>
                  <td>${record.latitude && record.longitude ? `${Number(record.latitude).toFixed(5)}, ${Number(record.longitude).toFixed(5)}` : "Not captured"}</td>
                </tr>
              `,
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function getActualRecordsForMonth(programType, monthKey) {
  return getApprovedRecords(programType)
    .filter((record) => getMonthKey(record.actualCompletionDate || record.deadline) === monthKey)
    .sort((a, b) => {
      const dateOrder = new Date(a.actualCompletionDate || a.deadline) - new Date(b.actualCompletionDate || b.deadline);
      if (dateOrder !== 0) return dateOrder;
      return a.blockField.localeCompare(b.blockField);
    });
}

function getDashboardRows(programType) {
  const plannedRows = state.plannedProgrammes
    .filter((row) => row.programType === programType)
    .map((row) => ({ ...row, months: { ...row.months } }));
  const plannedFields = new Set(plannedRows.map((row) => fieldKey(row.field)));
  const actualOnlyRows = [];

  getApprovedRecords(programType)
    .forEach((record) => {
      const key = fieldKey(record.blockField);
      if (!key || plannedFields.has(key) || actualOnlyRows.some((row) => fieldKey(row.field) === key)) return;
      actualOnlyRows.push({
        id: `actual-${key}`,
        programType,
        field: record.blockField,
        hect: Number(record.hectares) || 0,
        type: "Actual Only",
        sph: "-",
        palms: "-",
        machine: "-",
        lastDone: "-",
        months: {},
      });
    });

  return [...plannedRows, ...actualOnlyRows];
}

function getActualLookup(programType) {
  return getApprovedRecords(programType)
    .reduce((lookup, record) => {
      const monthKey = getMonthKey(record.actualCompletionDate || record.deadline);
      if (!MONTHS_2026.some((month) => month.key === monthKey)) return lookup;
      const key = `${fieldKey(record.blockField)}|${monthKey}`;
      lookup[key] = (lookup[key] || 0) + (Number(record.hectares) || 0);
      return lookup;
    }, {});
}

function getApprovedRecords(programType = selectedDashboardProgram) {
  return state.records.filter((record) => record.programType === programType && record.approvalStatus === "Approved");
}

function sumPlannedRows(rows) {
  return rows.reduce((total, row) => total + sumRowPlanned(row), 0);
}

function sumActualRows(rows, actualLookup) {
  return rows.reduce((total, row) => total + sumRowActual(row, actualLookup), 0);
}

function sumRowPlanned(row) {
  return MONTHS_2026.reduce((total, month) => total + (Number(row.months[month.key]) || 0), 0);
}

function sumRowActual(row, actualLookup) {
  return MONTHS_2026.reduce((total, month) => total + (Number(actualLookup[`${fieldKey(row.field)}|${month.key}`]) || 0), 0);
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

  dom.dashboardMapSummary.innerHTML = `
    <article><span>On Time</span><strong>${counts.green}</strong></article>
    <article><span>Delayed</span><strong>${counts.yellow}</strong></article>
    <article><span>Over-Delayed</span><strong>${counts.red}</strong></article>
    <article><span>No Data</span><strong>${counts.grey}</strong></article>
  `;

  if (window.L) {
    renderLeafletDashboardMap(statuses);
  } else {
    renderStaticDashboardMap(statuses);
  }

  renderMapFieldDetail(statuses.find((item) => item.field.fieldGis === selectedMapField) || statuses[0]);
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
      layer.bindTooltip(feature.properties.fieldGis, {
        className: "field-map-tooltip",
        direction: "center",
        permanent: false,
        sticky: true,
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
                <text class="field-map-label" x="${item.labelPoint.x}" y="${item.labelPoint.y}">${escapeHtml(item.field.fieldGis)}</text>
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
        fieldNo: item.field.fieldNo,
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
      <strong>${escapeHtml(item.field.fieldGis)}</strong>
      <span>${escapeHtml(item.label)}</span>
      <dl>
        <div><dt>GIS ha</dt><dd>${formatNumber(item.field.ha)}</dd></div>
        <div><dt>Planned</dt><dd>${formatNumber(item.plannedToDate)}</dd></div>
        <div><dt>Approved</dt><dd>${formatNumber(item.completedToDate)}</dd></div>
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
    <h3>${escapeHtml(item.field.fieldGis)}</h3>
    <dl>
      <div><dt>Field No.</dt><dd>${escapeHtml(item.field.fieldNo)}</dd></div>
      <div><dt>Programme</dt><dd>${escapeHtml(selectedDashboardProgram)}</dd></div>
      <div><dt>Estate</dt><dd>${escapeHtml(item.field.estate || "Digital Estate")}</dd></div>
      <div><dt>Division</dt><dd>${escapeHtml(item.field.division || "-")}</dd></div>
      <div><dt>GIS Hectares</dt><dd>${formatNumber(item.field.ha)}</dd></div>
      <div><dt>Planned Hectares To Date</dt><dd>${formatNumber(item.plannedToDate)}</dd></div>
      <div><dt>Approved Completed</dt><dd>${formatNumber(item.completedToDate)}</dd></div>
      <div><dt>Latest Planned Month</dt><dd>${item.latestPlannedMonth ? formatMonthLabel(item.latestPlannedMonth) : "No plan"}</dd></div>
      <div><dt>Last Completion</dt><dd>${item.lastCompletionDate ? formatDate(item.lastCompletionDate, "No date") : "No approved completion"}</dd></div>
    </dl>
    <p>${escapeHtml(item.message)}</p>
  `;
}

function getMapFieldStatus(row, field) {
  const currentMonth = currentMonthKey();
  const fieldCode = field?.fieldGis || row?.field || "";
  const approved = getApprovedRecords(selectedDashboardProgram).filter((record) => fieldKey(record.blockField) === fieldKey(fieldCode));
  const plannedToDate = MONTHS_2026.filter((month) => month.key <= currentMonth).reduce(
    (total, month) => total + (Number(row?.months?.[month.key]) || 0),
    0,
  );
  const completedToDate = approved
    .filter((record) => getMonthKey(record.actualCompletionDate || record.deadline) <= currentMonth)
    .reduce((total, record) => total + (Number(record.hectares) || 0), 0);
  const latestPlannedMonth = row ? getLatestPlannedMonth(row, currentMonth) : "";
  const completionDates = approved
    .map((record) => record.actualCompletionDate || record.deadline)
    .filter(Boolean)
    .sort();
  const lastCompletionDate = completionDates[completionDates.length - 1];

  if (!latestPlannedMonth) {
    return {
      status: "grey",
      label: "No planned data",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      lastCompletionDate,
      message: "No planned programme is available for this field in the current period.",
    };
  }

  if (plannedToDate > 0 && completedToDate >= plannedToDate) {
    return {
      status: "green",
      label: "On time / completed",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      lastCompletionDate,
      message: "Approved completion meets or exceeds planned hectarage to date.",
    };
  }

  const dueMonth = getFirstUnmetPlannedMonth(row, currentMonth, completedToDate) || latestPlannedMonth;
  const delayMonths = monthDiff(dueMonth, currentMonth);
  if (delayMonths > 3) {
    return {
      status: "red",
      label: "Over-delayed",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      lastCompletionDate,
      message: "Planned work is more than three months behind approved completion.",
    };
  }

  if (delayMonths >= 1) {
    return {
      status: "yellow",
      label: "Delayed",
      plannedToDate,
      completedToDate,
      latestPlannedMonth,
      lastCompletionDate,
      message: "Planned work is delayed by one to three months.",
    };
  }

  return {
    status: "green",
    label: "Current programme",
    plannedToDate,
    completedToDate,
    latestPlannedMonth,
    lastCompletionDate,
    message: "Latest planned work is within the current programme month.",
  };
}

function getLatestPlannedMonth(row, currentMonth) {
  const plannedMonths = MONTHS_2026.map((month) => month.key).filter((key) => key <= currentMonth && Number(row.months[key]) > 0);
  return plannedMonths[plannedMonths.length - 1];
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

function findPlannedRowForMapField(field, programType) {
  return getDashboardRows(programType).find(
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

function renderRecords() {
  const query = dom.searchInput.value.trim().toLowerCase();
  const typeFilter = dom.typeFilter.value;
  const approvalFilter = dom.stageFilter.value;

  const filtered = state.records.filter((record) => {
    const matchesText = [record.reporterName, record.programType, record.blockField, record.taskName, record.approvalStatus, record.remarks]
      .join(" ")
      .toLowerCase()
      .includes(query);
    const matchesType = !typeFilter || record.programType === typeFilter;
    const matchesApproval = !approvalFilter || record.approvalStatus === approvalFilter;
    return matchesText && matchesType && matchesApproval;
  });

  dom.recordsTable.innerHTML = "";
  dom.recordsCardList.innerHTML = "";
  dom.recordsEmpty.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((record) => {
    const tr = document.createElement("tr");
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
    dom.recordsTable.append(tr);
    dom.recordsCardList.append(renderRecordCard(record, gps));
  });

  document.querySelectorAll("[data-action][data-id]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "edit") editRecord(button.dataset.id);
      if (button.dataset.action === "approve") approveRecord(button.dataset.id);
      if (button.dataset.action === "delete") deleteRecord(button.dataset.id);
    });
  });
}

function renderRecordCard(record, gps) {
  const article = document.createElement("article");
  article.className = "record-card";
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
  const points = state.records.filter((record) => record.latitude && record.longitude);

  if (!points.length) {
    mapOutput.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 21s7-6.1 7-12A7 7 0 0 0 5 9c0 5.9 7 12 7 12Z" />
          <path d="M12 12a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
        <h3>No GPS records</h3>
        <p>Capture latitude and longitude to populate the map output.</p>
      </div>
    `;
    return;
  }

  const latitudes = points.map((record) => Number(record.latitude));
  const longitudes = points.map((record) => Number(record.longitude));
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);

  mapOutput.innerHTML = `<div class="map-canvas" id="mapCanvas"></div><div class="map-records" id="mapRecords"></div>`;
  const mapCanvas = document.querySelector("#mapCanvas");
  const mapRecords = document.querySelector("#mapRecords");
  points.forEach((record) => {
    const x = 8 + ((Number(record.longitude) - minLng) / lngRange) * 84;
    const y = 92 - ((Number(record.latitude) - minLat) / latRange) * 84;
    const accuracyRadius = Math.min(38, Math.max(14, Number(record.gpsAccuracy || 14)));
    const point = document.createElement("button");
    point.className = "map-point";
    point.type = "button";
    point.style.left = `${x}%`;
    point.style.top = `${y}%`;
    point.style.setProperty("--accuracy-radius", `${accuracyRadius}px`);
    point.title = `${record.programType} - ${record.blockField}`;
    point.setAttribute("aria-label", `${record.programType} - ${record.blockField}`);
    mapCanvas.append(point);

    const recordItem = document.createElement("article");
    recordItem.className = "map-record";
    recordItem.innerHTML = `
      <strong>${escapeHtml(record.blockField)} - ${escapeHtml(record.programType)}</strong>
      <span>${Number(record.latitude).toFixed(5)}, ${Number(record.longitude).toFixed(5)}</span>
      <span>${record.gpsAccuracy ? `Accuracy +/- ${Number(record.gpsAccuracy).toFixed(1)}m` : "Accuracy not captured"}</span>
    `;
    mapRecords.append(recordItem);
  });
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

function saveRecord(event) {
  event.preventDefault();
  clearFieldErrors();

  const data = {
    id: dom.recordId.value || createId(),
    reporterName: dom.reporterName.value.trim(),
    programType: dom.programType.value,
    blockField: dom.blockField.value.trim(),
    taskName: dom.taskName.value.trim(),
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

  const existingIndex = state.records.findIndex((record) => record.id === data.id);
  if (existingIndex >= 0) {
    state.records[existingIndex] = data;
  } else {
    state.records.unshift(data);
  }

  persist();
  renderAll();
  resetForm();
  setView("records");
  showToast(data.syncStatus === "Pending Sync" ? "Record saved offline and queued for approval." : "Record submitted for approval.");
}

function validateRecord(data) {
  const errors = [];
  if (!data.reporterName) errors.push({ field: dom.reporterName, message: "Enter reporter name." });
  if (!data.programType) errors.push({ field: dom.programType, message: "Select a Work Program type." });
  if (data.programType && !ALLOWED_PROGRAM_NAMES.has(data.programType)) errors.push({ field: dom.programType, message: "Select an approved Work Program type." });
  if (!data.blockField) errors.push({ field: dom.blockField, message: "Enter the block or field." });
  if (!data.taskName) errors.push({ field: dom.taskName, message: "Enter the task." });
  if (!data.hectares || data.hectares <= 0) errors.push({ field: dom.hectares, message: "Enter hectares above zero." });
  if (!data.actualCompletionDate) errors.push({ field: dom.actualCompletionDate, message: "Select actual completion date." });
  return errors;
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

function editRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;

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

function deleteRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  const confirmed = confirm(`Delete ${record.programType} record for ${record.blockField}?`);
  if (!confirmed) return;

  state.records = state.records.filter((item) => item.id !== id);
  persist();
  renderAll();
  showToast("Record deleted.");
}

function approveRecord(id) {
  const record = state.records.find((item) => item.id === id);
  if (!record) return;
  record.approvalStatus = "Approved";
  record.updatedAt = new Date().toISOString();
  persist();
  renderAll();
  showToast("Record approved and included in the dashboard.");
}

function resetForm() {
  dom.formHeading.textContent = "Capture Work Program";
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

function refreshConnectionStatus() {
  const online = navigator.onLine;
  dom.connectionDot.classList.toggle("online", online);
  dom.connectionDot.classList.toggle("offline", !online);
  dom.connectionText.textContent = online ? "Online" : "Offline";
}

function buildDefaultPlannedProgrammes() {
  return [
    ...buildProgrammeRows("Pruning", [
      ["Field P07", 9.2, "Frond", 110, 1012, "Manual", "Jan 26", 0],
      ["Field P11", 15.6, "Frond", 116, 1810, "Manual", "Feb 26", 1],
      ["Field P19", 21.3, "Frond", 120, 2556, "Manual", "Mar 26", 2],
    ]),
    ...buildProgrammeRows("Raking", [
      ["Block A12", 18.5, "Field upkeep", 108, 1998, "Manual", "Jan 26", 0],
      ["Block B04", 22.75, "Field upkeep", 112, 2548, "Manual", "Feb 26", 1],
      ["Block C09", 31.4, "Field upkeep", 118, 3705, "Manual", "Mar 26", 2],
    ]),
    ...buildProgrammeRows(SPRAYING_PROGRAM, getSprayingPlanRows()),
    ...buildProgrammeRows("Harvesting", [
      ["Block H01", 14.6, "FFB", 115, 1679, "Manual", "Jan 26", 0],
      ["Block H08", 26.2, "FFB", 118, 3092, "Manual", "Feb 26", 1],
      ["Block H15", 33.8, "FFB", 121, 4090, "Manual", "Mar 26", 2],
    ]),
  ];
}

function getSprayingPlanRows() {
  const mapFields = typeof window !== "undefined" ? window.FIELD_MAP_DATA?.fields || [] : [];
  if (mapFields.length) {
    return mapFields.map((field, index) => [
      field.fieldGis,
      field.ha,
      field.fieldType || "Mature",
      "-",
      "-",
      "STGEO",
      "Dec 25",
      index % 3,
    ]);
  }

  return [
    ["P02D1", 40.9395, "OP-MATURE", "-", "-", "STGEO", "Dec 25", 2],
    ["P05C1", 46.8695, "OP-MATURE", "-", "-", "STGEO", "Dec 25", 0],
    ["P06B", 74.9819, "OP-MATURE", "-", "-", "STGEO", "July 25", 1],
    ["P06C", 62.4727, "OP-MATURE", "-", "-", "STGEO", "Nov 25", 0],
    ["P07B1", 64.0017, "OP-MATURE", "-", "-", "STGEO", "Sep 25", 1],
    ["P07B3", 60.41, "OP-MATURE", "-", "-", "STGEO", "Sep 25", 2],
    ["P07B3A", 91.1074, "OP-MATURE", "-", "-", "STGEO", "Dec 25", 2],
    ["P07B3B", 49.9303, "OP-MATURE", "-", "-", "STGEO", "Sep 25", 1],
  ];
}

function buildProgrammeRows(programType, rows) {
  return rows.map(([field, hect, type, sph, palms, machine, lastDone, offset]) => ({
    id: `${normaliseKey(programType)}-${normaliseKey(field)}`,
    programType,
    field,
    hect,
    type,
    sph,
    palms,
    machine,
    lastDone,
    months: buildQuarterlyMonths(hect, offset),
  }));
}

function buildQuarterlyMonths(hect, offset) {
  const months = {};
  for (let monthIndex = offset; monthIndex < 12; monthIndex += 3) {
    const key = `${DASHBOARD_YEAR}-${String(monthIndex + 1).padStart(2, "0")}`;
    months[key] = hect;
  }
  return months;
}

function daysUntil(dateString) {
  if (!dateString) return Infinity;
  const date = new Date(`${dateString}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function formatDate(dateString, fallback = "No deadline") {
  if (!dateString) return fallback;
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${dateString}T00:00:00`));
}

function getMonthKey(dateString) {
  return dateString ? dateString.slice(0, 7) : "";
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function monthDiff(fromMonth, toMonth) {
  if (!fromMonth || !toMonth) return 0;
  const [fromYear, fromIndex] = fromMonth.split("-").map(Number);
  const [toYear, toIndex] = toMonth.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toIndex - fromIndex);
}

function formatMonthLabel(monthKey) {
  const month = MONTHS_2026.find((item) => item.key === monthKey);
  return month ? `${month.label} ${DASHBOARD_YEAR}` : monthKey;
}

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function normaliseKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll(/\s+/g, "-");
}

function fieldKey(value) {
  let key = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (key.startsWith("P")) key = key.slice(1);
  if (key.startsWith("20") && key.length > 4) key = key.slice(2);
  return key;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSignedNumber(value) {
  const prefix = Number(value) > 0 ? "+" : "";
  return `${prefix}${formatNumber(value)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function futureDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function showToast(message) {
  dom.toast.textContent = message;
  dom.toast.classList.remove("hidden");
  clearTimeout(showToast.timeoutId);
  showToast.timeoutId = setTimeout(() => {
    dom.toast.classList.add("hidden");
  }, 2600);
}
