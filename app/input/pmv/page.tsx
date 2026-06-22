import type { Metadata } from "next";
import { PmvTracker } from "@/components/pmv/pmv-tracker";

export const metadata: Metadata = { title: "PMV Tracker" };

export default function PmvInputPage() {
  return <PmvTracker />;
}
