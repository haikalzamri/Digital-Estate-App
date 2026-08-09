import type { Metadata } from "next";
import { CostbookDashboard } from "@/components/costbook/costbook-dashboard";

export const metadata: Metadata = { title: "Costbook" };

export default function CostbookManagementPage() {
  return <CostbookDashboard />;
}
