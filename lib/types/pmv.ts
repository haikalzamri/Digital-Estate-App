export type PmvStatus = "working" | "breakdown" | "idle";

export type PmvRecord = {
  id: string;
  source?: string;
  originalId?: string;
  startTime?: string;
  completionTime?: string;
  email?: string;
  formName?: string;
  lastModifiedTime?: string;
  reporterName: string;
  reportDate: string;
  machineType?: string;
  machineNumber: string;
  machineStatus: PmvStatus;
  ipsBattery?: string;
  checklist?: Record<string, string>;
  damagedComponents?: string[];
  idleReason?: string;
  assistantNotes?: string;
  syncStatus?: string;
  updatedAt?: string;
};

export type PmvDatabaseRecord = {
  id: string;
  source: string | null;
  original_id: string | null;
  start_time: string | null;
  completion_time: string | null;
  email: string | null;
  form_name: string | null;
  last_modified_time: string | null;
  reporter_name: string;
  report_date: string;
  machine_type: string | null;
  machine_number: string;
  machine_status: PmvStatus;
  ips_battery: string | null;
  checklist: Record<string, string> | null;
  damaged_components: string[] | null;
  idle_reason: string | null;
  assistant_notes: string | null;
  sync_status: string | null;
  created_at?: string;
  updated_at?: string;
};
