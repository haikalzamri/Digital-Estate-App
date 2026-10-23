import rules from "@/data/scenarios/checkroll-rules.json";
import rateSource from "@/data/reference/rates.json";
import { activities, fields, gangs, workers, withEvent, isManagement, type OfficeRole, type Session } from "@/lib/workshop";
import { morningView, effectiveGang } from "@/lib/morning-work";
import { completionWorks, validatedReport, type CompletedWork } from "@/lib/work-completion";

export type PaymentMethod = "daily" | "piece" | "bunch";
export type CheckrollRole = OfficeRole;
export type CheckrollTask = { task: string; bunches: number; gang: string };
export type CheckrollRow = {
  id: string; workId: string; workerId: string; gang: string; method: PaymentMethod;
  quantity: string; rateCode: string; secondaryActivity: string; secondaryField: string; otHours: string; note: string;
  source: "manual" | "productivity"; sourceRevision?: number; bunches?: number; tasks?: CheckrollTask[];
};
export type CheckrollSubmission = {
  revision: number; requestKey: string; submittedAt: string; actor: CheckrollRole;
  rows: CheckrollRow[]; context: string;
};
export type CheckrollDay = { date: string; rows: CheckrollRow[]; submissions: CheckrollSubmission[]; savedAt?: string };
export const paymentMethods = rules.methods as { id: PaymentMethod; label: string }[];
export const checkrollRates = rateSource.records.map((r) => ({ code: r.rateCode, unit: r.rateDescription, value: r.rateValue }));
export const presentPool = (s: Session) => workers.filter((w) => !w.needsReview && morningView(s).attendance[w.id] === "Present")
  .sort((a,b) => effectiveGang(s,a.id).localeCompare(effectiveGang(s,b.id),undefined,{numeric:true}) || a.name.localeCompare(b.name));
