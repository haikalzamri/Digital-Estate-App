// PMV Tracker and PMV Dashboard configuration, rendering, and export logic.

const PMV_EXCEL_SOURCE = "Excel PMV historical";
const PMV_EXCEL_PREFIX = "pmv-excel";
const PMV_DRIVER_SOURCE = "PMV Tracker";
const HISTORICAL_PMV_RECORDS = Array.isArray(window.PMV_HISTORICAL_RECORDS) ? window.PMV_HISTORICAL_RECORDS : [];
const PMV_REPORTER_OPTIONS = [
  "Muhaemin Ardi",
  "Ishak",
  "Usman Bajuri",
  "Hirman",
  "Ahmad Yani",
  "Rozi",
  "Mohd Yusuf",
  "Arun Kumar Gupta",
  "Muhammad Amrozi",
  "Krishnarmoorthy A/L Raganathan",
  "Shankar A/L Paramasivam",
  "Zalilah Binti Ahmad",
  "Muhammad Safuan B Noruddin",
  "Muhammad Nabil Irfan bin Harun",
  "Muhammad Harris bin Mohd Rosli",
  "Nazarul Hakimi bin Mohd Nasir",
  "Dany Wahyudi",
  "Other",
];
const PMV_MACHINE_OPTIONS = [
  "TC002",
  "TC006",
  "TC007",
  "TC011",
  "TC012",
  "TF018",
  "TF027",
  "TM081",
  "TM084",
  "TM085",
  "TM088",
  "TM090",
  "TM092",
  "TM095",
  "RM204",
  "RM206",
  "RM208",
  "RM209",
  "RM210",
  "RM211",
  "RM212",
  "RM220",
  "RM221",
  "RM222",
  "RM223",
  "RM228",
  "RM229",
  "RM230",
  "MB001",
  "MB003",
  "Other",
];
const PMV_CHECKLIST_ITEMS = [
  { key: "rops", label: "ROPS", detail: "Struktur Pelindung Rollover", inputName: "pmvCheckRops" },
  { key: "brakeClutch", label: "Brek dan clutch", detail: "Rem dan kopling", inputName: "pmvCheckBrakeClutch" },
  { key: "seatbelt", label: "Tali Pinggang Keselamatan", detail: "Sabuk pengaman", inputName: "pmvCheckSeatbelt" },
  { key: "tyreThread", label: "Bunga Tayar", detail: "Alur ban", inputName: "pmvCheckTyreThread" },
  { key: "parkingBrake", label: "Brek Parkir / Brek Tangan", detail: "Rem parkir / Rem tangan", inputName: "pmvCheckParkingBrake" },
  { key: "bearing", label: "Bearing", detail: "Bantalan", inputName: "pmvCheckBearing" },
  { key: "tyrePressureDamage", label: "Tekanan tayar dan kerosakan", detail: "Tekanan ban dan kerusakan", inputName: "pmvCheckTyrePressureDamage" },
  { key: "oilWaterLeak", label: "Tahap kebocoran minyak/air", detail: "Tingkat kebocoran oli/air", inputName: "pmvCheckOilWaterLeak" },
  { key: "engineOilLevel", label: "Paras minyak enjin", detail: "Level oli mesin", inputName: "pmvCheckEngineOilLevel" },
  { key: "gearboxOilLevel", label: "Paras minyak gear box", detail: "Level oli gearbox", inputName: "pmvCheckGearboxOilLevel" },
  { key: "coolantLevel", label: "Paras cecair penyejuk", detail: "Level cairan pendingin", inputName: "pmvCheckCoolantLevel" },
  { key: "tyreNut", label: "Nut tayar", detail: "Mur ban", inputName: "pmvCheckTyreNut" },
  { key: "greaseNipples", label: "Keadaan grease pada nipples", detail: "Kondisi grease pada nipple", inputName: "pmvCheckGreaseNipples" },
  { key: "gearbox", label: "Gearbox", detail: "Gearbok", inputName: "pmvCheckGearbox" },
  { key: "airFilter", label: "Penapis angin", detail: "Filter udara", inputName: "pmvCheckAirFilter" },
  { key: "dieselFilter", label: "Penapis minyak diesel", detail: "Filter solar/bahan bakar", inputName: "pmvCheckDieselFilter" },
  { key: "batteryWaterLevel", label: "Paras air bateri", detail: "Level air aki", inputName: "pmvCheckBatteryWaterLevel" },
  { key: "fanBeltTension", label: "Ketegangan tali sawat", detail: "Ketegangan tali kipas", inputName: "pmvCheckFanBeltTension" },
  { key: "steering", label: "Steering", detail: "Setir/Kemudi", inputName: "pmvCheckSteering" },
  { key: "tyreSeal", label: "Sil Tayar", detail: "", inputName: "pmvCheckTyreSeal" },
];
const PMV_DAMAGE_COMPONENT_OPTIONS = [
  "Engine",
  "Cooling",
  "Transmission",
  "Operator Station",
  "Chassis",
  "Hydraulic",
  "Steering",
  "Electrical",
  "Tyre",
  "Break and Oil Seal",
  "Shaft Patah",
  "Weelding",
  "Other",
];
const PMV_IDLE_REASON_OPTIONS = [
  "Banjir",
  "Hujan",
  "Logistik",
  "Tiada material",
  "Driver AL/MC",
  "Training",
  "Audit",
  "Other",
];
const PMV_STATUS_LABELS = {
  working: "Working (Jalan)",
  breakdown: "Breakdown (Rusak)",
  idle: "Idle (Diam)",
};
function normalizePmvRecords(records) {
  return records.map(normalizePmvRecord).filter(Boolean);
}

