import type { PrePlanDay, PrePlanProgramme, PrePlanStore } from "@/lib/types/pre-plan";

// Retain the original key so the map prototype's saved plans can be migrated.
export const PRE_PLAN_STORAGE_KEY = "dge-pre-plan-prototype-v1";

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function tomorrowDate(now = new Date()) {
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return localDate(tomorrow);
}

export function isPlanDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return Number.isFinite(date.getTime()) && localDate(date) === value;
}

export function emptyPlan(date: string): PrePlanDay {
  return { date, status: "Draft", programmes: [], allocations: [], fieldDetails: [], savedAt: null };
}

function assertDraft(plan: PrePlanDay) {
  if (plan.status !== "Draft") throw new Error("Reopen the demo plan before editing.");
}

function getProgramme(plan: PrePlanDay, programme: string) {
  const card = plan.programmes.find((item) => item.programme === programme);
  if (!card) throw new Error("Add the programme card first.");
  return card;
}

export function addProgramme(plan: PrePlanDay, programme: string): PrePlanDay {
  assertDraft(plan);
  if (!programme.trim()) throw new Error("Choose a programme first.");
  if (plan.programmes.some((item) => item.programme === programme)) return plan;
  return { ...plan, programmes: [...plan.programmes, { programme, fieldIds: [] }] };
}

export function removeProgramme(plan: PrePlanDay, programme: string): PrePlanDay {
  assertDraft(plan);
  return {
    ...plan,
    programmes: plan.programmes.filter((item) => item.programme !== programme),
    allocations: plan.allocations.filter((item) => item.programme !== programme),
    fieldDetails: plan.fieldDetails.filter((item) => item.programme !== programme),
  };
}

export function addProgrammeField(plan: PrePlanDay, programme: string, fieldId: string): PrePlanDay {
  assertDraft(plan);
  const card = getProgramme(plan, programme);
  if (!fieldId.trim()) throw new Error("Choose a field from the list.");
  if (card.fieldIds.includes(fieldId)) return plan;
  return { ...plan, programmes: plan.programmes.map((item) => item.programme === programme
    ? { ...item, fieldIds: [...item.fieldIds, fieldId] } : item) };
}

export function removeProgrammeField(plan: PrePlanDay, programme: string, fieldId: string): PrePlanDay {
  assertDraft(plan);
  getProgramme(plan, programme);
  return {
    ...plan,
    programmes: plan.programmes.map((item) => item.programme === programme
      ? { ...item, fieldIds: item.fieldIds.filter((id) => id !== fieldId) } : item),
    allocations: plan.allocations.map((item) => item.programme === programme
      ? { ...item, fieldIds: item.fieldIds.filter((id) => id !== fieldId) } : item),
    fieldDetails: plan.fieldDetails.filter((item) => item.programme !== programme || item.fieldId !== fieldId),
  };
}

export function addWorkersToProgramme(plan: PrePlanDay, workerIds: string[], programme: string): PrePlanDay {
  assertDraft(plan);
  getProgramme(plan, programme);
  const ids = new Set(workerIds);
  if (!ids.size || workerIds.some((id) => !id)) throw new Error("Select workers first.");
  if (plan.allocations.some((item) => ids.has(item.workerId) && item.programme !== programme)) {
    throw new Error("A selected worker already belongs to another programme on this date. Remove them from that card first.");
  }
  const added = [...ids].filter((id) => !plan.allocations.some((item) => item.workerId === id));
  if (!added.length) return plan;
  return { ...plan, allocations: [...plan.allocations, ...added.map((workerId) => ({ workerId, programme, fieldIds: [] }))] };
}

export function removeWorker(plan: PrePlanDay, programme: string, workerId: string): PrePlanDay {
  assertDraft(plan);
  return { ...plan, allocations: plan.allocations.filter((item) => item.programme !== programme || item.workerId !== workerId) };
}

export function toggleWorkerField(plan: PrePlanDay, workerId: string, fieldId: string): PrePlanDay {
  assertDraft(plan);
  const worker = plan.allocations.find((item) => item.workerId === workerId);
  if (!worker) throw new Error("Add this worker to a programme first.");
  if (!getProgramme(plan, worker.programme).fieldIds.includes(fieldId)) throw new Error("Add this field to the programme first.");
  return { ...plan, allocations: plan.allocations.map((item) => item.workerId === workerId
    ? { ...item, fieldIds: item.fieldIds.includes(fieldId) ? item.fieldIds.filter((id) => id !== fieldId) : [...item.fieldIds, fieldId] }
    : item) };
}

export function applyFieldsToWorkers(plan: PrePlanDay, programme: string, workerIds: string[], fieldIds: string[]): PrePlanDay {
  assertDraft(plan);
  const card = getProgramme(plan, programme);
  if (!workerIds.length || !fieldIds.length) throw new Error("Select workers and fields to apply.");
  if (fieldIds.some((id) => !card.fieldIds.includes(id))) throw new Error("Only fields listed in this programme can be assigned.");
  if (workerIds.some((id) => !plan.allocations.some((item) => item.workerId === id && item.programme === programme))) {
    throw new Error("Select workers from this programme only.");
  }
  const ids = new Set(workerIds);
  return { ...plan, allocations: plan.allocations.map((item) => ids.has(item.workerId)
    ? { ...item, fieldIds: [...new Set([...item.fieldIds, ...fieldIds])] } : item) };
}

