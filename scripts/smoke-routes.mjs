const baseUrl = (process.env.APP_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

const routeChecks = [
  ["/management/work-program", ["Work Program Dashboard"]],
  ["/management/work-program?view=records", ["Work Program Records", "Monthly Field Tracking", "Map Output"]],
  ["/management/pmv", ["Machines Reported", "Manager Action Queue", "Daily Reports"]],
  ["/management/harvesting-interval", ["Harvesting Interval Report", "Monthly Interval Grid", "QC + C1 activities"]],
  ["/input/work-program", ["Submit field completion", "Submit record"]],
  ["/input/pmv", ["Daily machine report", "Status Mesin", "Hantar Laporan"]],
];

let failures = 0;

for (const [path, expectedText] of routeChecks) {
  try {
    const response = await fetch(`${baseUrl}${path}`);
    const body = await response.text();
    const missing = expectedText.filter((text) => !body.includes(text));
    if (!response.ok || missing.length) {
      fail(`${path}: status ${response.status}; missing ${missing.join(", ") || "none"}`);
    } else {
      pass(`${path}: ${response.status}`);
    }
  } catch (error) {
    fail(`${path}: ${error.message}`);
  }
}

try {
  const response = await fetch(`${baseUrl}/`, { redirect: "manual" });
  const location = response.headers.get("location") || "";
  if (![307, 308].includes(response.status) || !location.endsWith("/management/work-program")) {
    fail(`/: expected redirect to /management/work-program; received ${response.status} ${location}`);
  } else {
    pass(`/: ${response.status} redirect`);
  }
} catch (error) {
  fail(`/: ${error.message}`);
}

try {
  const response = await fetch(`${baseUrl}/data/field-map-data.geojson`);
  const data = await response.json();
  if (!response.ok || data.type !== "FeatureCollection" || !Array.isArray(data.features) || !data.features.length) {
    fail("Field map: invalid or empty GeoJSON");
  } else {
    pass(`Field map: ${data.features.length} features`);
  }
} catch (error) {
  fail(`Field map: ${error.message}`);
}

for (const path of ["/api/work-program-records", "/api/pmv-records"]) {
  try {
    const response = await fetch(`${baseUrl}${path}`);
    const data = await response.json();
    if (response.ok && Array.isArray(data.records)) {
      pass(`${path}: connected (${data.records.length} records)`);
    } else if (response.status === 503 && data.error) {
      pass(`${path}: local Supabase configuration unavailable (expected in VM)`);
    } else {
      fail(`${path}: unexpected status ${response.status}`);
    }
  } catch (error) {
    fail(`${path}: ${error.message}`);
  }
}

if (failures) {
  console.error(`\nSmoke checks failed: ${failures}`);
  process.exitCode = 1;
} else {
  console.log("\nAll smoke checks passed.");
}

function pass(message) {
  console.log(`PASS ${message}`);
}

function fail(message) {
  failures += 1;
  console.error(`FAIL ${message}`);
}
