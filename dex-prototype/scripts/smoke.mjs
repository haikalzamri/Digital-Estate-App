const base = (process.env.APP_BASE_URL || "http://127.0.0.1:3060").replace(/\/$/, "");
const checks = [
  ["/", 200, ["Digital Estate Extended", "<h1>Attendance and Productivity</h1>", "New day", "Attendance and Productivity M2", "Work Programme", "Work Listing", "Add work programme", "Workshop", "Warehouse", "Store Clerk", "Machine System", "Machine Operator", "Machine Specialist", "E063", "DP-181026-001"]],
  ["/management/work-program", 404, []],
  ["/management/pre-plan", 404, []],
  ["/api/work-program-records", 404, []],
  ["/api/pmv-records", 404, []],
];
let failed = 0;
for (const [route, expectedStatus, expectedText] of checks) {
  try {
    const response = await fetch(base + route);
    const text = await response.text();
    if (response.status !== expectedStatus) throw new Error("Expected " + expectedStatus + ", got " + response.status);
    const missing = expectedText.filter((value) => !text.toLowerCase().includes(value.toLowerCase()));
    if (missing.length) throw new Error("Missing page content: " + missing.join(", "));
    console.log("PASS " + route + " (" + response.status + ")");
  } catch (error) { failed++; console.error("FAIL " + route + ": " + error.message); }
}
if (failed) process.exitCode = 1;
else console.log("DEX route smoke checks passed. Historical routes and live APIs are excluded.");

