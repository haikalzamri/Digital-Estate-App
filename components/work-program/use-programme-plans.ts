"use client";

import { useEffect, useMemo, useState } from "react";
import {
  dashboardSourceRows,
  fieldKey,
  formatNumber,
  normaliseKey,
  type FieldFeature,
} from "@/lib/work-program/analytics";
import { DASHBOARD_YEAR, PROGRAM_TYPES, monthsForYear } from "@/lib/work-program/config";

export const PROGRAMME_PLAN_EVENT = "dge-work-programme-plans-updated";
export const PROGRAMME_PLAN_CACHE_KEY = "dge-work-programme-plans-v1";

export type ProgrammePlanActor = "Assistant Manager" | "Manager";
export type ProgrammePlanStatus = "Draft" | "Pending Approval" | "Approved" | "Archived";

export type ProgrammePlanField = {
  id: string;
  field: string;
  category: string;
  hectares: number;
  actualBudget: "Programme";
  months: Record<string, number>;
};

export type ProgrammePlanLog = {
  id: string;
  at: string;
  actor: ProgrammePlanActor;
  action: string;
  detail: string;
  reason?: string;
};

export type ProgrammePlan = {
  id: string;
  name: string;
  activityCode?: string;
  year: number;
  status: ProgrammePlanStatus;
  version: number;
  createdBy: ProgrammePlanActor;
  createdAt: string;
  updatedAt: string;
  approvedBy?: ProgrammePlanActor;
  approvedAt?: string;
  rejectedBy?: ProgrammePlanActor;
  rejectedAt?: string;
  rejectedReason?: string;
  archivedBy?: ProgrammePlanActor;
  archivedAt?: string;
  archiveReason?: string;
  fields: ProgrammePlanField[];
  logs: ProgrammePlanLog[];
};

export function useProgrammePlans(fields: FieldFeature[]) {
  const [plans, setPlans] = useState<ProgrammePlan[]>(() => mergeSeedPlans([], fields));

  useEffect(() => {
    const loadPlans = () => setPlans(mergeSeedPlans(readStoredPlans(), fields));
    loadPlans();
    window.addEventListener("storage", loadPlans);
    window.addEventListener(PROGRAMME_PLAN_EVENT, loadPlans);
    return () => {
      window.removeEventListener("storage", loadPlans);
      window.removeEventListener(PROGRAMME_PLAN_EVENT, loadPlans);
    };
  }, [fields]);

  const savePlans = (nextPlans: ProgrammePlan[]) => {
    setPlans(nextPlans);
    writeStoredPlans(nextPlans);
  };

  return useMemo(() => ({
    plans,
    savePlans,
    approvedProgrammeNames: approvedProgrammeNames(plans),
  }), [plans]);
}

export function useApprovedProgrammeNames() {
  const [names, setNames] = useState<string[]>(() => approvedProgrammeNames(mergeSeedPlans([], [])));

  useEffect(() => {
    const loadNames = () => setNames(approvedProgrammeNames(mergeSeedPlans(readStoredPlans(), [])));
    loadNames();
    window.addEventListener("storage", loadNames);
    window.addEventListener(PROGRAMME_PLAN_EVENT, loadNames);
    return () => {
      window.removeEventListener("storage", loadNames);
      window.removeEventListener(PROGRAMME_PLAN_EVENT, loadNames);
    };
  }, []);

  return names;
}

export function readStoredPlans(): ProgrammePlan[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROGRAMME_PLAN_CACHE_KEY) || "[]") as ProgrammePlan[];
    return Array.isArray(parsed) ? parsed.filter(isPlanShape).map(normaliseStoredPlan) : [];
  } catch {
    return [];
  }
}

export function writeStoredPlans(plans: ProgrammePlan[]) {
  window.localStorage.setItem(PROGRAMME_PLAN_CACHE_KEY, JSON.stringify(plans));
  window.dispatchEvent(new Event(PROGRAMME_PLAN_EVENT));
}

export function buildProgrammeFields(programName: string, fields: FieldFeature[], year = DASHBOARD_YEAR): ProgrammePlanField[] {
  const targetMonths = monthsForYear(year);
  const sourceMonths = monthsForYear(DASHBOARD_YEAR);
  const sourceRows = dashboardSourceRows.filter((row) => row.programType === programName && row.actualBudget === "Programme");

  if (sourceRows.length) {
    return sourceRows.map((row) => ({
      id: `${normaliseKey(programName)}-${normaliseKey(row.field)}-programme-plan`,
      field: row.field,
      category: row.category || "-",
      hectares: Number(row.hect) || 0,
      actualBudget: "Programme",
      months: Object.fromEntries(targetMonths.map((month, index) => [month.key, Number(row.months[sourceMonths[index]?.key] || 0)])),
    }));
  }

  return [...fields]
    .sort((a, b) => (a.properties.field_no || a.properties.field_gis).localeCompare(b.properties.field_no || b.properties.field_gis, undefined, { numeric: true }))
    .map((field) => {
      const fieldName = field.properties.field_no || field.properties.field_gis;
      return {
        id: `${normaliseKey(programName || "programme")}-${normaliseKey(fieldName)}-programme-plan`,
        field: fieldName,
        category: String(field.properties.field_type || "").includes("IMMATURE") ? "Immature" : "Mature",
        hectares: Number(field.properties.ha_gis) || 0,
        actualBudget: "Programme",
        months: Object.fromEntries(targetMonths.map((month) => [month.key, 0])),
      };
    });
}

