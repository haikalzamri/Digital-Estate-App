import { machineValid, machineSummary } from "@/lib/machine";
import { warehouseStock, warehouseValid } from "@/lib/warehouse";
import { checkrollValid, checkrollSummary } from "@/lib/checkroll";
import { musterFor, musterValid, type HarvestType, type MusterData } from "@/lib/muster-chit";
import musterScenario from "@/data/scenarios/muster-chit.json";
import { completionSessionValid, secondaryJobsValid, programmesForSession, harvestForSession, latestReport, validatedReport } from "@/lib/work-completion";
import { HARVEST_ACTIVITY, harvestFieldNames, harvestingFieldArea } from "@/lib/harvesting-interval";
import { programmes, nextRound, programmeSummary, roundActual, WORKSHOP_YEAR, type Programme } from "@/lib/work-programme";
export { programmes };
export type { Programme };
import gangSource from "@/data/reference/gangs.json";
import employeeSource from "@/data/reference/employees.json";
import activitySource from "@/data/reference/activities.json";
import fieldSource from "@/data/reference/fields.json";
import machineSource from "@/data/reference/machines.json";
import materialSource from "@/data/reference/materials-sample.json";
import storeSource from "@/data/reference/storage-locations.json";
import machineState from "@/data/scenarios/machine-status.json";
import stockSource from "@/data/scenarios/material-stock.json";

export type ViewMode = "web" | "phone" | "workshop";
export type ManagementRole = "Assistant Manager" | "Manager" | "Field Officer";
export type OfficeRole = ManagementRole | "Store Clerk";
export type PhoneRole = OfficeRole | "Upkeep Mandor" | "Harvesting Mandor" | "Machine Operator" | "Machine Specialist";
export const isManagement = (role: string): role is ManagementRole => ["Assistant Manager","Field Officer","Manager"].includes(role);
export type Attendance = "Present" | "Absent" | "Unconfirmed";
export type PlanStatus = "Draft" | "Submitted" | "Approved" | "Dispatched";
export type PlanItem = { remark?: string; workCategory?: WorkKind; instructionOrigin?: "preplan" | "onsite"; harvestType?: HarvestType; intendedGangs?: string[]; planningSource?: "harvesting-interval" | "general" | "daily-work"; groupId?: string; id: string; programmeId: string | null; programmeRound?: number; programmeYear?: number; activityCode: string; fieldNo: string; targetHa: number; workerIds: string[]; startTime: string; endTime: string; evitCode: string; materialCode: string; storageLocation: string; materialQuantity: number };
export type WorkerAllocation = { groupKey: string; workerId: string; evitCode: string };
export type ProgrammeGroup = { kind: WorkKind; key: string; title: string; activityCode: string; programmeId: string | null; items: PlanItem[]; workers: WorkerAllocation[] };
export type Ticket = { id: string; itemId: string; workerIds: string[]; recipient: "Upkeep Mandor" | "Harvesting Mandor"; status: "Assigned" | "Accepted" };
export type Event = { id: number; title: string; detail: string; role: string; clock: string };
export type SharedPlanVersion = { version: number; sequence: number; date: string; reason: string; items: PlanItem[]; workers: WorkerAllocation[]; muster?: MusterData };
export type DailyRecord = { clock?: Session["clock"]; plan: Session["plan"]; morning?: import("./morning-work").MorningWork };
export type Session = { machine?: import("./machine").MachineData; warehouse?: import("./warehouse").WarehouseData; days?: DailyRecord[]; completions?: import("./work-completion").CompletedWork[]; morning?: import("./morning-work").MorningWork; version: 1; sequence: number; readSequence: number; clock: "office" | "muster" | "field" | "completion"; plan: { workDraft?: PlanItem[]; muster?: MusterData; sharedVersions?: SharedPlanVersion[]; amendmentReason?: string; id: string; date: string; status: PlanStatus; items: PlanItem[]; workerAllocations?: WorkerAllocation[]; baselineWorkers?: WorkerAllocation[] | null; attendance: Record<string, Attendance>; tickets: Ticket[]; returnReason: string; baseline: PlanItem[] | null }; events: Event[] };

const employeeCounts = new Map<string, number>();
employeeSource.records.forEach((r) => employeeCounts.set(r.employeeId, (employeeCounts.get(r.employeeId) || 0) + 1));
export const workers = employeeSource.records.filter((r, i, a) => a.findIndex((w) => w.employeeId === r.employeeId) === i).map((r) => ({
  id: r.employeeId, name: employeeCounts.get(r.employeeId)! > 1 ? "Identity needs review" : r.employeeName,
  harvestingCode: r.harvestingCode, gang: r.gangNo, gangDescription: r.gangDescription, needsReview: employeeCounts.get(r.employeeId)! > 1,
}));
export const gangs = gangSource.records.map((g) => g.gangNo).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
export const gangDescription = (gang: string) => gangSource.records.find((g) => g.gangNo === gang)?.description || "Gang " + gang;
export function intendedGangs(item: PlanItem) {
  return item.intendedGangs ?? (workKind(item) === "harvesting" ? ["3", "4", "5"] : ["21", "23", "24"]);
}
export function setIntendedGangs(s: Session, key: string, selected: string[]): Session {
  requireDraft(s);
  if (selected.some((g) => !gangs.includes(g))) throw new Error("Choose a gang from the master list.");
  return { ...s, plan: { ...s.plan, items: s.plan.items.map((i) => activityGroupKey(i) === key ? { ...i, intendedGangs: [...new Set(selected)] } : i) } };
}
export function gangAllocationIssues(s: Session, key?: string) {
  const items = s.plan.items.filter((i) => !key || activityGroupKey(i) === key);
  const roster = planWorkers(s).filter((w) => !key || w.groupKey === key);
  return [...new Set([
    ...items.filter((i) => !i.workerIds.length).map((i) => "Gang allocation pending for field " + i.fieldNo + "."),
    ...roster.filter((w) => !items.some((i) => activityGroupKey(i) === w.groupKey && i.workerIds.includes(w.workerId))).map((w) => "Choose a field for " + workerName(w.workerId) + "."),
    ...items.filter((i) => i.evitCode && !fieldDrivers(s, i).some((w) => w.evitCode === i.evitCode)).map((i) => "Driver pending for " + i.evitCode + " in field " + i.fieldNo + ".")
  ])];
}
export const activities = [...activitySource.records.map((r) => ({ code: r.activityCode, name: r.description })), ...musterScenario.activities.filter((a) => !activitySource.records.some((r) => r.activityCode === a.code))];
export const fields = fieldSource.records.map((r) => ({ fieldNo: r.fieldNo, division: r.division })).sort((a, b) => a.fieldNo.localeCompare(b.fieldNo, undefined, { numeric: true }));
export const machines = machineSource.records.map((r) => ({ code: r.evitCode, name: r.description, ...machineState.records.find((m) => m.evitCode === r.evitCode)! }));
export const materials = materialSource.records.map((r) => ({ code: r.materialCode, name: r.description, category: r.category }));
export const categories = [...new Set(materials.map((r) => r.category))];
export const stores = storeSource.records.filter((r) => r.estateCode === "E063").map((r) => ({ code: r.storageLocation, name: r.description }));
export const stocks = stockSource.records;
export const STORAGE_KEY = "dex-workshop-screen-v1";

