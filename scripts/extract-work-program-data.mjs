import { readFile, writeFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(new URL("../work-program-data.js", import.meta.url), "utf8");
const rows = vm.runInNewContext(`${source}\nDASHBOARD_SOURCE_ROWS;`, Object.create(null));
await writeFile(
  new URL("../lib/data/work-program-source.json", import.meta.url),
  `${JSON.stringify(rows, null, 2)}\n`,
  "utf8",
);

console.log(`Extracted ${rows.length} Work Program source rows.`);