export function createProgrammePlanLog(
  actor: ProgrammePlanActor,
  action: string,
  detail: string,
  reason?: string,
): ProgrammePlanLog {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    actor,
    action,
    detail,
    reason: reason?.trim() || undefined,
  };
}

export function cloneProgrammeFields(fields: ProgrammePlanField[]) {
  return fields.map((field) => ({ ...field, months: { ...field.months } }));
}

export function planRoundCount(fields: ProgrammePlanField[]) {
  return fields.reduce((highest, field) => Math.max(highest, Object.values(field.months).filter((value) => Number(value) > 0).length), 0);
}

export function planTargetHectares(fields: ProgrammePlanField[]) {
  return fields.reduce((total, field) => total + Object.values(field.months).reduce((sum, value) => sum + Number(value || 0), 0), 0);
}

export function statusLabel(status: ProgrammePlanStatus) {
  return status;
}

export function isProgrammeActive(plan: ProgrammePlan) {
  return plan.status === "Approved";
}

function approvedProgrammeNames(plans: ProgrammePlan[]) {
  const approved = plans.filter(isProgrammeActive).map((plan) => plan.name);
  return mergeProgrammeNames([...PROGRAM_TYPES], approved);
}

function mergeSeedPlans(storedPlans: ProgrammePlan[], fields: FieldFeature[]) {
  const existingByName = new Map(storedPlans.map((plan) => [fieldKey(plan.name), plan]));
  const seedPlans = PROGRAM_TYPES.map((name) => {
    const existing = existingByName.get(fieldKey(name));
    if (existing) return ensurePlanFields(existing, fields);
    return createSeedPlan(name, fields);
  });
  const seedKeys = new Set(PROGRAM_TYPES.map((name) => fieldKey(name)));
  const customPlans = storedPlans.filter((plan) => !seedKeys.has(fieldKey(plan.name))).map((plan) => ensurePlanFields(plan, fields));
  return [...seedPlans, ...customPlans];
}

function createSeedPlan(name: string, fields: FieldFeature[]): ProgrammePlan {
  const now = `${DASHBOARD_YEAR}-01-01T00:00:00.000Z`;
  const planFields = buildProgrammeFields(name, fields);
  return {
    id: `seed-${normaliseKey(name)}`,
    name,
    activityCode: "",
    year: DASHBOARD_YEAR,
    status: "Approved",
    version: 1,
    createdBy: "Manager",
    createdAt: now,
    updatedAt: now,
    approvedBy: "Manager",
    approvedAt: now,
    fields: planFields,
    logs: [
      {
        id: `seed-log-${normaliseKey(name)}`,
        at: now,
        actor: "Manager",
        action: "Approved baseline",
        detail: `Seeded ${name} as an approved baseline with ${planFields.length} field${planFields.length === 1 ? "" : "s"} and ${formatNumber(planTargetHectares(planFields))} planned ha.`,
      },
    ],
  };
}

function ensurePlanFields(plan: ProgrammePlan, fields: FieldFeature[]) {
  if (plan.fields.length || !fields.length) return plan;
  return { ...plan, fields: buildProgrammeFields(plan.name, fields, plan.year) };
}

function normaliseStoredPlan(plan: ProgrammePlan): ProgrammePlan {
  if ((plan.status as string) !== "Amendment Pending") return plan;
  const migrated = { ...plan } as ProgrammePlan & {
    pendingActivityCode?: string;
    pendingFields?: ProgrammePlanField[];
    pendingReason?: string;
  };
  delete migrated.pendingActivityCode;
  delete migrated.pendingFields;
  delete migrated.pendingReason;

  return {
    ...migrated,
    status: "Approved",
  };
}

function mergeProgrammeNames(base: string[], extra: string[]) {
  const seen = new Set<string>();
  return [...base, ...extra].filter((name) => {
    const key = fieldKey(name);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isPlanShape(plan: ProgrammePlan) {
  return Boolean(plan && typeof plan.id === "string" && typeof plan.name === "string" && Array.isArray(plan.fields));
}