export const formatHa = (n: number) => n.toLocaleString("en-MY", { maximumFractionDigits: 2 });
export const activityName = (code: string) => activities.find((r) => r.code === code)?.name || code;
export const workerName = (id: string) => workers.find((r) => r.id === id)?.name || id;
export const formatDate = (date: string, short = false) => { const value = new Date(date + "T12:00:00Z"); return Number.isFinite(value.getTime()) ? new Intl.DateTimeFormat("en-MY", { day: "numeric", month: short ? "short" : "long", year: "numeric", timeZone: "UTC" }).format(value) : "Choose an execution date"; };
export const stockFor = (item: Pick<PlanItem,"materialCode"|"storageLocation">, session?: Session) => (session ? warehouseStock(session) : stocks).find((r) => r.estateCode === "E063" && r.materialCode === item.materialCode && r.storageLocation === item.storageLocation);

export const activityGroupKey = (item: Pick<PlanItem, "groupId" | "programmeId" | "activityCode">) => item.groupId || item.programmeId || "manual:" + item.activityCode;
export function planWorkers(s: Session): WorkerAllocation[] {
  if (s.plan.workerAllocations) return s.plan.workerAllocations;
  const result: WorkerAllocation[] = [];
  for (const item of s.plan.items) for (const id of item.workerIds) {
    const groupKey = activityGroupKey(item);
    if (!result.some((w) => w.groupKey === groupKey && w.workerId === id)) result.push({ groupKey, workerId: id, evitCode: "" });
  }
  return result;
}
export function programmeGroups(s: Session): ProgrammeGroup[] {
  const keys = [...new Set(s.plan.items.map(activityGroupKey))];
  const roster = planWorkers(s);
  return keys.map((key) => {
    const items = s.plan.items.filter((i) => activityGroupKey(i) === key);
    const first = items[0];
    return { key, kind: workKind(first), title: first.planningSource === "harvesting-interval" ? first.harvestType === "LF" ? "Loose fruit" : first.harvestType === "Support" ? "Harvesting support" : "Harvesting" : programmes.find((p) => p.id === first.programmeId)?.title || (first.activityCode ? activityName(first.activityCode) : "General work"), activityCode: first.activityCode, programmeId: first.programmeId, items, workers: roster.filter((w) => w.groupKey === key) };
  });
}
export const assignedWorkerIds = (s: Session) => [...new Set([...planWorkers(s).map((w) => w.workerId), ...s.plan.items.flatMap((i) => i.workerIds)])];
export const fieldDrivers = (s: Session, item: PlanItem) => planWorkers(s).filter((w) => w.groupKey === activityGroupKey(item) && w.evitCode && item.workerIds.includes(w.workerId));
export const fieldMachines = (s: Session, item: PlanItem) => [...new Set([item.evitCode, ...fieldDrivers(s, item).map((w) => w.evitCode), ...(s.plan.muster?.evits || []).filter((e) => e.itemIds.includes(item.id)).map((e) => e.evitCode)].filter(Boolean))];
export function recommendationStatus(p: Programme) { return programmeSummary(p).status; }
export function makeItem(id: string, programme?: Programme, fieldNo?: string): PlanItem {
  const field = programme?.fields.find((f) => f.fieldNo === (fieldNo || programme.fields[0].fieldNo));
  const round = field ? nextRound(field) : undefined;
  return { id, programmeId: programme?.id || null, ...(round ? { programmeRound: round.number, programmeYear: WORKSHOP_YEAR } : {}), activityCode: programme?.activityCode || "PF3001", fieldNo: field?.fieldNo || "02D1", targetHa: 0, workerIds: [], startTime: "07:00", endTime: "12:00", evitCode: "", materialCode: "", storageLocation: "SR01", materialQuantity: 0 };
}
export function createSession(preset: "normal" | "muster" | "blank" = "normal"): Session {
  const item = makeItem("ITEM-1", programmes[0]);
  item.intendedGangs = ["24"]; item.evitCode = "MB001";
  item.targetHa = 12; item.materialCode = "1300000148"; item.materialQuantity = 250;
  const roster: WorkerAllocation[] = [];
  const initial: Session = { version: 1, sequence: 1, readSequence: 0, clock: preset === "muster" ? "muster" : "office",
    plan: { id: "DP-181026-001", date: "2026-10-18", status: preset === "muster" ? "Submitted" : "Draft", items: preset === "blank" ? [] : [item], workerAllocations: roster, baselineWorkers: preset === "muster" ? structuredClone(roster) : null, attendance: {}, tickets: [], returnReason: "", baseline: preset === "muster" ? structuredClone([item]) : null },
    events: [{ id: 1, title: preset === "blank" ? "Blank plan ready" : preset === "muster" ? "Shared pre-plan ready for muster" : "Workshop starting point loaded", detail: preset === "blank" ? "Browse programmes and collect tomorrow’s fields." : "Familiar E063 references with illustrative planning values.", role: "Workshop", clock: preset === "muster" ? "06:30" : "15:30" }] };
  if (preset !== "blank") { initial.plan.muster = musterFor(initial); initial.plan.muster.lines[0].plannedPax = 5; }
  return initial;
}
export function withEvent(s: Session, title: string, detail: string, role: string): Session {
  const sequence = s.sequence + 1;
  return { ...s, sequence, events: [{ id: sequence, title, detail, role, clock: s.clock === "office" ? "15:30" : s.clock === "muster" ? "06:30" : s.clock === "completion" ? "17:00" : "07:00" }, ...s.events].slice(0, 80) };
}
function requireDraft(s: Session) {
  if (s.plan.status !== "Draft") throw new Error("Choose Amend pre-plan to make and share a revision.");
}
export function overlap(a: PlanItem, b: PlanItem) { return a.startTime < b.endTime && b.startTime < a.endTime; }
const availableMachine = (code: string) => machines.some((m) => m.code === code && m.planningAvailability === "available" && m.pmvStatus !== "breakdown");
/** Allocation readiness is independent of material requests and legacy planning times. */
export function peopleActivityIssues(s: Session, groupKey?: string): string[] {
  const errors: string[] = [];
  const items = s.plan.items.filter((i) => !groupKey || activityGroupKey(i) === groupKey);
  if (!groupKey && (!/^\d{4}-\d{2}-\d{2}$/.test(s.plan.date) || !Number.isFinite(Date.parse(s.plan.date + "T12:00:00Z")))) errors.push("Choose a valid execution date.");
  if (!items.length) errors.push("Add at least one activity.");
  for (const i of items) {
    if (!activities.some((a) => a.code === i.activityCode)) errors.push("Choose an activity code.");
    if (i.fieldNo ? !fields.some((f) => f.fieldNo === i.fieldNo) : workKind(i) !== "general") errors.push("Choose a field for " + activityName(i.activityCode) + ".");
    if ((workKind(i) !== "general" && i.harvestType !== "Support" && !(i.targetHa > 0)) || i.targetHa < 0 || !Number.isFinite(i.targetHa)) errors.push("Enter planned Ha for field " + i.fieldNo + ".");
    if (i.evitCode && !availableMachine(i.evitCode)) errors.push("Choose an available EVIT.");
  }
  return [...new Set(errors)];
}
export function materialIssues(s: Session, groupKey?: string): string[] {
  return [...new Set(s.plan.items.filter((i) => !groupKey || activityGroupKey(i) === groupKey).flatMap((i) => {
    if (!i.materialCode) return [];
    if (!materials.some((m) => m.code === i.materialCode) || !stores.some((store) => store.code === i.storageLocation)) return ["Choose a material and store for field " + i.fieldNo + "."];
    return i.materialQuantity > 0 && Number.isFinite(i.materialQuantity) ? [] : ["Enter the requested material quantity for field " + i.fieldNo + "."];
  }))];
}
export const planIssues = (s: Session) => [...peopleActivityIssues(s), ...materialIssues(s)];

