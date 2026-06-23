export type HarvestingIntervalField = {
  id: string;
  field: string;
  block: string;
  hectares: number | null;
  blockHectares: number | null;
  baseInterval: number;
  bfDisplay?: string;
  hasReferenceBaseline: boolean;
};

export type HarvestingIntervalSource = {
  metadata: {
    module: string;
    activitySourceFile: string;
    referenceTemplateFile: string;
    sourceDescription: string;
    baseDate: string;
    startDate: string;
    lastActivityDate: string;
    defaultMonth: string;
    availableMonths: string[];
  };
  fields: HarvestingIntervalField[];
  activityByField: Record<string, string[]>;
};

export type HarvestingIntervalCell = {
  date: string;
  day: number;
  dayName: string;
  harvest: boolean;
  interval: number;
  isSunday: boolean;
};

export type HarvestingIntervalFieldReport = HarvestingIntervalField & {
  cells: HarvestingIntervalCell[];
  harvestCount: number;
  endInterval: number;
  maxInterval: number;
};

export type HarvestingIntervalMonthReport = {
  month: string;
  monthLabel: string;
  days: HarvestingIntervalCell[];
  fields: HarvestingIntervalFieldReport[];
  activeFields: number;
  totalHarvests: number;
  sourceActiveFields: number;
  sourceActivityCount: number;
  highestInterval: number;
};
