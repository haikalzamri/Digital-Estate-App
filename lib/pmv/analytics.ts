import sourceRecordsJson from "@/lib/data/pmv-source.json";
import type { PmvRecord } from "@/lib/types/pmv";
import { normalisePmvRecord, sortPmvRecordsDescending } from "./records";

export const pmvHistoricalRecords = (sourceRecordsJson as PmvRecord[])
  .map((record) => normalisePmvRecord(record))
  .sort(sortPmvRecordsDescending);