function normalizePmvRecord(record) {
  if (!record || typeof record !== "object") return null;
  const status = normalizePmvStatus(record.machineStatus);
  const imported = isPmvHistoricalRecord(record);
  return {
    id: record.id || createId(),
    source: record.source || PMV_DRIVER_SOURCE,
    originalId: record.originalId || "",
    startTime: record.startTime || record.createdAt || record.updatedAt || "",
    completionTime: record.completionTime || record.updatedAt || "",
    email: record.email || "",
    formName: record.formName || "",
    lastModifiedTime: record.lastModifiedTime || "",
    reporterName: String(record.reporterName || "").trim(),
    reportDate: record.reportDate || getDatePart(record.startTime || record.updatedAt) || todayDate(),
    machineType: String(record.machineType || "").trim(),
    machineNumber: String(record.machineNumber || record.machine || "").trim(),
    machineStatus: status,
    ipsBattery: status === "working" ? String(record.ipsBattery || "").trim() : "",
    checklist: normalizePmvChecklist(record.checklist, !imported),
    damagedComponents: status === "breakdown" ? normalizePmvComponents(record.damagedComponents) : [],
    idleReason: status === "idle" ? String(record.idleReason || "").trim() : "",
    assistantNotes: String(record.assistantNotes || "").trim(),
    updatedAt: record.updatedAt || new Date().toISOString(),
  };
}

function normalizePmvStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value.startsWith("breakdown")) return "breakdown";
  if (value.startsWith("idle")) return "idle";
  return "working";
}

function normalizePmvChecklist(checklist = {}, fillMissing = true) {
  return PMV_CHECKLIST_ITEMS.reduce((items, item) => {
    const value = checklist[item.key] === "Kurang Baik" || checklist[item.key] === "Baik" ? checklist[item.key] : "";
    items[item.key] = value || (fillMissing ? "Baik" : "");
    return items;
  }, {});
}

function getDefaultPmvChecklist() {
  return normalizePmvChecklist();
}

function normalizePmvComponents(components) {
  if (Array.isArray(components)) return components.map((component) => String(component || "").trim()).filter(Boolean);
  return String(components || "")
    .split(";")
    .map((component) => component.trim())
    .filter(Boolean);
}

function buildDefaultPmvRecords() {
  return normalizePmvRecords(HISTORICAL_PMV_RECORDS).sort(sortPmvRecordsDescending);
}

function mergeDefaultPmvRecords(records) {
  const importedRecords = buildDefaultPmvRecords();
  const importedIds = new Set(importedRecords.map((record) => record.id));
  const manualRecords = normalizePmvRecords(records).filter((record) => !importedIds.has(record.id) && !isPmvHistoricalRecord(record));
  return mergePmvRecordSets(importedRecords, manualRecords);
}

function mergePmvRecordSets(...recordSets) {
  const recordsById = new Map();
  recordSets.flat().forEach((record) => {
    const normalized = normalizePmvRecord(record);
    if (normalized?.id) recordsById.set(normalized.id, normalized);
  });
  return [...recordsById.values()].sort(sortPmvRecordsDescending);
}

function isPmvHistoricalRecord(record) {
  return record?.source === PMV_EXCEL_SOURCE || String(record?.id || "").startsWith(`${PMV_EXCEL_PREFIX}-`);
}

function sortPmvRecordsDescending(a, b) {
  return new Date(b.completionTime || b.updatedAt || b.reportDate || 0) - new Date(a.completionTime || a.updatedAt || a.reportDate || 0);
}

async function syncPmvRecordsFromApi() {
  if (!window.digitalEstateApi?.listPmvRecords) return;
  try {
    const remoteRecords = normalizePmvRecords(await window.digitalEstateApi.listPmvRecords());
    state.pmvRecords = remoteRecords;
    selectedPmvDashboardDate = getLatestPmvReportDate();
    persist();
    renderAll();
  } catch (error) {
    console.warn("PMV Supabase sync unavailable:", error.message);
  }
}

function renderPmvDashboard() {
  if (!selectedPmvDashboardDate) selectedPmvDashboardDate = getLatestPmvReportDate();
  renderPmvDashboardFilters();
  const records = getPmvDashboardRecords();
  renderPmvDashboardSummary(records);
  renderPmvActionQueue(records);
  renderPmvBreakdownReasons(records);
  renderPmvStatusTrend();
  renderPmvRepeatIssues();
  renderPmvChecklistRisk();
  renderPmvDashboardTable(records);
}

function renderPmvDashboardFilters() {
  dom.pmvDashboardDateFilter.value = selectedPmvDashboardDate || "";
  const machineValues = getPmvMachineFilterValues();
  if (selectedPmvDashboardMachine && !machineValues.includes(selectedPmvDashboardMachine)) selectedPmvDashboardMachine = "";
  fillSelect(dom.pmvDashboardMachineFilter, "All machines", machineValues);
  dom.pmvDashboardMachineFilter.value = selectedPmvDashboardMachine;
  dom.pmvDashboardStatusFilter.value = selectedPmvDashboardStatus;
}

