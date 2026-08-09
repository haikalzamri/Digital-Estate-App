export type CostbookActivity = {
  code: string;
  name: string;
  fieldCodes: string[];
  evitNumbers: string[];
};

export type CostbookWorker = {
  workerId: string;
  workerName: string;
  mandays: number;
  rate: number;
  overtimeHours: number;
  overtimeRate: number;
};

export type CostbookSupervision = {
  supervisorId: string;
  supervisorName: string;
  hours: number;
  rate: number;
};

export type CostbookLabour = {
  workers: CostbookWorker[];
  supervision: CostbookSupervision[];
};

export type CostbookMaterial = {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
};

export type CostbookEvitUsage = {
  evitNumber: string;
  hours: number;
  ratePerHour: number;
  transportCost: number;
};

export type CostbookRecord = {
  id: string;
  activityCode: string;
  fieldCode: string;
  date: string;
  labour: CostbookLabour;
  materials: CostbookMaterial[];
  evitUsage: CostbookEvitUsage[];
  hectaresCovered: number;
  remark: string;
};

export type CostbookSource = {
  metadata: {
    module: string;
    sourceDescription: string;
    defaultActivityCode: string;
    defaultMonth: string;
    availableMonths: string[];
  };
  activities: CostbookActivity[];
  records: CostbookRecord[];
};

export type CostbookMaterialReportLine = CostbookMaterial & {
  materialCost: number;
  costPerHectare: number;
};

export type CostbookEvitReportLine = CostbookEvitUsage & {
  operatingCost: number;
  evitCost: number;
  totalCost: number;
  costPerHectare: number;
};

export type CostbookLabourRateType = "Normal Rate" | "Supervision Rate";

export type CostbookWorkerReportLine = {
  workerId: string;
  workerName: string;
  mandays: number;
  rateType: CostbookLabourRateType;
  rate: number;
  overtimeHours: number;
  overtimeRate: number;
  labourAmount: number;
  overtimeAmount: number;
  totalAmount: number;
};

export type CostbookDayReport = CostbookRecord & {
  workerLines: CostbookWorkerReportLine[];
  mandays: number;
  labourAmount: number;
  overtimeHours: number;
  overtimeAmount: number;
  labourCostToday: number;
  labourMonthToDate: number;
  labourCostPerHectare: number;
  materialLines: CostbookMaterialReportLine[];
  materialCostToday: number;
  materialMonthToDate: number;
  materialCostPerHectare: number;
  evitLines: CostbookEvitReportLine[];
  evitCostToday: number;
  evitMonthToDate: number;
  evitCostPerHectare: number;
  totalCostToday: number;
  totalCostToDate: number;
  hectaresToDate: number;
  costPerHectareToday: number;
  costPerHectareToDate: number;
};

export type CostbookReport = {
  activity: CostbookActivity | null;
  month: string;
  monthLabel: string;
  selectedFieldCodes: string[];
  selectedEvitNumbers: string[];
  days: CostbookDayReport[];
  totals: {
    labour: number;
    labourCostPerHectare: number;
    material: number;
    materialCostPerHectare: number;
    evit: number;
    evitCostPerHectare: number;
    cost: number;
    hectares: number;
    costPerHectare: number;
  };
};
