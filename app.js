const STORAGE_KEY = "sdg-work-program-tracker-v1";
function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const defaultState = {
  programTypes: getDefaultProgramTypes(),
  plannedProgrammes: buildDefaultPlannedProgrammes(),
  records: buildDefaultRecords(),
  pmvRecords: buildDefaultPmvRecords(),
};

let state = loadState();
let currentView = "dashboard";
let selectedDashboardType = "work-program";
let selectedDashboardProgram = state.programTypes.find((type) => type.name === MATURE_CIRCLE_PROGRAM)?.name || state.programTypes[0]?.name || "";
let selectedDashboardBreakdown = null;
let selectedDashboardMode = "map";
let showProgrammeRows = false;
let selectedDashboardTableField = "";
let selectedDashboardTableColumn = "";
let selectedMapField = "";
let selectedApprovalStatus = getInitialApprovalStatus();
let selectedRecordId = "";
let selectedMonthlyProgram = state.programTypes.find((type) => type.name === MATURE_CIRCLE_PROGRAM)?.name || state.programTypes[0]?.name || "";
let selectedMonthlyMonth = getDefaultMonthlyMonth();
let selectedPmvDashboardDate = getLatestPmvReportDate();
let selectedPmvDashboardMachine = "";
let selectedPmvDashboardStatus = "";
let dashboardLeafletMap = null;
let dashboardFieldLayer = null;
let recordsLeafletMap = null;
let recordsFieldLayer = null;
let recordsMarkerLayer = null;
let recordsMarkerLookup = new Map();
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
  dashboardNavGroup: document.querySelector("#dashboardNavGroup"),
  dashboardNavOptions: document.querySelector("#dashboardNavOptions"),
  dashboardTypeButtons: document.querySelectorAll("[data-dashboard-type]"),
  workProgramDashboardView: document.querySelector("#workProgramDashboardView"),
  pmvDashboardView: document.querySelector("#pmvDashboardView"),
  pmvDashboardDateFilter: document.querySelector("#pmvDashboardDateFilter"),
  pmvDashboardMachineFilter: document.querySelector("#pmvDashboardMachineFilter"),
  pmvDashboardStatusFilter: document.querySelector("#pmvDashboardStatusFilter"),
  pmvDashboardExportButton: document.querySelector("#pmvDashboardExportButton"),
  pmvDashboardSummary: document.querySelector("#pmvDashboardSummary"),
  pmvSummaryModal: document.querySelector("#pmvSummaryModal"),
  pmvSummaryModalTitle: document.querySelector("#pmvSummaryModalTitle"),
  pmvSummaryModalMeta: document.querySelector("#pmvSummaryModalMeta"),
  pmvSummaryModalList: document.querySelector("#pmvSummaryModalList"),
  pmvSummaryModalClose: document.querySelector("#pmvSummaryModalClose"),
  pmvActionQueue: document.querySelector("#pmvActionQueue"),
  pmvBreakdownReasons: document.querySelector("#pmvBreakdownReasons"),
  pmvStatusTrend: document.querySelector("#pmvStatusTrend"),
  pmvRepeatIssues: document.querySelector("#pmvRepeatIssues"),
  pmvChecklistRisk: document.querySelector("#pmvChecklistRisk"),
  pmvDashboardTableHead: document.querySelector("#pmvDashboardTableHead"),
  pmvDashboardTableBody: document.querySelector("#pmvDashboardTableBody"),
  dashboardProgramSelect: document.querySelector("#dashboardProgramSelect"),
  programmeDashboardTitle: document.querySelector("#programmeDashboardTitle"),
  dashboardMapButton: document.querySelector("#dashboardMapButton"),
  dashboardTableButton: document.querySelector("#dashboardTableButton"),
  dashboardMapView: document.querySelector("#dashboardMapView"),
  dashboardTableView: document.querySelector("#dashboardTableView"),
  dashboardMapSummary: document.querySelector("#dashboardMapSummary"),
  dashboardMapLegend: document.querySelector("#dashboardMapLegend"),
  dashboardMapRulesButton: document.querySelector("#dashboardMapRulesButton"),
  dashboardMapRulesPopover: document.querySelector("#dashboardMapRulesPopover"),
  dashboardMap: document.querySelector("#dashboardMap"),
  dashboardMapDetail: document.querySelector("#dashboardMapDetail"),
  programmeSummary: document.querySelector("#programmeSummary"),
  programmeRowsToggle: document.querySelector("#programmeRowsToggle"),
  dashboardExportButton: document.querySelector("#dashboardExportButton"),
  programmeDashboardHead: document.querySelector("#programmeDashboardHead"),
  programmeDashboardBody: document.querySelector("#programmeDashboardBody"),
  dailyTrackingPanel: document.querySelector("#dailyTrackingPanel"),
  recordsTable: document.querySelector("#recordsTable"),
  recordsCardList: document.querySelector("#recordsCardList"),
  recordsEmpty: document.querySelector("#recordsEmpty"),
  typeFilter: document.querySelector("#typeFilter"),
  fieldFilter: document.querySelector("#fieldFilter"),
  approvalTabs: document.querySelector("#approvalTabs"),
  recordsScrollButton: document.querySelector("#recordsScrollButton"),
  monthlyProgramFilter: document.querySelector("#monthlyProgramFilter"),
  monthlyMonthFilter: document.querySelector("#monthlyMonthFilter"),
  monthlyTrackingHead: document.querySelector("#monthlyTrackingHead"),
  monthlyTrackingBody: document.querySelector("#monthlyTrackingBody"),
  monthlyTrackingFoot: document.querySelector("#monthlyTrackingFoot"),
  recordForm: document.querySelector("#recordForm"),
  formHeading: document.querySelector("#formHeading"),
  recordId: document.querySelector("#recordId"),
  reporterName: document.querySelector("#reporterName"),
  programType: document.querySelector("#programType"),
  blockField: document.querySelector("#blockField"),
  fieldOptions: document.querySelector("#fieldOptions"),
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
  pmvForm: document.querySelector("#pmvForm"),
  pmvClearButton: document.querySelector("#pmvClearButton"),
  pmvRecordId: document.querySelector("#pmvRecordId"),
  pmvReportDate: document.querySelector("#pmvReportDate"),
  pmvReporterOptions: document.querySelector("#pmvReporterOptions"),
  pmvReporterError: document.querySelector("#pmvReporterError"),
  pmvMachineOptions: document.querySelector("#pmvMachineOptions"),
  pmvMachineError: document.querySelector("#pmvMachineError"),
  pmvIpsBatteryError: document.querySelector("#pmvIpsBatteryError"),
  pmvChecklist: document.querySelector("#pmvChecklist"),
  pmvDamagedComponentOptions: document.querySelector("#pmvDamagedComponentOptions"),
  pmvDamagedComponentError: document.querySelector("#pmvDamagedComponentError"),
  pmvIdleReasonOptions: document.querySelector("#pmvIdleReasonOptions"),
  pmvIdleReasonError: document.querySelector("#pmvIdleReasonError"),
  pmvAssistantNotes: document.querySelector("#pmvAssistantNotes"),
  pmvWorkingFields: document.querySelector("#pmvWorkingFields"),
  pmvBreakdownFields: document.querySelector("#pmvBreakdownFields"),
  pmvIdleFields: document.querySelector("#pmvIdleFields"),
  pmvRecordCount: document.querySelector("#pmvRecordCount"),
  pmvRecordList: document.querySelector("#pmvRecordList"),
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

  dom.searchInput.addEventListener("input", renderRecordsOutputs);
  dom.typeFilter.addEventListener("change", renderRecordsOutputs);
  dom.fieldFilter.addEventListener("change", renderRecordsOutputs);
  dom.dashboardTypeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView("dashboard");
      setDashboardType(button.dataset.dashboardType || "work-program");
    });
  });
  dom.pmvDashboardDateFilter.addEventListener("change", () => {
    selectedPmvDashboardDate = dom.pmvDashboardDateFilter.value || getLatestPmvReportDate();
    renderPmvDashboard();
  });
  dom.pmvDashboardMachineFilter.addEventListener("change", () => {
    selectedPmvDashboardMachine = dom.pmvDashboardMachineFilter.value || "";
    renderPmvDashboard();
  });
  dom.pmvDashboardStatusFilter.addEventListener("change", () => {
    selectedPmvDashboardStatus = dom.pmvDashboardStatusFilter.value || "";
    renderPmvDashboard();
  });
  dom.pmvDashboardExportButton.addEventListener("click", downloadPmvDashboardExport);
  dom.pmvDashboardSummary.addEventListener("click", handlePmvSummaryMetricClick);
  dom.pmvSummaryModalClose.addEventListener("click", closePmvSummaryModal);
  dom.pmvSummaryModal.addEventListener("click", (event) => {
    if (event.target === dom.pmvSummaryModal) closePmvSummaryModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dom.pmvSummaryModal.classList.contains("hidden")) closePmvSummaryModal();
  });
  dom.dashboardProgramSelect.addEventListener("change", () => {
    selectedDashboardProgram = dom.dashboardProgramSelect.value || state.programTypes[0]?.name || "";
    selectedDashboardBreakdown = null;
    selectedDashboardTableField = "";
    selectedDashboardTableColumn = "";
    selectedMapField = "";
    renderDashboard();
  });
  dom.approvalTabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-approval-status]");
    if (!button) return;
    selectedApprovalStatus = button.dataset.approvalStatus;
    selectedRecordId = "";
    renderRecordsOutputs();
  });
  dom.recordsScrollButton.addEventListener("click", scrollRecordsList);
  dom.monthlyProgramFilter.addEventListener("change", () => {
    selectedMonthlyProgram = dom.monthlyProgramFilter.value || state.programTypes[0]?.name || "";
    renderMonthlyTrackingTable();
  });
  dom.monthlyMonthFilter.addEventListener("change", () => {
    selectedMonthlyMonth = dom.monthlyMonthFilter.value || getDefaultMonthlyMonth();
    renderMonthlyTrackingTable();
  });
  dom.blockField.addEventListener("change", () => {
    dom.blockField.value = dom.blockField.value.trim();
  });
  dom.dashboardMapButton.addEventListener("click", () => setDashboardMode("map"));
  dom.dashboardTableButton.addEventListener("click", () => setDashboardMode("table"));
  dom.programmeRowsToggle.addEventListener("click", toggleProgrammeRows);
  dom.dashboardExportButton.addEventListener("click", downloadDashboardTableExport);
  dom.programmeDashboardHead.addEventListener("click", handleProgrammeTableHighlightClick);
  dom.programmeDashboardBody.addEventListener("click", handleProgrammeTableHighlightClick);
  dom.dashboardMapRulesButton.addEventListener("click", toggleDashboardMapRules);

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
  dom.pmvForm.addEventListener("submit", savePmvRecord);
  dom.pmvForm.addEventListener("change", handlePmvFormChange);
  dom.pmvClearButton.addEventListener("click", resetPmvForm);
  dom.pmvRecordList.addEventListener("click", handlePmvRecordActionClick);
  document.addEventListener("click", handleRecordActionClick);

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
      records: mergeDefaultRecords(Array.isArray(parsed.records) ? parsed.records : defaultState.records),
      pmvRecords: mergeDefaultPmvRecords(Array.isArray(parsed.pmvRecords) ? parsed.pmvRecords : defaultState.pmvRecords),
    };
  } catch {
    return defaultState;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderSelects();
  renderApprovalTabs();
  renderDashboard();
  renderRecordsOutputs();
  renderMonthlyTrackingTable();
  renderPmvTracker();
  renderConfiguration();
}

