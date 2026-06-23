import type { Metadata } from "next";
import { HarvestingIntervalDashboard } from "@/components/harvesting-interval/harvesting-interval-dashboard";

export const metadata: Metadata = { title: "Harvesting Interval" };

export default function HarvestingIntervalPage() {
  return <HarvestingIntervalDashboard />;
}
