import type { Metadata } from "next";
import { WorkProgramManagement } from "@/components/work-program/work-program-management";

export const metadata: Metadata = { title: "Work Program Management" };

type PageProps = {
  searchParams: Promise<{ view?: string }>;
};

export default async function WorkProgramManagementPage({ searchParams }: PageProps) {
  const { view } = await searchParams;
  const activeView = view === "records" ? "records" : "dashboard";

  return <WorkProgramManagement initialView={activeView} />;
}
