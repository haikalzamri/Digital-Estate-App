"use client";

import { LayoutDashboard, ListChecks } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { WorkProgramDashboard } from "@/components/work-program/work-program-dashboard";
import { WorkProgramRecords } from "@/components/work-program/work-program-records";
import { useFieldMap } from "@/components/work-program/use-field-map";
import { useWorkProgramData } from "@/components/work-program/use-work-program-data";

type ManagementView = "dashboard" | "records";

export function WorkProgramManagement({ initialView }: { initialView: ManagementView }) {
  const router = useRouter();
  const fieldMap = useFieldMap();
  const data = useWorkProgramData();
  const [activeView, setActiveView] = useState(initialView);
  const [syncBusy, setSyncBusy] = useState(false);

  const changeView = (view: ManagementView) => {
    setActiveView(view);
    router.replace(view === "records" ? "/management/work-program?view=records" : "/management/work-program", {
      scroll: false,
    });
  };

  const sync = useCallback(async () => {
    setSyncBusy(true);
    try {
      await data.syncPending();
    } finally {
      setSyncBusy(false);
    }
  }, [data]);

  return (
    <ModuleShell
      audience="management"
      title="Work Program"
      subtitle="Dashboard monitoring, approval review, monthly tracking and estate map output"
      onSync={sync}
      syncBusy={syncBusy}
    >
      <nav className="section-tabs management-tabs" aria-label="Work Program management views">
        <button className={activeView === "dashboard" ? "active" : ""} type="button" onClick={() => changeView("dashboard")}>
          <LayoutDashboard aria-hidden="true" size={16} />
          Dashboard
        </button>
        <button className={activeView === "records" ? "active" : ""} type="button" onClick={() => changeView("records")}>
          <ListChecks aria-hidden="true" size={16} />
          Records
        </button>
      </nav>

      {data.message ? (
        <div className="inline-notice" role="status">
          <span>{data.message}</span>
          <button type="button" onClick={() => data.setMessage("")} aria-label="Dismiss message">
            Close
          </button>
        </div>
      ) : null}

      {activeView === "dashboard" ? (
        <WorkProgramDashboard fieldMap={fieldMap} records={data.records} loading={data.loading} source={data.source} />
      ) : (
        <WorkProgramRecords
          fieldMap={fieldMap}
          records={data.records}
          loading={data.loading}
          source={data.source}
          onSave={data.saveRecord}
          onApprove={data.approveRecord}
          onDelete={data.deleteRecord}
        />
      )}
    </ModuleShell>
  );
}