function renderPmvDashboardSummary(records) {
  const working = records.filter((record) => record.machineStatus === "working");
  const breakdown = records.filter((record) => record.machineStatus === "breakdown");
  const idle = records.filter((record) => record.machineStatus === "idle");
  const attention = records.filter(hasPmvActionIssue);
  const totalMachines = countUniquePmvMachines(records);
  const latestLabel = selectedPmvDashboardDate ? formatDate(selectedPmvDashboardDate, selectedPmvDashboardDate) : "No date";
  dom.pmvDashboardSummary.innerHTML = [
    renderPmvMetric("Machines Reported", totalMachines, latestLabel, "neutral", "reported"),
    renderPmvMetric("Working", countUniquePmvMachines(working), `${working.length} report${working.length === 1 ? "" : "s"}`, "good", "working"),
    renderPmvMetric("Breakdown", countUniquePmvMachines(breakdown), `${breakdown.length} report${breakdown.length === 1 ? "" : "s"}`, "bad", "breakdown"),
    renderPmvMetric("Idle", countUniquePmvMachines(idle), `${idle.length} report${idle.length === 1 ? "" : "s"}`, "warn", "idle"),
    renderPmvMetric("Need Action", attention.length, "Breakdown, idle, or Kurang Baik", "bad"),
  ].join("");
}

function renderPmvMetric(label, value, helper, tone, summaryType = "") {
  const content = `
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      <small>${escapeHtml(helper)}</small>
  `;
  if (!summaryType) return `<article class="pmv-metric ${tone}">${content}</article>`;
  return `
    <button class="pmv-metric ${tone} clickable" type="button" data-pmv-summary="${escapeHtml(summaryType)}" aria-label="View ${escapeHtml(label)} machine list">
      ${content}
    </button>
  `;
}

function handlePmvSummaryMetricClick(event) {
  const button = event.target.closest("[data-pmv-summary]");
  if (!button) return;
  openPmvSummaryModal(button.dataset.pmvSummary);
}

function openPmvSummaryModal(summaryType) {
  const records = getPmvSummaryRecords(summaryType);
  const machineRows = getPmvSummaryMachineRows(records);
  const titles = {
    reported: "Machines Reported",
    working: "Working Machines",
    breakdown: "Breakdown Machines",
    idle: "Idle Machines",
  };
  dom.pmvSummaryModalTitle.textContent = titles[summaryType] || "Machines";
  dom.pmvSummaryModalMeta.textContent = `${formatDate(selectedPmvDashboardDate, "No date")} | ${records.length} report${records.length === 1 ? "" : "s"} | ${machineRows.length} machine${machineRows.length === 1 ? "" : "s"}`;
  dom.pmvSummaryModalList.innerHTML = machineRows.length
    ? machineRows
        .map(
          (row) => `
            <div class="pmv-summary-machine-row">
              <strong>${escapeHtml(row.machine)}</strong>
              <span>${escapeHtml(row.names.join(", "))}</span>
            </div>
          `,
        )
        .join("")
    : `<div class="pmv-dashboard-empty">No machine found for this selection.</div>`;
  dom.pmvSummaryModal.classList.remove("hidden");
}

function closePmvSummaryModal() {
  dom.pmvSummaryModal.classList.add("hidden");
}

function getPmvSummaryRecords(summaryType) {
  const records = getPmvDashboardRecords();
  if (summaryType === "working") return records.filter((record) => record.machineStatus === "working");
  if (summaryType === "breakdown") return records.filter((record) => record.machineStatus === "breakdown");
  if (summaryType === "idle") return records.filter((record) => record.machineStatus === "idle");
  return records;
}

function getPmvSummaryMachineRows(records) {
  return [...groupBy(records, getPmvMachineLabel).entries()]
    .map(([machine, machineRecords]) => ({
      machine,
      names: [...new Set(machineRecords.map((record) => record.reporterName || "Name not captured"))],
    }))
    .sort((a, b) => a.machine.localeCompare(b.machine, undefined, { numeric: true }));
}

function renderPmvActionQueue(records) {
  const actions = records.filter(hasPmvActionIssue).sort(sortPmvActionRecords).slice(0, 12);
  if (!actions.length) {
    dom.pmvActionQueue.innerHTML = `<div class="pmv-dashboard-empty">No manager action required for the selected filters.</div>`;
    return;
  }
  dom.pmvActionQueue.innerHTML = actions
    .map((record) => {
      const reasons = getPmvActionReasons(record);
      return `
        <article class="pmv-action-card">
          <div>
            <span class="pmv-status-pill pmv-status-${record.machineStatus}">${escapeHtml(PMV_STATUS_LABELS[record.machineStatus])}</span>
            <strong>${escapeHtml(getPmvMachineLabel(record))}</strong>
            <small>${escapeHtml(record.reporterName || "No reporter")} | ${formatDate(record.reportDate, "No date")}</small>
          </div>
          <p>${escapeHtml(reasons.join(", "))}</p>
          ${record.assistantNotes ? `<em>${escapeHtml(record.assistantNotes)}</em>` : ""}
        </article>
      `;
    })
    .join("");
}

