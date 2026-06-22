import { readRequestBody, routeError, supabaseRest, textOrNull, timestampOrNull } from "@/lib/server/supabase-rest";
import type { PmvDatabaseRecord, PmvRecord, PmvStatus } from "@/lib/types/pmv";

export const dynamic = "force-dynamic";

const validStatuses = new Set<PmvStatus>(["working", "breakdown", "idle"]);

export async function GET() {
  try {
    const rows = await supabaseRest<PmvDatabaseRecord[]>(
      "pmv_records?select=*&order=completion_time.desc.nullslast,updated_at.desc&limit=5000",
    );
    return Response.json({ records: rows.map(fromDatabaseRecord) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await readRequestBody(request);
    const input = Array.isArray(payload.records) ? payload.records : [payload.record ?? payload].filter(Boolean);
    const rows = input.map((record) => toDatabaseRecord(record as Partial<PmvRecord>));
    rows.forEach(validateDatabaseRecord);
    const saved = await supabaseRest<PmvDatabaseRecord[]>("pmv_records?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates,return=representation",
      body: JSON.stringify(rows),
    });
    return Response.json({ records: saved.map(fromDatabaseRecord) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const payload = await readRequestBody(request);
    const id = String(payload.id ?? new URL(request.url).searchParams.get("id") ?? "").trim();
    if (!id) throw new Error("PMV record id is required.");
    await supabaseRest<null>(`pmv_records?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    return Response.json({ ok: true, id });
  } catch (error) {
    return routeError(error);
  }
}

function toDatabaseRecord(record: Partial<PmvRecord>): PmvDatabaseRecord {
  const status = normalizeStatus(record.machineStatus);
  return {
    id: String(record.id ?? "").trim(),
    source: textOrNull(record.source) ?? "PMV Tracker",
    original_id: textOrNull(record.originalId),
    start_time: timestampOrNull(record.startTime),
    completion_time: timestampOrNull(record.completionTime ?? record.updatedAt),
    email: textOrNull(record.email),
    form_name: textOrNull(record.formName),
    last_modified_time: timestampOrNull(record.lastModifiedTime),
    reporter_name: String(record.reporterName ?? "").trim(),
    report_date: String(record.reportDate ?? "").trim(),
    machine_type: textOrNull(record.machineType),
    machine_number: String(record.machineNumber ?? "").trim(),
    machine_status: status,
    ips_battery: status === "working" ? textOrNull(record.ipsBattery) : null,
    checklist: record.checklist && typeof record.checklist === "object" ? record.checklist : {},
    damaged_components: Array.isArray(record.damagedComponents) ? record.damagedComponents : [],
    idle_reason: status === "idle" ? textOrNull(record.idleReason) : null,
    assistant_notes: textOrNull(record.assistantNotes),
    sync_status: textOrNull(record.syncStatus),
    updated_at: timestampOrNull(record.updatedAt) ?? new Date().toISOString(),
  };
}

function fromDatabaseRecord(row: PmvDatabaseRecord): PmvRecord {
  return {
    id: row.id,
    source: row.source ?? "Supabase",
    originalId: row.original_id ?? "",
    startTime: row.start_time ?? "",
    completionTime: row.completion_time ?? "",
    email: row.email ?? "",
    formName: row.form_name ?? "",
    lastModifiedTime: row.last_modified_time ?? "",
    reporterName: row.reporter_name ?? "",
    reportDate: row.report_date ?? "",
    machineType: row.machine_type ?? "",
    machineNumber: row.machine_number ?? "",
    machineStatus: row.machine_status ?? "working",
    ipsBattery: row.ips_battery ?? "",
    checklist: row.checklist ?? {},
    damagedComponents: Array.isArray(row.damaged_components) ? row.damaged_components : [],
    idleReason: row.idle_reason ?? "",
    assistantNotes: row.assistant_notes ?? "",
    syncStatus: row.sync_status ?? "Synced",
    updatedAt: row.updated_at ?? row.created_at ?? "",
  };
}

function validateDatabaseRecord(record: PmvDatabaseRecord) {
  if (!record.id) throw new Error("PMV record id is required.");
  if (!record.reporter_name) throw new Error("Reporter name is required.");
  if (!record.report_date) throw new Error("Report date is required.");
  if (!record.machine_number) throw new Error("Machine number is required.");
  if (!validStatuses.has(record.machine_status)) throw new Error("Invalid machine status.");
}

function normalizeStatus(status: unknown): PmvStatus {
  const value = String(status ?? "").trim().toLowerCase();
  if (value.startsWith("breakdown")) return "breakdown";
  if (value.startsWith("idle")) return "idle";
  return "working";
}
