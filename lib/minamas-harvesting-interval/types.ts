export type Division = "DIV01" | "DIV02" | "DIV03";
export type DivisionFilter = Division | "all";
export type IntervalStatus = "onTrack" | "watch" | "caution" | "overdue" | "uncertain" | "noData";
export interface MinamasField { code: string; label: string; yop: number; division: Division; hectares: number }
export interface MinamasSource {
  metadata: {
    estate: string; estateName: string; sourceFile: string;
    productionStart: string; productionEnd: string; dispatchStart: string; dispatchEnd: string;
    availableMonths: string[]; defaultDate: string;
    productionRows: number; dispatchRows: number; excludedUnclassifiedBunches: number;
    productionBunches: number; dispatchBunches: number;
    weightUnit: "KG"; estateWeightKg: number; millWeightKg: number;
  };
  fields: MinamasField[];
  production: Record<string, Record<string, number>>;
  dispatch: Record<string, Record<string, number>>;
  weights: Record<string, Record<string, { estate: number; mill: number }>>;
}
export interface FieldInterval {
  interval: number | null; lastHarvest: string | null; cycleStart: string | null;
  status: IntervalStatus; explanation: string;
}
export interface DayMetrics { production: number | null; dispatch: number | null; difference: number | null }
export interface FieldShape { code: string; points: string; labelX: number; labelY: number }
