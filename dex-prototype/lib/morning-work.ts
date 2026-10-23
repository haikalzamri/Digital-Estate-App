import { driverAssignmentLocked, isMachineRole, type DriverAssignment } from "@/lib/machine";
import { allocateMusterLine, musterFor, musterIssues, musterSnapshot, setMuster, type HarvestType, type MusterData } from "@/lib/muster-chit";
import {
  additionalWorkDraft, activities, activityGroupKey, activityName, addGeneralField, addGeneralWork, addHarvestField, addProgrammeWorkers, addRecommendation,
  assignedWorkerIds, dispatchTickets, programmes, fields, machines, gangs, intendedGangs, setIntendedGangs, hasSharedPlan, sharedPlanVersion, planIssues, planWorkers, programmeGroups, removePlanField, setGroupActivity,
  createSession, makeItem, workKind, dailyRecords, openDailyRecord, createDailyPlan, setProgrammeWindow, setWorkerMachine, toggleWorkerField, updateItem, withEvent, workers,
  isManagement, type OfficeRole, type Attendance, type PhoneRole, type PlanItem, type Session, type Ticket, type WorkerAllocation,
} from "@/lib/workshop";

export type MorningChange = {
  id: number; action: string; actor: OfficeRole; effectiveTime: string; reason: string;
  before: PlanItem[]; after: PlanItem[]; beforeWorkers: WorkerAllocation[]; afterWorkers: WorkerAllocation[];
  beforeGangs: Record<string, string>; afterGangs: Record<string, string>;
};
export type MorningWork = {
  machineDrivers?: Record<string, DriverAssignment>;
  checkroll?: import("./checkroll").CheckrollDay;
  acceptedItemIds?: string[]; attendanceSubmittedAt?: string; muster?: MusterData; approvedMuster?: MusterData; id: string; date: string; origin: "approved" | "field"; stage: "Editing" | "Dispatched";
  items: PlanItem[]; workerAllocations: WorkerAllocation[]; attendance: Record<string, Attendance>; tickets: Ticket[];
  secondaryJobs?: import("./work-completion").SecondaryJob[]; attendanceComplete?: boolean;
  sharedVersion?: number; approvedItems: PlanItem[]; approvedWorkers: WorkerAllocation[]; gangByWorker: Record<string, string>; changes: MorningChange[];
};
export type MobileWorkChoice = { kind: "upkeep" | "harvesting" | "general"; programmeId: string; activityCode: string; fields: string[]; harvestType?: HarvestType };