export function finalisationIssues(plan: PrePlanDay) {
  const issues: string[] = [];
  if (!plan.programmes.length) issues.push("Add at least one programme.");
  for (const card of plan.programmes) {
    const workers = plan.allocations.filter((item) => item.programme === card.programme);
    if (!card.fieldIds.length) issues.push(`${card.programme}: add at least one field.`);
    if (!workers.length) issues.push(`${card.programme}: add workers or remove the empty card.`);
    const missing = workers.filter((item) => !item.fieldIds.length).length;
    if (missing) issues.push(`${card.programme}: select fields for ${missing} worker${missing === 1 ? "" : "s"}.`);
  }
  return issues;
}

export function finalisePlan(plan: PrePlanDay): PrePlanDay {
  assertDraft(plan);
  const issues = finalisationIssues(plan);
  if (issues.length) throw new Error(issues.join(" "));
  return { ...plan, status: "Finalised" };
}

export function parsePlanStore(raw: string | null): PrePlanStore {
  if (!raw) return { version: 2, days: {} };
  const store: unknown = JSON.parse(raw);
  const invalid = (): never => { throw new Error("Saved prototype data could not be read. Reload or clear this prototype’s browser data before saving."); };
  if (!isObject(store) || ![1, 2].includes(Number(store.version)) || !isObject(store.days)) return invalid();
  if (store.version !== 1 && store.version !== 2) return invalid();
  const days: Record<string, PrePlanDay> = {};
  for (const [date, plan] of Object.entries(store.days)) {
    if (!isPlanDate(date) || !isObject(plan) || plan.date !== date || !["Draft", "Finalised"].includes(String(plan.status))) return invalid();
    if (!Array.isArray(plan.allocations) || !Array.isArray(plan.fieldDetails)) return invalid();
    if (plan.savedAt !== null && (typeof plan.savedAt !== "string" || !Number.isFinite(Date.parse(plan.savedAt)))) return invalid();
    const workers = new Set<string>();
    for (const item of plan.allocations) {
      if (!isObject(item) || typeof item.workerId !== "string" || !item.workerId || workers.has(item.workerId)) return invalid();
      if (typeof item.programme !== "string" || !item.programme || !isUniqueStrings(item.fieldIds)) return invalid();
      if (store.version === 1 && !item.fieldIds.length) return invalid();
      workers.add(item.workerId);
    }
    const details = new Set<string>();
    for (const detail of plan.fieldDetails) {
      if (!isObject(detail) || typeof detail.programme !== "string" || !detail.programme || typeof detail.fieldId !== "string" || !detail.fieldId || typeof detail.remarks !== "string") return invalid();
      if (detail.targetHa !== null && (typeof detail.targetHa !== "number" || !Number.isFinite(detail.targetHa) || detail.targetHa <= 0)) return invalid();
      const key = JSON.stringify([detail.programme, detail.fieldId]);
      if (details.has(key)) return invalid();
      details.add(key);
    }
    // Convert earlier map allocations into one card and a field pool per programme.
    const legacy = plan as unknown as Omit<PrePlanDay, "programmes">;
    const programmes: PrePlanProgramme[] = [];
    if (store.version === 1) {
      for (const item of [...legacy.allocations, ...legacy.fieldDetails.map((detail) => ({ programme: detail.programme, fieldIds: [detail.fieldId] }))]) {
        let card = programmes.find((entry) => entry.programme === item.programme);
        if (!card) { card = { programme: item.programme, fieldIds: [] }; programmes.push(card); }
        card.fieldIds = [...new Set([...card.fieldIds, ...item.fieldIds])];
      }
    } else {
      if (!Array.isArray(plan.programmes)) return invalid();
      const names = new Set<string>();
      for (const card of plan.programmes) {
        if (!isObject(card) || typeof card.programme !== "string" || !card.programme || names.has(card.programme) || !isUniqueStrings(card.fieldIds)) return invalid();
        names.add(card.programme);
        programmes.push({ programme: card.programme, fieldIds: card.fieldIds });
      }
      for (const allocation of legacy.allocations) {
        const card = programmes.find((item) => item.programme === allocation.programme);
        if (!card || allocation.fieldIds.some((id) => !card.fieldIds.includes(id))) return invalid();
      }
      for (const detail of legacy.fieldDetails) {
        if (!programmes.some((item) => item.programme === detail.programme && item.fieldIds.includes(detail.fieldId))) return invalid();
      }
    }
    const converted: PrePlanDay = { ...legacy, programmes };
    // Old finalised records may include notes-only programmes; keep data and reopen for review.
    if (converted.status === "Finalised" && finalisationIssues(converted).length) {
      if (store.version === 2) return invalid();
      converted.status = "Draft";
    }
    days[date] = converted;
  }
  return { version: 2, days };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isUniqueStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0) && new Set(value).size === value.length;
}
