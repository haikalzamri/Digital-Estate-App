import assert from "node:assert/strict";
import fs from "node:fs";
import { FIELD_ORDER, getFields, getInterval, getDayMetrics, getTotals, getWeightTotals, intervalStatus, monthDays } from "./report.ts";
import { FIELD_SHAPES } from "./field-map-data.ts";
const source = JSON.parse(fs.readFileSync(new URL("./source.json", import.meta.url), "utf8"));
let count = 0;
function check(name, run) { run(); count++; console.log("PASS " + name); }
function fixture(production) { return { ...source, production: { TEST: production }, dispatch: {}, metadata: { ...source.metadata, productionStart: "2026-07-01", productionEnd: "2026-09-19" } }; }
check("A five-day gap continues the cycle; a six-day gap resets", () => {
 const data = fixture({ "2026-07-01": 10, "2026-07-06": 20, "2026-07-12": 30 });
 assert.equal(getInterval(data, "TEST", "2026-07-06").interval, 6);
 assert.equal(getInterval(data, "TEST", "2026-07-12").interval, 1);
 assert.equal(getInterval(data, "TEST", "2026-07-14").interval, 3);
});
check("Initial history remains unknown until observed; June is not fabricated", () => {
 const data = fixture({ "2026-07-03": 10, "2026-07-12": 20 });
 assert.equal(getInterval(data, "TEST", "2026-07-02").interval, null);
 assert.equal(getInterval(data, "TEST", "2026-07-03").status, "uncertain");
 assert.equal(getInterval(data, "TEST", "2026-07-12").status, "onTrack");
});
check("Six observed empty days establish the first known cycle", () => {
 assert.equal(getInterval(fixture({ "2026-07-07": 10 }), "TEST", "2026-07-07").status, "onTrack");
});
check("Zero quantities and dispatch do not reset production intervals", () => {
 const data = fixture({ "2026-07-01": 10, "2026-07-07": 0 });
 data.dispatch.TEST = { "2026-07-07": 40 };
 assert.equal(getInterval(data, "TEST", "2026-07-07").interval, 7);
});
check("Intervals carry across months regardless of input order", () => {
 const data = fixture({ "2026-08-02": 50, "2026-07-29": 40, "2026-07-10": 10 });
 assert.equal(getInterval(data, "TEST", "2026-08-02").interval, 5);
 assert.equal(getInterval(data, "TEST", "2026-08-03").interval, 6);
});
check("Unknown and future dates never create a false status", () => {
 for (const date of ["", "2026-02-30", "2026-06-30", "2026-09-20"]) assert.equal(getInterval(source, "17G007", date).interval, null);
});
check("H017 is provisional even when its calculated interval is high", () => {
 const value = getInterval(source, "23H017", "2026-08-31");
 assert.equal(value.interval, 61); assert.equal(value.status, "uncertain");
 assert.equal(value.lastHarvest, "2026-08-31");
});
check("All interval band boundaries match the agreed colours", () => {
 for (const [days, status] of [[1,"onTrack"],[12,"onTrack"],[13,"watch"],[15,"watch"],[16,"caution"],[20,"caution"],[21,"overdue"]]) assert.equal(intervalStatus(days),status);
});
check("Division 1 has exactly the agreed nine fields in manual order", () => {
 assert.deepEqual(getFields(source, "DIV01").map(f=>f.code), ["17G007","17G008","17G009","17G010","17H011","23I012","09I013","98J011","98J010"]);
 assert.equal(getFields(source,"DIV01",false).length,19);
});
check("Division filters are isolated and all 37 active fields appear once", () => {
 const all = getFields(source,"all");
 assert.equal(all.length,37); assert.equal(new Set(all.map(f=>f.code)).size,37);
 for (const div of ["DIV01","DIV02","DIV03"]) assert.ok(getFields(source,div).every(f=>f.division===div));
 assert.equal(getFields(source,"DIV02").length,18); assert.equal(getFields(source,"DIV03").length,10);
});
check("E014 planting years remain separate, and I013 follows SAP 2009", () => {
 const fields=getFields(source,"DIV02").filter(f=>f.label==="E014");
 assert.deepEqual(fields.map(f=>f.yop),[2011,2020]);
 assert.equal(source.fields.find(f=>f.code==="09I013").yop,2009);
 assert.notEqual(source.production["11E014"],source.production["20E014"]);
});
check("Aggregated data reconciles to eligible workbook rows only", () => {
 const codes=getFields(source,"all").map(f=>f.code);
 const totals=getTotals(source,codes,"2026-07-01","2026-09-19");
 assert.equal(totals.production,838130); assert.equal(totals.dispatch,634665);
 assert.equal(source.metadata.productionRows,1352); assert.equal(source.metadata.dispatchRows,1345);
 assert.equal(source.metadata.excludedUnclassifiedBunches,743);
 assert.equal(Object.keys(source.production).length,37);
});
check("Daily totals agree with month totals and division totals reconcile", () => {
 const codes=getFields(source,"all").map(f=>f.code);
 for (const month of source.metadata.availableMonths) {
  const days=monthDays(month);
  const total=getTotals(source,codes,days[0],days.at(-1));
  const daily=days.reduce((sum,date)=>sum+codes.reduce((n,code)=>n+(getDayMetrics(source,code,date).production||0),0),0);
  assert.equal(daily,total.production);
  const divisions=["DIV01","DIV02","DIV03"].reduce((sum,div)=>sum+(getTotals(source,getFields(source,div).map(f=>f.code),days[0],days.at(-1)).production||0),0);
  assert.equal(divisions,total.production);
 }
});
check("September dispatch is unavailable, never a false zero or balance", () => {
 const day=getDayMetrics(source,"17G007","2026-09-12");
 assert.equal(day.production,458); assert.equal(day.dispatch,null); assert.equal(day.difference,null);
 const total=getTotals(source,["17G007"],"2026-09-01","2026-09-30");
 assert.equal(total.dispatch,null); assert.equal(total.difference,null);
 assert.equal(getDayMetrics(source,"17G007","2026-09-20").production,null);
});
check("Multi-month comparison includes only the common supplied period", () => {
 const codes=getFields(source,"all").map(f=>f.code);
 const all=getTotals(source,codes,"2026-07-01","2026-09-19");
 const august=getTotals(source,codes,"2026-07-01","2026-08-31");
 assert.equal(all.comparisonThrough,"2026-08-31"); assert.equal(all.difference,august.difference);
 assert.equal(all.comparedProduction,august.production);
});
check("Map parcels have valid unique codes and cover every report field", () => {
 assert.equal(new Set(FIELD_SHAPES.map(f=>f.code)).size,FIELD_SHAPES.length);
 for (const shape of FIELD_SHAPES) assert.ok(source.fields.some(f=>f.code===shape.code),shape.code);
 for (const code of Object.values(FIELD_ORDER).flat()) assert.ok(FIELD_SHAPES.some(f=>f.code===code),code);
});
check("Public prototype data excludes personal records and other estates", () => {
 const json=JSON.stringify(source);
 for (const word of ["EMP_NO","CREATE_USER","MODIFY_USER","E451","BUNCH_CNT_DTL_ID"]) assert.ok(!json.includes(word));
});