export const approvedCheckrollWork = (s: Session) => completionWorks(s).filter((w) => w.date === s.plan.date && validatedReport(w));
export function defaultPayment(s: Session, workerId: string, gang = effectiveGang(s,workerId)): PaymentMethod {
  const worker = workers.find((w) => w.id === workerId);
  if (worker?.harvestingCode === rules.bunchWorkerCode && rules.bunchGangs.includes(gang)) return "bunch";
  if (rules.pieceGangs.includes(gang)) return "piece";
  return "daily";
}
function secondaryGang(s: Session, workId: string, workerId: string) {
  const work = completionWorks(s).find((w) => w.id === workId);
  const job = s.morning?.secondaryJobs?.find((j) => j.id === work?.secondaryJobId && j.workerIds.includes(workerId));
  return job?.toGang || "";
}
export const checkrollGang = (s: Session, workId: string, workerId: string) => secondaryGang(s,workId,workerId) || effectiveGang(s,workerId);
const rowId = (workId: string, workerId: string) => workId + "|" + workerId;
function baseRow(s: Session, workId: string, workerId: string): CheckrollRow {
  return { id:rowId(workId,workerId),workId,workerId,gang:checkrollGang(s,workId,workerId),method:defaultPayment(s,workerId,checkrollGang(s,workId,workerId)),
    quantity:"",rateCode:"",secondaryActivity:"",secondaryField:"",otHours:"0",note:"",source:"manual" };
}
function approvedWorkerData(work: CompletedWork, workerId: string) {
  const r = validatedReport(work), tasks = r?.production?.rows.filter((row) => row.workerId === workerId).map(({task,bunches,gang}) => ({task,bunches,gang})) || [];
  return tasks.length ? { source:"productivity" as const,sourceRevision:r!.id,bunches:tasks.reduce((n,row) => n+row.bunches,0),tasks } : null;
}
/** Approved facts refresh the draft only. Submitted snapshots are immutable. */
export function checkrollView(s: Session): CheckrollDay {
  const existing = s.morning?.checkroll, work = approvedCheckrollWork(s);
  const rows = structuredClone(existing?.rows || []);
  for (const w of work) {
    const report = validatedReport(w)!;
    for (const workerId of new Set(report.production?.rows.map((row) => row.workerId) || [])) {
      const data = approvedWorkerData(w,workerId)!;
      const previous = rows.find((row) => row.id === rowId(w.id,workerId));
      if (!previous) rows.push({...baseRow(s,w.id,workerId),...data,method:"bunch"});
      else Object.assign(previous,data);
    }
  }
  return {date:s.plan.date,rows,submissions:existing?.submissions || [],savedAt:existing?.savedAt};
}
function requireEditor(role: string): asserts role is CheckrollRole {
  if (!isManagement(role)) throw new Error("Checkroll is available to estate management.");
}
function structuralRows(s: Session, rows: CheckrollRow[]) {
  if (!Array.isArray(rows) || new Set(rows.map((r) => r?.id)).size !== rows.length) return false;
  return rows.every((r) => r && r.id === rowId(r.workId,r.workerId) && workers.some((w) => w.id === r.workerId && !w.needsReview)
    && gangs.includes(r.gang) && paymentMethods.some((m) => m.id === r.method)
    && ["quantity","rateCode","secondaryActivity","secondaryField","otHours","note"].every((key) => typeof r[key as keyof CheckrollRow] === "string")
    && ["manual","productivity"].includes(r.source) && completionWorks(s).some((w) => w.id === r.workId && w.date === s.plan.date && validatedReport(w))
    && (r.rateCode === "" || checkrollRates.some((rate) => rate.code === r.rateCode))
    && (r.secondaryActivity === "" || activities.some((a) => a.code === r.secondaryActivity))
    && (r.secondaryField === "" || fields.some((f) => f.fieldNo === r.secondaryField))
    && (r.source === "manual" ? r.sourceRevision == null && r.bunches == null && r.tasks == null :
      Number.isInteger(r.sourceRevision) && Number.isSafeInteger(r.bunches) && r.bunches! >= 0 && Array.isArray(r.tasks) && r.tasks.length > 0
      && r.tasks.every((task) => task && typeof task.task === "string" && task.task.trim() && Number.isSafeInteger(task.bunches) && task.bunches >= 0 && ["3","4","5"].includes(task.gang))
      && r.bunches === r.tasks.reduce((n,t) => n+t.bunches,0)
      && completionWorks(s).find((w) => w.id === r.workId)?.reports.some((report) => report.id === r.sourceRevision && report.status === "Validated" &&
        JSON.stringify(report.production?.rows.filter((row) => row.workerId === r.workerId).map(({task,bunches,gang}) => ({task,bunches,gang}))) === JSON.stringify(r.tasks))));
}
function draftRows(s: Session, rows: CheckrollRow[], role: string): Session {
  requireEditor(role);
  if (!structuralRows(s,rows)) throw new Error("Check the Checkroll workers and approved work references.");
  const before = morningView(s), current = checkrollView(s);
  return {...s,morning:{...before,checkroll:{...current,rows:structuredClone(rows)}}};
}
export function assignCheckrollWorkers(s: Session, workId: string, ids: string[], role: string): Session {
  requireEditor(role);
  if (!approvedCheckrollWork(s).some((w) => w.id === workId)) throw new Error("Choose approved completed work.");
  const pool = presentPool(s);
  if (!ids.length || ids.some((id) => !pool.some((w) => w.id === id))) throw new Error("Choose present workers from the working-gang pool.");
  const day = checkrollView(s), rows = [...day.rows];
  for (const id of new Set(ids)) if (!rows.some((row) => row.id === rowId(workId,id))) rows.push(baseRow(s,workId,id));
  return draftRows(s,rows,role);
}
export function updateCheckrollRow(s: Session, id: string, changes: Partial<Pick<CheckrollRow,"method"|"quantity"|"rateCode"|"secondaryActivity"|"secondaryField"|"otHours"|"note">>, role: string) {
  const day = checkrollView(s);
  if (!day.rows.some((row) => row.id === id)) throw new Error("This allocation is unavailable.");
  return draftRows(s,day.rows.map((row) => row.id === id ? {...row,...changes} : row),role);
}
export function removeCheckrollRow(s: Session, id: string, role: string) {
  const day = checkrollView(s), row = day.rows.find((row) => row.id === id);
  if (row?.source === "productivity") throw new Error("Approved bunch records are retained. Change the payment method if needed.");
  return draftRows(s,day.rows.filter((row) => row.id !== id),role);
}
const validNumber = (value: string, min = 0, max = Infinity) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= min && Number(value) <= max;
export function checkrollIssues(s: Session, day = checkrollView(s)): string[] {
  const issues:string[] = [], pool = presentPool(s);
  if (!day.rows.length) issues.push("Allocate at least one present worker to approved work.");
  for (const row of day.rows) {
    const worker = workers.find((w) => w.id === row.workerId)!;
    const prefix = worker.name + ": ";
    if (!pool.some((w) => w.id === row.workerId)) issues.push(prefix + "not clocked in. Confirm attendance before submitting.");
    if (row.gang !== checkrollGang(s,row.workId,row.workerId)) issues.push(prefix + "working gang changed. Refresh this allocation.");
    if (row.method === "daily") {
      if (!validNumber(row.otHours,0,24)) issues.push(prefix + "enter OT hours from 0 to 24.");
      if (row.secondaryField && !row.secondaryActivity) issues.push(prefix + "choose the secondary activity for this field.");
    }
    if (row.method === "piece") {
      if (!validNumber(row.quantity,0.000001)) issues.push(prefix + "enter a piece-rated quantity greater than zero.");
      if (!checkrollRates.some((rate) => rate.code === row.rateCode && rate.unit !== "Daily")) issues.push(prefix + "choose a piece rate type.");
    }
    if (row.method === "bunch" && (row.source !== "productivity" || row.bunches == null)) issues.push(prefix + "no approved bunch count is available for this field.");
  }
  for (const id of new Set(day.rows.map((row) => row.workerId))) {
    if (day.rows.filter((row) => row.workerId === id && row.method === "daily").reduce((n,row) => n+(Number(row.otHours)||0),0) > 24) issues.push("Total OT exceeds 24 hours for " + workers.find((w) => w.id === id)!.name + ".");
  }
  return [...new Set(issues)];
}
function context(s: Session) {
  return JSON.stringify({present:presentPool(s).map((w) => [w.id,effectiveGang(s,w.id)]),approved:approvedCheckrollWork(s).map((w) => [w.id,validatedReport(w)!.id]).sort()});
}
export function refreshCheckrollGangs(s: Session, role: string) {
  return draftRows(s,checkrollView(s).rows.map((row) => ({...row,gang:checkrollGang(s,row.workId,row.workerId)})),role);
}
export function saveCheckrollDraft(s: Session, role: string): Session {
  requireEditor(role);
  const day = checkrollView(s), before = morningView(s);
  return withEvent({...s,morning:{...before,checkroll:{...day,savedAt:new Date().toISOString()}}},"Checkroll draft saved",s.plan.date + " · " + day.rows.length + " worker allocations",role);
}
export function submitCheckroll(s: Session, role: string, requestKey: string): Session {
  requireEditor(role);
  const day = checkrollView(s);
  if (!requestKey.trim()) throw new Error("A submission reference is required.");
  if (day.submissions.some((submission) => submission.requestKey === requestKey)) return s;
  const issues = checkrollIssues(s,day); if (issues.length) throw new Error(issues[0]);
  const last = day.submissions.at(-1), currentContext = context(s);
  if (last && JSON.stringify(last.rows) === JSON.stringify(day.rows) && last.context === currentContext) return s;
  const submittedAt = new Date().toISOString();
  const submission:CheckrollSubmission = {revision:day.submissions.length+1,requestKey,submittedAt,actor:role,rows:structuredClone(day.rows),context:currentContext};
  return withEvent({...s,morning:{...morningView(s),checkroll:{...day,savedAt:submittedAt,submissions:[...day.submissions,submission]}}},"Checkroll submitted",s.plan.date + " · V" + submission.revision + " · Prototype record",role);
}
export function checkrollSummary(s: Session) {
  const day = checkrollView(s), last = day.submissions.at(-1), pool = presentPool(s);
  const remaining = pool.filter((w) => !day.rows.some((row) => row.workerId === w.id)).length;
  const unallocatedWork = approvedCheckrollWork(s).filter((w) => !day.rows.some((row) => row.workId === w.id)).length;
  const changed = !!last && (JSON.stringify(last.rows) !== JSON.stringify(day.rows) || last.context !== context(s));
  const invalid = new Set(day.rows.filter((row) => checkrollIssues(s,{...day,rows:[row]}).length).map((row)=>row.id));
  for (const id of new Set(day.rows.map((row)=>row.workerId))) if(day.rows.filter((row)=>row.workerId===id&&row.method==="daily").reduce((n,row)=>n+(Number(row.otHours)||0),0)>24) day.rows.filter((row)=>row.workerId===id).forEach((row)=>invalid.add(row.id));
  const pendingInputs = remaining + invalid.size;
  const done = !!last && !changed && !pendingInputs && !unallocatedWork;
  const status = last ? changed ? "Needs update" : remaining || unallocatedWork ? "Partially submitted" : "Submitted" : day.rows.length ? "Draft" : "Not started";
  return {day,last,remaining,unallocatedWork,pendingInputs,changed,done,status,workers:new Set(day.rows.map((row) => row.workerId)).size,
    text:status + (day.rows.length ? " · " + new Set(day.rows.map((row) => row.workerId)).size + " workers" : "")};
}
function submittedValuesValid(rows: CheckrollRow[]) {
  if (rows.some((row) => row.method === "daily" && (!validNumber(row.otHours,0,24) || row.secondaryField && !row.secondaryActivity)
    || row.method === "piece" && (!validNumber(row.quantity,0.000001) || !checkrollRates.some((rate) => rate.code === row.rateCode && rate.unit !== "Daily"))
    || row.method === "bunch" && row.source !== "productivity")) return false;
  return [...new Set(rows.map((row) => row.workerId))].every((id) => rows.filter((row) => row.workerId === id && row.method === "daily").reduce((n,row) => n+Number(row.otHours),0) <= 24);
}
export function checkrollValid(s: Session) {
  const day = s.morning?.checkroll;
  if (day == null) return true;
  if (!day || day.date !== s.plan.date || !structuralRows(s,day.rows) || !Array.isArray(day.submissions)) return false;
  if (day.savedAt != null && (typeof day.savedAt !== "string" || !Number.isFinite(Date.parse(day.savedAt)))) return false;
  const requests = new Set<string>();
  return day.submissions.every((submission,index) => {
    if (!submission || submission.revision !== index+1 || !isManagement(submission.actor) ||
      typeof submission.requestKey !== "string" || !submission.requestKey.trim() || requests.has(submission.requestKey) ||
      typeof submission.submittedAt !== "string" || !Number.isFinite(Date.parse(submission.submittedAt)) || typeof submission.context !== "string" ||
      !structuralRows(s,submission.rows) || !submission.rows.length) return false;
    requests.add(submission.requestKey);
    try {
      const snapshot = JSON.parse(submission.context);
      if (!Array.isArray(snapshot.present) || !Array.isArray(snapshot.approved) || !submittedValuesValid(submission.rows)) return false;
      if (!snapshot.present.every((entry: unknown) => Array.isArray(entry) && entry.length === 2 && workers.some((worker) => worker.id === entry[0] && !worker.needsReview) && gangs.includes(entry[1]))) return false;
      if (!snapshot.approved.every((entry: unknown) => Array.isArray(entry) && entry.length === 2 && completionWorks(s).some((work) => work.id === entry[0] && work.date === s.plan.date && work.reports.some((report) => report.id === entry[1] && report.status === "Validated")))) return false;
      return submission.rows.every((row) => snapshot.present.some((entry: string[]) => entry[0] === row.workerId && (secondaryGang(s,row.workId,row.workerId) || entry[1]) === row.gang)
        && snapshot.approved.some((entry: [string,number]) => entry[0] === row.workId && (row.source !== "productivity" || row.sourceRevision === entry[1])));
    } catch { return false; }
  });
}