export type FieldProgress = { label: string; completed: number | null; total: number; remaining: number | null; percent: number; pending: number };
export function fieldProgress(s: Session, item: PlanItem): FieldProgress | null {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const field = programmesForSession(s).find((p) => p.id === item.programmeId)?.fields.find((f) => f.fieldNo === item.fieldNo);
  const round = field && (!item.programmeYear || item.programmeYear === WORKSHOP_YEAR) ? item.programmeRound ? field.rounds.find((r) => r.number === item.programmeRound) : nextRound(field) : undefined;
  if (round) {
    const completed = roundActual(round), total = round.targetHa;
    const pending = round2((s.completions || []).filter((w) => w.programmeId === item.programmeId && w.fieldNo === item.fieldNo && w.programmeRound === round.number && w.programmeYear === WORKSHOP_YEAR && latestReport(w)?.status === "Reported").reduce((sum, w) => sum + (latestReport(w)?.ha || 0) - (validatedReport(w)?.ha || 0), 0));
    return { label: "Round " + round.number + " completion", completed, total, remaining: round2(Math.max(0, total - completed)), percent: total > 0 ? Math.min(100, completed / total * 100) : 0, pending };
  }
  if (workKind(item) === "harvesting" && (!item.harvestType || item.harvestType === "FFB")) {
    const total = harvestingFieldArea(item.fieldNo);
    if (!total) return null;
    const records = harvestForSession(s).activityByField[item.fieldNo] || {};
    const date = Object.keys(records).filter((d) => d <= s.plan.date && records[d].hectare > 0).sort().at(-1);
    const completed = date ? records[date].hectare : 0;
    return { label: date ? "Latest recorded harvest · " + formatDate(date, true) : "No recorded harvest", completed, total, remaining: null, percent: Math.min(100, completed / total * 100), pending: 0 };
  }
  const total = field?.hectares || programmes.flatMap((p) => p.fields).find((f) => f.fieldNo === item.fieldNo)?.hectares || harvestingFieldArea(item.fieldNo);
  return total ? { label: "Field area · no programme progress", completed: null, total, remaining: null, percent: 0, pending: 0 } : null;
}
export function updateItem(s: Session, itemId: string, patch: Partial<PlanItem>): Session {
  requireDraft(s);
  const item = s.plan.items.find((i) => i.id === itemId);
  if (item?.planningSource === "general" && patch.fieldNo && s.plan.items.some((i) => i.id !== itemId && activityGroupKey(i) === activityGroupKey(item) && i.fieldNo === patch.fieldNo)) throw new Error("This field is already in the General work card.");
  return { ...s, plan: { ...s.plan, items: s.plan.items.map((i) => i.id === itemId ? { ...i, ...patch } : i) } };
}
export function addRecommendation(s: Session, programmeId: string, fieldNo?: string): Session {
  requireDraft(s);
  const p = programmesForSession(s).find((r) => r.id === programmeId);
  const field = p?.fields.find((f) => f.fieldNo === (fieldNo || p.fields[0].fieldNo));
  const round = field ? nextRound(field) : undefined;
  if (!p || !field || !round) throw new Error("Choose a field with outstanding programme work.");
  if (s.plan.items.some((i) => i.programmeId === programmeId && i.fieldNo === field.fieldNo && (i.programmeRound == null || i.programmeRound === round.number))) return s;
  const item = makeItem("ITEM-" + (s.sequence + s.plan.items.length + 1), p, field.fieldNo);
  const peer = s.plan.items.find((i) => activityGroupKey(i) === programmeId);
  if (peer) { item.startTime = peer.startTime; item.endTime = peer.endTime; if (peer.intendedGangs) item.intendedGangs = [...peer.intendedGangs]; }
  return withEvent({ ...s, plan: { ...s.plan, items: [...s.plan.items, item] } }, "Field added to tomorrow’s activities", p.title + " · " + field.fieldNo + " · Round " + round.number, "Assistant Manager");
}
export function removePlanField(s: Session, itemId: string): Session {
  requireDraft(s);
  const item = s.plan.items.find((i) => i.id === itemId);
  if (!item) return s;
  const items = s.plan.items.filter((i) => i.id !== itemId), key = activityGroupKey(item);
  const remains = items.some((i) => activityGroupKey(i) === key);
  return withEvent({ ...s, plan: { ...s.plan, items, workerAllocations: planWorkers(s).filter((w) => remains || w.groupKey !== key) } }, "Field removed from tomorrow’s activities", activityName(item.activityCode) + " · " + item.fieldNo, "Assistant Manager");
}
export function removeProgrammeGroup(s: Session, key: string): Session {
  requireDraft(s);
  return withEvent({ ...s, plan: { ...s.plan, items: s.plan.items.filter((i) => activityGroupKey(i) !== key), workerAllocations: planWorkers(s).filter((w) => w.groupKey !== key) } }, "Activity removed from daily plan", programmeGroups(s).find((g) => g.key === key)?.title || key, "Assistant Manager");
}
export function addProgrammeWorkers(s: Session, key: string, ids: string[]): Session {
  requireDraft(s);
  if (!s.plan.items.some((i) => activityGroupKey(i) === key)) throw new Error("Choose an activity with at least one field.");
  if (ids.some((id) => !workers.some((w) => w.id === id && !w.needsReview))) throw new Error("Use workers with unambiguous identities.");
  const roster = planWorkers(s), additions = [...new Set(ids)].filter((id) => !roster.some((w) => w.groupKey === key && w.workerId === id));
  if (!additions.length) return s;
  return withEvent({ ...s, plan: { ...s.plan, workerAllocations: [...roster, ...additions.map((workerId) => ({ groupKey: key, workerId, evitCode: "" }))] } }, "Workers added to activity", additions.length + " worker(s) · choose their fields next.", "Assistant Manager");
}
export function toggleWorkerField(s: Session, key: string, workerId: string, itemId: string): Session {
  requireDraft(s);
  const item = s.plan.items.find((i) => i.id === itemId && activityGroupKey(i) === key);
  const crew = planWorkers(s).find((w) => w.groupKey === key && w.workerId === workerId);
  if (!item || !crew) throw new Error("Add the worker to this activity first.");
  if (item.workerIds.includes(workerId)) return updateItem(s, itemId, { workerIds: item.workerIds.filter((id) => id !== workerId) });
  return updateItem(s, itemId, { workerIds: [...item.workerIds, workerId], evitCode: item.evitCode === crew.evitCode ? "" : item.evitCode });
}
export function assignAllProgrammeFields(s: Session, key: string, workerId: string): Session {
  requireDraft(s);
  let next = s;
  for (const item of s.plan.items.filter((i) => activityGroupKey(i) === key && !i.workerIds.includes(workerId))) next = toggleWorkerField(next, key, workerId, item.id);
  return next;
}
export function removeProgrammeWorker(s: Session, key: string, workerId: string): Session {
  requireDraft(s);
  return { ...s, plan: { ...s.plan, workerAllocations: planWorkers(s).filter((w) => !(w.groupKey === key && w.workerId === workerId)), items: s.plan.items.map((i) => activityGroupKey(i) === key ? { ...i, workerIds: i.workerIds.filter((id) => id !== workerId) } : i) } };
}
export function setWorkerMachine(s: Session, key: string, workerId: string, evitCode: string): Session {
  requireDraft(s);
  const roster = planWorkers(s);
  if (!roster.some((w) => w.groupKey === key && w.workerId === workerId)) throw new Error("Add this worker to the activity first.");
  if (evitCode) {
    if (!availableMachine(evitCode)) throw new Error("This machine is unavailable. Review its PMV and planning status.");
    const other = roster.find((w) => w.evitCode === evitCode && !(w.groupKey === key && w.workerId === workerId) && w.groupKey === key);
    if (other) throw new Error(evitCode + " is already assigned to " + workerName(other.workerId) + " in this activity.");
  }
  return { ...s, plan: { ...s.plan, workerAllocations: roster.map((w) => w.groupKey === key && w.workerId === workerId ? { ...w, evitCode } : w), items: s.plan.items.map((i) => activityGroupKey(i) === key && i.workerIds.includes(workerId) && i.evitCode === evitCode ? { ...i, evitCode: "" } : i) } };
}
export function setProgrammeWindow(s: Session, key: string, startTime: string, endTime: string): Session {
  requireDraft(s);
  return { ...s, plan: { ...s.plan, items: s.plan.items.map((i) => activityGroupKey(i) === key ? { ...i, startTime, endTime } : i) } };
}
export function toggleWorker(s: Session, itemId: string, id: string): Session {
  const item = s.plan.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Select a field first.");
  const key = activityGroupKey(item);
  return toggleWorkerField(addProgrammeWorkers(s, key, [id]), key, id, itemId);
}
export function submitPlan(s: Session): Session {
  requireDraft(s); const issues = planIssues(s); if (issues.length) throw new Error(issues[0]);
  const previous = sharedPlanVersions(s);
  const revision: SharedPlanVersion = { version: previous.length + 1, sequence: s.sequence + 1, date: s.plan.date,
    reason: s.plan.amendmentReason?.trim() || "Initial pre-plan shared", items: structuredClone(s.plan.items), workers: structuredClone(planWorkers(s)), muster: structuredClone(musterFor(s)) };
  return withEvent({ ...s, plan: { ...s.plan, status: "Submitted", muster: structuredClone(musterFor(s)), baseline: structuredClone(s.plan.items), baselineWorkers: structuredClone(planWorkers(s)),
    sharedVersions: [...previous, revision], amendmentReason: "", returnReason: "" } },
    previous.length ? "Pre-plan revision shared" : "Pre-plan shared", s.plan.id + " · V" + revision.version + " · Available directly to the Field Officer.", "Assistant Manager");
}
export function markAttendance(s: Session, id: string, attendance: Attendance): Session {
  if (!["Submitted", "Approved"].includes(s.plan.status)) throw new Error("Share the pre-plan before recording attendance.");
  if (!assignedWorkerIds(s).includes(id)) throw new Error("This worker is not assigned to the plan.");
  return { ...s, clock: "muster", plan: { ...s.plan, attendance: { ...s.plan.attendance, [id]: attendance } } };
}
export function dispatchTickets(s: Session, itemIds = s.plan.items.map((i) => i.id)): Session {
  if (!["Submitted", "Approved"].includes(s.plan.status)) throw new Error("Share the plan or confirm morning work before issuing tickets.");
  const selected = s.plan.items.filter((i) => itemIds.includes(i.id));
  if (!selected.length || selected.length !== new Set(itemIds).size) throw new Error("Select submitted work to accept.");
  const selectedSession = { ...s, plan: { ...s.plan, items: selected, workerAllocations: planWorkers(s).filter((w) => selected.some((i) => activityGroupKey(i) === w.groupKey)) } };
  const issues = planIssues(selectedSession); if (issues.length) throw new Error(issues[0]);
  const used = new Set(s.plan.tickets.map((t) => t.id));
  let nextNumber = 1;
  const accepted = selected.map((i) => {
    const existing = s.plan.tickets.find((t) => t.itemId === i.id);
    const recipient = workKind(i) === "harvesting" ? "Harvesting Mandor" as const : "Upkeep Mandor" as const;
    let id = existing?.id;
    while (!id) { const candidate = "TK-" + s.plan.id.replace(/^DP-/, "") + "-" + String(nextNumber++).padStart(3, "0"); if (!used.has(candidate)) { id = candidate; used.add(id); } }
    return { id, itemId: i.id, workerIds: existing?.workerIds || [...i.workerIds], recipient, status: existing?.recipient === recipient ? existing.status : "Assigned" };
  });
  const tickets: Ticket[] = [...s.plan.tickets.filter((t) => !itemIds.includes(t.itemId)), ...accepted];
  const added = tickets.filter((t) => !s.plan.tickets.some((old) => old.id === t.id)).length;
  return withEvent({ ...s, clock: "field", plan: { ...s.plan, status: "Dispatched", tickets } }, "Work tickets sent", added + " new ticket(s) · Attendance submitted; work accepted.", "Field Officer");
}
export function acceptTicket(s: Session, id: string): Session {
  const ticket = s.plan.tickets.find((t) => t.id === id);
  if (!ticket || ticket.status !== "Assigned") throw new Error("This ticket is already accepted or unavailable.");
  return withEvent({ ...s, plan: { ...s.plan, tickets: s.plan.tickets.map((t) => t.id === id ? { ...t, status: "Accepted" } : t) } }, "Ticket accepted", id + " · " + ticket.recipient, ticket.recipient);
}
export function parseSession(value: unknown): Session | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Session;
  if (!warehouseValid(s.warehouse) || !machineValid(s.machine)) return null;
  if (s.version !== 1 || !["office", "muster", "field", "completion"].includes(s.clock) || !Number.isInteger(s.sequence) || !Number.isInteger(s.readSequence) || !s.plan || typeof s.plan.id !== "string" || typeof s.plan.date !== "string" || !["Draft", "Submitted", "Approved", "Dispatched"].includes(s.plan.status) || !Array.isArray(s.plan.items) || !Array.isArray(s.events) || !s.plan.attendance || !Array.isArray(s.plan.tickets)) return null;
  if (s.plan.workDraft != null) {
    if (!Array.isArray(s.plan.workDraft) || !parseSession({...s,days:undefined,morning:undefined,completions:undefined,
      plan:{...s.plan,workDraft:undefined,status:"Draft",items:s.plan.workDraft,workerAllocations:[],tickets:[],baseline:null,baselineWorkers:null,sharedVersions:undefined,muster:undefined}})) return null;
  }
  if (!s.plan.items.every((i) => i && typeof i.id === "string" && typeof i.fieldNo === "string" && typeof i.activityCode === "string" && typeof i.targetHa === "number" && Array.isArray(i.workerIds) && i.workerIds.every((id) => typeof id === "string") && typeof i.startTime === "string" && typeof i.endTime === "string" && typeof i.evitCode === "string" && typeof i.materialCode === "string" && typeof i.storageLocation === "string" && typeof i.materialQuantity === "number")) return null;
  if (!s.plan.tickets.every((t) => t && typeof t.id === "string" && typeof t.itemId === "string" && Array.isArray(t.workerIds) && ["Assigned", "Accepted"].includes(t.status) && ["Upkeep Mandor", "Harvesting Mandor"].includes(t.recipient))) return null;
  if (!s.events.every((e) => e && Number.isInteger(e.id) && typeof e.title === "string" && typeof e.detail === "string" && typeof e.role === "string" && typeof e.clock === "string")) return null;
  if (typeof s.plan.returnReason !== "string" || !Object.values(s.plan.attendance).every((a) => ["Present", "Absent", "Unconfirmed"].includes(a))) return null;
  if (s.plan.muster != null && !musterValid(s.plan.muster)) return null;
  if (s.plan.items.some((i) => i.remark != null && typeof i.remark !== "string" || i.workCategory != null && !["upkeep","harvesting","general"].includes(i.workCategory) || i.instructionOrigin != null && !["preplan","onsite"].includes(i.instructionOrigin))) return null;
  if (s.plan.items.some((i) => i.harvestType != null && !["FFB", "LF", "Support"].includes(i.harvestType))) return null;
  const itemIds = new Set(s.plan.items.map((i) => i.id));
  if (itemIds.size !== s.plan.items.length) return null;
  if (!s.plan.items.every((i) => (fields.some((f) => f.fieldNo === i.fieldNo) || (workKind(i) === "general" && i.fieldNo === "")) && (activities.some((a) => a.code === i.activityCode) || (s.plan.status === "Draft" && i.planningSource === "general" && i.activityCode === "")) && Number.isFinite(i.targetHa) && Number.isFinite(i.materialQuantity) && new Set(i.workerIds).size === i.workerIds.length && i.workerIds.every((id) => workers.some((w) => w.id === id && !w.needsReview)))) return null;
  if (!s.plan.items.every((i) => i.intendedGangs == null || Array.isArray(i.intendedGangs) && new Set(i.intendedGangs).size === i.intendedGangs.length && i.intendedGangs.every((g) => gangs.includes(g)))) return null;
  if (!s.plan.items.every((i) => i.planningSource == null ? i.groupId == null : i.planningSource === "harvesting-interval" ? (i.groupId === "harvesting" || typeof i.groupId === "string" && i.groupId.startsWith("harvesting:")) && i.programmeId == null && harvestFieldNames.includes(i.fieldNo) && i.activityCode.startsWith("PH") : i.planningSource === "daily-work" ? typeof i.groupId === "string" && i.groupId.startsWith("daily:") && i.programmeId == null && !!i.workCategory : i.planningSource === "general" && typeof i.groupId === "string" && i.groupId.startsWith("general:") && i.programmeId == null)) return null;
  if (s.plan.items.some((i, index) => i.planningSource && i.fieldNo && s.plan.items.slice(index + 1).some((other) => activityGroupKey(other) === activityGroupKey(i) && other.fieldNo === i.fieldNo))) return null;
  if (!s.plan.tickets.every((t) => itemIds.has(t.itemId) && t.workerIds.every((id) => s.plan.items.find((i) => i.id === t.itemId)!.workerIds.includes(id)))) return null;
  if (new Set(s.plan.tickets.map((t) => t.id)).size !== s.plan.tickets.length) return null;
  if (!s.plan.items.every((i) => (i.programmeRound == null || (Number.isInteger(i.programmeRound) && i.programmeRound > 0)) && (i.programmeYear == null || Number.isInteger(i.programmeYear)))) return null;
  if (!s.plan.items.every((i) => i.programmeRound == null || programmes.some((p) => p.id === i.programmeId && p.activityCode === i.activityCode && p.fields.some((f) => f.fieldNo === i.fieldNo && f.rounds.some((r) => r.number === i.programmeRound && Number(r.dueDate.slice(0, 4)) === i.programmeYear))))) return null;
  if (s.plan.workerAllocations != null && !Array.isArray(s.plan.workerAllocations)) return null;
  const roster = planWorkers(s);
  if (!roster.every((w) => w && typeof w.groupKey === "string" && typeof w.workerId === "string" && typeof w.evitCode === "string" && workers.some((r) => r.id === w.workerId && !r.needsReview) && s.plan.items.some((i) => activityGroupKey(i) === w.groupKey) && (!w.evitCode || machines.some((m) => m.code === w.evitCode)))) return null;
  if (new Set(roster.map((w) => w.groupKey + "|" + w.workerId)).size !== roster.length) return null;
  if (!s.plan.items.every((i) => i.workerIds.every((id) => roster.some((w) => w.groupKey === activityGroupKey(i) && w.workerId === id)))) return null;
  if (s.morning != null) {
    const m = s.morning;
    if (!m || typeof m.id !== "string" || typeof m.date !== "string" || !["approved", "field"].includes(m.origin) || !["Editing", "Dispatched"].includes(m.stage) || !Array.isArray(m.items) || !Array.isArray(m.workerAllocations) || !Array.isArray(m.tickets) || !Array.isArray(m.approvedItems) || !Array.isArray(m.approvedWorkers) || !Array.isArray(m.changes) || !m.attendance || !m.gangByWorker) return null;
    if (!Object.entries(m.attendance).every(([id, value]) => workers.some((w) => w.id === id) && ["Present", "Absent", "Unconfirmed"].includes(value))) return null;
    if (!Object.entries(m.gangByWorker).every(([id, gang]) => workers.some((w) => w.id === id && !w.needsReview) && gangs.includes(gang))) return null;
    const check = (items: PlanItem[], workerAllocations: WorkerAllocation[], tickets: Ticket[] = []) => parseSession({ ...s, days: undefined, morning: undefined, completions: undefined, plan: { ...s.plan, muster: undefined, sharedVersions: undefined, status: "Draft", items, workerAllocations, tickets, attendance: m.attendance } });
    if (m.muster != null && !musterValid(m.muster) || m.approvedMuster != null && !musterValid(m.approvedMuster)) return null;
    if (!check(m.items, m.workerAllocations, m.tickets) || !check(m.approvedItems, m.approvedWorkers)) return null;
    if (m.sharedVersion != null && (!Number.isInteger(m.sharedVersion) || m.sharedVersion < 0 || m.sharedVersion > sharedPlanVersion(s))) return null;
    if (m.acceptedItemIds != null && (!Array.isArray(m.acceptedItemIds) || new Set(m.acceptedItemIds).size !== m.acceptedItemIds.length || m.acceptedItemIds.some((id) => !m.items.some((i) => i.id === id) || !m.tickets.some((t) => t.itemId === id)))) return null;
    if (m.attendanceSubmittedAt != null && (typeof m.attendanceSubmittedAt !== "string" || !Number.isFinite(Date.parse(m.attendanceSubmittedAt)))) return null;
    if (m.attendanceComplete != null && typeof m.attendanceComplete !== "boolean") return null;
    if (m.machineDrivers != null && (typeof m.machineDrivers !== "object" || Array.isArray(m.machineDrivers) || new Set(Object.values(m.machineDrivers).map((v)=>v.evitCode)).size !== Object.values(m.machineDrivers).length || !Object.entries(m.machineDrivers).every(([id,v])=>workers.some((w)=>w.id===id&&!w.needsReview)&&v&&machines.some((machine)=>machine.code===v.evitCode)&&["Machine Operator","Machine Specialist"].includes(v.role)))) return null;
    if (!m.changes.every((c) => c && Number.isInteger(c.id) && typeof c.action === "string" && isManagement(c.actor) && typeof c.effectiveTime === "string" && typeof c.reason === "string" && c.reason.trim() && Array.isArray(c.before) && Array.isArray(c.after) && Array.isArray(c.beforeWorkers) && Array.isArray(c.afterWorkers) && c.beforeGangs && c.afterGangs && check(c.before, c.beforeWorkers) && check(c.after, c.afterWorkers))) return null;
  }
  if (s.plan.sharedVersions != null) {
    if (!Array.isArray(s.plan.sharedVersions)) return null;
    for (let n = 0; n < s.plan.sharedVersions.length; n++) {
      const v = s.plan.sharedVersions[n];
      if (!v || v.version !== n + 1 || !Number.isInteger(v.sequence) || v.sequence < 0 || v.date !== s.plan.date || typeof v.reason !== "string" || !v.reason.trim() || !Array.isArray(v.items) || !v.items.length || !Array.isArray(v.workers)) return null;
      const check = parseSession({ ...s, days: undefined, morning: undefined, completions: undefined, plan: { ...s.plan, status: "Draft", muster: v.muster, sharedVersions: undefined, items: v.items, workerAllocations: v.workers, tickets: [] } });
      if (!check) return null;
    }
    const last = s.plan.sharedVersions.at(-1);
    if (last && (JSON.stringify(last.items) !== JSON.stringify(s.plan.baseline) || JSON.stringify(last.workers) !== JSON.stringify(s.plan.baselineWorkers))) return null;
  }
  if (s.plan.amendmentReason != null && typeof s.plan.amendmentReason !== "string") return null;
  if (s.completions != null && !Array.isArray(s.completions)) return null;
  const completions = s.completions || [], localCompletions = completions.filter((w) => w && w.date === s.plan.date);
  if (!completionSessionValid({ ...s, completions: localCompletions })) return null;
  if (s.days != null) {
    if (!Array.isArray(s.days) || s.days.some((d) => !d || !d.plan || typeof d.plan.id !== "string" || typeof d.plan.date !== "string" || (d.clock != null && !["office", "muster", "field", "completion"].includes(d.clock)))) return null;
    const records = [{ plan: s.plan }, ...s.days];
    if (new Set(records.map((d) => d.plan.id)).size !== records.length || new Set(records.map((d) => d.plan.date)).size !== records.length) return null;
    if (completions.some((w) => !w || !records.some((d) => d.plan.date === w.date))) return null;
    if (s.days.some((d) => !parseSession({ ...s, ...d, morning: d.morning, days: undefined, completions: completions.filter((w) => w.date === d.plan.date) }))) return null;
  } else if (localCompletions.length !== completions.length) return null;
  if (new Set(completions.map((w) => w.id)).size !== completions.length || !secondaryJobsValid(s) || !checkrollValid(s)) return null;
  return { ...s, plan: { ...s.plan, workerAllocations: roster } };
}


