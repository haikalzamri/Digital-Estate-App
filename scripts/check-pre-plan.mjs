import assert from "node:assert/strict";
import {
  addProgramme, addProgrammeField, addWorkersToProgramme, applyFieldsToWorkers, emptyPlan,
  finalisationIssues, finalisePlan, isPlanDate, parsePlanStore, removeProgramme,
  removeProgrammeField, removeWorker, toggleWorkerField, tomorrowDate,
} from "../lib/pre-plan/planning.ts";
import { DEMO_WORKERS } from "../lib/pre-plan/dummy-workers.ts";

let checks = 0;
function check(label, run) { run(); checks += 1; console.log(`PASS ${label}`); }
const date = "2026-09-23";
const initial = emptyPlan(date);
const card = addProgramme(initial, "Mature Circle");
const fields = addProgrammeField(addProgrammeField(card, "Mature Circle", "P01"), "Mature Circle", "P02");
const workers = addWorkersToProgramme(fields, ["DEMO001", "DEMO002"], "Mature Circle");
const one = toggleWorkerField(workers, "DEMO001", "P01");
const multiple = toggleWorkerField(one, "DEMO001", "P02");
const twoCards = addProgramme(multiple, "Pruning");
const complete = applyFieldsToWorkers(multiple, "Mature Circle", ["DEMO002"], ["P01"]);
const storeFor = (plan, version = 2) => JSON.stringify({ version, days: { [date]: plan } });

