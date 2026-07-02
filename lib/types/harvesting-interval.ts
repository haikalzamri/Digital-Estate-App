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

export type HarvestingIntervalMetricKey = "hectare" | "bunches" | "tonnage";

export type HarvestingIntervalActivityMetrics = {
  hectare: number;
  bunches: number;
  tonnage: number;
  activityCode?: string;
  monthHectare?: number;
};

export type HarvestingIntervalDispatchMetrics = {
  hectare: number;
  bunches: number;
  kg: number;
  unit?: string;
  plantedHectare?: number;
  harvestingDay?: number;
  harvestingRound?: number;
};

export type HarvestingIntervalBalanceMetrics = {
  hectare: number;
  bunches: number;
  kg: number;
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
    activityRows?: number;
    dispatchRows?: number;
    dispatchSourceFile?: string;
    lastDispatchDate?: string;
    overlaySourceFile?: string;
    overlaySourceSheet?: string;
    overlayRows?: number;
    overlayActivities?: string[];
  };
  fields: HarvestingIntervalField[];
  activityByField: Record<string, Record<string, HarvestingIntervalActivityMetrics>>;
  dailyTotals: Record<string, HarvestingIntervalActivityMetrics>;
  dispatchByField: Record<string, Record<string, HarvestingIntervalDispatchMetrics>>;
  dispatchDailyTotals: Record<string, HarvestingIntervalDispatchMetrics>;
  overlayByField: Record<string, Record<string, string[]>>;
};

export type HarvestingIntervalCell = {
  date: string;
  day: number;
  dayName: string;
  harvest: boolean;
  interval: number;
  isSunday: boolean;
  activity: HarvestingIntervalActivityMetrics | null;
  dispatch: HarvestingIntervalDispatchMetrics | null;
  balance: HarvestingIntervalBalanceMetrics;
  overlays: string[];
};

export type HarvestingIntervalFieldReport = HarvestingIntervalField & {
  cells: HarvestingIntervalCell[];
  harvestCount: number;
  monthlyHectareTotal: number;
  monthlyDispatchHectareTotal: number;
  endInterval: number;
  maxInterval: number;
};

export type HarvestingIntervalMonthReport = {
  month: string;
  monthLabel: string;
  days: HarvestingIntervalCell[];
  fields: HarvestingIntervalFieldReport[];
  dailyTotals: Record<string, HarvestingIntervalActivityMetrics>;
  dispatchDailyTotals: Record<string, HarvestingIntervalDispatchMetrics>;
  dailyBalances: Record<string, HarvestingIntervalBalanceMetrics>;
  monthlyTotals: HarvestingIntervalActivityMetrics;
  monthlyDispatchTotals: HarvestingIntervalDispatchMetrics;
  monthlyBalances: HarvestingIntervalBalanceMetrics;
  activeFields: number;
  totalHarvests: number;
  sourceActiveFields: number;
  sourceActivityCount: number;
  highestInterval: number;
};
