import scenario from "@/data/scenarios/machine-operations.json";
import { dailyRecords, fieldMachines, isManagement, machines, withEvent, workers, type PhoneRole, type PlanItem, type Session } from "@/lib/workshop";
import { morningSession, morningView, attendanceReady } from "@/lib/morning-work";
import { warehouseFor } from "@/lib/warehouse";

export type MachineRole = "Machine Operator" | "Machine Specialist";
export type DriverAssignment = { evitCode: string; role: MachineRole };
export type MachineActor = { role: PhoneRole; workerId: string };
export type MachinePhase = "Pending" | "Accepted" | "Ready" | "Running" | "Breakdown" | "Ended" | "Submitted" | "Approved" | "Reassigned";
export type MachinePoint = { x: number; y: number };
export type MachineCheck = { status: "Operating" | "Idling" | "Breakdown"; ips: "" | "Yes" | "No"; items: Record<string, "Baik" | "Kurang">; reason: string; remark: string; fuelLitres: number; pickupIds: string[] };
export type MachineSegment = { kind: "Operating" | "Downtime"; start: string; end?: string };
export type MachineIssue = { id: string; category: string; remark: string; at: string; position: MachinePoint; photo?: string };
export type MachineBreakdown = { component: string; remark: string; start: string; end?: string };
export type MachineReport = { revision: number; declaredHa: number; remark: string; submittedAt: string; status: "Pending approval" | "Approved"; approvedAt?: string; approvedBy?: string };
export type MachineJob = {
  id: string; dayId: string; itemId: string; sourceTicketId: string; date: string; driverId: string; role: MachineRole; evitCode: string; item: PlanItem;
  phase: MachinePhase; openedAt?: string; acceptedAt?: string; preparedAt?: string; check?: MachineCheck;
  segments: MachineSegment[]; issues: MachineIssue[]; breakdowns: MachineBreakdown[]; endedAt?: string; trackedHa?: number; routeProgress?: number; reports: MachineReport[];
};
export type MachineData = { schemaVersion: 1; jobs: MachineJob[] };
export const machineScenario = scenario;
export const isMachineRole = (role: string): role is MachineRole => role === "Machine Operator" || role === "Machine Specialist";
export const latestMachineReport = (job: MachineJob) => job.reports.at(-1);
const round = (n: number) => Math.round(n * 100) / 100;
const validNumber = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const iso = (at: number) => { if (!Number.isFinite(at)) throw new Error("Invalid machine time."); return new Date(at).toISOString(); };
const activePhases: MachinePhase[] = ["Accepted", "Ready", "Running", "Breakdown", "Ended"];
export function defaultMachineCheck(): MachineCheck {
  return { status: "Operating", ips: "", items: Object.fromEntries(scenario.checklist.map((i) => [i.key, "Baik"])), reason: "", remark: "", fuelLitres: 0, pickupIds: [] };
}
export function machineJobs(s: Session): MachineJob[] {
  const candidates: MachineJob[] = [];
  for (const record of dailyRecords(s)) {
    const day = { ...s, ...record, morning: record.morning }, m = morningView(day);
    if (!attendanceReady(day)) continue;
    for (const item of m.items) {
      const source = m.tickets.find((t) => t.itemId === item.id);
      if (!source) continue;
      for (const evitCode of fieldMachines(morningSession(day), item)) {
        const match = Object.entries(m.machineDrivers || {}).find(([id, assignment]) => assignment.evitCode === evitCode && m.attendance[id] === "Present");
        if (!match) continue;
        const [driverId, assignment] = match;
        if ((s.machine?.jobs||[]).some((j)=>j.dayId===record.plan.id&&j.itemId===item.id&&j.evitCode===evitCode&&j.driverId!==driverId&&!["Pending","Reassigned"].includes(j.phase))) continue;
        candidates.push({ id: ["M3", record.plan.id, item.id, evitCode, driverId].join(":"), dayId: record.plan.id, date: record.plan.date, itemId: item.id, sourceTicketId: source.id,
          driverId, role: assignment.role, evitCode, item: structuredClone(item), phase: "Pending", segments: [], issues: [], breakdowns: [], reports: [] });
      }
    }
  }
  const saved = s.machine?.jobs || [], ids = new Set(saved.map((j) => j.id));
  return [...saved.map((job) => {
    if (job.phase !== "Pending" && job.phase !== "Reassigned") return job;
    const candidate = candidates.find((j) => j.id === job.id);
    return candidate ? { ...job, item: candidate.item, sourceTicketId: candidate.sourceTicketId, phase: "Pending" as const } : { ...job, phase: "Reassigned" as const };
  }), ...candidates.filter((j) => !ids.has(j.id))].sort((a, b) => b.date.localeCompare(a.date) || a.evitCode.localeCompare(b.evitCode) || a.item.fieldNo.localeCompare(b.item.fieldNo));
}
export function machineOperators(s: Session, role?: MachineRole) {
  const entries = new Map<string, { id: string; name: string; role: MachineRole; evits: string[] }>();
  const add = (id: string, assignedRole: MachineRole, evit: string) => {
    if (role && assignedRole !== role) return;
    const worker = workers.find((w) => w.id === id && !w.needsReview); if (!worker) return;
    const key = id + ":" + assignedRole, row = entries.get(key) || { id, name: worker.name, role: assignedRole, evits: [] };
    if (!row.evits.includes(evit)) row.evits.push(evit); entries.set(key, row);
  };
  for (const day of dailyRecords(s)) for (const [id, assignment] of Object.entries(day.morning?.machineDrivers || {})) add(id, assignment.role, assignment.evitCode);
  for (const job of s.machine?.jobs || []) add(job.driverId, job.role, job.evitCode);
  return [...entries.values()].sort((a, b) => a.name.localeCompare(b.name));
}
export function machineUnread(s: Session, role: PhoneRole, workerId?: string) {
  return machineJobs(s).filter((j) => j.phase === "Pending" && !j.openedAt && (isMachineRole(role) ? j.role === role && (!workerId || j.driverId === workerId) : isManagement(role))).length;
}
export function driverAssignmentLocked(s: Session, workerId: string, evitCode?: string) {
  return (s.machine?.jobs || []).some((j) => j.date === s.plan.date && activePhases.includes(j.phase) && (j.driverId === workerId || !!evitCode && j.evitCode === evitCode));
}
function ownJob(s: Session, id: string, actor: MachineActor) {
  const job = machineJobs(s).find((j) => j.id === id);
  if (!job || !isMachineRole(actor.role) || job.role !== actor.role || job.driverId !== actor.workerId) throw new Error("Only the assigned operator can update this ticket.");
  if (job.phase === "Reassigned") throw new Error("This ticket has been reassigned. Refresh Work Listing.");
  return structuredClone(job);
}
function saveJob(s: Session, job: MachineJob, title: string, actor: string): Session {
  const data: MachineData = { schemaVersion: 1, jobs: [...(s.machine?.jobs || []).filter((j) => j.id !== job.id), job] };
  return withEvent({ ...s, machine: data }, title, job.evitCode + " · " + job.item.activityCode + " · " + job.item.fieldNo, actor);
}
export function openMachineJob(s: Session, id: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor); if (job.openedAt) return s;
  job.openedAt = iso(at); return saveJob(s, job, "Machine ticket opened", actor.role);
}
export function acceptMachineJob(s: Session, id: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor); if (job.phase !== "Pending") return s;
  job.phase = "Accepted"; job.openedAt ||= iso(at); job.acceptedAt = iso(at);
  return saveJob(s, job, "Machine job accepted", actor.role);
}
export function machinePickupItems(s: Session, job: MachineJob) {
  const movements = warehouseFor(s).movements;
  return movements.filter((m) => m.kind === "Issue out" && m.status === "Posted" && (m.requestKey?.startsWith(job.dayId + "|" + job.itemId + "|") || m.workKey === job.dayId + "|" + job.itemId))
    .map((m) => ({ ...m, availableQuantity: Math.max(0, m.quantity - movements.filter((r) => r.kind === "Return to store" && r.reference === m.id).reduce((n, r) => n + r.quantity, 0)) })).filter((m) => m.availableQuantity > 0);
}
function checkValid(check: MachineCheck) {
  return !!check && ["Operating", "Idling", "Breakdown"].includes(check.status) && ["", "Yes", "No"].includes(check.ips) && typeof check.reason === "string" && typeof check.remark === "string" &&
    validNumber(check.fuelLitres) && Array.isArray(check.pickupIds) && new Set(check.pickupIds).size === check.pickupIds.length && check.pickupIds.every((id) => typeof id === "string") &&
    !!check.items && scenario.checklist.every((i) => ["Baik", "Kurang"].includes(check.items[i.key])) && Object.keys(check.items).length === scenario.checklist.length;
}
export function prepareMachineJob(s: Session, id: string, input: MachineCheck, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (!["Accepted", "Ready"].includes(job.phase)) throw new Error("Accept the job before completing its preparation.");
  if (!checkValid(input)) throw new Error("Complete the machine status and checklist.");
  const check = structuredClone(input);
  if (check.status === "Operating") {
    if (!check.ips) throw new Error("Answer the IPS battery question.");
    const pickup = machinePickupItems(s, job);
    if (check.pickupIds.some((id) => !pickup.some((m) => m.id === id))) throw new Error("Confirm only materials already issued by Warehouse.");
    job.phase = "Ready";
  } else {
    if (!check.reason.trim()) throw new Error("Choose the idling reason or breakdown component.");
    job.phase = "Submitted"; job.endedAt = iso(at); job.trackedHa = 0; job.routeProgress = 0;
    job.reports.push({ revision: 1, declaredHa: 0, remark: check.remark, submittedAt: iso(at), status: "Pending approval" });
    check.fuelLitres = 0; check.pickupIds = [];
  }
  job.check = check; job.preparedAt = iso(at);
  return saveJob(s, job, check.status === "Operating" ? "Machine preparation confirmed" : "Machine job closed · " + check.status, actor.role);
}
function closeSegment(job: MachineJob, at: number) {
  const current = job.segments.at(-1);
  if (current && !current.end) { if (at < Date.parse(current.start)) throw new Error("Machine time cannot move backwards."); current.end = iso(at); }
}
export function startMachineJob(s: Session, id: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (job.phase === "Running") return s;
  if (job.phase !== "Ready" || job.check?.status !== "Operating") throw new Error("Confirm preparation before starting tracking.");
  if (machineJobs(s).some((j) => j.id !== id && ["Running", "Breakdown"].includes(j.phase) && (j.driverId === job.driverId || j.evitCode === job.evitCode))) throw new Error("Finish or resume the current machine job before starting another.");
  job.phase = "Running"; job.segments.push({ kind: "Operating", start: iso(at) });
  return saveJob(s, job, "Machine tracking started", actor.role);
}
export function machineElapsed(job: MachineJob, at = Date.now()) {
  const sum = (kind: MachineSegment["kind"]) => job.segments.filter((s) => s.kind === kind).reduce((n, s) => n + Math.max(0, (s.end ? Date.parse(s.end) : at) - Date.parse(s.start)) / 1000, 0);
  return { operating: sum("Operating"), downtime: sum("Downtime") };
}
export function machineProgress(job: MachineJob, at = Date.now()) {
  return job.routeProgress ?? Math.min(1, machineElapsed(job, at).operating / scenario.simulationSecondsPerRoute);
}
export function machineTrackedHa(job: MachineJob, at = Date.now()) {
  return job.trackedHa ?? round(job.item.targetHa * machineProgress(job, at));
}
const route: MachinePoint[] = [{x:.18,y:.85},{x:.8,y:.85},{x:.8,y:.68},{x:.18,y:.68},{x:.18,y:.5},{x:.8,y:.5},{x:.8,y:.32},{x:.18,y:.32},{x:.18,y:.15},{x:.8,y:.15}];
export function machineRoute(progress: number): MachinePoint[] {
  const p = Math.min(1, Math.max(0, progress)) * (route.length - 1), i = Math.floor(p), base = route.slice(0, i + 1);
  if (i < route.length - 1 && p > i) base.push({ x: route[i].x + (route[i+1].x-route[i].x)*(p-i), y: route[i].y + (route[i+1].y-route[i].y)*(p-i) });
  return base;
}
export function addMachineIssue(s: Session, id: string, input: Omit<MachineIssue, "id" | "at">, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (job.phase !== "Running") throw new Error("Pin issues while the job is operating.");
  if (!scenario.issueCategories.includes(input.category) || !input.position || ![input.position.x,input.position.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) ||
    typeof input.remark !== "string" || input.photo != null && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(input.photo) || input.photo.length > 450000)) throw new Error("Choose an issue category, location and a supported photo.");
  job.issues.push({ ...input, id: job.id + ":PIN:" + (job.issues.length + 1), at: iso(at) });
  return saveJob(s, job, "Machine issue pinned", actor.role);
}
export function breakMachineJob(s: Session, id: string, component: string, remark: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (job.phase !== "Running") throw new Error("Only an operating job can declare a breakdown.");
  if (!scenario.damageComponents.includes(component)) throw new Error("Choose the breakdown component.");
  closeSegment(job, at); job.phase = "Breakdown"; job.segments.push({ kind: "Downtime", start: iso(at) });
  job.breakdowns.push({ component, remark: remark.trim(), start: iso(at) });
  return saveJob(s, job, "Machine breakdown declared", actor.role);
}
export function resumeMachineJob(s: Session, id: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (job.phase !== "Breakdown") throw new Error("This job is not paused for breakdown.");
  closeSegment(job, at); job.breakdowns.at(-1)!.end = iso(at); job.phase = "Running";
  job.segments.push({ kind: "Operating", start: iso(at) });
  return saveJob(s, job, "Machine tracking resumed", actor.role);
}
export function endMachineJob(s: Session, id: string, actor: MachineActor, at = Date.now()) {
  const job = ownJob(s, id, actor);
  if (!["Running", "Breakdown"].includes(job.phase)) throw new Error("Start tracking before ending work.");
  closeSegment(job, at); const breakdown = job.breakdowns.at(-1); if (breakdown && !breakdown.end) breakdown.end = iso(at);
  job.routeProgress = machineProgress(job, at); job.trackedHa = machineTrackedHa(job, at);
  job.phase = "Ended"; job.endedAt = iso(at);
  return saveJob(s, job, "Machine work ended", actor.role);
}
export function submitMachineReport(s: Session, id: string, declaredHa: number, remark: string, actor: MachineActor, expectedRevision: number, at = Date.now()) {
  const job = ownJob(s, id, actor), latest = latestMachineReport(job);
  if (!["Ended", "Submitted", "Approved"].includes(job.phase)) throw new Error("End tracking before reporting completion.");
  if ((latest?.revision || 0) !== expectedRevision) throw new Error("This report has changed. Reopen the ticket.");
  if (!validNumber(declaredHa) || Math.abs(round(declaredHa) - declaredHa) > .000001) throw new Error("Enter completed Ha with up to two decimal places.");
  if (job.check?.status !== "Operating" && declaredHa !== 0) throw new Error("A job closed before operating has zero machine Ha.");
  if (latest && latest.declaredHa === declaredHa && latest.remark === remark.trim()) return s;
  job.reports.push({ revision: job.reports.length + 1, declaredHa, remark: remark.trim(), submittedAt: iso(at), status: "Pending approval" });
  job.phase = "Submitted";
  return saveJob(s, job, "Machine productivity submitted", actor.role);
}
export function approveMachineReports(s: Session, selection: { id: string; revision: number }[], role: PhoneRole, at = Date.now()) {
  if (!isManagement(role)) throw new Error("Machine productivity is approved by estate management in M2.");
  if (!selection.length || new Set(selection.map((v) => v.id)).size !== selection.length) throw new Error("Select pending machine reports.");
  const jobs = structuredClone(s.machine?.jobs || []);
  for (const selected of selection) {
    const job = jobs.find((j) => j.id === selected.id), report = job && latestMachineReport(job);
    if (!job || job.phase !== "Submitted" || !report || report.status !== "Pending approval" || report.revision !== selected.revision) throw new Error("A selected report has changed. Refresh the selection.");
  }
  for (const selected of selection) {
    const job = jobs.find((j) => j.id === selected.id)!, report = latestMachineReport(job)!;
    report.status = "Approved"; report.approvedAt = iso(at); report.approvedBy = role; job.phase = "Approved";
  }
  return withEvent({ ...s, machine: { schemaVersion: 1, jobs } }, "Machine productivity approved", selection.length + " report(s) · Machine Ha retained separately", role);
}
export function machineJobLabel(job: MachineJob) {
  if (job.phase === "Submitted" || job.phase === "Approved") return job.check?.status !== "Operating" ? job.check?.status || job.phase : job.phase === "Approved" ? "Completed" : "Completed";
  return ({ Pending: "Pending", Accepted: "Checklist pending", Ready: "Ready to start", Running: "Operating", Breakdown: "Breakdown", Ended: "Completion pending", Reassigned: "Reassigned" } as Record<string,string>)[job.phase] || job.phase;
}
export function machineSummary(s: Session, date: string) {
  const jobs = machineJobs(s).filter((j) => j.date === date && j.phase !== "Reassigned"), reports = jobs.filter((j) => j.reports.length);
  return { jobs: jobs.length, pending: reports.filter((j) => latestMachineReport(j)?.status === "Pending approval").length, unsubmitted: jobs.filter((j) => !j.reports.length).length,
    approved: reports.filter((j) => latestMachineReport(j)?.status === "Approved").length, declaredHa: round(reports.reduce((n,j) => n + (latestMachineReport(j)?.declaredHa || 0),0)),
    approvedHa: round(reports.filter((j) => latestMachineReport(j)?.status === "Approved").reduce((n,j) => n + latestMachineReport(j)!.declaredHa,0)) };
}
export function machineValid(value: unknown): boolean {
  if (value == null) return true;
  try {
    const data = value as MachineData;
    if (data.schemaVersion !== 1 || !Array.isArray(data.jobs) || new Set(data.jobs.map((j) => j.id)).size !== data.jobs.length) return false;
    const time = (v: unknown) => typeof v === "string" && Number.isFinite(Date.parse(v));
    for (const j of data.jobs) {
      if (!j || !["id","dayId","itemId","sourceTicketId","date","driverId","evitCode"].every((key) => typeof (j as unknown as Record<string,unknown>)[key] === "string") ||
        !workers.some((w) => w.id === j.driverId && !w.needsReview) || !machines.some((m) => m.code === j.evitCode) || !isMachineRole(j.role) ||
        !["Pending","Accepted","Ready","Running","Breakdown","Ended","Submitted","Approved","Reassigned"].includes(j.phase) || !j.item || j.item.id !== j.itemId || !validNumber(j.item.targetHa) ||
        !Array.isArray(j.segments) || !Array.isArray(j.issues) || !Array.isArray(j.breakdowns) || !Array.isArray(j.reports) || j.check != null && !checkValid(j.check)) return false;
      for (const key of ["openedAt","acceptedAt","preparedAt","endedAt"] as const) if (j[key] != null && !time(j[key])) return false;
      if (j.trackedHa != null && !validNumber(j.trackedHa) || j.routeProgress != null && (!validNumber(j.routeProgress) || j.routeProgress > 1)) return false;
      if (j.segments.some((v,i) => !["Operating","Downtime"].includes(v.kind) || !time(v.start) || v.end != null && (!time(v.end) || Date.parse(v.end) < Date.parse(v.start)) ||
        !v.end && i !== j.segments.length - 1 || i > 0 && (!j.segments[i-1].end || Date.parse(v.start) < Date.parse(j.segments[i-1].end!)))) return false;
      const active = j.segments.filter((v) => !v.end);
      if (["Running","Breakdown"].includes(j.phase) ? active.length !== 1 || active[0].kind !== (j.phase === "Running" ? "Operating" : "Downtime") : active.length !== 0) return false;
      if (j.issues.some((p) => !p || !time(p.at) || !scenario.issueCategories.includes(p.category) || typeof p.remark !== "string" || !p.position || ![p.position.x,p.position.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1) ||
        p.photo != null && (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(p.photo) || p.photo.length > 450000))) return false;
      if (j.breakdowns.some((b) => !scenario.damageComponents.includes(b.component) || typeof b.remark !== "string" || !time(b.start) || b.end != null && (!time(b.end) || Date.parse(b.end) < Date.parse(b.start)))) return false;
      if (j.reports.some((r,i) => r.revision !== i+1 || !validNumber(r.declaredHa) || typeof r.remark !== "string" || !time(r.submittedAt) || !["Pending approval","Approved"].includes(r.status) ||
        r.status === "Approved" && (!time(r.approvedAt) || !isManagement(r.approvedBy || "")))) return false;
      const latest = latestMachineReport(j);
      if (j.phase === "Submitted" && latest?.status !== "Pending approval" || j.phase === "Approved" && latest?.status !== "Approved" || latest && !["Submitted","Approved"].includes(j.phase)) return false;
      if (["Ready","Running","Breakdown","Ended","Submitted","Approved"].includes(j.phase) && !j.check) return false;
    }
    return true;
  } catch { return false; }
}