export function morningView(s: Session): MorningWork {
  if (s.morning && !(hasSharedPlan(s) && !s.morning.items.length && (s.morning.sharedVersion || 0) < sharedPlanVersion(s))) return s.morning;
  const approved = hasSharedPlan(s);
  const sharedItems = s.plan.status === "Dispatched" ? s.plan.items : s.plan.baseline || s.plan.items;
  const sharedWorkers = s.plan.status === "Dispatched" ? planWorkers(s) : s.plan.baselineWorkers || planWorkers(s);
  return {
    muster: approved ? structuredClone(s.plan.sharedVersions?.at(-1)?.muster || s.plan.muster) : undefined,
    approvedMuster: approved ? structuredClone(s.plan.sharedVersions?.at(-1)?.muster || s.plan.muster) : undefined,
    id: approved ? s.plan.id : "MW-" + s.plan.date.replaceAll("-", "").slice(6, 8) + s.plan.date.slice(5, 7) + s.plan.date.slice(2, 4) + "-001",
    date: s.plan.date, origin: approved ? "approved" : "field", stage: s.plan.status === "Dispatched" ? "Dispatched" : "Editing",
    items: approved ? structuredClone(sharedItems) : [], workerAllocations: approved ? structuredClone(sharedWorkers) : [],
    attendance: s.morning ? { ...s.morning.attendance } : approved ? { ...s.plan.attendance } : {}, tickets: approved ? structuredClone(s.plan.tickets) : [],
    approvedItems: approved ? structuredClone(s.plan.baseline || s.plan.items) : [],
    approvedWorkers: approved ? structuredClone(s.plan.baselineWorkers || planWorkers(s)) : [],
    machineDrivers: s.morning?.machineDrivers,
    checkroll: s.morning?.checkroll,
    gangByWorker: { ...s.morning?.gangByWorker }, changes: s.morning?.changes || [], attendanceComplete: s.morning?.attendanceComplete, attendanceSubmittedAt: s.morning?.attendanceSubmittedAt, sharedVersion: approved ? sharedPlanVersion(s) : 0,
  };
}
export function morningSession(s: Session, morning = morningView(s)): Session {
  return { ...s, morning: undefined, plan: { ...s.plan, id: morning.id, date: morning.date, status: "Draft", muster: morning.muster, items: morning.items, workerAllocations: morning.workerAllocations, attendance: morning.attendance, tickets: morning.tickets, baseline: morning.approvedItems, baselineWorkers: morning.approvedWorkers, returnReason: "" } };
}
export function effectiveGang(s: Session, workerId: string) { return s.morning?.gangByWorker[workerId] || workers.find((w) => w.id === workerId)?.gang || ""; }
export function beforeWork(s: Session) {
  return !(s.completions || []).some((w) => w.date === s.plan.date && w.reports.length) && !(s.morning?.secondaryJobs?.length);
}
export function gangEditable(s: Session) { return !!s.plan; }
export function morningEditable(s: Session) { return beforeWork(s); }
function requireMorning(s: Session, allocationOnly = false) {
  const morning = morningView(s);
  if (!allocationOnly && !beforeWork(s)) throw new Error("Work reporting has started. Record further work and any T6 as a secondary job.");
  return morning;
}
function requireReason(reason: string) {
  if (!reason.trim()) throw new Error("Enter a reason for the morning change.");
}
function pruneRoster(draft: Session): Session {
  return { ...draft, plan: { ...draft.plan, workerAllocations: planWorkers(draft).filter((w) => draft.plan.items.some((i) => activityGroupKey(i) === w.groupKey && i.workerIds.includes(w.workerId))) } };
}
function record(s: Session, before: MorningWork, draft: Session, action: string, reason: string, gangByWorker = before.gangByWorker, actor: OfficeRole = "Field Officer"): Session {
  const change: MorningChange = {
    id: before.changes.length + 1, action, actor, effectiveTime: new Date().toISOString(), reason: reason.trim(),
    before: structuredClone(before.items), after: structuredClone(draft.plan.items),
    beforeWorkers: structuredClone(before.workerAllocations), afterWorkers: structuredClone(planWorkers(draft)),
    beforeGangs: { ...before.gangByWorker }, afterGangs: { ...gangByWorker },
  };
  const tickets = before.tickets.map((ticket) => {
    const item = draft.plan.items.find((i) => i.id === ticket.itemId);
    if (!item) return ticket;
    const recipient = workKindForTicket(item);
    return { ...ticket, recipient, status: ticket.recipient === recipient ? ticket.status : "Assigned" as const,
      workerIds: [...item.workerIds] };
  });
  const morning: MorningWork = { ...before, muster: draft.plan.muster ? structuredClone(musterFor(draft)) : before.muster, items: draft.plan.items, workerAllocations: planWorkers(draft), attendance: draft.plan.attendance, tickets, gangByWorker, changes: [...before.changes, change] };
  return withEvent({ ...s, clock: s.clock === "completion" ? "completion" : before.stage === "Dispatched" ? "field" : "muster", morning }, action, reason.trim(), actor);
}
const workKindForTicket = (item: PlanItem): Ticket["recipient"] => workKind(item) === "harvesting" ? "Harvesting Mandor" : "Upkeep Mandor";
function amend(s: Session, action: string, reason: string, update: (draft: Session) => Session, allocationOnly = false): Session {
  requireReason(reason);
  const before = requireMorning(s, allocationOnly);
  return record(s, before, update(morningSession(s, before)), action, reason);
}
export function addMobileWork(s: Session, choice: MobileWorkChoice): Session {
  if (!choice.fields.length || new Set(choice.fields).size !== choice.fields.length || choice.fields.some((f) => !fields.some((row) => row.fieldNo === f))) throw new Error("Choose one or more fields from the master list.");
  let next = s;
  if (choice.kind === "upkeep") {
    for (const field of choice.fields) next = addRecommendation(next, choice.programmeId, field);
  } else if (choice.kind === "harvesting") {
    for (const field of choice.fields) next = addHarvestField(next, field, choice.activityCode, choice.harvestType);
  } else {
    if (!activities.some((a) => a.code === choice.activityCode)) throw new Error("Choose a General work activity code.");
    next = addGeneralWork(next);
    const first = next.plan.items.at(-1)!;
    const key = activityGroupKey(first);
    next = setGroupActivity(next, key, choice.activityCode);
    next = updateItem(next, first.id, { fieldNo: choice.fields[0] });
    for (const field of choice.fields.slice(1)) {
      next = addGeneralField(next, key);
      next = updateItem(next, next.plan.items.at(-1)!.id, { fieldNo: field });
    }
  }
  return next;
}
export function addMorningWork(s: Session, choice: MobileWorkChoice, reason: string) {
  return amend(s, "Morning work added", reason.trim() || "Work added before work started", (draft) => {
    const added = addMobileWork(draft, choice), oldIds = new Set(draft.plan.items.map((i) => i.id));
    return { ...added, plan: { ...added.plan, items: added.plan.items.map((i) => oldIds.has(i.id) ? i : { ...i, id: "MW-" + i.id, ...(i.planningSource === "general" ? { groupId: "general:morning:" + i.groupId } : {}) }) } };
  });
}
export function saveMorningField(s: Session, id: string, patch: Partial<PlanItem>, reason: string) {
  return amend(s, "Field work amended", reason.trim() || "Field work updated before work started", (draft) => updateItem(draft, id, patch));
}
export function removeMorningField(s: Session, id: string, reason: string) {
  if (morningView(s).tickets.some((t) => t.itemId === id)) throw new Error("This field already has a ticket. Keep the issued record and add changed work separately.");
  return amend(s, "Morning field removed", reason, (draft) => pruneRoster(removePlanField(draft, id)));
}
export function editMorningActivity(s: Session, key: string, code: string, start: string, end: string, reason: string) {
  return amend(s, "Morning activity amended", reason.trim() || "Activity updated before work started", (draft) => {
    const group = programmeGroups(draft).find((g) => g.key === key);
    if (!group || !activities.some((a) => a.code === code)) throw new Error("Choose a valid activity.");
    let next = draft;
    if (group.programmeId && code !== group.activityCode) {
      if (code.startsWith("PH")) throw new Error("Add a Harvesting card for harvesting work.");
      const groupId = "general:morning:" + key;
      next = { ...next, plan: { ...next.plan, items: next.plan.items.map((item) => {
        if (activityGroupKey(item) !== key) return item;
        return { ...item, programmeId: null, programmeRound: undefined, programmeYear: undefined, planningSource: "general" as const, groupId, activityCode: code, startTime: start, endTime: end };
      }), workerAllocations: planWorkers(next).map((w) => w.groupKey === key ? { ...w, groupKey: groupId } : w) } };
    } else {
      if (code !== group.activityCode) next = setGroupActivity(next, key, code);
      next = setProgrammeWindow(next, key, start, end);
    }
    return next;
  });
}
export function setMorningDriver(s: Session, group: string, workerId: string, evit: string, reason: string) {
  return amend(s, "EVIT driver amended", reason.trim() || "Driver assignment updated", (draft) => setWorkerMachine(draft, group, workerId, evit), true);
}
/** Attendance does not allocate workers or change work tickets. */
export function clockWorker(s: Session, id: string, attendance: Attendance, actor: PhoneRole = "Field Officer") {
  return clockWorkers(s, [id], attendance, actor);
}
export function clockWorkers(s: Session, ids: string[], attendance: Attendance, actor: PhoneRole = "Field Officer") {
  const before = requireMorning(s, true), selected = [...new Set(ids)];
  if (!["Present", "Absent", "Unconfirmed"].includes(attendance) || selected.some((id) => !workers.some((w) => w.id === id && !w.needsReview))) throw new Error("Select workers with unambiguous identities.");
  if (attendance !== "Present" && selected.some((id) => driverAssignmentLocked(s,id))) throw new Error("This driver has an active machine job. Finish the job before clearing attendance.");
  const nextAttendance = { ...before.attendance, ...Object.fromEntries(selected.map((id) => [id, attendance])) };
  return withEvent({ ...s, morning: { ...before, attendance: nextAttendance, attendanceComplete: false } },
    "Attendance updated", selected.length + " worker(s) · " + (attendance === "Present" ? "Clocked in" : attendance === "Unconfirmed" ? "Neutral" : "Absent"), actor);
}
export function assignClockMachine(s: Session, workerId: string, evitCode: string, role: string, actor: OfficeRole): Session {
  if (!isManagement(actor)) throw new Error("Only estate management can assign EVIT at Clock/in.");
  const before = requireMorning(s,true), worker = workers.find((w)=>w.id===workerId&&!w.needsReview);
  if (!worker || before.attendance[workerId]!=="Present") throw new Error("Clock in this driver before assigning EVIT.");
  const previous = before.machineDrivers?.[workerId];
  if (previous?.evitCode===evitCode && previous?.role===role) return s;
  if (driverAssignmentLocked(s,workerId,evitCode)) throw new Error("This driver or EVIT has an active machine job. Keep its assignment until the job ends.");
  if (evitCode && (!machines.some((m)=>m.code===evitCode) || !isMachineRole(role))) throw new Error("Choose a machine and operator role.");
  if (evitCode && Object.entries(before.machineDrivers||{}).some(([id,v])=>id!==workerId&&v.evitCode===evitCode)) throw new Error("This EVIT is already assigned to another driver for this day.");
  const machineDrivers={...before.machineDrivers};
  if (evitCode) machineDrivers[workerId]={evitCode,role:role as DriverAssignment["role"]}; else delete machineDrivers[workerId];
  return withEvent({...s,morning:{...before,machineDrivers}},"Driver EVIT assigned",worker.name+" · "+(evitCode||"Assignment cleared"),actor);
}
export function clockAllocated(s: Session) {
  return clockWorkers(s, assignedWorkerIds(morningSession(s)), "Present");
}
export function attendanceSummary(s: Session, actor: PhoneRole = "Field Officer") {
  const morning = morningView(s);
  const population = workers.filter((w) => !w.needsReview && (actor === "Harvesting Mandor" ? !["21","23","24"].includes(effectiveGang(s,w.id)) : actor === "Upkeep Mandor" ? ["21","23","24"].includes(effectiveGang(s,w.id)) : true));
  const clockedIn = population.filter((w) => morning.attendance[w.id] === "Present").length;
  return { clockedIn, neutral: population.length - clockedIn, t6: population.filter((w) => morning.attendance[w.id] === "Present" && effectiveGang(s,w.id) !== w.gang).length };
}
export function attendanceReady(s: Session) {
  const morning = morningView(s);
  return morning.date === s.plan.date && morning.attendanceComplete === true && !!morning.attendanceSubmittedAt;
}
export function saveAttendance(s: Session, actor: PhoneRole) {
  const before = requireMorning(s, true), summary = attendanceSummary(s, actor);
  return withEvent({ ...s, morning: { ...before, attendanceComplete: true, attendanceSubmittedAt: new Date().toISOString() } },
    "Attendance submitted", summary.clockedIn + " clocked in · " + summary.neutral + " neutral · " + summary.t6 + " workers T6", actor);
}
export function transferAttendanceGang(s: Session, id: string, toGang: string, actor: OfficeRole = "Field Officer") {
  const before = requireMorning(s), worker = workers.find((w) => w.id === id && !w.needsReview);
  if (!worker || before.attendance[id] !== "Present") throw new Error("Clock in the worker before recording T6.");
  if (!gangs.includes(toGang) || toGang === effectiveGang(s,id)) throw new Error("Choose a different receiving gang.");
  const gangByWorker = { ...before.gangByWorker, [id]: toGang };
  const recorded = record(s,before,morningSession(s,before),"T6 at Clock/in",worker.name + " → Gang " + toGang,gangByWorker,actor);
  return { ...recorded, morning: { ...recorded.morning!, attendanceComplete: false, tickets: before.tickets, items: before.items, workerAllocations: before.workerAllocations, muster: before.muster } };
}
export function setMorningGangs(s: Session, key: string, selected: string[]) {
  return amend(s, "Intended gangs updated", "Gang planning updated before work started", (draft) => setIntendedGangs(draft, key, selected));
}
function allocationDraft(s: Session, before: MorningWork, workerIds: string[], itemIds: string[], replaceId?: string) {
  const ids = [...new Set(workerIds)], targets = before.items.filter((i) => itemIds.includes(i.id));
  if (!targets.length || targets.length !== new Set(itemIds).size || new Set(targets.map(activityGroupKey)).size !== 1) throw new Error("Choose destination fields from one activity.");
  if (!ids.length || ids.some((id) => !workers.some((w) => w.id === id && !w.needsReview) || before.attendance[id] !== "Present")) throw new Error("Clock in the selected workers before allocating them.");
  let draft = morningSession(s, before);
  draft = { ...draft, plan: { ...draft.plan, items: draft.plan.items.map((i) => ({ ...i, workerIds: i.workerIds.filter((id) => !(ids.includes(id) && !itemIds.includes(i.id)) && !(replaceId && id === replaceId)) })) } };
  draft = pruneRoster(draft);
  const key = activityGroupKey(targets[0]);
  draft = addProgrammeWorkers(draft, key, ids);
  for (const id of ids) for (const target of targets) if (!draft.plan.items.find((i) => i.id === target.id)!.workerIds.includes(id)) draft = toggleWorkerField(draft, key, id, target.id);
  return draft;
}
export function assignMorningWorkers(s: Session, input: { workerIds: string[]; itemIds: string[]; replaceId?: string }) {
  const before = requireMorning(s, true), draft = allocationDraft(s, before, input.workerIds, input.itemIds, input.replaceId);
  return record(s, before, draft, "Gang allocation updated", input.workerIds.length + " workers allocated · Working gangs retained.");
}
export type GangSuggestion = { workerId: string; gang: string; itemIds: string[] };
export function gangSuggestions(s: Session): GangSuggestion[] {
  const before = morningView(s), allocated = new Set(before.items.flatMap((i) => i.workerIds.filter((id) => before.attendance[id] === "Present")));
  return workers.filter((w) => !w.needsReview && before.attendance[w.id] === "Present" && !allocated.has(w.id)).map((w) => {
    const gang = effectiveGang(s, w.id);
    return { workerId: w.id, gang, itemIds: before.items.filter((i) => intendedGangs(i).includes(gang)).map((i) => i.id) };
  });
}
export function applyGangSuggestions(s: Session) {
  const before = requireMorning(s, true), suggestions = gangSuggestions(s).filter((r) => r.itemIds.length === 1);
  if (!suggestions.length) throw new Error("Choose destinations for the available gangs.");
  let draft = morningSession(s, before);
  for (const itemId of [...new Set(suggestions.map((r) => r.itemIds[0]))]) {
    const ids = suggestions.filter((r) => r.itemIds[0] === itemId).map((r) => r.workerId);
    draft = allocationDraft(s, { ...before, items: draft.plan.items, workerAllocations: planWorkers(draft) }, ids, [itemId]);
  }
  return record(s, before, draft, "Gang suggestions applied", suggestions.length + " present workers allocated to a single matching field. Other destinations remain pending.");
}
export function transferMorningWorkers(s: Session, input: { workerIds: string[]; itemIds?: string[]; toGang: string; replaceId?: string; reason: string }) {
  requireReason(input.reason);
  const before = requireMorning(s), ids = [...new Set(input.workerIds)];
  if (!gangs.includes(input.toGang)) throw new Error("Choose the receiving gang.");
  if (!ids.length || ids.some((id) => !workers.some((w) => w.id === id && !w.needsReview) || before.attendance[id] !== "Present")) throw new Error("Select clocked-in workers for T6.");
  if (ids.some((id) => effectiveGang(s, id) === input.toGang)) throw new Error("These workers already belong to the receiving gang. Use Allocate gang for field changes.");
  const gangByWorker = { ...before.gangByWorker };
  for (const id of ids) gangByWorker[id] = input.toGang;
  let draft: Session;
  if (input.itemIds?.length) draft = allocationDraft(s, before, ids, input.itemIds, input.replaceId);
  else draft = pruneRoster({ ...morningSession(s, before), plan: { ...morningSession(s, before).plan, items: before.items.map((i) => ({ ...i, workerIds: i.workerIds.filter((id) => !ids.includes(id)) })) } });
  return record(s, before, draft, "T6 before work", input.reason + " · " + ids.length + " workers → Gang " + input.toGang + (input.itemIds?.length ? " · Destination allocated" : " · Allocation pending"), gangByWorker);
}
export function assignPreplanWorkers(s: Session, ids: string[], itemIds: string[]) {
  const targets = s.plan.items.filter((i) => itemIds.includes(i.id));
  if (!targets.length || new Set(targets.map(activityGroupKey)).size !== 1) throw new Error("Choose fields from one activity.");
  let next = addProgrammeWorkers(s, activityGroupKey(targets[0]), ids);
  for (const id of ids) for (const target of targets) if (!next.plan.items.find((i) => i.id === target.id)!.workerIds.includes(id)) next = toggleWorkerField(next, activityGroupKey(target), id, target.id);
  return next;
}
export function detachPreplanWorker(s: Session, itemId: string, id: string) {
  const item = s.plan.items.find((i) => i.id === itemId);
  if (!item) throw new Error("Choose a field.");
  return pruneRoster(updateItem(s, itemId, { workerIds: item.workerIds.filter((worker) => worker !== id) }));
}
export function detachMorningWorker(s: Session, itemId: string, id: string, reason: string) {
  return amend(s, "Worker allocation amended", reason.trim() || "Field allocation updated", (draft) => detachPreplanWorker(draft, itemId, id), true);
}
export function releaseAbsentDriver(s: Session, id: string) {
  return amend(s, "Absent driver EVIT released", "Driver absent at Clock/in; EVIT released for reassignment.", (draft) => {
    let next = draft;
    for (const allocation of planWorkers(draft).filter((w) => w.workerId === id && w.evitCode)) next = setWorkerMachine(next, allocation.groupKey, id, "");
    return next;
  });
}
export function morningIssues(s: Session) {
  return planIssues(morningSession(s));
}
export function confirmMorning(s: Session, reason = "Work details confirmed; gang allocation tracked separately.") {
  if (!attendanceReady(s)) throw new Error("Submit attendance before accepting work and sending tickets.");
  const before = requireMorning(s), issues = morningIssues(s);
  if (issues.length) throw new Error(issues[0]);
  const draft = morningSession(s, before);
  const prepared = pruneRoster({ ...draft, plan: { ...draft.plan, items: draft.plan.items.map((i) => ({ ...i, workerIds: i.workerIds.filter((id) => before.attendance[id] === "Present") })) } });
  const dispatched = dispatchTickets({ ...prepared, plan: { ...prepared.plan, status: "Submitted" } });
  const recorded = record(s, before, prepared, "Work tickets issued", reason);
  return { ...recorded, clock: "field" as const, morning: { ...recorded.morning!, stage: "Dispatched" as const, tickets: dispatched.plan.tickets } };
}
/** Opening received work acknowledges delivery; FO acceptance remains the dispatch decision. */
export function openMandoreWork(s: Session, ids: string[], role: PhoneRole): Session {
  const morning = morningView(s);
  if (!["Upkeep Mandor","Harvesting Mandor"].includes(role) || morning.stage !== "Dispatched" || ids.some((id) => !morning.tickets.some((t) => t.id === id && t.recipient === role))) throw new Error("Open work assigned to your Mandore role.");
  if (!ids.some((id) => morning.tickets.some((t) => t.id === id && t.status === "Assigned"))) return s;
  return withEvent({ ...s, morning: { ...morning, tickets: morning.tickets.map((t) => ids.includes(t.id) ? { ...t, status: "Accepted" as const } : t) } }, "Work opened", ids.length + " field instruction(s) · " + role, role);
}
export function acceptMorningTicket(s: Session, id: string, role: PhoneRole) {
  const morning = morningView(s), ticket = morning.tickets.find((t) => t.id === id);
  if (!ticket || morning.stage !== "Dispatched" || ticket.status !== "Assigned" || ticket.recipient !== role) throw new Error("This ticket is unavailable for the selected Mandor.");
  return withEvent({ ...s, morning: { ...morning, tickets: morning.tickets.map((t) => t.id === id ? { ...t, status: "Accepted" as const } : t) } }, "Ticket accepted", id + " · " + role, role);
}
export function hasNewSharedPlan(s: Session) {
  return !!s.morning && hasSharedPlan(s) && (s.morning.sharedVersion ?? (s.morning.origin === "approved" ? 1 : 0)) < sharedPlanVersion(s);
}
export function receiveSharedPlan(s: Session) {
  if (!hasSharedPlan(s)) throw new Error("The office pre-plan has not been shared.");
  const current = requireMorning(s,true);

  if (!hasNewSharedPlan(s)) return s;
  const incoming = structuredClone(s.plan.baseline || s.plan.items), previous = current.approvedItems;
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const items: PlanItem[] = [];
  for (const local of current.items) {
    if (current.tickets.some((t) => t.itemId === local.id)) { items.push(local); continue; }
    const original = previous.find((i) => i.id === local.id), remote = incoming.find((i) => i.id === local.id);
    if (!original) { items.push(local); continue; }
    if (!remote) { if (!same(local, original)) items.push(local); continue; }
    const merged = { ...remote };
    for (const key of new Set([...Object.keys(original), ...Object.keys(local), ...Object.keys(remote)]) as Set<keyof PlanItem>) {
      if (!same(local[key], original[key])) { if (key in local) Object.assign(merged, { [key]: local[key] }); else Reflect.deleteProperty(merged, key); }
    }
    items.push(merged);
  }
  for (const remote of incoming) {
    if (previous.some((i) => i.id === remote.id) || items.some((i) => i.id === remote.id)) continue;
    items.push(remote);
  }
  if (items.some((i, n) => items.slice(n + 1).some((j) => activityGroupKey(i) === activityGroupKey(j) && i.fieldNo === j.fieldNo))) throw new Error("The shared plan and morning work contain the same activity and field. Review that duplicate field before receiving this revision.");
  const remoteWorkers = s.plan.baselineWorkers || planWorkers(s), roster: WorkerAllocation[] = [];
  for (const item of items) for (const workerId of item.workerIds) {
    const groupKey = activityGroupKey(item);
    if (roster.some((w) => w.groupKey === groupKey && w.workerId === workerId)) continue;
    const original = current.approvedWorkers.find((w) => w.groupKey === groupKey && w.workerId === workerId);
    const local = current.workerAllocations.find((w) => w.groupKey === groupKey && w.workerId === workerId);
    const remote = remoteWorkers.find((w) => w.groupKey === groupKey && w.workerId === workerId);
    roster.push(local && !same(local, original) ? local : remote || local || { groupKey, workerId, evitCode: "" });
  }
  const remoteMuster = s.plan.sharedVersions?.at(-1)?.muster || s.plan.muster;
  const baseMuster = current.approvedMuster;
  const localMuster = current.muster;
  let mergedMuster = structuredClone(remoteMuster);
  if (localMuster) {
    mergedMuster = structuredClone(localMuster);
    const remoteLines = remoteMuster?.lines || [], baseLines = baseMuster?.lines || [];
    mergedMuster.lines = [];
    for (const local of localMuster.lines) {
      const original = baseLines.find((l) => l.id === local.id), remote = remoteLines.find((l) => l.id === local.id);
      if (!original) { mergedMuster.lines.push(local); continue; }
      if (!remote) { if (!same(local,original)) mergedMuster.lines.push(local); continue; }
      mergedMuster.lines.push({ ...remote, ...Object.fromEntries(Object.entries(local).filter(([k,v]) => !same(v,original[k as keyof typeof original]))) });
    }
    for (const remote of remoteLines) if (!baseLines.some((l) => l.id === remote.id) && !mergedMuster.lines.some((l) => l.id === remote.id)) mergedMuster.lines.push(remote);
    for (const k of ["crop","categories","evits"] as const) if (same(localMuster[k],baseMuster?.[k]) && remoteMuster) Object.assign(mergedMuster, { [k]: structuredClone(remoteMuster[k]) });
  }
  const draft = { ...morningSession(s), plan: { ...morningSession(s).plan, muster: mergedMuster, items, workerAllocations: roster } };
  const recorded = record(s, current, draft, "Shared pre-plan received", "V" + sharedPlanVersion(s) + " received; existing FO amendments and attendance retained.");
  return { ...recorded, morning: { ...recorded.morning!, id: s.plan.id, origin: "approved" as const, sharedVersion: sharedPlanVersion(s),
    approvedMuster: structuredClone(remoteMuster), approvedItems: structuredClone(incoming), approvedWorkers: structuredClone(remoteWorkers) } };
}
export function workTitle(item: PlanItem) {
  return item.planningSource === "harvesting-interval" ? "Harvesting" : programmes.find((p) => p.id === item.programmeId)?.title || activityName(item.activityCode) || "General work";
}