export type WorkKind = "upkeep" | "harvesting" | "general";
export function workKind(item: Pick<PlanItem, "planningSource" | "programmeId" | "activityCode" | "workCategory">): WorkKind {
  if (item.workCategory) return item.workCategory;
  return item.planningSource === "general" ? "general" : item.planningSource === "harvesting-interval" || (!item.programmeId && item.activityCode.startsWith("PH")) ? "harvesting" : item.programmeId ? "upkeep" : "general";
}
export function activitySourceLabel(item: PlanItem) {
  return item.planningSource === "daily-work" ? "Daily work programme" : item.planningSource === "harvesting-interval" ? item.harvestType === "LF" ? "Harvesting · Loose fruit" : item.harvestType === "Support" ? "Harvesting · Support" : "Harvesting · Harvesting interval" : workKind(item) === "general" ? "General work · No programme" : item.programmeId ? "Upkeep · Work Programme" : "Harvesting · Manual activity";
}
function nextItemId(s: Session) {
  let number = s.sequence + s.plan.items.length + 1;
  while (s.plan.items.some((i) => i.id === "ITEM-" + number)) number++;
  return "ITEM-" + number;
}
export function addHarvestField(s: Session, fieldNo: string, activityCode = HARVEST_ACTIVITY, type: HarvestType = activityCode === "PH4008" ? "Support" : "FFB"): Session {
  requireDraft(s);
  if (!harvestFieldNames.includes(fieldNo)) throw new Error("Choose a harvesting field from the interval report.");
  if (!activities.some((a) => a.code === activityCode && activityCode.startsWith("PH"))) throw new Error("Choose a harvesting activity code.");
  const peer = s.plan.items.find((i) => i.planningSource === "harvesting-interval" && (i.harvestType || "FFB") === type && i.activityCode === activityCode);
  if (s.plan.items.some((i) => i.planningSource === "harvesting-interval" && (i.harvestType || "FFB") === type && i.activityCode === activityCode && i.fieldNo === fieldNo)) return s;
  const item: PlanItem = { ...makeItem(nextItemId(s)), planningSource: "harvesting-interval", harvestType: type, groupId: peer?.groupId || "harvesting:" + type + ":" + activityCode, activityCode, fieldNo, ...(peer?.intendedGangs ? { intendedGangs: [...peer.intendedGangs] } : {}), startTime: peer?.startTime || "07:00", endTime: peer?.endTime || "12:00" };
  return withEvent({ ...s, plan: { ...s.plan, items: [...s.plan.items, item] } }, "Harvesting field added", type + " · " + fieldNo + " · declare planned hectares and Pax.", "Assistant Manager");
}
export function setGroupActivity(s: Session, key: string, code: string): Session {
  requireDraft(s);
  const group = programmeGroups(s).find((g) => g.key === key);
  if (!group || group.items[0].programmeId) throw new Error("Choose a manual or harvesting activity card.");
  if (!activities.some((a) => a.code === code) && !(group.items[0].planningSource === "general" && code === "")) throw new Error("Choose an activity from the master list.");
  if (group.items[0].planningSource === "harvesting-interval" && !code.startsWith("PH")) throw new Error("Choose a harvesting activity code.");
  return { ...s, plan: { ...s.plan, items: s.plan.items.map((i) => activityGroupKey(i) === key ? { ...i, activityCode: code } : i) } };
}
export function addGeneralWork(s: Session): Session {
  requireDraft(s);
  const id = nextItemId(s);
  const item: PlanItem = { ...makeItem(id), planningSource: "general", groupId: "general:" + id, activityCode: "", fieldNo: "" };
  return withEvent({ ...s, plan: { ...s.plan, items: [...s.plan.items, item] } }, "Other work added", "Choose an activity code. Field, Ha, EVIT and remarks are optional.", "Assistant Manager");
}
export function addGeneralField(s: Session, key: string): Session {
  requireDraft(s);
  const peer = s.plan.items.find((i) => activityGroupKey(i) === key && i.planningSource === "general");
  if (!peer) throw new Error("Choose a General work card.");
  if (s.plan.items.some((i) => activityGroupKey(i) === key && !i.fieldNo)) throw new Error("Choose the blank field before adding another.");
  const item: PlanItem = { ...makeItem(nextItemId(s)), planningSource: "general", groupId: peer.groupId, activityCode: peer.activityCode, fieldNo: "", intendedGangs: peer.intendedGangs ? [...peer.intendedGangs] : undefined, startTime: peer.startTime, endTime: peer.endTime };
  return { ...s, plan: { ...s.plan, items: [...s.plan.items, item] } };
}


