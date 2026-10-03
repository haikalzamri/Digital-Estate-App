export type DemoWorker = { id: string; name: string; gang: string };

export type PrePlanAllocation = {
  workerId: string;
  programme: string;
  fieldIds: string[];
};

export type PrePlanFieldDetail = {
  programme: string;
  fieldId: string;
  targetHa: number | null;
  remarks: string;
};

export type PrePlanProgramme = {
  programme: string;
  fieldIds: string[];
};

export type PrePlanDay = {
  date: string;
  status: "Draft" | "Finalised";
  programmes: PrePlanProgramme[];
  allocations: PrePlanAllocation[];
  fieldDetails: PrePlanFieldDetail[];
  savedAt: string | null;
};

export type PrePlanStore = { version: 2; days: Record<string, PrePlanDay> };