function renderPmvBreakdownReasons(records) {
  const breakdownRecords = records.filter((record) => record.machineStatus === "breakdown");
  const counts = countByValue(breakdownRecords.flatMap((record) => record.damagedComponents.length ? record.damagedComponents : ["No component captured"]));
  renderPmvRankList(dom.pmvBreakdownReasons, counts, "No breakdown reason captured for the selected filters.");
}

function renderPmvStatusTrend() {
  const endDate = selectedPmvDashboardDate || getLatestPmvReportDate();
  const days = getDateWindow(endDate, 14);
  const rows = days.map((dateKey) => {
    const records = state.pmvRecords.filter(
      (record) => record.reportDate === dateKey && recordMatchesPmvMachineFilter(record) && recordMatchesPmvStatusFilter(record),
    );
    return {
      dateKey,
      working: records.filter((record) => record.machineStatus === "working").length,
      breakdown: records.filter((record) => record.machineStatus === "breakdown").length,
      idle: records.filter((record) => record.machineStatus === "idle").length,
    };
  });
  dom.pmvStatusTrend.innerHTML = rows
    .map((row) => {
      const total = row.working + row.breakdown + row.idle;
      const workingPct = total ? (row.working / total) * 100 : 0;
      const breakdownPct = total ? (row.breakdown / total) * 100 : 0;
      const idlePct = Math.max(0, 100 - workingPct - breakdownPct);
      return `
        <div class="pmv-trend-row">
          <span>${escapeHtml(formatShortDate(row.dateKey))}</span>
          <div class="pmv-stacked-bar" aria-label="${escapeHtml(formatDate(row.dateKey, row.dateKey))}: ${total} reports">
            <i class="working" style="width:${workingPct}%"></i>
            <i class="breakdown" style="width:${breakdownPct}%"></i>
            <i class="idle" style="width:${idlePct}%"></i>
          </div>
          <strong>${total}</strong>
        </div>
      `;
    })
    .join("");
}

function renderPmvRepeatIssues() {
  const records = getPmvRecordsInWindow(selectedPmvDashboardDate || getLatestPmvReportDate(), 30)
    .filter(recordMatchesPmvMachineFilter)
    .filter(recordMatchesPmvStatusFilter)
    .filter(hasPmvActionIssue);
  const groups = groupBy(records, getPmvMachineLabel);
  const rows = [...groups.entries()]
    .map(([machine, machineRecords]) => ({
      machine,
      count: machineRecords.length,
      breakdowns: machineRecords.filter((record) => record.machineStatus === "breakdown").length,
      reasons: topValues(machineRecords.flatMap(getPmvActionReasons), 3).map((item) => item.label),
    }))
    .sort((a, b) => b.count - a.count || a.machine.localeCompare(b.machine, undefined, { numeric: true }))
    .slice(0, 8);
  if (!rows.length) {
    dom.pmvRepeatIssues.innerHTML = `<div class="pmv-dashboard-empty">No repeated machine issue in the last 30 days.</div>`;
    return;
  }
  dom.pmvRepeatIssues.innerHTML = rows
    .map(
      (row) => `
        <article class="pmv-repeat-card">
          <strong>${escapeHtml(row.machine)}</strong>
          <span>${row.count} issue report${row.count === 1 ? "" : "s"} | ${row.breakdowns} breakdown</span>
          <small>${escapeHtml(row.reasons.join(", ") || "No reason captured")}</small>
        </article>
      `,
    )
    .join("");
}

function renderPmvChecklistRisk() {
  const records = getPmvRecordsInWindow(selectedPmvDashboardDate || getLatestPmvReportDate(), 30)
    .filter(recordMatchesPmvMachineFilter)
    .filter(recordMatchesPmvStatusFilter);
  const riskyItems = PMV_CHECKLIST_ITEMS.flatMap((item) =>
    records
      .filter((record) => record.checklist?.[item.key] === "Kurang Baik")
      .map(() => item.label),
  );
  const counts = countByValue(riskyItems);
  renderPmvRankList(dom.pmvChecklistRisk, counts, "No Kurang Baik checklist item in the last 30 days.");
}

function renderPmvDashboardTable(records) {
  const visibleRecords = [...records].sort(sortPmvRecordsDescending).slice(0, 30);
  dom.pmvDashboardTableHead.innerHTML = `
    <tr>
      <th>Date</th>
      <th>Machine</th>
      <th>Status</th>
      <th>Reporter</th>
      <th>Issue / Action</th>
      <th>Notes</th>
    </tr>
  `;
  dom.pmvDashboardTableBody.innerHTML = visibleRecords.length
    ? visibleRecords
        .map(
          (record) => `
            <tr>
              <td>${formatDate(record.reportDate, "No date")}</td>
              <td><strong>${escapeHtml(getPmvMachineLabel(record))}</strong></td>
              <td><span class="pmv-status-pill pmv-status-${record.machineStatus}">${escapeHtml(PMV_STATUS_LABELS[record.machineStatus])}</span></td>
              <td>${escapeHtml(record.reporterName || "-")}</td>
              <td>${escapeHtml(getPmvActionReasons(record).join(", ") || "No issue reported")}</td>
              <td>${escapeHtml(record.assistantNotes || "-")}</td>
            </tr>
          `,
        )
        .join("")
    : `<tr><td colspan="6" class="pmv-dashboard-empty">No PMV records match the selected filters.</td></tr>`;
}

