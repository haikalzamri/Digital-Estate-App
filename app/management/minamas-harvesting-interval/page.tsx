import type { Metadata } from "next";
import { MinamasDashboard } from "@/components/minamas-harvesting-interval/dashboard";
export const metadata: Metadata = { title: { absolute: "Minamas | Harvesting Interval" } };
export default function MinamasHarvestingIntervalPage() { return <MinamasDashboard />; }
