import type { Metadata } from "next";
import { PmvDashboard } from "@/components/pmv/pmv-dashboard";

export const metadata: Metadata = { title: "PMV Dashboard" };

export default function PmvManagementPage() {
  return <PmvDashboard />;
}