function renderPmvRankList(container, counts, emptyMessage) {
  const rows = topValuesFromMap(counts, 8);
  if (!rows.length) {
    container.innerHTML = `<div class="pmv-dashboard-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }
  const max = Math.max(...rows.map((row) => row.count), 1);
  container.innerHTML = rows
    .map(
      (row) => `
        <div class="pmv-rank-row">
          <span>${escapeHtml(row.label)}</span>
          <div><i style="width:${(row.count / max) * 100}%"></i></div>
          <strong>${row.count}</strong>
        </div>
      `,
    )
    .join("");
}

function getLatestPmvReportDate() {
  const dates = state.pmvRecords
    .map((record) => record.reportDate || getDatePart(record.completionTime || record.updatedAt || record.startTime))
    .filter(isIsoDate)
    .sort();
  return dates[dates.length - 1] || todayDate();
}

function getPmvMachineFilterValues() {
  const values = new Set();
  state.pmvRecords.forEach((record) => {
    if (record.machineNumber) values.add(record.machineNumber);
  });
  return [...values].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function getPmvDashboardRecords() {
  return state.pmvRecords.filter(
    (record) =>
      record.reportDate === selectedPmvDashboardDate &&
      recordMatchesPmvMachineFilter(record) &&
      recordMatchesPmvStatusFilter(record),
  );
}

function recordMatchesPmvMachineFilter(record) {
  return !selectedPmvDashboardMachine || record.machineNumber === selectedPmvDashboardMachine;
}

function recordMatchesPmvStatusFilter(record) {
  return !selectedPmvDashboardStatus || record.machineStatus === selectedPmvDashboardStatus;
}

function countUniquePmvMachines(records) {
  return new Set(records.map(getPmvMachineLabel)).size;
}

function hasPmvActionIssue(record) {
  return (
    record.machineStatus === "breakdown" ||
    record.machineStatus === "idle" ||
    record.ipsBattery === "No" ||
    PMV_CHECKLIST_ITEMS.some((item) => record.checklist?.[item.key] === "Kurang Baik")
  );
}

function sortPmvActionRecords(a, b) {
  const severity = {
    breakdown: 0,
    idle: 1,
    working: 2,
  };
  return (
    (severity[a.machineStatus] ?? 3) - (severity[b.machineStatus] ?? 3) ||
    getPmvMachineLabel(a).localeCompare(getPmvMachineLabel(b), undefined, { numeric: true }) ||
    new Date(b.completionTime || b.updatedAt || b.reportDate || 0) - new Date(a.completionTime || a.updatedAt || a.reportDate || 0)
  );
}

function getPmvActionReasons(record) {
  if (record.machineStatus === "breakdown") {
    return record.damagedComponents.length ? record.damagedComponents : ["Breakdown - component not captured"];
  }
  if (record.machineStatus === "idle") {
    return [record.idleReason || "Idle - reason not captured"];
  }

  const reasons = [];
  if (record.ipsBattery === "No") reasons.push("IPS Battery >13v: No");
  PMV_CHECKLIST_ITEMS.forEach((item) => {
    if (record.checklist?.[item.key] === "Kurang Baik") reasons.push(item.label);
  });
  return reasons;
}

function countByValue(values) {
  return values.reduce((counts, value) => {
    const label = String(value || "").trim();
    if (!label) return counts;
    counts.set(label, (counts.get(label) || 0) + 1);
    return counts;
  }, new Map());
}

function topValues(values, limit = 8) {
  return topValuesFromMap(countByValue(values), limit);
}

function topValuesFromMap(counts, limit = 8) {
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, undefined, { numeric: true }))
    .slice(0, limit);
}

function getDateWindow(endDate, dayCount) {
  const end = isIsoDate(endDate) ? parseIsoDate(endDate) : parseIsoDate(todayDate());
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (dayCount - 1 - index));
    return toIsoDateString(date);
  });
}

function getPmvRecordsInWindow(endDate, dayCount) {
  const dates = new Set(getDateWindow(endDate, dayCount));
  return state.pmvRecords.filter((record) => dates.has(record.reportDate));
}

function groupBy(items, keyGetter) {
  return items.reduce((groups, item) => {
    const key = keyGetter(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
    return groups;
  }, new Map());
}

function getPmvMachineLabel(record) {
  return record.machineNumber || "Machine not captured";
}

function formatShortDate(dateKey) {
  if (!isIsoDate(dateKey)) return dateKey || "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
  }).format(parseIsoDate(dateKey));
}

function getDatePart(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  const isoMatch = text.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : toIsoDateString(parsed);
}

function downloadPmvDashboardExport() {
  const records = getPmvDashboardRecords().sort(sortPmvRecordsDescending);
  if (!records.length) {
    showToast("No PMV dashboard data available to export.");
    return;
  }

  const headers = getPmvExportHeaders();
  const csv = [
    headers,
    ...records.map((record) => {
      const row = toPmvExportRow(record);
      return headers.map((header) => row[header]);
    }),
  ]
    .map((row) => row.map(csvEscape).join(","))
    .join("\n");

  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `pmv-dashboard-${selectedPmvDashboardDate || "all"}${selectedPmvDashboardMachine ? `-${normaliseKey(selectedPmvDashboardMachine)}` : ""}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast("PMV dashboard export downloaded.");
}

function getPmvExportHeaders() {
  return [
    "ID",
    "Start time",
    "Completion time",
    "Email",
    "Name",
    "Last modified time",
    "Piih nama anda",
    "Pilih Mesin Anda",
    "Status Mesin2",
    "IPS Battery Voltmeter >13v",
    ...PMV_CHECKLIST_ITEMS.map(formatPmvChecklistHeader),
    "Catatan untuk Tuan Assistant",
    "Component rosak (Mesin Rusak)",
    "Machine Idle",
  ];
}

function toPmvExportRow(record) {
  const row = {
    ID: record.originalId || record.id,
    "Start time": formatPmvExportDateTime(record.startTime),
    "Completion time": formatPmvExportDateTime(record.completionTime || record.updatedAt),
    Email: record.email || "",
    Name: record.formName || "",
    "Last modified time": formatPmvExportDateTime(record.lastModifiedTime),
    "Piih nama anda": record.reporterName || "",
    "Pilih Mesin Anda": record.machineNumber || "",
    "Status Mesin2": PMV_STATUS_LABELS[record.machineStatus] || record.machineStatus || "",
    "IPS Battery Voltmeter >13v": record.ipsBattery || "",
    "Catatan untuk Tuan Assistant": record.assistantNotes || "",
    "Component rosak (Mesin Rusak)": record.damagedComponents.join("; "),
    "Machine Idle": record.idleReason || "",
  };
  PMV_CHECKLIST_ITEMS.forEach((item) => {
    row[formatPmvChecklistHeader(item)] = record.checklist?.[item.key] || "";
  });
  return row;
}

function formatPmvChecklistHeader(item) {
  return item.detail ? `${item.label} (${item.detail})` : item.label;
}

function formatPmvExportDateTime(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace("T", " ");
}

function renderPmvStaticOptions() {
  renderPmvChoiceOptions(dom.pmvReporterOptions, "pmvReporterName", PMV_REPORTER_OPTIONS, "pmvReporterOther", "Nama lain");
  renderPmvChoiceOptions(dom.pmvMachineOptions, "pmvMachineNumber", PMV_MACHINE_OPTIONS, "pmvMachineOther", "Mesin lain");
  renderPmvChecklistOptions();
  renderPmvChoiceOptions(dom.pmvDamagedComponentOptions, "pmvDamagedComponent", PMV_DAMAGE_COMPONENT_OPTIONS, "pmvDamagedComponentOther", "Komponen lain", {
    type: "checkbox",
  });
  renderPmvChoiceOptions(dom.pmvIdleReasonOptions, "pmvIdleReason", PMV_IDLE_REASON_OPTIONS, "pmvIdleReasonOther", "Sebab lain");
  updatePmvOtherInputs();
}

function renderPmvChoiceOptions(container, name, options, otherId, otherPlaceholder, config = {}) {
  if (container.children.length) return;
  const type = config.type || "radio";
  container.innerHTML = options
    .map((option) => {
      const isOther = option === "Other";
      return `
        <label class="pmv-list-option ${isOther ? "pmv-other-option" : ""}">
          <input type="${type}" name="${escapeHtml(name)}" value="${escapeHtml(option)}" />
          <span>${escapeHtml(option)}</span>
          ${
            isOther
              ? `<input class="pmv-other-input" id="${escapeHtml(otherId)}" type="text" placeholder="${escapeHtml(otherPlaceholder)}" disabled />`
              : ""
          }
        </label>
      `;
    })
    .join("");
}

function renderPmvChecklistOptions() {
  if (dom.pmvChecklist.children.length) return;
  dom.pmvChecklist.innerHTML = `
    <div class="pmv-checklist-header">
      <span></span>
      <span>Baik</span>
      <span>Kurang Baik</span>
    </div>
    ${PMV_CHECKLIST_ITEMS.map(
      (item) => `
        <div class="pmv-checklist-row">
          <div class="pmv-check-name">
            <strong>${escapeHtml(item.label)}</strong>
            ${item.detail ? `<em>(${escapeHtml(item.detail)})</em>` : ""}
          </div>
          <label class="pmv-check-choice">
            <input type="radio" name="${escapeHtml(item.inputName)}" value="Baik" checked />
            <span>Baik</span>
          </label>
          <label class="pmv-check-choice">
            <input type="radio" name="${escapeHtml(item.inputName)}" value="Kurang Baik" />
            <span>Kurang Baik</span>
          </label>
        </div>
      `,
    ).join("")}
  `;
}

function handlePmvFormChange(event) {
  if (event.target.name === "pmvMachineStatus") renderPmvStatusFields();
  if (event.target.matches('input[type="radio"], input[type="checkbox"]')) updatePmvOtherInputs();
}

function renderPmvTracker() {
  renderPmvStaticOptions();
  if (!dom.pmvReportDate.value) dom.pmvReportDate.value = todayDate();
  renderPmvStatusFields();
  renderPmvRecords();
  updatePmvOtherInputs();
}

function renderPmvStatusFields() {
  const status = getPmvMachineStatus();
  [dom.pmvWorkingFields, dom.pmvBreakdownFields, dom.pmvIdleFields].forEach((section) => {
    section.classList.toggle("hidden", section.dataset.pmvStatusSection !== status);
  });
}

async function savePmvRecord(event) {
  event.preventDefault();
  clearFieldErrors();
  clearPmvGroupErrors();

  const status = getPmvMachineStatus();
  const existingRecord = state.pmvRecords.find((record) => record.id === dom.pmvRecordId.value);
  const submittedAt = new Date().toISOString();
  const data = {
    id: dom.pmvRecordId.value || createId(),
    source: PMV_DRIVER_SOURCE,
    originalId: existingRecord?.originalId || "",
    startTime: existingRecord?.startTime || submittedAt,
    completionTime: submittedAt,
    email: existingRecord?.email || "",
    formName: existingRecord?.formName || "",
    lastModifiedTime: "",
    reporterName: getPmvRadioValueWithOther("pmvReporterName", "pmvReporterOther"),
    reportDate: dom.pmvReportDate.value,
    machineType: "",
    machineNumber: getPmvRadioValueWithOther("pmvMachineNumber", "pmvMachineOther"),
    machineStatus: status,
    ipsBattery: status === "working" ? getPmvRadioValue("pmvIpsBattery") : "",
    checklist: status === "working" ? getPmvChecklistValues() : getDefaultPmvChecklist(),
    damagedComponents: status === "breakdown" ? getPmvCheckedValuesWithOther("pmvDamagedComponent", "pmvDamagedComponentOther") : [],
    idleReason: status === "idle" ? getPmvRadioValueWithOther("pmvIdleReason", "pmvIdleReasonOther") : "",
    assistantNotes: dom.pmvAssistantNotes.value.trim(),
    updatedAt: submittedAt,
  };

  const errors = validatePmvRecord(data);
  if (errors.length) {
    errors.forEach(({ field, message, group }) => {
      if (field) {
        setFieldError(field, message);
      } else {
        setPmvGroupError(group, message);
      }
    });
    showToast("Please complete the required PMV fields.");
    return;
  }

  let normalized = normalizePmvRecord(data);
  let savedToSupabase = false;

  if (window.digitalEstateApi?.upsertPmvRecord) {
    try {
      const remoteRecord = await window.digitalEstateApi.upsertPmvRecord(normalized);
      normalized = normalizePmvRecord(remoteRecord) || normalized;
      savedToSupabase = true;
    } catch (error) {
      console.warn("PMV Supabase save unavailable:", error.message);
    }
  }

  const existingIndex = state.pmvRecords.findIndex((record) => record.id === normalized.id);
  if (existingIndex >= 0) {
    state.pmvRecords[existingIndex] = normalized;
  } else {
    state.pmvRecords.unshift(normalized);
  }

  persist();
  selectedPmvDashboardDate = normalized.reportDate;
  selectedPmvDashboardMachine = "";
  selectedPmvDashboardStatus = "";
  renderAll();
  resetPmvForm();
  showToast(savedToSupabase ? "PMV record saved to Supabase." : "PMV record saved locally. Supabase sync unavailable.");
}

function validatePmvRecord(data) {
  const errors = [];
  if (!data.reporterName) errors.push({ group: "reporter", message: "Select your name." });
  if (!data.reportDate) errors.push({ field: dom.pmvReportDate, message: "Select date." });
  if (!data.machineNumber) errors.push({ group: "machine", message: "Select your machine." });
  if (data.machineStatus === "working" && !data.ipsBattery) errors.push({ group: "ipsBattery", message: "Select Yes or No." });
  if (data.machineStatus === "breakdown" && !data.damagedComponents.length) {
    errors.push({ group: "damagedComponents", message: "Select at least one damaged component." });
  }
  if (data.machineStatus === "idle" && !data.idleReason) errors.push({ group: "idleReason", message: "Select idle reason." });
  return errors;
}

function getPmvMachineStatus() {
  return dom.pmvForm.querySelector('input[name="pmvMachineStatus"]:checked')?.value || "working";
}

function getPmvRadioValue(name) {
  return dom.pmvForm.querySelector(`input[name="${name}"]:checked`)?.value || "";
}

function getPmvRadioValueWithOther(name, otherInputId) {
  const value = getPmvRadioValue(name);
  if (value !== "Other") return value;
  return document.querySelector(`#${otherInputId}`)?.value.trim() || "";
}

function getPmvChecklistValues() {
  return PMV_CHECKLIST_ITEMS.reduce((values, item) => {
    values[item.key] = dom.pmvForm.querySelector(`input[name="${item.inputName}"]:checked`)?.value || "Baik";
    return values;
  }, {});
}

function getCheckedValues(name) {
  return [...dom.pmvForm.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function getPmvCheckedValuesWithOther(name, otherInputId) {
  return getCheckedValues(name)
    .map((value) => (value === "Other" ? document.querySelector(`#${otherInputId}`)?.value.trim() || "" : value))
    .filter(Boolean);
}

function updatePmvOtherInputs() {
  [
    ["pmvReporterName", "pmvReporterOther"],
    ["pmvMachineNumber", "pmvMachineOther"],
    ["pmvIdleReason", "pmvIdleReasonOther"],
  ].forEach(([name, inputId]) => {
    const input = document.querySelector(`#${inputId}`);
    if (!input) return;
    const isOtherSelected = getPmvRadioValue(name) === "Other";
    input.disabled = !isOtherSelected;
    if (!isOtherSelected) input.value = "";
  });

  const componentOtherInput = document.querySelector("#pmvDamagedComponentOther");
  const componentOtherSelected = Boolean(dom.pmvForm.querySelector('input[name="pmvDamagedComponent"][value="Other"]:checked'));
  if (componentOtherInput) {
    componentOtherInput.disabled = !componentOtherSelected;
    if (!componentOtherSelected) componentOtherInput.value = "";
  }
}

function clearPmvGroupErrors() {
  dom.pmvReporterError.textContent = "";
  dom.pmvMachineError.textContent = "";
  dom.pmvIpsBatteryError.textContent = "";
  dom.pmvDamagedComponentError.textContent = "";
  dom.pmvIdleReasonError.textContent = "";
}

function setPmvGroupError(group, message) {
  const targets = {
    reporter: dom.pmvReporterError,
    machine: dom.pmvMachineError,
    ipsBattery: dom.pmvIpsBatteryError,
    damagedComponents: dom.pmvDamagedComponentError,
    idleReason: dom.pmvIdleReasonError,
  };
  if (targets[group]) targets[group].textContent = message;
}

function renderPmvRecords() {
  const records = [...state.pmvRecords].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  dom.pmvRecordCount.textContent = `${records.length} record${records.length === 1 ? "" : "s"}`;
  if (!records.length) {
    dom.pmvRecordList.innerHTML = `
      <div class="empty-state pmv-empty-state">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h10" />
        </svg>
        <strong>No PMV records yet</strong>
        <p>Submitted PMV machine checks will appear here.</p>
      </div>
    `;
    return;
  }

  dom.pmvRecordList.innerHTML = records.slice(0, 8).map(renderPmvRecordCard).join("");
}

function renderPmvRecordCard(record) {
  const statusClass = `pmv-status-${record.machineStatus}`;
  const detail = getPmvRecordDetail(record);
  const deleteButton = isPmvHistoricalRecord(record)
    ? ""
    : `
      <button class="icon-button danger" type="button" data-pmv-action="delete" data-id="${escapeHtml(record.id)}" title="Delete PMV record" aria-label="Delete PMV record">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 7h12" />
          <path d="M9 7V5h6v2" />
          <path d="M9 11v6" />
          <path d="M15 11v6" />
          <path d="M8 7l1 13h6l1-13" />
        </svg>
      </button>
    `;
  return `
    <article class="pmv-record-card">
      <div class="pmv-record-main">
        <span class="pmv-status-pill ${statusClass}">${escapeHtml(PMV_STATUS_LABELS[record.machineStatus])}</span>
        <strong>${escapeHtml(getPmvMachineLabel(record))}</strong>
        <span>${escapeHtml(record.reporterName)} | ${formatDate(record.reportDate, "No date")}</span>
        <p>${escapeHtml(detail)}</p>
      </div>
      ${deleteButton}
    </article>
  `;
}

function getPmvRecordDetail(record) {
  if (record.machineStatus === "working") {
    const faultyItems = PMV_CHECKLIST_ITEMS.filter((item) => record.checklist[item.key] === "Kurang Baik").map((item) => item.label);
    if (faultyItems.length) return `IPS Battery >13v: ${record.ipsBattery || "Not captured"}; Kurang Baik: ${faultyItems.join(", ")}`;
    return record.ipsBattery ? `IPS Battery >13v: ${record.ipsBattery}; checklist all Baik` : "No issue reported";
  }
  if (record.machineStatus === "breakdown") return `Component rosak: ${record.damagedComponents.join(", ") || "Not captured"}`;
  return `Idle: ${record.idleReason || "Not captured"}`;
}

function handlePmvRecordActionClick(event) {
  const button = event.target.closest("[data-pmv-action][data-id]");
  if (!button) return;
  if (button.dataset.pmvAction === "delete") deletePmvRecord(button.dataset.id);
}

async function deletePmvRecord(id) {
  const record = state.pmvRecords.find((item) => item.id === id);
  if (!record) return;
  if (isPmvHistoricalRecord(record)) {
    showToast("Historical PMV records are kept as source data.");
    return;
  }
  const confirmed = confirm(`Delete PMV record for ${getPmvMachineLabel(record)}?`);
  if (!confirmed) return;
  if (window.digitalEstateApi?.deletePmvRecord) {
    try {
      await window.digitalEstateApi.deletePmvRecord(id);
    } catch (error) {
      console.warn("PMV Supabase delete unavailable:", error.message);
    }
  }
  state.pmvRecords = state.pmvRecords.filter((item) => item.id !== id);
  persist();
  renderAll();
  showToast("PMV record deleted.");
}

function resetPmvForm() {
  dom.pmvForm.reset();
  dom.pmvRecordId.value = "";
  dom.pmvReportDate.value = todayDate();
  dom.pmvForm.querySelector('input[name="pmvMachineStatus"][value="working"]').checked = true;
  PMV_CHECKLIST_ITEMS.forEach((item) => {
    const input = dom.pmvForm.querySelector(`input[name="${item.inputName}"][value="Baik"]`);
    if (input) input.checked = true;
  });
  clearFieldErrors();
  clearPmvGroupErrors();
  renderPmvStatusFields();
}