export function hasSharedPlan(s: Session) { return !!s.plan.baseline?.length || ["Submitted", "Approved", "Dispatched"].includes(s.plan.status); }
export function sharedPlanVersions(s: Session): SharedPlanVersion[] {
  if (s.plan.sharedVersions) return s.plan.sharedVersions;
  if (!hasSharedPlan(s)) return [];
  return [{ version: 1, sequence: 0, date: s.plan.date, reason: "Original shared pre-plan",
    items: structuredClone(s.plan.baseline || s.plan.items), workers: structuredClone(s.plan.baselineWorkers || planWorkers(s)), muster: structuredClone(s.plan.muster) }];
}
export const sharedPlanVersion = (s: Session) => sharedPlanVersions(s).length;
export function amendPlan(s: Session, reason: string): Session {
  if (s.plan.status === "Draft") throw new Error("The pre-plan is already editable.");
  if (!reason.trim()) throw new Error("Enter a reason for this pre-plan amendment.");
  const versions = sharedPlanVersions(s), baseline = structuredClone(s.plan.baseline || s.plan.items), baselineWorkers = structuredClone(s.plan.baselineWorkers || planWorkers(s));
  const morning = s.morning || { id: s.plan.id, date: s.plan.date, origin: "approved" as const, stage: s.plan.status === "Dispatched" ? "Dispatched" as const : "Editing" as const,
    items: structuredClone(s.plan.status === "Dispatched" ? s.plan.items : baseline), workerAllocations: structuredClone(s.plan.status === "Dispatched" ? planWorkers(s) : baselineWorkers),
    approvedMuster: structuredClone(versions.at(-1)?.muster || s.plan.muster), muster: structuredClone(versions.at(-1)?.muster || s.plan.muster), attendance: { ...s.plan.attendance }, tickets: structuredClone(s.plan.tickets), approvedItems: baseline, approvedWorkers: baselineWorkers, gangByWorker: {}, changes: [], sharedVersion: versions.length };
  return withEvent({ ...s, morning, plan: { ...s.plan, status: "Draft", baseline, baselineWorkers, sharedVersions: versions, amendmentReason: reason.trim() } },
    "Pre-plan amendment started", reason.trim() + " · Existing morning work and tickets retained.", "Assistant Manager");
}
function validDate(date: string) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date + "T12:00:00Z")) && new Date(date + "T12:00:00Z").toISOString().slice(0, 10) === date; }
export function nextPlanningDate(date: string) { const day = new Date(date + "T12:00:00Z"); day.setUTCDate(day.getUTCDate() + 1); return day.toISOString().slice(0, 10); }
const dailyId = (date: string) => "DP-" + date.slice(8, 10) + date.slice(5, 7) + date.slice(2, 4) + "-001";
export function setPlanningDate(s: Session, date: string): Session {
  requireDraft(s);
  if (!validDate(date)) throw new Error("Choose a valid execution date.");
  if (date === s.plan.date) return s;
  if (hasSharedPlan(s) || s.morning) throw new Error("This day already has shared or morning work. Create another day from Attendance and Productivity M2.");
  if (s.days?.some((d) => d.plan.date === date)) throw new Error("This date already exists in Attendance and Productivity M2. Open that day.");
  return { ...s, plan: { ...s.plan, id: dailyId(date), date } };
}
export function dailyRecords(s: Session): DailyRecord[] { return [{ plan: s.plan, morning: s.morning, clock: s.clock }, ...(s.days || [])].sort((a, b) => b.plan.date.localeCompare(a.plan.date)); }
export function createDailyPlan(s: Session, date: string): Session {
  if (!validDate(date)) throw new Error("Choose a valid day.");
  if (dailyRecords(s).some((d) => d.plan.date === date)) throw new Error("This day already exists. Open it from Attendance and Productivity M2.");
  const blank = createSession("blank");
  return withEvent({ ...s, clock: "office", plan: { ...blank.plan, id: dailyId(date), date }, morning: undefined,
    days: [...(s.days || []), structuredClone({ plan: s.plan, morning: s.morning, clock: s.clock })] },
    "Daily workspace created", date + " · Previous days, tickets and completion records retained.", "Assistant Manager");
}
export function openDailyRecord(s: Session, id: string): Session {
  if (id === s.plan.id) return s;
  const record = s.days?.find((d) => d.plan.id === id);
  if (!record) throw new Error("This saved day is unavailable.");
  return { ...s, clock: record.clock || (record.morning?.stage === "Dispatched" ? "field" : "office"), plan: structuredClone(record.plan), morning: structuredClone(record.morning),
    days: [...(s.days || []).filter((d) => d.plan.id !== id), structuredClone({ plan: s.plan, morning: s.morning, clock: s.clock })] };
}
export function dailyWorkSummary(s: Session, record: DailyRecord) {
  const day = { ...s, ...record, morning: record.morning, days: undefined };
  const m = record.morning, shared = hasSharedPlan(day), issued = m?.stage === "Dispatched" || record.plan.status === "Dispatched";
  const items = m?.items || (shared ? record.plan.baseline || record.plan.items : record.plan.items);
  const ticketItems = m?.items || record.plan.items, tickets = m?.tickets || record.plan.tickets;
  const attendance = m?.attendance || record.plan.attendance;
  const crew = [...new Set(items.flatMap((i) => i.workerIds).filter((id) => attendance[id] === "Present"))];
  const population = workers.filter((w) => !w.needsReview), present = population.filter((w) => attendance[w.id] === "Present").length;
  const confirmed = population.filter((w) => ["Present", "Absent"].includes(attendance[w.id])).length;
  const unallocated = population.filter((w) => attendance[w.id] === "Present" && !crew.includes(w.id)).length;
  const missingGangFields = items.filter((i) => !i.workerIds.some((id) => attendance[id] === "Present")).length;
  const jobs = m?.secondaryJobs || [];
  const works = (s.completions || []).filter((w) => w.date === record.plan.date);
  const areaTickets = tickets.filter((t) => { const item = ticketItems.find((i) => i.id === t.itemId); return !!item && (workKind(item) !== "general" && item.harvestType !== "Support" || item.targetHa > 0); });
  const required = areaTickets.map((t) => works.find((w) => w.ticketId === t.id && w.origin === "primary"));
  const relevant = works.filter((w) => w.kind !== "general" || latestReport(w)?.ha != null);
  const missing = required.filter((w) => !w).length + jobs.filter((job) => job.areaRequired && !job.reportWorkId).length;
  const pending = relevant.filter((w) => latestReport(w)?.status === "Reported").length;
  const returned = relevant.filter((w) => latestReport(w)?.status === "Returned").length;
  const validated = relevant.filter((w) => latestReport(w)?.status === "Validated").length;
  const approvedBunches = works.reduce((n, w) => n + (validatedReport(w)?.production?.rows.reduce((sum, row) => sum + row.bunches, 0) || 0), 0);
  const haDone = issued && (areaTickets.length > 0 || relevant.length > 0) && !missing && !pending && !returned && required.every((w) => w && latestReport(w)?.status === "Validated");
  const areaRequired = items.some((i) => workKind(i) !== "general" && i.harvestType !== "Support" || i.targetHa > 0) || relevant.length > 0;
  const checkroll = checkrollSummary(day);
  const productionRequired = tickets.map((t)=>works.find((w)=>w.ticketId===t.id&&w.origin==="primary"));
  const productivityPending = productionRequired.filter((w)=>!w||latestReport(w)?.status!=="Validated").length + jobs.filter((job)=>job.areaRequired&&(!job.reportWorkId||latestReport(works.find((w)=>w.id===job.reportWorkId)!)?.status!=="Validated")).length;
  const machine = machineSummary(s,record.plan.date);
  const productivityDone = tickets.length>0 && !productivityPending && !machine.pending && !machine.unsubmitted;
  const fieldCreated = !!m?.items.some((i) => !m.approvedItems.some((p) => p.id === i.id));
  return { id: record.plan.id, reference: m?.origin === "field" ? m.id : record.plan.id, date: record.plan.date, shared, issued, items, tickets, crew,
    origin: shared ? fieldCreated || m?.origin === "field" ? "Pre-plan + morning work" : "Pre-plan" : m?.items.length ? "Morning work · no pre-plan" : record.plan.items.length ? "Draft pre-plan" : "No work recorded",
    preplan: shared ? record.plan.status === "Draft" ? "Amendment draft · V" + sharedPlanVersion(day) + " still shared" : "Shared · V" + sharedPlanVersion(day) : record.plan.items.length ? "Draft · not shared" : "Not prepared",
    attendance: m?.attendanceSubmittedAt ? "Submitted · " + present + " clocked in · " + (population.length - present) + " not clocked in" : confirmed ? present + " clocked in · " + (population.length - present) + " not clocked in" : "Not submitted",
    attendanceDone: m?.attendanceComplete === true,
    gangStatus: !items.length ? "No work yet" : missingGangFields || unallocated ? missingGangFields + " fields pending · " + unallocated + " present workers unallocated" : "Allocated · " + crew.length + " workers",
    gangDone: items.length > 0 && !missingGangFields && !unallocated, secondaryJobs: jobs,
    morning: items.length ? tickets.length + " field instructions accepted · " + Math.max(0,items.length-tickets.length) + " pending" : "Not started",
    ticketStatus: issued ? tickets.length + " issued · " + tickets.filter((t) => t.status === "Accepted").length + " opened by Mandore" : "Not issued",
    haStatus: !items.length ? "No work yet" : !areaRequired ? "Not required · non-area work" : !issued ? "Awaiting field work" : haDone ? "Done · " + formatHa(relevant.reduce((n, w) => n + (validatedReport(w)?.ha || 0), 0)) + " ha validated" : missing + " missing · " + pending + " pending · " + returned + " returned · " + validated + " validated",
    machineStatus: machine.jobs ? machine.approved + " approved · " + machine.pending + " pending · " + machine.unsubmitted + " unsubmitted · " + formatHa(machine.approvedHa) + " machine ha approved" : "",
    productivityPending: productivityPending + machine.pending + machine.unsubmitted, productivityDone, checkrollPending: checkroll.pendingInputs,
    haDone, areaRequired, approvedBunches, checkroll: items.length ? checkroll.text : "No work yet", checkrollDone: checkroll.done, morningChanges: m?.changes || [], versions: sharedPlanVersions(day) };
}