function setView(viewName) {
  currentView = viewName;
  const titleMap = {
    dashboard: "Dashboard",
    records: "Records",
    capture: "Program Tracker",
    pmv: "PMV Tracker",
    settings: "Configuration",
  };

  dom.viewTitle.textContent = titleMap[viewName];
  dom.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewName));
  dom.views.forEach((view) => view.classList.toggle("active", view.id === `${viewName}View`));
  dom.dashboardNavGroup.classList.toggle("active", viewName === "dashboard");
  dom.navButtons.forEach((button) => {
    if (button.dataset.view === "dashboard") button.setAttribute("aria-expanded", String(viewName === "dashboard"));
  });
  if (viewName === "records") window.setTimeout(fitRecordsLeafletMap, 0);
  if (viewName === "dashboard" && selectedDashboardType === "work-program" && selectedDashboardMode === "map") {
    window.setTimeout(fitLeafletDashboardMap, 0);
  }
}

function setDashboardType(type) {
  selectedDashboardType = type || "work-program";
  selectedDashboardBreakdown = null;
  selectedDashboardTableField = "";
  selectedDashboardTableColumn = "";
  renderDashboard();
}

function renderSelects() {
  if (!state.programTypes.some((type) => type.name === selectedDashboardProgram)) {
    selectedDashboardProgram = state.programTypes[0]?.name || "";
  }
  fillSelect(dom.dashboardProgramSelect, "", state.programTypes.map((item) => item.name));
  dom.dashboardProgramSelect.value = selectedDashboardProgram;
  fillSelect(dom.programType, "Select program type", state.programTypes.map((item) => item.name));
  fillSelect(dom.typeFilter, "All program types", state.programTypes.map((item) => item.name));
  fillSelect(dom.fieldFilter, "All fields", getFieldFilterValues());
  fillSelect(dom.monthlyProgramFilter, "Select program", state.programTypes.map((item) => item.name));
  if (!state.programTypes.some((type) => type.name === selectedMonthlyProgram)) {
    selectedMonthlyProgram = state.programTypes[0]?.name || "";
  }
  dom.monthlyProgramFilter.value = selectedMonthlyProgram;
  fillMonthSelect(dom.monthlyMonthFilter);
  renderFieldOptions();
}