check("Dispatch weights reconcile to all 1,345 E450 detail rows", () => {
 const codes = getFields(source, "all").map(f => f.code);
 const totals = getWeightTotals(source, codes, "2026-07-01", "2026-08-31");
 assert.equal(totals.estate, 7169669); assert.equal(totals.mill, 7520410);
 assert.equal(totals.variance, 350741);
 assert.ok(Math.abs(totals.variancePercent - 350741 / 7169669 * 100) < 1e-10);
 assert.equal(source.metadata.weightUnit, "KG");
});
check("Weight division and daily totals reconcile without header double counting", () => {
 const codes = getFields(source, "all").map(f => f.code);
 for (const month of ["2026-07", "2026-08"]) {
  const days = monthDays(month), total = getWeightTotals(source, codes, days[0], days.at(-1));
  for (const metric of ["estate", "mill", "variance"]) {
   const daily = days.reduce((sum,date) => sum + getWeightTotals(source,codes,date,date)[metric], 0);
   const divisions = ["DIV01","DIV02","DIV03"].reduce((sum,div) => sum + getWeightTotals(source,getFields(source,div).map(f=>f.code),days[0],days.at(-1))[metric], 0);
   assert.equal(daily, total[metric]); assert.equal(divisions, total[metric]);
  }
 }
});
check("Weights respect date cutoffs and do not fabricate September data", () => {
 const codes = getFields(source, "all").map(f=>f.code);
 const august = getWeightTotals(source,codes,"2026-08-01","2026-08-31");
 const longer = getWeightTotals(source,codes,"2026-08-01","2026-09-19");
 assert.deepEqual(august,longer);
 for (const [from,through] of [["2026-09-01","2026-09-19"],["2026-06-01","2026-06-30"],["2026-08-10","2026-08-01"],["bad","2026-08-01"]]) {
  const result = getWeightTotals(source,codes,from,through);
  assert.equal(result.estate,null); assert.equal(result.mill,null);
  assert.equal(result.variance,null); assert.equal(result.variancePercent,null);
 }
});
check("Weight variance uses matched dispatch rows, exact dates, and estate denominator", () => {
 const data = {...source,weights:{TEST:{"2026-08-01":{estate:1000,mill:900},"2026-08-02":{estate:2000,mill:2200}}}};
 assert.deepEqual(getWeightTotals(data,["TEST"],"2026-08-01","2026-08-01"),{estate:1000,mill:900,variance:-100,variancePercent:-10,through:"2026-08-01"});
 const total = getWeightTotals(data,["TEST","TEST"],"2026-08-01","2026-08-02");
 assert.equal(total.estate,3000); assert.equal(total.mill,3100); assert.equal(total.variance,100);
 assert.equal(getWeightTotals(data,["TEST"],"2026-08-03","2026-08-03").variancePercent,null);
 assert.equal(getWeightTotals(data,["TEST"],"2026-08-03","2026-08-03").estate,0);
});
console.log("\n"+count+" Minamas checks passed.");
