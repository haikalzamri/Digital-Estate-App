import { readFile, writeFile } from "node:fs/promises";

const sourcePath = new URL("../pmv-data.js", import.meta.url);
const outputPath = new URL("../lib/data/pmv-source.json", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const assignment = "window.PMV_HISTORICAL_RECORDS = ";
const start = source.indexOf(assignment);

if (start < 0) throw new Error("PMV historical record assignment was not found.");

const jsonText = source.slice(start + assignment.length).trim().replace(/;$/, "");
const records = JSON.parse(jsonText);

if (!Array.isArray(records)) throw new Error("PMV source data is not an array.");

await writeFile(outputPath, `${JSON.stringify(records)}\n`, "utf8");
console.log(`Generated ${records.length} PMV records at ${outputPath.pathname}`);