function fillSelect(element, placeholder, values) {
  const currentValue = element.value;
  element.innerHTML = "";
  if (placeholder) element.append(new Option(placeholder, ""));
  values.forEach((value) => element.append(new Option(value, value)));
  if (values.includes(currentValue)) element.value = currentValue;
}

function renderFieldOptions() {
  dom.fieldOptions.innerHTML = "";
  getTrackingFields().forEach((field) => {
    const option = document.createElement("option");
    option.value = getFieldDisplayName(field);
    dom.fieldOptions.append(option);
  });
}

function getFieldFilterValues() {
  const values = new Map();
  getTrackingFields().forEach((field) => {
    values.set(fieldKey(getFieldDisplayName(field)), getFieldDisplayName(field));
  });
  state.records.forEach((record) => {
    const field = normalizeFieldName(record.blockField);
    if (field) values.set(fieldKey(field), field);
  });
  return [...values.values()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function fillMonthSelect(element) {
  element.innerHTML = "";
  MONTHS_2026.forEach((month) => {
    element.append(new Option(formatMonthLabel(month.key), month.key));
  });
  if (!MONTHS_2026.some((month) => month.key === selectedMonthlyMonth)) {
    selectedMonthlyMonth = getDefaultMonthlyMonth();
  }
  element.value = selectedMonthlyMonth;
}

function renderDashboard() {
  const isWorkProgramDashboard = selectedDashboardType === "work-program";
  dom.dashboardTypeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.dashboardType === selectedDashboardType);
  });
  dom.workProgramDashboardView.classList.toggle("hidden", !isWorkProgramDashboard);
  dom.pmvDashboardView.classList.toggle("hidden", isWorkProgramDashboard);
  if (!isWorkProgramDashboard) {
    destroyDashboardLeafletMap();
    selectedDashboardBreakdown = null;
    dom.dailyTrackingPanel.classList.add("hidden");
    dom.dailyTrackingPanel.innerHTML = "";
    renderPmvDashboard();
    return;
  }

  renderDashboardTabs();
  renderDashboardMode();
  renderDashboardMap();
  renderProgrammeSummary();
  renderProgrammeTable();
  renderDailyTrackingPanel();
}