check("One card per programme; existing plans are not mutated", () => {
  assert.equal(initial.programmes.length, 0);
  assert.equal(card.programmes.length, 1);
  assert.equal(addProgramme(card, "Mature Circle"), card);
  assert.equal(addProgrammeField(fields, "Mature Circle", "P01"), fields);
});
check("Adding workers reserves the programme without assigning fields", () => {
  assert.equal(fields.allocations.length, 0);
  assert.equal(workers.allocations.length, 2);
  assert.deepEqual(workers.allocations.map((item) => item.fieldIds), [[], []]);
  assert.equal(addWorkersToProgramme(workers, ["DEMO001", "DEMO001"], "Mature Circle"), workers);
});
check("Adding another programme field never assigns it automatically", () => {
  const updated = addProgrammeField(multiple, "Mature Circle", "P03");
  assert.deepEqual(updated.allocations, multiple.allocations);
  assert.deepEqual(updated.programmes[0].fieldIds, ["P01", "P02", "P03"]);
});
check("Each worker selects multiple fields independently", () => {
  assert.deepEqual(multiple.allocations[0].fieldIds, ["P01", "P02"]);
  assert.deepEqual(multiple.allocations[1].fieldIds, []);
  assert.deepEqual(toggleWorkerField(multiple, "DEMO001", "P01").allocations[0].fieldIds, ["P02"]);
});
check("A worker with no fields still cannot join another programme", () => {
  assert.throws(() => addWorkersToProgramme(twoCards, ["DEMO002"], "Pruning"), /another programme/);
  assert.throws(() => addWorkersToProgramme(twoCards, ["DEMO003", "DEMO001"], "Pruning"), /another programme/);
  assert.equal(twoCards.allocations.length, 2);
});
check("Removing the last field keeps the worker and programme reservation", () => {
  const removed = toggleWorkerField(one, "DEMO001", "P01");
  assert.equal(removed.allocations.length, 2);
  assert.deepEqual(removed.allocations[0].fieldIds, []);
  assert.throws(() => addWorkersToProgramme(addProgramme(removed, "Pruning"), ["DEMO001"], "Pruning"), /another programme/);
});
check("Removing a worker releases them for another programme", () => {
  const removed = removeWorker(twoCards, "Mature Circle", "DEMO001");
  const reassigned = addWorkersToProgramme(removed, ["DEMO001"], "Pruning");
  assert.equal(reassigned.allocations.find((item) => item.workerId === "DEMO001").programme, "Pruning");
});
check("Bulk assignment adds fields, preserves previous choices and avoids duplicates", () => {
  const bulk = applyFieldsToWorkers(multiple, "Mature Circle", ["DEMO001", "DEMO002"], ["P02", "P02"]);
  assert.deepEqual(bulk.allocations[0].fieldIds, ["P01", "P02"]);
  assert.deepEqual(bulk.allocations[1].fieldIds, ["P02"]);
});
check("Assignments reject fields and workers outside their card", () => {
  assert.throws(() => toggleWorkerField(multiple, "DEMO001", "P99"), /Add this field/);
  assert.throws(() => applyFieldsToWorkers(multiple, "Mature Circle", ["DEMO001"], ["P99"]), /Only fields/);
  assert.throws(() => applyFieldsToWorkers(twoCards, "Mature Circle", ["DEMO001", "DEMO003"], ["P01"]), /this programme only/);
  assert.throws(() => addWorkersToProgramme(initial, ["DEMO001"], "Mature Circle"), /card first/);
});
check("Removing a programme field updates its workers and notes without releasing them", () => {
  const noted = { ...complete, fieldDetails: [{ programme: "Mature Circle", fieldId: "P01", targetHa: 5, remarks: "Earlier demo note" }] };
  const removed = removeProgrammeField(noted, "Mature Circle", "P01");
  assert.deepEqual(removed.programmes[0].fieldIds, ["P02"]);
  assert.deepEqual(removed.allocations.map((item) => item.fieldIds), [["P02"], []]);
  assert.deepEqual(removed.fieldDetails, []);
  assert.equal(noted.allocations.length, 2);
});
check("Removing a programme clears only that card, its workers and notes", () => {
  const noted = { ...twoCards, fieldDetails: [{ programme: "Mature Circle", fieldId: "P01", targetHa: 5, remarks: "Note" }] };
  const removed = removeProgramme(noted, "Mature Circle");
  assert.deepEqual(removed.programmes, [{ programme: "Pruning", fieldIds: [] }]);
  assert.deepEqual(removed.allocations, []);
  assert.deepEqual(removed.fieldDetails, []);
});
check("Separate dates can allocate the same worker to different programmes", () => {
  const otherDay = addWorkersToProgramme(addProgramme(emptyPlan("2026-09-24"), "Pruning"), ["DEMO001"], "Pruning");
  assert.equal(multiple.allocations[0].programme, "Mature Circle");
  assert.equal(otherDay.allocations[0].programme, "Pruning");
});
check("Finalisation requires cards, fields and complete worker rows", () => {
  assert.throws(() => finalisePlan(initial), /at least one programme/);
  assert.throws(() => finalisePlan(card), /at least one field/);
  assert.throws(() => finalisePlan(fields), /add workers/);
  assert.throws(() => finalisePlan(multiple), /select fields for 1 worker/);
  assert.deepEqual(finalisationIssues(complete), []);
  assert.equal(finalisePlan(complete).status, "Finalised");
});
check("Finalised plans reject every editing operation", () => {
  const plan = finalisePlan(complete);
  for (const edit of [
    () => addProgramme(plan, "Pruning"),
    () => removeProgramme(plan, "Mature Circle"),
    () => addProgrammeField(plan, "Mature Circle", "P03"),
    () => removeProgrammeField(plan, "Mature Circle", "P01"),
    () => addWorkersToProgramme(plan, ["DEMO003"], "Mature Circle"),
    () => removeWorker(plan, "Mature Circle", "DEMO001"),
    () => toggleWorkerField(plan, "DEMO001", "P01"),
    () => applyFieldsToWorkers(plan, "Mature Circle", ["DEMO001"], ["P02"]),
  ]) assert.throws(edit, /Reopen/);
});
check("Incomplete drafts and complete finalised plans save and load without loss", () => {
  for (const plan of [initial, card, workers, twoCards, finalisePlan(complete)]) {
    assert.deepEqual(parsePlanStore(storeFor(plan)), { version: 2, days: { [date]: plan } });
  }
  assert.deepEqual(parsePlanStore(null), { version: 2, days: {} });
});
check("Earlier map plans migrate to cards and preserve all fields and notes", () => {
  const legacy = { ...complete };
  delete legacy.programmes;
  legacy.fieldDetails = [{ programme: "Mature Circle", fieldId: "P03", targetHa: 2.5, remarks: "Legacy note" }];
  legacy.savedAt = "2026-09-22T08:00:00.000Z";
  const converted = parsePlanStore(storeFor(legacy, 1)).days[date];
  assert.deepEqual(converted.programmes, [{ programme: "Mature Circle", fieldIds: ["P01", "P02", "P03"] }]);
  assert.deepEqual(converted.allocations, legacy.allocations);
  assert.deepEqual(converted.fieldDetails, legacy.fieldDetails);
  assert.equal(converted.savedAt, legacy.savedAt);
  assert.deepEqual(parsePlanStore(storeFor(converted)).days[date], converted);
});
check("Legacy finalised plans retain status unless a notes-only card needs review", () => {
  const legacy = { ...finalisePlan(complete) };
  delete legacy.programmes;
  assert.equal(parsePlanStore(storeFor(legacy, 1)).days[date].status, "Finalised");
  legacy.fieldDetails = [{ programme: "Pruning", fieldId: "P03", targetHa: null, remarks: "Unassigned" }];
  const converted = parsePlanStore(storeFor(legacy, 1)).days[date];
  assert.equal(converted.status, "Draft");
  assert.equal(converted.programmes.length, 2);
  assert.deepEqual(converted.fieldDetails, legacy.fieldDetails);
});
check("Saved data rejects duplicate workers, programmes and fields", () => {
  for (const plan of [
    { ...multiple, allocations: [...multiple.allocations, multiple.allocations[0]] },
    { ...multiple, programmes: [...multiple.programmes, multiple.programmes[0]] },
    { ...multiple, programmes: [{ programme: "Mature Circle", fieldIds: ["P01", "P01"] }] },
    { ...multiple, allocations: [{ workerId: "DEMO001", programme: "Mature Circle", fieldIds: ["P01", "P01"] }] },
  ]) assert.throws(() => parsePlanStore(storeFor(plan)));
});
check("Saved data rejects orphaned fields, missing cards and incomplete finalised plans", () => {
  for (const plan of [
    { ...multiple, programmes: [] },
    { ...multiple, programmes: [{ programme: "Mature Circle", fieldIds: ["P01"] }] },
    { ...multiple, fieldDetails: [{ programme: "Pruning", fieldId: "P01", targetHa: null, remarks: "" }] },
    { ...multiple, status: "Finalised" },
  ]) assert.throws(() => parsePlanStore(storeFor(plan)));
});
check("Malformed stores and invalid dates or coverage are rejected", () => {
  assert.throws(() => parsePlanStore("{broken"));
  assert.throws(() => parsePlanStore(JSON.stringify({ version: 3, days: {} })));
  assert.throws(() => parsePlanStore(JSON.stringify({ version: 2, days: { wrong: multiple } })));
  assert.throws(() => parsePlanStore(storeFor({ ...complete, fieldDetails: [{ programme: "Mature Circle", fieldId: "P01", targetHa: 0, remarks: "" }] })));
});
check("Tomorrow handles month/year transitions and dates reject overflow", () => {
  assert.equal(tomorrowDate(new Date(2026, 11, 31, 23, 30)), "2027-01-01");
  assert.equal(tomorrowDate(new Date(2028, 1, 28, 23, 30)), "2028-02-29");
  assert.equal(isPlanDate("2026-02-30"), false);
  assert.equal(isPlanDate("2028-02-29"), true);
});
check("Demo workers have unique IDs and complete dummy details", () => {
  assert.equal(new Set(DEMO_WORKERS.map((worker) => worker.id)).size, DEMO_WORKERS.length);
  assert.equal(DEMO_WORKERS.length, 18);
  assert.ok(DEMO_WORKERS.every((worker) => worker.id.startsWith("DEMO") && worker.name && worker.gang));
});
console.log(`\n${checks} Pre-Plan checks passed.`);
