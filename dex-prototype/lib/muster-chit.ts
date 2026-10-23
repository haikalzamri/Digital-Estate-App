import scenario from "@/data/scenarios/muster-chit.json";
import { activityGroupKey, assignedWorkerIds, fieldMachines, machines, planWorkers, programmeGroups, workers, type PlanItem, type Session, type WorkerAllocation } from "@/lib/workshop";

export type HarvestType = "FFB" | "LF" | "Support";
export type ManpowerLine = { id: string; groupKey: string; remark: string; plannedPax: number | null; itemIds: string[]; workerIds: string[] };
export type CropPlan = { inField: number | null; bin: number | null; platform: number | null; estimate: number | null; looseFruit: number | null };
export type EvitPlan = { id: string; evitCode: string; itemIds: string[]; driverId: string };
export type MusterSnapshot = { lines: ManpowerLine[]; crop: CropPlan; categories: Record<string, number[]>; absenceReasons: Record<string, string>; evits: EvitPlan[] };
export type MusterSubmission = { revision: number; submittedAt: string; items: PlanItem[]; workers: WorkerAllocation[]; attendance: Session["plan"]["attendance"]; data: MusterSnapshot };
export type MusterData = MusterSnapshot & { savedAt?: string; submissions: MusterSubmission[] };
export const categoryNames = scenario.categoryNames;
export const absenceReasons = scenario.absenceReasons;
export const harvestType = (item: Pick<PlanItem, "harvestType">): HarvestType => item.harvestType || "FFB";
const clone = <T,>(value: T): T => structuredClone(value);
const uniq = (ids: string[]) => [...new Set(ids)];
export function musterFor(s: Session): MusterData {
  const stored = s.plan.muster;
  const claimed = new Set<string>();
  const lines: ManpowerLine[] = [];
  for (const g of programmeGroups(s)) {
    const ids = g.items.map((i) => i.id), allocated = uniq(g.items.flatMap((i) => i.workerIds));
    const previous = stored?.lines.filter((l) => l.groupKey === g.key) || [];
    const base: ManpowerLine[] = previous.length ? clone(previous) : [{ id: "MP:" + g.key, groupKey: g.key, remark: "", plannedPax: allocated.length || null, itemIds: ids, workerIds: allocated }];
    const covered = new Set(base.flatMap((l) => l.itemIds));
    base[0].itemIds = uniq([...base[0].itemIds, ...ids.filter((id) => !covered.has(id))]);
    for (const l of base) {
      l.itemIds = l.itemIds.filter((id) => ids.includes(id));
      l.workerIds = l.workerIds.filter((id) => allocated.includes(id) && l.itemIds.some((itemId) => g.items.find((i) => i.id === itemId)?.workerIds.includes(id)) && !claimed.has(id));
      l.workerIds.forEach((id) => claimed.add(id));
      lines.push(l);
    }
    for (const id of allocated.filter((id) => !claimed.has(id))) {
      const l = base.find((l) => l.itemIds.some((itemId) => g.items.find((i) => i.id === itemId)?.workerIds.includes(id)));
      if (l) { l.workerIds.push(id); claimed.add(id); }
    }
  }
  return {
    lines, crop: clone(stored?.crop || scenario.crop),
    categories: clone(stored?.categories || Object.fromEntries(categoryNames.map((n) => [n, [0, 0, 0, 0]]))),
    absenceReasons: clone(stored?.absenceReasons || {}),
    evits: clone(stored?.evits || []).map((e) => ({ ...e, itemIds: e.itemIds.filter((id) => s.plan.items.some((i) => i.id === id)), driverId: assignedWorkerIds(s).includes(e.driverId) ? e.driverId : "" })).filter((e) => e.itemIds.length),
    submissions: clone(stored?.submissions || []), ...(stored?.savedAt ? { savedAt: stored.savedAt } : {}),
  };
}
export function manpowerIssues(s: Session, groupKey?: string): string[] {
  const rows = musterFor(s).lines.filter((l) => !groupKey || l.groupKey === groupKey);
  return rows.flatMap((l) => {
    const name = l.remark.trim() || l.groupKey;
    if (!l.remark.trim() && rows.filter((row) => row.groupKey === l.groupKey).length > 1) return ["Enter an activity description for each Pax requirement."];
    if (!Number.isInteger(l.plannedPax) || !(l.plannedPax! > 0)) return ["Enter planned Pax for " + name + "."];
    if (l.workerIds.filter((id) => s.plan.attendance[id] !== "Absent").length > l.plannedPax!) return ["Allocated workers exceed planned Pax for " + name + "."];
    if (!l.itemIds.length) return ["Choose a field for " + name + "."];
    return [];
  });
}
export function musterIssues(s: Session): string[] {
  const data = musterFor(s);
  const invalidMachine = data.evits.some((e) => !machines.some((m) => m.code === e.evitCode && m.planningAvailability === "available" && m.pmvStatus !== "breakdown"));
  return [...manpowerIssues(s), ...(invalidMachine ? ["Choose an available EVIT in the EVIT section."] : [])];
}
export function setMuster(s: Session, data: MusterData, allocate = false): Session {
  if (s.plan.status !== "Draft") throw new Error("Amend the pre-plan before changing planned information.");
  if (!musterValid(data)) throw new Error("Check the planned quantities, Pax and selected workers.");
  const allowedItems = new Set(s.plan.items.map((i) => i.id));
  if (data.lines.some((l) => l.itemIds.some((id) => !allowedItems.has(id) || activityGroupKey(s.plan.items.find((i) => i.id === id)!) !== l.groupKey))) throw new Error("Choose fields within this activity.");
  if (new Set(data.lines.flatMap((l) => l.workerIds)).size !== data.lines.flatMap((l) => l.workerIds).length) throw new Error("A worker can occupy one morning position. Remove their previous allocation first.");
  const next = { ...s, plan: { ...s.plan, muster: clone(data) } };
  if (!allocate) return next;
  const oldRoster = planWorkers(s);
  next.plan.items = s.plan.items.map((i) => ({ ...i, workerIds: uniq(data.lines.filter((l) => l.itemIds.includes(i.id)).flatMap((l) => l.workerIds)) }));
  next.plan.workerAllocations = data.lines.flatMap((l) => l.workerIds.map((workerId) => oldRoster.find((w) => w.groupKey === l.groupKey && w.workerId === workerId) || { groupKey: l.groupKey, workerId, evitCode: "" }));
  for (const e of data.evits) {
    next.plan.workerAllocations = next.plan.workerAllocations.map((w) => w.evitCode === e.evitCode ? { ...w, evitCode: "" } : w);
    if (e.driverId) {
      const destination = next.plan.items.find((i) => e.itemIds.includes(i.id) && i.workerIds.includes(e.driverId));
      if (!destination) throw new Error("Allocate the EVIT driver to its activity and field first.");
      next.plan.workerAllocations = next.plan.workerAllocations.map((w) => w.workerId === e.driverId && w.groupKey === activityGroupKey(destination) ? { ...w, evitCode: e.evitCode } : w);
    }
  }
  return next;
}
export function editManpower(s: Session, groupKey: string, lineId: string, patch: Partial<Pick<ManpowerLine, "remark" | "plannedPax" | "itemIds">>): Session {
  const data = musterFor(s);
  data.lines = data.lines.map((l) => l.id === lineId && l.groupKey === groupKey ? { ...l, ...patch } : l);
  return setMuster(s, data, patch.itemIds != null);
}
export function addManpowerLine(s: Session, key: string): Session {
  const data = musterFor(s), group = programmeGroups(s).find((g) => g.key === key);
  if (!group) throw new Error("Choose an activity.");
  let index = 1; while (data.lines.some((l) => l.id === "MP:" + key + ":" + index)) index++;
  data.lines.push({ id: "MP:" + key + ":" + index, groupKey: key, remark: "", plannedPax: null, itemIds: group.items.map((i) => i.id), workerIds: [] });
  return setMuster(s, data);
}
export function removeManpowerLine(s: Session, lineId: string): Session {
  const data = musterFor(s), line = data.lines.find((l) => l.id === lineId);
  if (!line || data.lines.filter((l) => l.groupKey === line.groupKey).length === 1) throw new Error("Keep at least one description for the activity.");
  data.lines = data.lines.filter((l) => l.id !== lineId);
  return setMuster(s, data, true);
}
export function allocateMusterLine(s: Session, lineId: string, ids: string[]): Session {
  const data = musterFor(s), line = data.lines.find((l) => l.id === lineId);
  if (!line) throw new Error("Choose a planned position.");
  if (ids.some((id) => s.plan.attendance[id] !== "Present" || !workers.some((w) => w.id === id && !w.needsReview))) throw new Error("Choose workers from the clocked-in pool.");
  if (line.plannedPax != null && ids.length > line.plannedPax) throw new Error("Increase planned Pax or select fewer workers.");
  line.workerIds = uniq(ids);
  return setMuster(s, data, true);
}
export function musterSnapshot(data: MusterData): MusterSnapshot {
  return clone({ lines: data.lines, crop: data.crop, categories: data.categories, absenceReasons: data.absenceReasons, evits: data.evits });
}
export function plannedPax(s: Session) { return musterFor(s).lines.reduce((n, l) => n + (l.plannedPax || 0), 0); }
export function plannedMachines(s: Session) {
  const extra = musterFor(s).evits;
  const entries = s.plan.items.flatMap((i) => fieldMachines(s, i).map((code) => ({ code, itemId: i.id })));
  return uniq(entries.map((e) => e.code)).map((code) => ({ code, itemIds: uniq(entries.filter((e) => e.code === code).map((e) => e.itemId)), driverIds: uniq([...planWorkers(s).filter((w) => w.evitCode === code).map((w) => w.workerId), ...extra.filter((e) => e.evitCode === code).map((e) => e.driverId)].filter(Boolean)) }));
}
export function musterValid(value: unknown): value is MusterData {
  if (!value || typeof value !== "object") return false;
  const d = value as MusterData;
  const nonnegative = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const ids = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string") && new Set(v).size === v.length;
  const snapshotValid = (x: MusterSnapshot) => !!x && Array.isArray(x.lines) && new Set(x.lines.map((l) => l?.id)).size === x.lines.length && x.lines.every((l) => l && typeof l.id === "string" && typeof l.groupKey === "string" && typeof l.remark === "string" && (l.plannedPax === null || nonnegative(l.plannedPax) && Number.isInteger(l.plannedPax)) && ids(l.itemIds) && ids(l.workerIds) && l.workerIds.every((id) => workers.some((w) => w.id === id && !w.needsReview))) && !!x.crop && ["inField","bin","platform","estimate","looseFruit"].every((k) => { const v = x.crop[k as keyof CropPlan]; return v === null || nonnegative(v); }) && !!x.categories && categoryNames.every((k) => Array.isArray(x.categories[k]) && x.categories[k].length === 4 && x.categories[k].every((n) => nonnegative(n) && Number.isInteger(n))) && !!x.absenceReasons && Object.entries(x.absenceReasons).every(([id, r]) => workers.some((w) => w.id === id && !w.needsReview) && absenceReasons.includes(r)) && Array.isArray(x.evits) && x.evits.every((e) => e && typeof e.id === "string" && machines.some((m) => m.code === e.evitCode) && ids(e.itemIds) && typeof e.driverId === "string" && (!e.driverId || workers.some((w) => w.id === e.driverId && !w.needsReview)));
  return snapshotValid(d) && (d.savedAt == null || typeof d.savedAt === "string" && Number.isFinite(Date.parse(d.savedAt))) && Array.isArray(d.submissions) && d.submissions.every((v, i) => v && v.revision === i + 1 && typeof v.submittedAt === "string" && Number.isFinite(Date.parse(v.submittedAt)) && Array.isArray(v.items) && Array.isArray(v.workers) && v.attendance && snapshotValid(v.data));
}
