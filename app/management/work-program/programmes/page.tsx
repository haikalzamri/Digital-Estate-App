import type { Metadata } from "next";
import { WorkProgrammePlans } from "@/components/work-program/work-programme-plans";

export const metadata: Metadata = { title: "Work Program Programme Plan" };

export default function WorkProgrammePlansPage() {
  return <WorkProgrammePlans />;
}