/** Planned information remains independent of completed Ha and Checkroll. */
export function updateMorningMuster(s: Session, data: MusterData, allocate = false): Session {
  return amend(s, allocate ? "Muster positions allocated" : "Muster plan updated", allocate ? "Present workers allocated from the current working-gang pool" : "Planned Muster Chit information updated", (draft) => setMuster(draft, data, allocate), allocate);
}
export function allocateMorningLine(s: Session, lineId: string, ids: string[]): Session {
  return amend(s, "Muster positions allocated", "Present workers allocated from the current working-gang pool", (draft) => allocateMusterLine(draft, lineId, ids), true);
}
export function saveMusterDraft(s: Session): Session {
  const before = requireMorning(s, true), view = morningSession(s, before), data = musterFor(view);
  data.savedAt = new Date().toISOString();
  return withEvent({ ...s, morning: { ...before, muster: data } }, "Muster Chit draft saved", before.id + " · Planned information retained", "Field Officer");
}
export function submitMuster(s: Session): Session {
  const before = requireMorning(s), view = morningSession(s, before), issues = musterIssues(view);
  if (issues.length) throw new Error(issues[0]);
  const preparedView = { ...view, plan: { ...view.plan, items: view.plan.items.map((i) => ({ ...i, workerIds: i.workerIds.filter((id) => before.attendance[id] === "Present") })) } };
  const data = musterFor(preparedView), submittedAt = new Date().toISOString();
  const snapshot = musterSnapshot(data), last = data.submissions.at(-1);
  if (!last || JSON.stringify(last.data) !== JSON.stringify(snapshot) || JSON.stringify(last.items) !== JSON.stringify(preparedView.plan.items) || JSON.stringify(last.attendance) !== JSON.stringify(before.attendance)) {
    data.submissions.push({ revision: data.submissions.length + 1, submittedAt, items: structuredClone(preparedView.plan.items), workers: structuredClone(planWorkers(preparedView).filter((w) => preparedView.plan.items.some((i) => i.workerIds.includes(w.workerId)))), attendance: { ...before.attendance }, data: snapshot });
  }
  data.savedAt = submittedAt;
  return confirmMorning({ ...s, morning: { ...before, muster: data } }, "Muster Chit submitted · Planned work only; actual Ha and Checkroll recorded separately.");
}

