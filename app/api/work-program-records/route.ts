import {
  dateOrNull,
  numberOrNull,
  readRequestBody,
  routeError,
  supabaseRest,
  textOrNull,
  timestampOrNull,
} from "@/lib/server/supabase-rest";
import type { WorkProgramDatabaseRecord, WorkProgramRecord } from "@/lib/types/work-program";

export const dynamic = "force-dynamic";

const validApprovalStatuses = new Set(["Pending Approval", "Approved"]);

export async function GET() {
  try {
    const rows = await supabaseRest<WorkProgramDatabaseRecord[]>(
      "work_program_records?select=*&order=actual_completion_date.desc.nullslast,updated_at.desc&limit=10000",
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
    const rows = input.map((record) => toDatabaseRecord(record as Partial<WorkProgramRecord>));
    rows.forEach(validateDatabaseRecord);
    const saved = await supabaseRest<WorkProgramDatabaseRecord[]>("work_program_records?on_conflict=id", {
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
    if (!id) throw new Error("Work Program record id is required.");
    await supabaseRest<null>(`work_program_records?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
    return Response.json({ ok: true, id });
  } catch (error) {
    return routeError(error);
  }
}

function toDatabaseRecord(record: Partial<WorkProgramRecord>): WorkProgramDatabaseRecord {
  return {
    id: String(record.id ?? "").trim(),
    source: textOrNull(record.source) ?? "Work Program Tracker",
    reporter_name: String(record.reporterName ?? "").trim(),
    program_type: String(record.programType ?? "").trim(),
    block_field: String(record.blockField ?? "").trim(),
    task_name: textOrNull(record.taskName ?? record.programType) ?? "Completion",
    scheduler_stage: textOrNull(record.schedulerStage) ?? "Completed",
    hectares: numberOrNull(record.hectares) ?? 0,
    actual_completion_date: dateOrNull(record.actualCompletionDate ?? record.deadline) ?? "",
    deadline: dateOrNull(record.deadline ?? record.actualCompletionDate),
    priority: textOrNull(record.priority),
    approval_status: normalizeApprovalStatus(record.approvalStatus),
    remarks: textOrNull(record.remarks),
    latitude: numberOrNull(record.latitude),
    longitude: numberOrNull(record.longitude),
    gps_accuracy: textOrNull(record.gpsAccuracy),
    photo_data: textOrNull(record.photoData),
    sync_status: textOrNull(record.syncStatus),
    category: textOrNull(record.category),
    updated_at: timestampOrNull(record.updatedAt) ?? new Date().toISOString(),
  };
}

function fromDatabaseRecord(row: WorkProgramDatabaseRecord): WorkProgramRecord {
  return {
    id: row.id,
    source: row.source ?? "Supabase",
    reporterName: row.reporter_name ?? "",
    programType: row.program_type ?? "",
    blockField: row.block_field ?? "",
    taskName: row.task_name ?? "",
    schedulerStage: row.scheduler_stage ?? "Completed",
    hectares: Number(row.hectares) || 0,
    actualCompletionDate: row.actual_completion_date ?? "",
    deadline: row.deadline ?? row.actual_completion_date ?? "",
    priority: row.priority ?? "Must",
    approvalStatus: row.approval_status ?? "Pending Approval",
    remarks: row.remarks ?? "",
    latitude: row.latitude == null ? "" : String(row.latitude),
    longitude: row.longitude == null ? "" : String(row.longitude),
    gpsAccuracy: row.gps_accuracy ?? "",
    photoData: row.photo_data ?? "",
    syncStatus: row.sync_status ?? "Synced",
    updatedAt: row.updated_at ?? row.created_at ?? "",
    category: row.category ?? "",
  };
}

function validateDatabaseRecord(record: WorkProgramDatabaseRecord) {
  if (!record.id) throw new Error("Work Program record id is required.");
  if (!record.reporter_name) throw new Error("Reporter name is required.");
  if (!record.program_type) throw new Error("Program type is required.");
  if (!record.block_field) throw new Error("Block or field is required.");
  if (!record.hectares || record.hectares <= 0) throw new Error("Hectares must be above zero.");
  if (!record.actual_completion_date) throw new Error("Actual completion date is required.");
  if (!validApprovalStatuses.has(record.approval_status)) throw new Error("Invalid approval status.");
}

function normalizeApprovalStatus(status: unknown): "Pending Approval" | "Approved" {
  return status === "Approved" ? "Approved" : "Pending Approval";
}
