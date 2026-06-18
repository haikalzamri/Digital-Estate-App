const VALID_APPROVAL_STATUSES = new Set(["Pending Approval", "Approved"]);

module.exports = async function handler(req, res) {
  setJsonHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (!hasSupabaseConfig()) {
    res.status(503).json({
      error: "Supabase environment variables are not configured.",
      required: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"],
    });
    return;
  }

  try {
    if (req.method === "GET") {
      const records = await listWorkProgramRecords();
      res.status(200).json({ records: records.map(fromDatabaseRecord) });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const records = Array.isArray(payload?.records) ? payload.records : [payload?.record || payload].filter(Boolean);
      const cleanRecords = records.map(toDatabaseRecord);
      cleanRecords.forEach(validateDatabaseRecord);
      const savedRecords = await upsertWorkProgramRecords(cleanRecords);
      res.status(200).json({ records: savedRecords.map(fromDatabaseRecord) });
      return;
    }

    if (req.method === "DELETE") {
      const payload = await readJsonBody(req);
      const id = String(payload?.id || req.query?.id || "").trim();
      if (!id) throw new Error("Work Program record id is required.");
      await deleteWorkProgramRecord(id);
      res.status(200).json({ ok: true, id });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    res.status(400).json({ error: error.message || "Work Program request failed." });
  }
};

function setJsonHeaders(res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function hasSupabaseConfig() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseHeaders(extraHeaders = {}) {
  return {
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    ...extraHeaders,
  };
}

function supabaseRestUrl(path) {
  return `${process.env.SUPABASE_URL.replace(/\/$/, "")}/rest/v1/${path}`;
}

async function listWorkProgramRecords() {
  const response = await fetch(supabaseRestUrl("work_program_records?select=*&order=actual_completion_date.desc.nullslast,updated_at.desc&limit=10000"), {
    headers: supabaseHeaders(),
  });
  return readSupabaseResponse(response);
}

async function upsertWorkProgramRecords(records) {
  const response = await fetch(supabaseRestUrl("work_program_records?on_conflict=id"), {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(records),
  });
  return readSupabaseResponse(response);
}

async function deleteWorkProgramRecord(id) {
  const response = await fetch(supabaseRestUrl(`work_program_records?id=eq.${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: supabaseHeaders({ Prefer: "return=minimal" }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Supabase delete failed with status ${response.status}.`);
  }
}

async function readSupabaseResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(data?.message || data?.error || `Supabase request failed with status ${response.status}.`);
  }
  return Array.isArray(data) ? data : [];
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body || "{}");

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function toDatabaseRecord(record) {
  return {
    id: String(record.id || "").trim(),
    source: String(record.source || "Work Program Tracker").trim(),
    reporter_name: String(record.reporterName || "").trim(),
    program_type: String(record.programType || "").trim(),
    block_field: String(record.blockField || "").trim(),
    task_name: String(record.taskName || record.programType || "Completion").trim(),
    scheduler_stage: String(record.schedulerStage || "Completed").trim(),
    hectares: numberOrNull(record.hectares),
    actual_completion_date: dateOrNull(record.actualCompletionDate || record.deadline),
    deadline: dateOrNull(record.deadline || record.actualCompletionDate),
    priority: stringOrNull(record.priority),
    approval_status: normalizeApprovalStatus(record.approvalStatus),
    remarks: stringOrNull(record.remarks),
    latitude: numberOrNull(record.latitude),
    longitude: numberOrNull(record.longitude),
    gps_accuracy: stringOrNull(record.gpsAccuracy),
    photo_data: stringOrNull(record.photoData),
    sync_status: stringOrNull(record.syncStatus),
    category: stringOrNull(record.category),
    updated_at: timestampOrNull(record.updatedAt) || new Date().toISOString(),
  };
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    source: row.source || "Supabase",
    reporterName: row.reporter_name || "",
    programType: row.program_type || "",
    blockField: row.block_field || "",
    taskName: row.task_name || "",
    schedulerStage: row.scheduler_stage || "Completed",
    hectares: Number(row.hectares) || 0,
    actualCompletionDate: row.actual_completion_date || "",
    deadline: row.deadline || row.actual_completion_date || "",
    priority: row.priority || "Must",
    approvalStatus: row.approval_status || "Pending Approval",
    remarks: row.remarks || "",
    latitude: row.latitude === null || row.latitude === undefined ? "" : String(row.latitude),
    longitude: row.longitude === null || row.longitude === undefined ? "" : String(row.longitude),
    gpsAccuracy: row.gps_accuracy || "",
    photoData: row.photo_data || "",
    syncStatus: row.sync_status || "Synced",
    updatedAt: row.updated_at || row.created_at || "",
    category: row.category || "",
  };
}

function validateDatabaseRecord(record) {
  if (!record.id) throw new Error("Work Program record id is required.");
  if (!record.reporter_name) throw new Error("Reporter name is required.");
  if (!record.program_type) throw new Error("Program type is required.");
  if (!record.block_field) throw new Error("Block or field is required.");
  if (!record.hectares || record.hectares <= 0) throw new Error("Hectares must be above zero.");
  if (!record.actual_completion_date) throw new Error("Actual completion date is required.");
  if (!VALID_APPROVAL_STATUSES.has(record.approval_status)) throw new Error("Invalid approval status.");
}

function normalizeApprovalStatus(status) {
  return status === "Approved" ? "Approved" : "Pending Approval";
}

function stringOrNull(value) {
  const text = String(value || "").trim();
  return text || null;
}

function numberOrNull(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function dateOrNull(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function timestampOrNull(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
