const VALID_STATUSES = new Set(["working", "breakdown", "idle"]);

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
      const records = await listPmvRecords();
      res.status(200).json({ records: records.map(fromDatabaseRecord) });
      return;
    }

    if (req.method === "POST") {
      const payload = await readJsonBody(req);
      const records = Array.isArray(payload?.records) ? payload.records : [payload?.record || payload].filter(Boolean);
      const cleanRecords = records.map(toDatabaseRecord);
      cleanRecords.forEach(validateDatabaseRecord);
      const savedRecords = await upsertPmvRecords(cleanRecords);
      res.status(200).json({ records: savedRecords.map(fromDatabaseRecord) });
      return;
    }

    if (req.method === "DELETE") {
      const payload = await readJsonBody(req);
      const id = String(payload?.id || req.query?.id || "").trim();
      if (!id) throw new Error("PMV record id is required.");
      await deletePmvRecord(id);
      res.status(200).json({ ok: true, id });
      return;
    }

    res.setHeader("Allow", "GET, POST, DELETE, OPTIONS");
    res.status(405).json({ error: "Method not allowed." });
  } catch (error) {
    res.status(400).json({ error: error.message || "PMV request failed." });
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

async function listPmvRecords() {
  const response = await fetch(supabaseRestUrl("pmv_records?select=*&order=completion_time.desc.nullslast,updated_at.desc&limit=5000"), {
    headers: supabaseHeaders(),
  });
  return readSupabaseResponse(response);
}

async function upsertPmvRecords(records) {
  const response = await fetch(supabaseRestUrl("pmv_records?on_conflict=id"), {
    method: "POST",
    headers: supabaseHeaders({
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=representation",
    }),
    body: JSON.stringify(records),
  });
  return readSupabaseResponse(response);
}

async function deletePmvRecord(id) {
  const response = await fetch(supabaseRestUrl(`pmv_records?id=eq.${encodeURIComponent(id)}`), {
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
  const status = normalizeStatus(record.machineStatus);
  return {
    id: String(record.id || "").trim(),
    source: String(record.source || "PMV Tracker").trim(),
    original_id: stringOrNull(record.originalId),
    start_time: timestampOrNull(record.startTime),
    completion_time: timestampOrNull(record.completionTime || record.updatedAt),
    email: stringOrNull(record.email),
    form_name: stringOrNull(record.formName),
    last_modified_time: timestampOrNull(record.lastModifiedTime),
    reporter_name: String(record.reporterName || "").trim(),
    report_date: String(record.reportDate || "").trim(),
    machine_type: stringOrNull(record.machineType),
    machine_number: String(record.machineNumber || "").trim(),
    machine_status: status,
    ips_battery: status === "working" ? stringOrNull(record.ipsBattery) : null,
    checklist: record.checklist && typeof record.checklist === "object" ? record.checklist : {},
    damaged_components: Array.isArray(record.damagedComponents) ? record.damagedComponents : [],
    idle_reason: status === "idle" ? stringOrNull(record.idleReason) : null,
    assistant_notes: stringOrNull(record.assistantNotes),
    sync_status: stringOrNull(record.syncStatus),
    updated_at: timestampOrNull(record.updatedAt) || new Date().toISOString(),
  };
}

function fromDatabaseRecord(row) {
  return {
    id: row.id,
    source: row.source || "Supabase",
    originalId: row.original_id || "",
    startTime: row.start_time || "",
    completionTime: row.completion_time || "",
    email: row.email || "",
    formName: row.form_name || "",
    lastModifiedTime: row.last_modified_time || "",
    reporterName: row.reporter_name || "",
    reportDate: row.report_date || "",
    machineType: row.machine_type || "",
    machineNumber: row.machine_number || "",
    machineStatus: row.machine_status || "working",
    ipsBattery: row.ips_battery || "",
    checklist: row.checklist || {},
    damagedComponents: Array.isArray(row.damaged_components) ? row.damaged_components : [],
    idleReason: row.idle_reason || "",
    assistantNotes: row.assistant_notes || "",
    syncStatus: row.sync_status || "Synced",
    updatedAt: row.updated_at || row.created_at || "",
  };
}

function validateDatabaseRecord(record) {
  if (!record.id) throw new Error("PMV record id is required.");
  if (!record.reporter_name) throw new Error("Reporter name is required.");
  if (!record.report_date) throw new Error("Report date is required.");
  if (!record.machine_number) throw new Error("Machine number is required.");
  if (!VALID_STATUSES.has(record.machine_status)) throw new Error("Invalid machine status.");
}

function normalizeStatus(status) {
  const value = String(status || "").trim().toLowerCase();
  if (value.startsWith("breakdown")) return "breakdown";
  if (value.startsWith("idle")) return "idle";
  return "working";
}

function stringOrNull(value) {
  const text = String(value || "").trim();
  return text || null;
}

function timestampOrNull(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