/** Pending additions belong to the day and do not change submitted instructions. */
export function additionalWorkDraft(s: Session): Session {
  return {...s,days:undefined,morning:undefined,plan:{...s.plan,workDraft:undefined,status:"Draft",items:structuredClone(s.plan.workDraft||[]),
    workerAllocations:[],tickets:[],attendance:{},baseline:null,baselineWorkers:null,sharedVersions:undefined,muster:undefined}};
}
export function saveAdditionalWorkDraft(s: Session, draft: Session): Session {
  if (draft.plan.date!==s.plan.date) throw new Error("Return to the matching work date.");
  const used=new Set([...(s.plan.workDraft||[]),...s.plan.items,...(s.morning?.items||[])].map((item)=>item.id));
  let number=1;
  const items=draft.plan.items.map((item)=>{
    if(item.id.startsWith("ADD-")) return structuredClone(item);
    while(used.has("ADD-"+number))number++;
    const id="ADD-"+number++;used.add(id);
    return {...structuredClone(item),id,...(item.planningSource==="general"&&item.groupId==="general:"+item.id?{groupId:"general:"+id}:{})};
  });
  const next={...s,plan:{...s.plan,workDraft:items}};
  if(!parseSession(next))throw new Error("Check the pending work references.");
  return next;
}