function refreshConnectionStatus() {
  const online = navigator.onLine;
  dom.connectionDot.classList.toggle("online", online);
  dom.connectionDot.classList.toggle("offline", !online);
  dom.connectionText.textContent = online ? "Online" : "Offline";
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
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDashboardDate(value) {
  if (!value) return "-";
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return formatDate(text, "-");
  return escapeHtml(text);
}

function formatDashboardTemplateDate(row, key) {
  if (row.isTemplate && !row[key]) return "";
  return formatDashboardDate(row[key]);
}

function formatDashboardTemplateValue(row, key) {
  if (row.isTemplate && (row[key] === null || row[key] === undefined || row[key] === "")) return "";
  return formatDashboardValue(row[key]);
}

function isIsoDate(value) {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  return !Number.isNaN(parseIsoDate(text).getTime());
}

function parseIsoDate(value) {
  return new Date(`${value}T00:00:00`);
}

function addMonthsToDateString(dateString, months) {
  if (!isIsoDate(dateString)) return "";
  const monthCount = Number(months);
  if (!Number.isFinite(monthCount)) return "";
  const source = parseIsoDate(dateString);
  const target = new Date(source);
  const sourceDay = source.getDate();
  target.setMonth(target.getMonth() + monthCount);
  if (target.getDate() !== sourceDay) target.setDate(0);
  return toIsoDateString(target);
}

function toIsoDateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDashboardValue(value) {
  if (value === null || value === undefined || value === "") return "-";
  const number = Number(value);
  if (Number.isFinite(number)) {
    return number.toLocaleString("en-MY", {
      maximumFractionDigits: 2,
    });
  }
  return escapeHtml(value);
}

function getMonthKey(dateString) {
  return dateString ? dateString.slice(0, 7) : "";
}

function getMonthEndDate(monthKey) {
  const day = String(getDaysInMonth(monthKey)).padStart(2, "0");
  return `${monthKey}-${day}`;
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

function getDefaultMonthlyMonth() {
  const currentMonth = currentMonthKey();
  return MONTHS_2026.some((month) => month.key === currentMonth) ? currentMonth : MONTHS_2026[0].key;
}

function getDaysInMonth(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month, 0).getDate();
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

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("en-MY", {
    maximumFractionDigits: number >= 10 ? 0 : 1,
  });
}

function formatMonthlyHectares(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const safeNumber = Math.round((number + Number.EPSILON) * 1000000) / 1000000;
  return safeNumber.toLocaleString("en-MY", {
    maximumFractionDigits: 6,
  });
}

function formatRawNumber(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : String(value);
}

function formatSignedMonthlyHectares(value) {
  const number = Number(value) || 0;
  const prefix = number > 0 ? "+" : "";
  return `${prefix}${formatMonthlyHectares(number)}`;
}

function sumDecimalValues(values) {
  const numericValues = values.map((value) => Number(value) || 0);
  const maxDecimals = Math.min(6, Math.max(0, ...values.map(getDecimalPlaces)));
  const scale = 10 ** maxDecimals;
  return numericValues.reduce((total, value) => total + Math.round(value * scale), 0) / scale;
}

function getDecimalPlaces(value) {
  const text = String(value ?? "").trim();
  if (!text || text.includes("e")) return 0;
  return text.includes(".") ? text.split(".")[1].replace(/0+$/, "").length : 0;
}

function getProgramColor(programType) {
  return PROGRAM_COLORS[programType] || "#5f6f65";
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
