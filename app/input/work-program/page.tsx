import type { Metadata } from "next";
import { WorkProgramTracker } from "@/components/work-program/work-program-tracker";

export const metadata: Metadata = { title: "Program Tracker" };

export default function WorkProgramInputPage() {
  return <WorkProgramTracker />;
}
