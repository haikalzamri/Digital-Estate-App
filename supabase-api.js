// Browser adapter for Vercel API routes. Secrets stay server-side in /api/*.

window.digitalEstateApi = {
  listPmvRecords,
  upsertPmvRecord,
  deletePmvRecord,
  listWorkProgramRecords,
  upsertWorkProgramRecord,
  deleteWorkProgramRecord,
};

async function listPmvRecords() {
  const response = await fetch("/api/pmv-records", {
    headers: { Accept: "application/json" },
  });
  const data = await readApiResponse(response);
  return Array.isArray(data.records) ? data.records : [];
}

async function upsertPmvRecord(record) {
  const response = await fetch("/api/pmv-records", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ record }),
  });
  const data = await readApiResponse(response);
  return Array.isArray(data.records) ? data.records[0] : null;
}

async function deletePmvRecord(id) {
  const response = await fetch("/api/pmv-records", {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  return readApiResponse(response);
}


async function listWorkProgramRecords() {
  const response = await fetch("/api/work-program-records", {
    headers: { Accept: "application/json" },
  });
  const data = await readApiResponse(response);
  return Array.isArray(data.records) ? data.records : [];
}

async function upsertWorkProgramRecord(record) {
  const response = await fetch("/api/work-program-records", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ record }),
  });
  const data = await readApiResponse(response);
  return Array.isArray(data.records) ? data.records[0] : null;
}

async function deleteWorkProgramRecord(id) {
  const response = await fetch("/api/work-program-records", {
    method: "DELETE",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  return readApiResponse(response);
}

async function readApiResponse(response) {
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(data.error || `API request failed with status ${response.status}.`);
  }
  return data;
}