/** A submitted daily instruction is the basis for material requests and Mandore tickets. */
export type DailyChoice = MobileWorkChoice;
export function createWorkDraft(s: Session, choice: DailyChoice, date = s.plan.date): Session {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + "T12:00:00Z").toISOString().slice(0,10) !== date) throw new Error("Choose a valid work date.");
  if (!activities.some((a) => a.code === choice.activityCode)) throw new Error("Choose an activity code.");
  if (new Set(choice.fields).size !== choice.fields.length || choice.fields.some((f) => !fields.some((row) => row.fieldNo === f))) throw new Error("Choose fields from the master list.");
  if (choice.kind !== "general" && !choice.fields.length) throw new Error("Choose at least one field.");
  const p = choice.programmeId ? programmes.find((p) => p.id === choice.programmeId && p.activityCode === choice.activityCode) : undefined;
  if (choice.programmeId && !p) throw new Error("Choose the matching Work Programme.");
  const blank = createSession("blank"), selected = choice.fields.length ? choice.fields : [""];
  const items: PlanItem[] = selected.map((fieldNo,index) => {
    if (p && !p.fields.some((f) => f.fieldNo === fieldNo)) throw new Error("Choose a field within this programme.");
    const item = makeItem("DRAFT-" + (index+1),p,fieldNo);
    return { ...item, fieldNo, activityCode: choice.activityCode, instructionOrigin: "onsite", remark: "",
      ...(p ? {} : choice.kind === "general" ? { planningSource: "general" as const, groupId:"general:onsite:" + choice.activityCode } : { planningSource:"daily-work" as const, workCategory:choice.kind, groupId:"daily:" + choice.kind + ":" + choice.activityCode }),
      ...(choice.kind === "harvesting" ? { harvestType:choice.harvestType || (choice.activityCode === "PH4008" ? "Support" : "FFB") } : {}) };
  });
  return { ...blank, sequence:s.sequence, plan:{...blank.plan,date,items} };
}
function forWorkDate(s: Session, date: string) {
  if (s.plan.date === date) return s;
  const record = dailyRecords(s).find((r) => r.plan.date === date);
  return record ? openDailyRecord(s,record.plan.id) : createDailyPlan(s,date);
}
export function acceptDailyWork(s: Session, itemIds: string[], actor: OfficeRole = "Field Officer"): Session {
  if (!isManagement(actor)) throw new Error("Only estate management can accept work.");
  const before = requireMorning(s,true), selected = [...new Set(itemIds)];
  if (!selected.length || selected.some((id) => !before.items.some((i) => i.id === id))) throw new Error("Select a submitted activity to accept.");
  if (selected.every((id) => before.tickets.some((ticket) => ticket.itemId === id))) return s;
  if (!attendanceReady(s)) throw new Error("Submit attendance before accepting work and sending tickets.");
  const draft = morningSession(s,before), dispatched = dispatchTickets({ ...draft, plan: { ...draft.plan, status:"Submitted" } },selected);
  return withEvent({ ...s, clock:"field", morning:{ ...before, stage:"Dispatched", tickets:dispatched.plan.tickets, acceptedItemIds:[...new Set([...(before.acceptedItemIds || before.tickets.map((t) => t.itemId)),...selected])] } },
    "Work accepted", selected.length + " field instruction(s) · Relevant Mandore notified",actor);
}
export function submitDailyWork(s: Session, draft: Session, actor: OfficeRole): Session {
  if (!isManagement(actor)) throw new Error("Only estate management can add work.");
  const target = forWorkDate(s,draft.plan.date), before = requireMorning(target,true);
  const issues = planIssues(draft); if (issues.length) throw new Error(issues[0]);
  const used = new Set([...target.plan.items,...before.items].map((i) => i.id));
  let n = target.sequence + before.items.length + 1;
  const items = draft.plan.items.map((i) => {
    if (before.items.some((old) => old.activityCode === i.activityCode && old.fieldNo === i.fieldNo && workKind(old) === workKind(i) && (old.harvestType || "FFB") === (i.harvestType || "FFB"))) throw new Error("This activity and field are already listed. Edit the existing work instead.");
    while (used.has("MW-ITEM-" + n)) n++;
    const id = "MW-ITEM-" + n++; used.add(id);
    return { ...i,id,workerIds:[],instructionOrigin:"onsite" as const, ...(i.planningSource === "general" ? { groupId:"general:onsite:" + i.activityCode } : {}) };
  });
  const merged = { ...morningSession(target,before), plan:{ ...morningSession(target,before).plan, items:[...before.items,...items] } };
  const recorded = record(target,before,merged,"Work programme submitted","On-the-spot work submitted with material requirements",before.gangByWorker,actor);
  return recorded;
}
export function saveDailyWorkChanges(s: Session, itemIds: string[], replacement: PlanItem[], actor: OfficeRole): Session {
  if (!isManagement(actor)) throw new Error("Only estate management can edit instructions.");
  const before = requireMorning(s,true);
  const ids = new Set(before.tickets.filter((t) => itemIds.includes(t.itemId)).map((t) => t.id));
  if ((s.machine?.jobs || []).some((job) => job.dayId===s.plan.id && itemIds.includes(job.itemId) && !["Pending","Reassigned"].includes(job.phase))) throw new Error("This instruction has an accepted machine job. Keep that history and add further work separately.");
  if ((s.completions || []).some((work) => ids.has(work.ticketId) && work.reports.length)) throw new Error("This instruction has actual work recorded. Keep that history and record additional work separately.");
  if (replacement.length !== itemIds.length || replacement.some((i) => !itemIds.includes(i.id)) || itemIds.some((id) => !before.items.some((i) => i.id === id))) throw new Error("This activity has changed. Reopen it.");
  const draft = { ...morningSession(s,before),plan:{ ...morningSession(s,before).plan,items:replacement} };
  const issues = planIssues(draft); if (issues.length) throw new Error(issues[0]);
  const merged = { ...draft,plan:{ ...draft.plan,items:before.items.map((i) => replacement.find((r) => r.id === i.id) || i)} };
  if (merged.plan.items.some((i,index) => i.fieldNo && merged.plan.items.slice(index+1).some((o) => o.activityCode === i.activityCode && o.fieldNo === i.fieldNo && workKind(o) === workKind(i) && (o.harvestType || "FFB") === (i.harvestType || "FFB")))) throw new Error("This activity and field already exist in the listing.");
  const roster: WorkerAllocation[] = [];
  for (const item of merged.plan.items) for (const workerId of item.workerIds) {
    const groupKey = activityGroupKey(item);
    if (roster.some((w) => w.groupKey === groupKey && w.workerId === workerId)) continue;
    const previous = before.items.find((i) => i.id === item.id);
    const allocation = before.workerAllocations.find((w) => w.workerId === workerId && w.groupKey === (previous ? activityGroupKey(previous) : groupKey));
    roster.push({groupKey,workerId,evitCode:allocation?.evitCode || ""});
  }
  merged.plan.workerAllocations = roster;
  return record(s,before,merged,"Work instruction amended","Activity, field and resource details updated before work",before.gangByWorker,actor);
}

export function submitAdditionalWorkDraft(s: Session, actor: OfficeRole): Session {
  const next=submitDailyWork(s,additionalWorkDraft(s),actor);
  const plan={...next.plan};delete plan.workDraft;
  return {...next,plan};
}
