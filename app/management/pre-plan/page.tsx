import type { Metadata } from "next";
import { PrePlanBoard } from "@/components/pre-plan/pre-plan-board";

export const metadata: Metadata = { title: "Pre-Plan Prototype" };

export default function PrePlanPage() {
  return <PrePlanBoard />;
}
