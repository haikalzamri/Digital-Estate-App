import type { PhoneRole, Session, Ticket, WorkKind } from "@/lib/workshop";
import { activities, fields, gangs, workers, withEvent, workKind, isManagement } from "@/lib/workshop";
import { morningView, effectiveGang } from "@/lib/morning-work";
import { programmes, roundActual, withProgrammeCredits, type ProgrammeCredit } from "@/lib/work-programme";
import { harvestFieldNames, harvestingFieldArea, harvestSource, withHarvestCredits } from "@/lib/harvesting-interval";

export type HarvestTask = { workerId: string; gang: string; task: string; bunches: number };
export type BunchProduction = { kind: "bunches"; rows: HarvestTask[] };
export const harvestingGangs = ["3", "4", "5"];
export const qcWorkers = (s: Session, gang: string) => workers.filter((w) => !w.needsReview && w.harvestingCode === "QC" && harvestingGangs.includes(gang) && effectiveGang(s, w.id) === gang);
export const bunchTotal = (r: HaRevision | undefined) => r?.production?.rows.reduce((n, row) => n + row.bunches, 0) || 0;
export type CompletionStatus = "Reported" | "Validated" | "Returned";
export type HaRevision = {
  production?: BunchProduction; id: number; requestKey?: string; ha: number | null; finish: "Partial" | "Finished"; note: string;
  actor: Ticket["recipient"]; status: CompletionStatus; submittedAt: string;
  reviewNote: string; reviewedAt?: string;
};
export type CompletedWork = {
  harvestType?: import("./muster-chit").HarvestType;
  secondaryJobId?: string; id: string; ticketId: string; origin: "primary" | "secondary"; date: string;
  activityCode: string; fieldNo: string; kind: WorkKind; programmeId: string | null;
  programmeRound?: number; programmeYear?: number; plannedHa: number;
  workerIds: string[]; recipient: Ticket["recipient"]; reports: HaRevision[];
};
export type HaInput = { production?: BunchProduction; requestKey?: string; ha: number | null; finish: "Partial" | "Finished"; note: string };
export type SecondaryInput = HaInput & {
  secondaryJobId?: string; sameWork: boolean; activityCode: string; fieldNo: string; programmeId: string | null;
  programmeRound?: number; newArea: boolean; nonArea?: boolean;
};
export type SecondaryJob = {
  id: string; requestKey: string; ticketId: string; date: string; activityCode: string; fieldNo: string;
  workerIds: string[]; toGang: string; fromGangs: Record<string, string>; note: string; areaRequired: boolean;
  actor: PhoneRole; recordedAt: string; reportWorkId?: string;
};
export type SecondaryJobInput = { requestKey: string; activityCode: string; fieldNo: string; workerIds: string[]; toGang: string; note: string; nonArea: boolean };
export const secondaryJobs = (s: Session) => s.morning?.secondaryJobs || [];
export function recordSecondaryJob(s: Session, ticketId: string, input: SecondaryJobInput, role: PhoneRole) {
  const execution = executionTickets(s), ticket = execution.tickets.find((t) => t.id === ticketId);
  if (!ticket || !isManagement(role) && (role !== ticket.recipient || !["Assigned","Accepted"].includes(ticket.status))) throw new Error("Record secondary work as the Field Officer or the assigned Mandor.");
  if (!input.requestKey.trim() || !input.note.trim()) throw new Error("Add a secondary job note.");
  if (secondaryJobs(s).some((job) => job.requestKey === input.requestKey)) return s;
  if (!activities.some((a) => a.code === input.activityCode) || !fields.some((f) => f.fieldNo === input.fieldNo)) throw new Error("Choose a valid secondary activity and field.");
  const before = morningView(s), ids = [...new Set(input.workerIds)];
  if (ids.some((id) => !workers.some((w) => w.id === id && !w.needsReview) || before.attendance[id] !== "Present")) throw new Error("Choose clocked-in workers for the secondary job.");
  if (input.toGang && (!gangs.includes(input.toGang) || !ids.length)) throw new Error("Select workers and a receiving gang for secondary-job T6.");
  if (input.toGang && ids.some((id) => effectiveGang(s, id) === input.toGang)) throw new Error("The selected workers already belong to that gang.");
  const job: SecondaryJob = { id: "SJ-" + (s.sequence + 1), requestKey: input.requestKey, ticketId, date: execution.date, activityCode: input.activityCode, fieldNo: input.fieldNo,
    workerIds: ids, toGang: input.toGang, fromGangs: Object.fromEntries(ids.map((id) => [id, effectiveGang(s, id)])),
    note: input.note.trim(), areaRequired: !input.nonArea, actor: role, recordedAt: new Date().toISOString() };
  return withEvent({ ...s, morning: { ...before, secondaryJobs: [...secondaryJobs(s), job] } }, input.toGang ? "Secondary job with T6 recorded" : "Secondary job recorded",
    input.activityCode + " · " + input.fieldNo + " · " + (input.toGang ? "Gang " + input.toGang : ids.length + " workers") + " · Original work retained; Ha and Checkroll can follow separately.", role);
}
export function secondaryJobsValid(s: Session) {
  const jobs = s.morning?.secondaryJobs;
  if (jobs == null) return true;
  if (!Array.isArray(jobs) || new Set(jobs.map((j) => j?.id)).size !== jobs.length || new Set(jobs.map((j) => j?.requestKey)).size !== jobs.length) return false;
  const execution = executionTickets(s);
  return jobs.every((j) => {
    if (!j || typeof j.id !== "string" || typeof j.requestKey !== "string" || !j.requestKey.trim() || j.date !== execution.date || typeof j.toGang !== "string" ||
      !activities.some((a) => a.code === j.activityCode) || !fields.some((f) => f.fieldNo === j.fieldNo) || !Array.isArray(j.workerIds) || new Set(j.workerIds).size !== j.workerIds.length ||
      !j.workerIds.every((id) => workers.some((w) => w.id === id && !w.needsReview)) || typeof j.areaRequired !== "boolean" ||
      typeof j.note !== "string" || !j.note.trim() || typeof j.recordedAt !== "string" || !Number.isFinite(Date.parse(j.recordedAt)) ||
      !j.fromGangs || typeof j.fromGangs !== "object" || !j.workerIds.every((id) => gangs.includes(j.fromGangs[id])) ||
      j.toGang && (!gangs.includes(j.toGang) || !j.workerIds.length || j.workerIds.some((id) => j.fromGangs[id] === j.toGang))) return false;
    const ticket = execution.tickets.find((t) => t.id === j.ticketId);
    if (!ticket || !isManagement(j.actor) && j.actor !== ticket.recipient) return false;
    return j.reportWorkId == null || (s.completions || []).some((w) => w.id === j.reportWorkId && w.secondaryJobId === j.id && w.origin === "secondary" && w.ticketId === j.ticketId);
  });
}
const rounded = (n: number) => Math.round(n * 100) / 100;
export const completionWorks = (s: Session) => s.completions || [];
export const latestReport = (w: CompletedWork) => w.reports.at(-1);
export const validatedReport = (w: CompletedWork) => w.reports.findLast((r) => r.status === "Validated");
export const pendingHa = (w: CompletedWork) => latestReport(w)?.status === "Reported" ? rounded((latestReport(w)!.ha || 0) - (validatedReport(w)?.ha || 0)) : 0;
export const pendingReports = (s: Session) => completionWorks(s).filter((w) => latestReport(w)?.status === "Reported");
export function executionTickets(s: Session) {
  return s.morning?.stage === "Dispatched" ? { date: s.morning.date, items: s.morning.items, tickets: s.morning.tickets }
    : s.plan.status === "Dispatched" ? { date: s.plan.date, items: s.plan.items, tickets: s.plan.tickets } : { date: s.plan.date, items: [], tickets: [] };
}
export function primaryWork(s: Session, ticketId: string): CompletedWork {
  const existing = completionWorks(s).find((w) => w.ticketId === ticketId && w.origin === "primary");
  if (existing) return existing;
  const execution = executionTickets(s), ticket = execution.tickets.find((t) => t.id === ticketId);
  const item = execution.items.find((i) => i.id === ticket?.itemId);
  if (!ticket || !item) throw new Error("This work ticket has not been issued.");
  return { id: "HA:" + ticketId, ticketId, origin: "primary", date: execution.date, activityCode: item.activityCode,
    fieldNo: item.fieldNo, harvestType: item.harvestType, kind: workKind(item), programmeId: item.programmeId, programmeRound: item.programmeRound,
    programmeYear: item.programmeYear, plannedHa: item.targetHa, workerIds: [...ticket.workerIds], recipient: ticket.recipient, reports: [] };
}
export function progressDestination(w: CompletedWork) {
  return w.programmeId ? "Work Programme · R" + w.programmeRound
    : w.kind === "harvesting" && w.harvestType === "LF" ? "Loose fruit work · separate from FFB interval" : w.harvestType === "Support" ? "Harvesting support · no FFB interval credit" : w.kind === "harvesting" && harvestFieldNames.includes(w.fieldNo) ? "Harvesting interval" : "Unplanned work · no programme credit";
}
function requireReporter(s: Session, w: CompletedWork, role: PhoneRole) {
  const ticket = executionTickets(s).tickets.find((t) => t.id === w.ticketId);
  if (!ticket || ticket.recipient !== role || w.recipient !== role || !["Assigned","Accepted"].includes(ticket.status)) throw new Error("Report against work assigned to your Mandore role.");
}
function checkBunches(w: CompletedWork, production: BunchProduction) {
  if (w.kind !== "harvesting" || w.origin !== "primary" || production.kind !== "bunches" || !Array.isArray(production.rows) || !production.rows.length) throw new Error("Add at least one harvesting task.");
  if (!Number.isSafeInteger(production.rows.reduce((n, row) => n + (row?.bunches || 0), 0))) throw new Error("The bunch total is too large.");
  const keys = new Set<string>();
  for (const row of production.rows) {
    if (!row || typeof row.task !== "string") throw new Error("Enter a task number.");
    const key = row.workerId + ":" + row.task.trim();
    if (!workers.some((worker) => worker.id === row.workerId && !worker.needsReview && worker.harvestingCode === "QC") || !harvestingGangs.includes(row.gang) || !row.task.trim() || !Number.isSafeInteger(row.bunches) || row.bunches < 0 || keys.has(key)) throw new Error("Use QC workers in gangs 3, 4 or 5, with unique task numbers and whole bunch quantities.");
    keys.add(key);
  }
}
function checkInput(w: CompletedWork, input: HaInput) {
  if (!(["Partial", "Finished"] as string[]).includes(input.finish)) throw new Error("Choose partial or finished work.");
  if (input.production) checkBunches(w, input.production);
  if (input.ha == null ? !input.production && w.kind !== "general" && w.harvestType !== "Support" : !Number.isFinite(input.ha) || input.ha < 0 || rounded(input.ha) !== input.ha) throw new Error("Enter completed hectares, using up to two decimal places. General work may leave Ha blank.");
  if (typeof input.note !== "string") throw new Error("Enter a valid remark.");
}
function saveReport(s: Session, w: CompletedWork, input: HaInput, role: PhoneRole): Session {
  requireReporter(s, w, role); checkInput(w, input);
  if (input.requestKey && completionWorks(s).some((work) => work.reports.some((r) => r.requestKey === input.requestKey))) return s;
  if (latestReport(w)?.status === "Reported") throw new Error("This report is awaiting approval. Return or validate it before another revision.");
  if (input.production && input.ha != null) throw new Error("The Field Officer confirms harvesting Ha during approval.");
  if (input.production?.rows.some((row) => effectiveGang(s, row.workerId) !== row.gang)) throw new Error("A worker’s working gang has changed. Refresh that worker’s gang before submitting.");
  const report: HaRevision = { ...(input.production ? { production: structuredClone(input.production) } : {}), id: s.sequence + 1, ...(input.requestKey ? { requestKey: input.requestKey } : {}), ha: input.ha, finish: input.finish, note: input.note.trim(), actor: w.recipient,
    status: "Reported", submittedAt: new Date().toISOString(), reviewNote: "" };
  const saved = { ...w, reports: [...w.reports, report] };
  return withEvent({ ...acknowledgeReportTicket(s, w.ticketId), clock: "completion", completions: [...completionWorks(s).filter((x) => x.id !== w.id), saved] },
    w.reports.length ? "Productivity correction submitted" : w.origin === "secondary" ? "Secondary work reported" : "Productivity submitted",
    w.activityCode + " · " + w.fieldNo + " · " + (input.production ? bunchTotal(report) + " bunches" : input.ha == null ? "Non-area work" : input.ha + " ha") + " · Checkroll pending", role);
}
function acknowledgeReportTicket(s: Session, ticketId: string): Session {
  if (s.morning?.stage === "Dispatched") return { ...s, morning: { ...s.morning, tickets: s.morning.tickets.map((t) => t.id === ticketId ? { ...t, status: "Accepted" as const } : t) } };
  return { ...s, plan: { ...s.plan, tickets: s.plan.tickets.map((t) => t.id === ticketId ? { ...t, status: "Accepted" as const } : t) } };
}
export function submitFieldReports(s: Session, inputs: { ticketId: string; input: HaInput }[], role: PhoneRole): Session {
  if (!inputs.length || new Set(inputs.map((entry) => entry.ticketId)).size !== inputs.length) throw new Error("Enter production for at least one field.");
  return inputs.reduce((next, entry) => reportTicketHa(next, entry.ticketId, entry.input, role), s);
}
export function reportTicketHa(s: Session, ticketId: string, input: HaInput, role: PhoneRole) {
  return saveReport(s, primaryWork(s, ticketId), input, role);
}
export function reviseWorkHa(s: Session, workId: string, input: HaInput, role: PhoneRole) {
  const w = completionWorks(s).find((w) => w.id === workId);
  if (!w) throw new Error("Choose an existing work report.");
  return saveReport(s, w, input, role);
}
export function secondaryOptions(activityCode: string, fieldNo: string) {
  return programmes.filter((p) => p.activityCode === activityCode).flatMap((p) => p.fields.filter((f) => f.fieldNo === fieldNo).flatMap((f) => f.rounds.map((r) => ({ programmeId: p.id, title: p.title, round: r.number, year: Number(r.dueDate.slice(0, 4)), targetHa: r.targetHa }))));
}
export function reportSecondaryHa(s: Session, ticketId: string, input: SecondaryInput, role: PhoneRole) {
  const parent = primaryWork(s, ticketId); requireReporter(s, parent, role);
  const job = input.secondaryJobId ? secondaryJobs(s).find((j) => j.id === input.secondaryJobId && j.ticketId === ticketId) : undefined;
  if (input.secondaryJobId && !job) throw new Error("Choose an existing secondary job.");
  if (job?.reportWorkId && input.requestKey && completionWorks(s).some((w) => w.id === job.reportWorkId && w.reports.some((r) => r.requestKey === input.requestKey))) return s;
  if (job?.reportWorkId) throw new Error("This secondary job already has a Ha report. Correct that total instead.");
  if (job && (input.activityCode !== job.activityCode || input.fieldNo !== job.fieldNo || input.sameWork && (job.activityCode !== parent.activityCode || job.fieldNo !== parent.fieldNo))) throw new Error("The Ha report must match its secondary job.");
  if (!input.newArea) throw new Error("Confirm this is additional work and does not repeat area already reported.");
  let destination: Partial<CompletedWork>;
  if (input.sameWork) destination = { activityCode: parent.activityCode, fieldNo: parent.fieldNo, kind: parent.kind, harvestType: parent.harvestType, programmeId: parent.programmeId, programmeRound: parent.programmeRound, programmeYear: parent.programmeYear };
  else {
    if (!activities.some((a) => a.code === input.activityCode) || !fields.some((f) => f.fieldNo === input.fieldNo)) throw new Error("Choose a valid secondary activity and field.");
    const option = input.programmeId ? secondaryOptions(input.activityCode, input.fieldNo).find((o) => o.programmeId === input.programmeId && o.round === input.programmeRound) : undefined;
    if (input.programmeId && !option) throw new Error("Choose a matching programme round.");
    destination = { harvestType: input.activityCode === "PH4008" ? "Support" : undefined, activityCode: input.activityCode, fieldNo: input.fieldNo, programmeId: option?.programmeId || null, programmeRound: option?.round, programmeYear: option?.year, kind: option ? "upkeep" : input.activityCode.startsWith("PH") ? "harvesting" : input.nonArea ? "general" : "upkeep" };
  }
  const w: CompletedWork = { ...parent, ...destination, ...(job ? { secondaryJobId: job.id, workerIds: [...job.workerIds] } : {}), id: "HA:SECONDARY:" + (s.sequence + 1), origin: "secondary", plannedHa: 0, reports: [] };
  if (w.kind !== "general" && !(input.ha != null && input.ha > 0)) throw new Error("Additional area must be greater than zero.");
  const next = saveReport(s, w, input, role);
  if (!job || next === s) return next;
  return { ...next, morning: { ...next.morning!, secondaryJobs: secondaryJobs(next).map((j) => j.id === job.id ? { ...j, reportWorkId: w.id } : j) } };
}
export function programmeCredits(s: Session): ProgrammeCredit[] {
  return completionWorks(s).flatMap((w) => {
    const report = validatedReport(w);
    return report && report.ha != null && report.ha > 0 && w.programmeId && w.programmeRound && w.programmeYear
      ? [{ id: w.id, programmeId: w.programmeId, fieldNo: w.fieldNo, round: w.programmeRound, year: w.programmeYear, date: w.date, ha: report.ha }] : [];
  });
}
export const programmesForSession = (s: Session) => withProgrammeCredits(programmeCredits(s));
export function harvestForSession(s: Session) {
  return withHarvestCredits(completionWorks(s).flatMap((w) => {
    const ha = validatedReport(w)?.ha;
    return w.kind === "harvesting" && (!w.harvestType || w.harvestType === "FFB") && harvestFieldNames.includes(w.fieldNo) && ha != null && ha > 0 ? [{ fieldNo: w.fieldNo, date: w.date, ha }] : [];
  }));
}
export function validationIssue(s: Session, w: CompletedWork, confirmedHa?: number | null): string {
  const latest = latestReport(w);
  const report = latest && confirmedHa !== undefined ? { ...latest, ha: confirmedHa } : latest;
  if (!report || report.status !== "Reported") return "This report is no longer awaiting validation.";
  if (w.programmeId) {
    const field = programmes.find((p) => p.id === w.programmeId && p.activityCode === w.activityCode)?.fields.find((f) => f.fieldNo === w.fieldNo);
    const round = field?.rounds.find((r) => r.number === w.programmeRound && Number(r.dueDate.slice(0, 4)) === w.programmeYear);
    if (!round) return "No matching programme round. Return this report for correction.";
    const other = programmeCredits(s).filter((c) => c.id !== w.id && c.programmeId === w.programmeId && c.fieldNo === w.fieldNo && c.round === w.programmeRound && c.year === w.programmeYear).reduce((n, c) => n + c.ha, 0);
    if (rounded(roundActual(round) + other + (report.ha || 0)) > round.targetHa + 0.005) return "This would exceed the round’s " + round.targetHa + " ha. Check for overlapping area or correct the reported total.";
  }
  if (w.kind === "harvesting" && harvestFieldNames.includes(w.fieldNo)) {
    const opening = !w.harvestType || w.harvestType === "FFB" ? harvestSource.activityByField[w.fieldNo]?.[w.date]?.hectare || 0 : 0;
    const other = completionWorks(s).filter((x) => x.id !== w.id && x.kind === "harvesting" && (x.harvestType || "FFB") === (w.harvestType || "FFB") && x.fieldNo === w.fieldNo && x.date === w.date).reduce((n, x) => n + (validatedReport(x)?.ha || 0), 0);
    if (rounded(opening + other + (report.ha || 0)) > harvestingFieldArea(w.fieldNo) + 0.005) return "This would exceed the field area for this harvesting day. Check for repeated coverage.";
  }
  return "";
}
export function reviewWorkHa(s: Session, workId: string, revisionId: number, decision: "Validated" | "Returned", note: string, role: string, confirmedHa?: number | null): Session {
  if (!isManagement(role)) throw new Error("Only estate management can approve productivity.");
  const w = completionWorks(s).find((w) => w.id === workId), report = w && latestReport(w);
  if (!w || !report || report.id !== revisionId || report.status !== "Reported") throw new Error("This report has already changed. Review its latest version.");
  if (decision === "Returned" && !note.trim()) throw new Error("Give a reason when returning Ha.");
  const ha = report.production && decision === "Validated" ? confirmedHa : report.ha;
  if (decision === "Validated") {
    if (report.production && (ha == null ? w.harvestType !== "Support" : !Number.isFinite(ha) || ha < 0 || rounded(ha) !== ha)) throw new Error("Confirm completed harvesting Ha, using up to two decimal places.");
    const issue = validationIssue(s, w, ha); if (issue) throw new Error(issue);
  }
  const updated = { ...w, reports: w.reports.map((r) => r.id === revisionId ? { ...r, ...(decision === "Validated" && r.production ? { ha: ha ?? null } : {}), status: decision, reviewNote: note.trim(), reviewedAt: new Date().toISOString() } : r) };
  return withEvent({ ...s, clock: "completion", completions: completionWorks(s).map((x) => x.id === w.id ? updated : x) },
    decision === "Validated" ? "Productivity approved" : "Productivity returned for correction", w.activityCode + " · " + w.fieldNo + " · " + progressDestination(w) + " · Checkroll pending", role);
}
export function completionSessionValid(s: Session): boolean {
  if (s.completions == null) return true;
  if (!Array.isArray(s.completions)) return false;
  const execution = executionTickets(s), works = s.completions;
  if (!works.every((w) => w && Array.isArray(w.reports))) return false;
  if (new Set(works.map((w) => w?.id)).size !== works.length) return false;
  const jobLinks = works.filter((w) => w.secondaryJobId != null).map((w) => w.secondaryJobId);
  if (new Set(jobLinks).size !== jobLinks.length) return false;
  const requestKeys = works.flatMap((w) => w?.reports?.map((r) => r?.requestKey).filter(Boolean) || []);
  if (new Set(requestKeys).size !== requestKeys.length) return false;
  return works.every((w) => {
    if (!w || typeof w.id !== "string" || !["primary", "secondary"].includes(w.origin) || !["upkeep", "harvesting", "general"].includes(w.kind) || w.date !== execution.date || !Array.isArray(w.workerIds) || !Array.isArray(w.reports) || !w.reports.length || !Number.isFinite(w.plannedHa) || w.plannedHa < 0) return false;
    if (w.harvestType != null && !["FFB","LF","Support"].includes(w.harvestType)) return false;
    if (w.secondaryJobId != null && (w.origin !== "secondary" || typeof w.secondaryJobId !== "string")) return false;
    const ticket = execution.tickets.find((t) => t.id === w.ticketId), item = execution.items.find((i) => i.id === ticket?.itemId);
    if (!ticket || !item || ticket.status !== "Accepted" || ticket.recipient !== w.recipient || !(w.origin === "secondary" && w.secondaryJobId ? secondaryJobs(s).some((j) => j.id === w.secondaryJobId && j.ticketId === ticket.id && j.activityCode === w.activityCode && j.fieldNo === w.fieldNo && w.workerIds.every((id) => j.workerIds.includes(id))) : w.workerIds.every((id) => workers.some((worker) => worker.id === id && !worker.needsReview) && (ticket.workerIds.includes(id) || (s.morning?.changes || []).some((change) => [...change.before, ...change.after].some((old) => old.id === ticket.itemId && old.workerIds.includes(id)))))) || !activities.some((a) => a.code === w.activityCode) || !(fields.some((f) => f.fieldNo === w.fieldNo) || w.kind === "general" && w.fieldNo === "")) return false;
    if (w.origin === "primary" && (w.id !== "HA:" + ticket.id || w.activityCode !== item.activityCode || w.fieldNo !== item.fieldNo || w.programmeId !== item.programmeId || w.programmeRound !== item.programmeRound || w.programmeYear !== item.programmeYear || w.kind !== workKind(item) || (w.harvestType || "FFB") !== (item.harvestType || "FFB"))) return false;
    if (w.programmeId != null && w.kind !== "upkeep") return false;
    if (w.programmeId != null && !secondaryOptions(w.activityCode, w.fieldNo).some((o) => o.programmeId === w.programmeId && o.round === w.programmeRound && o.year === w.programmeYear)) return false;
    if (w.programmeId == null && (w.programmeRound != null || w.programmeYear != null)) return false;
    if (new Set(w.reports.map((r) => r?.id)).size !== w.reports.length) return false;
    return w.reports.every((r, index) => {
      if (!r || !Number.isInteger(r.id) || r.id <= 0 || (index > 0 && r.id <= w.reports[index - 1].id) || r.actor !== w.recipient || !["Reported", "Validated", "Returned"].includes(r.status) || typeof r.note !== "string" || typeof r.submittedAt !== "string" || !Number.isFinite(Date.parse(r.submittedAt)) || typeof r.reviewNote !== "string") return false;
      if (r.requestKey != null && (typeof r.requestKey !== "string" || !r.requestKey.trim())) return false;
      if (r.status === "Reported" && (r.reviewedAt != null || r.reviewNote !== "")) return false;
      try { checkInput(w, r); } catch { return false; }
      if (r.production && (r.status === "Validated" ? r.ha == null && w.harvestType !== "Support" : r.ha != null)) return false;
      return (r.status !== "Reported" || index === w.reports.length - 1) && (r.status === "Reported" || typeof r.reviewedAt === "string" && Number.isFinite(Date.parse(r.reviewedAt))) && (r.status !== "Returned" || !!r.reviewNote.trim());
    });
  });
}

