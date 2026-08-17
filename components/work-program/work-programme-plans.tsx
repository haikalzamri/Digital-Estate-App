"use client";

import {
  CheckCircle2,
  ClipboardList,
  FileArchive,
  FilePlus2,
  History,
  LockKeyhole,
  PencilLine,
  Send,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { useFieldMap } from "@/components/work-program/use-field-map";
import {
  buildProgrammeFields,
  cloneProgrammeFields,
  createProgrammePlanLog,
  statusLabel,
  useProgrammePlans,
  type ProgrammePlan,
  type ProgrammePlanActor,
  type ProgrammePlanField,
  type ProgrammePlanStatus,
} from "@/components/work-program/use-programme-plans";
import { fieldKey, formatNumber } from "@/lib/work-program/analytics";
import { DASHBOARD_YEAR, WORK_PROGRAM_YEARS, monthsForYear } from "@/lib/work-program/config";

type PlanEditorMode = "create" | "draft";

type PlanEditorState = {
  mode: PlanEditorMode;
  planId?: string;
  activityCode: string;
  name: string;
  year: number;
  reason: string;
  fields: ProgrammePlanField[];
};

type ArchiveState = {
  planId: string;
  reason: string;
} | null;

export function WorkProgrammePlans() {
  const fieldMap = useFieldMap();
  const { plans, savePlans } = useProgrammePlans(fieldMap.features);
  const [actor, setActor] = useState<ProgrammePlanActor>("Assistant Manager");
  const [statusFilter, setStatusFilter] = useState<"All" | ProgrammePlanStatus>("All");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [editor, setEditor] = useState<PlanEditorState | null>(null);
  const [archiveState, setArchiveState] = useState<ArchiveState>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const visiblePlans = useMemo(
    () => plans.filter((plan) => statusFilter === "All" || plan.status === statusFilter),
    [plans, statusFilter],
  );
  const selectedPlan = visiblePlans.find((plan) => plan.id === selectedPlanId) || visiblePlans[0] || null;
  const stats = useMemo(() => ({
    approved: plans.filter((plan) => plan.status === "Approved").length,
    pending: plans.filter((plan) => plan.status === "Pending Approval").length,
    draft: plans.filter((plan) => plan.status === "Draft").length,
    archived: plans.filter((plan) => plan.status === "Archived").length,
  }), [plans]);
  const editorMonths = useMemo(() => monthsForYear(editor?.year || DASHBOARD_YEAR), [editor?.year]);

  const applyStatusFilter = (status: "All" | ProgrammePlanStatus) => {
    const nextVisiblePlans = plans.filter((plan) => status === "All" || plan.status === status);
    setStatusFilter(status);
    setSelectedPlanId(nextVisiblePlans[0]?.id || "");
    setEditor(null);
    setArchiveState(null);
    setMessage("");
    setError("");
  };

  const persistPlanUpdate = (updater: (plan: ProgrammePlan) => ProgrammePlan, success: string) => {
    if (!selectedPlan) return;
    const nextPlans = plans.map((plan) => (plan.id === selectedPlan.id ? updater(plan) : plan));
    savePlans(nextPlans);
    setSelectedPlanId(selectedPlan.id);
    setMessage(success);
    setError("");
  };

  const openCreate = () => {
    setEditor({
      mode: "create",
      activityCode: "",
      name: "",
      year: DASHBOARD_YEAR,
      reason: "",
      fields: buildProgrammeFields("", fieldMap.features, DASHBOARD_YEAR),
    });
    setArchiveState(null);
    setMessage("");
    setError("");
  };

  const openDraftEdit = (plan: ProgrammePlan) => {
    setEditor({
      mode: "draft",
      planId: plan.id,
      activityCode: plan.activityCode || "",
      name: plan.name,
      year: plan.year,
      reason: "",
      fields: cloneProgrammeFields(plan.fields),
    });
    setArchiveState(null);
    setMessage("");
    setError("");
  };

  const saveEditor = () => {
    if (!editor) return;
    const activityCode = normalisePlanActivityCode(editor.activityCode);
    const name = editor.name.trim();
    if (!activityCode) {
      setError("Enter the activity code before saving.");
      return;
    }
    if (!name) {
      setError("Enter a programme name before saving.");
      return;
    }
    const duplicate = plans.find((plan) => fieldKey(plan.name) === fieldKey(name) && plan.id !== editor.planId);
    if (duplicate) {
      setError("This programme already exists. Select the existing programme or use a different name.");
      return;
    }
    const duplicateActivityCode = plans.find((plan) =>
      plan.status !== "Archived" &&
      normalisePlanActivityCode(plan.activityCode || "") === activityCode &&
      plan.id !== editor.planId
    );
    if (duplicateActivityCode) {
      setError("This activity code is already used by another programme.");
      return;
    }

    if (editor.mode === "create") {
      const now = new Date().toISOString();
      const autoApproved = actor === "Manager";
      const createdPlan: ProgrammePlan = {
        id: `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name,
        activityCode,
        year: editor.year,
        status: autoApproved ? "Approved" : "Draft",
        version: 1,
        createdBy: actor,
        createdAt: now,
        updatedAt: now,
        approvedBy: autoApproved ? "Manager" : undefined,
        approvedAt: autoApproved ? now : undefined,
        fields: cloneProgrammeFields(editor.fields),
        logs: [
          createProgrammePlanLog(actor, "Created programme", `${activityCode} · ${name} created with ${editor.fields.length} field${editor.fields.length === 1 ? "" : "s"}.`),
          ...(autoApproved
            ? [createProgrammePlanLog("Manager", "Approved programme", "Manager-created programme was approved directly.")]
            : []),
        ],
      };
      savePlans([...plans, createdPlan]);
      setSelectedPlanId(createdPlan.id);
      setEditor(null);
      setMessage(autoApproved ? "Programme created and approved directly." : "Programme draft created. Submit it when ready for Manager approval.");
      setError("");
      return;
    }

    if (editor.mode === "draft") {
      const nextPlans = plans.map((plan) => plan.id === editor.planId
        ? {
            ...plan,
            name,
            activityCode,
            year: editor.year,
            rejectedBy: undefined,
            rejectedAt: undefined,
            rejectedReason: undefined,
            fields: cloneProgrammeFields(editor.fields),
            updatedAt: new Date().toISOString(),
            logs: [
              createProgrammePlanLog(actor, "Updated draft", `Draft template updated for ${activityCode} · ${name}.`),
              ...plan.logs,
            ],
          }
        : plan);
      savePlans(nextPlans);
      setSelectedPlanId(editor.planId || selectedPlanId);
      setEditor(null);
      setMessage("Programme draft updated.");
      setError("");
      return;
    }
  };

  const submitPlan = (plan: ProgrammePlan) => {
    if (selectedPlan?.id !== plan.id) setSelectedPlanId(plan.id);
    persistPlanUpdate((current) => {
      const managerSubmit = actor === "Manager";
      return {
        ...current,
        status: managerSubmit ? "Approved" : "Pending Approval",
        updatedAt: new Date().toISOString(),
        approvedBy: managerSubmit ? "Manager" : current.approvedBy,
        approvedAt: managerSubmit ? new Date().toISOString() : current.approvedAt,
        logs: [
          createProgrammePlanLog(actor, managerSubmit ? "Approved programme" : "Submitted programme", managerSubmit ? "Manager submitted and approved the programme directly." : "Programme submitted for Manager approval."),
          ...current.logs,
        ],
      };
    }, actor === "Manager" ? "Programme approved directly." : "Programme submitted for Manager approval.");
  };

  const approvePlan = () => {
    if (actor !== "Manager") {
      setError("Only Manager can approve programme plans.");
      return;
    }
    persistPlanUpdate((current) => {
      return {
        ...current,
        status: "Approved",
        updatedAt: new Date().toISOString(),
        approvedBy: "Manager",
        approvedAt: new Date().toISOString(),
        rejectedBy: undefined,
        rejectedAt: undefined,
        rejectedReason: undefined,
        logs: [
          createProgrammePlanLog("Manager", "Approved programme", "Programme approved as active baseline."),
          ...current.logs,
        ],
      };
    }, "Programme approved.");
  };

  const rejectPlan = () => {
    if (actor !== "Manager") {
      setError("Only Manager can reject programme plans.");
      return;
    }
    const reason = window.prompt("Reason for rejection")?.trim();
    if (!reason) {
      setError("Enter a rejection reason before returning this programme to draft.");
      return;
    }
    persistPlanUpdate((current) => {
      return {
        ...current,
        status: "Draft",
        updatedAt: new Date().toISOString(),
        rejectedBy: "Manager",
        rejectedAt: new Date().toISOString(),
        rejectedReason: reason,
        logs: [
          createProgrammePlanLog("Manager", "Rejected programme", "Programme returned to draft for revision.", reason),
          ...current.logs,
        ],
      };
    }, "Programme returned to draft.");
  };

  const archivePlan = () => {
    if (!archiveState) return;
    const reason = archiveState.reason.trim();
    if (actor !== "Manager") {
      setError("Only Manager can archive approved programmes.");
      return;
    }
    if (!reason) {
      setError("Enter an archive remark before archiving this programme.");
      return;
    }
    const targetPlan = plans.find((plan) => plan.id === archiveState.planId);
    if (!targetPlan) return;
    const nextPlans = plans.map((plan) => plan.id === archiveState.planId
      ? {
          ...plan,
          status: "Archived" as const,
          archivedBy: "Manager" as const,
          archivedAt: new Date().toISOString(),
          archiveReason: reason,
          updatedAt: new Date().toISOString(),
          logs: [
            createProgrammePlanLog("Manager", "Archived programme", "Programme archived and removed from operational selection.", reason),
            ...plan.logs,
          ],
        }
      : plan);
    savePlans(nextPlans);
    setStatusFilter("Archived");
    setSelectedPlanId(targetPlan.id);
    setArchiveState(null);
    setEditor(null);
    setMessage("Programme archived. Create a new programme plan for any replacement.");
    setError("");
  };

  const deleteDraftPlan = (plan: ProgrammePlan) => {
    if (plan.status !== "Draft") {
      setError("Only draft programmes can be deleted. Approved programmes must be archived.");
      return;
    }

    const draftLabel = plan.rejectedReason ? "rejected draft" : "draft";
    const confirmed = window.confirm(`Delete ${plan.name} ${draftLabel}? This cannot be undone.`);
    if (!confirmed) return;

    const nextPlans = plans.filter((candidate) => candidate.id !== plan.id);
    const nextVisiblePlans = nextPlans.filter((candidate) => statusFilter === "All" || candidate.status === statusFilter);
    savePlans(nextPlans);
    setSelectedPlanId(nextVisiblePlans[0]?.id || "");
    setEditor(null);
    setArchiveState(null);
    setMessage(`${plan.name} ${draftLabel} deleted.`);
    setError("");
  };

  return (
    <ModuleShell
      audience="management"
      title="Work Program"
      subtitle="Programme planning, approval control and archive history"
    >
      <nav className="section-tabs management-tabs" aria-label="Work Program management views">
        <Link href="/management/work-program">Monthly View</Link>
        <Link href="/management/work-program?view=records">Daily View</Link>
        <Link className="active" href="/management/work-program/programmes">
          <ClipboardList aria-hidden="true" size={16} />
          Programme Plan
        </Link>
      </nav>

      <section className="workspace-section programme-plan-workspace" aria-labelledby="programme-plan-title">
        <div className="workspace-toolbar">
          <div className="section-heading">
            <p>Programme governance</p>
            <h2 id="programme-plan-title">Programme Plan Control</h2>
          </div>
          <div className="toolbar-actions">
            <label className="select-control compact-role-control">
              <span>Current role</span>
              <select value={actor} onChange={(event) => setActor(event.target.value as ProgrammePlanActor)}>
                <option>Assistant Manager</option>
                <option>Manager</option>
              </select>
            </label>
            <button className="primary-button" type="button" onClick={openCreate}>
              <FilePlus2 aria-hidden="true" size={16} /> Create Programme
            </button>
          </div>
        </div>

        <div className="programme-plan-kpis">
          <PlanKpi active={statusFilter === "Approved"} label="Approved" onClick={() => applyStatusFilter("Approved")} value={stats.approved} tone="approved" />
          <PlanKpi active={statusFilter === "Pending Approval"} label="Pending Approval" onClick={() => applyStatusFilter("Pending Approval")} value={stats.pending} tone="pending" />
          <PlanKpi active={statusFilter === "Draft"} label="Draft" onClick={() => applyStatusFilter("Draft")} value={stats.draft} tone="draft" />
          <PlanKpi active={statusFilter === "Archived"} label="Archived" onClick={() => applyStatusFilter("Archived")} value={stats.archived} tone="archived" />
        </div>

        {message ? <div className="inline-notice" role="status"><span>{message}</span><button type="button" onClick={() => setMessage("")}>Close</button></div> : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}

        <div className="programme-plan-layout">
          <aside className="data-panel programme-plan-list-panel">
            <div className="panel-heading">
              <div>
                <h3>Programme List</h3>
                <p>Only approved programmes are selectable in operational screens.</p>
              </div>
            </div>
            <label className="compact-select programme-status-filter">
              <span>Status</span>
              <select value={statusFilter} onChange={(event) => applyStatusFilter(event.target.value as "All" | ProgrammePlanStatus)}>
                <option>All</option>
                <option>Approved</option>
                <option>Pending Approval</option>
                <option>Draft</option>
                <option>Archived</option>
              </select>
            </label>
            <div className="programme-plan-list">
              {visiblePlans.map((plan) => (
                <button
                  className={`programme-plan-card ${selectedPlan?.id === plan.id ? "selected" : ""}`}
                  key={plan.id}
                  type="button"
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    setEditor(null);
                    setError("");
                    setMessage("");
                  }}
                >
                  <span className={`plan-status-dot ${statusClass(plan.status)}`} />
                  <strong>{plan.name}</strong>
                  <small>{programmePlanCardMeta(plan)}</small>
                  <PlanStatusBadge status={plan.status} />
                </button>
              ))}
            </div>
          </aside>

          <div className="programme-plan-main">
            {editor ? (
              <ProgrammePlanEditor
                actor={actor}
                editor={editor}
                months={editorMonths}
                onCancel={() => {
                  setEditor(null);
                  setError("");
                }}
                onChange={setEditor}
                onSave={saveEditor}
              />
            ) : selectedPlan ? (
              <>
                <ProgrammePlanDetail
                  actor={actor}
                  plan={selectedPlan}
                  onArchive={() => setArchiveState({ planId: selectedPlan.id, reason: "" })}
                  onApprove={approvePlan}
                  onDelete={() => deleteDraftPlan(selectedPlan)}
                  onEditDraft={() => openDraftEdit(selectedPlan)}
                  onReject={rejectPlan}
                  onSubmit={() => submitPlan(selectedPlan)}
                />
                {archiveState?.planId === selectedPlan.id ? (
                  <div className="data-panel archive-programme-panel">
                    <div className="panel-heading">
                      <div>
                        <h3>Archive Programme</h3>
                        <p>Archived programmes remain in history but are hidden from operational input and dashboard selections.</p>
                      </div>
                    </div>
                    <label className="compact-select archive-reason-field">
                      <span>Archive Remark *</span>
                      <textarea value={archiveState.reason} onChange={(event) => setArchiveState({ ...archiveState, reason: event.target.value })} placeholder="Explain why this approved programme is being archived." rows={3} />
                    </label>
                    <div className="toolbar-actions archive-actions">
                      <button className="secondary-button" type="button" onClick={() => setArchiveState(null)}>Cancel</button>
                      <button className="secondary-button danger-button" type="button" onClick={archivePlan} disabled={actor !== "Manager"}><FileArchive aria-hidden="true" size={16} /> Archive Programme</button>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="data-panel"><p className="empty-state">No programme plans available.</p></div>
            )}
          </div>
        </div>
      </section>
    </ModuleShell>
  );
}

function PlanKpi({
  active,
  label,
  onClick,
  value,
  tone,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  value: number;
  tone: string;
}) {
  return (
    <button aria-pressed={active} className={`programme-plan-kpi ${tone} ${active ? "active" : ""}`} onClick={onClick} type="button">
      <span>{label}</span>
      <strong>{value}</strong>
    </button>
  );
}

function ProgrammePlanDetail({
  actor,
  plan,
  onArchive,
  onApprove,
  onDelete,
  onEditDraft,
  onReject,
  onSubmit,
}: {
  actor: ProgrammePlanActor;
  plan: ProgrammePlan;
  onArchive: () => void;
  onApprove: () => void;
  onDelete: () => void;
  onEditDraft: () => void;
  onReject: () => void;
  onSubmit: () => void;
}) {
  const activeFields = plan.fields;
  const activeActivityCode = plan.activityCode || "";

  return (
    <div className="programme-plan-detail-stack">
      <div className="data-panel programme-plan-detail-panel">
        <div className="panel-heading">
          <div>
            <PlanStatusBadge status={plan.status} />
            <h3>{plan.name}</h3>
          </div>
          <ProgrammePlanActions
            actor={actor}
            plan={plan}
            onArchive={onArchive}
            onApprove={onApprove}
            onEditDraft={onEditDraft}
            onReject={onReject}
            onSubmit={onSubmit}
          />
        </div>

        <div className="programme-plan-summary-grid">
          <SummaryMetric label="Status" value={statusLabel(plan.status)} />
          <SummaryMetric label="Activity Code" value={activeActivityCode || "-"} />
          <SummaryMetric label="Year" value={String(plan.year)} />
        </div>

        {plan.status === "Draft" ? (
          <div className="draft-plan-controls">
            <div>
              <strong>Draft Management</strong>
              <span>Delete is available only before the programme is submitted or approved.</span>
            </div>
            <button className="secondary-button danger-button" type="button" onClick={onDelete}>
              <Trash2 aria-hidden="true" size={16} /> Delete Draft
            </button>
          </div>
        ) : null}

        {plan.status === "Approved" ? (
          <div className="locked-baseline-note">
            <LockKeyhole aria-hidden="true" size={16} />
            <span>Approved baseline is locked. Archive this programme with Manager remark if it needs to be replaced.</span>
          </div>
        ) : null}

        {plan.status === "Draft" && plan.rejectedReason ? (
          <div className="programme-review-note rejected-note">
            <XCircle aria-hidden="true" size={16} />
            <div>
              <strong>Rejected Draft</strong>
              <span>{plan.rejectedReason}</span>
              <small>{plan.rejectedBy || "Manager"} · {plan.rejectedAt ? formatShortDateTime(plan.rejectedAt) : "Recently"}</small>
            </div>
          </div>
        ) : null}

        {plan.status === "Archived" ? (
          <div className="programme-review-note archived-note">
            <FileArchive aria-hidden="true" size={16} />
            <div>
              <strong>Archived Programme</strong>
              <span>{plan.archiveReason}</span>
              <small>{plan.archivedBy || "Manager"} · {plan.archivedAt ? formatShortDateTime(plan.archivedAt) : "Recently"}</small>
            </div>
          </div>
        ) : null}
      </div>

      <div className="data-panel">
        <div className="panel-heading">
          <div>
            <h3>{plan.status === "Archived" ? "Archived Plan Preview" : "Programme Plan Preview"}</h3>
            <p>Field, Category, Ha and Actual/Budget remain fixed; programme month values define the approved plan.</p>
          </div>
        </div>
        <PlanPreviewTable fields={activeFields} year={plan.year} />
      </div>

      <ProgrammePlanLogPanel plan={plan} />
    </div>
  );
}

function ProgrammePlanActions({
  actor,
  plan,
  onArchive,
  onApprove,
  onEditDraft,
  onReject,
  onSubmit,
}: {
  actor: ProgrammePlanActor;
  plan: ProgrammePlan;
  onArchive: () => void;
  onApprove: () => void;
  onEditDraft: () => void;
  onReject: () => void;
  onSubmit: () => void;
}) {
  if (plan.status === "Draft") {
    return (
      <div className="toolbar-actions">
        <button className="secondary-button" type="button" onClick={onEditDraft}><PencilLine aria-hidden="true" size={16} /> Edit Draft</button>
        <button className="primary-button" type="button" onClick={onSubmit}>{actor === "Manager" ? <ShieldCheck aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}{actor === "Manager" ? "Approve Directly" : "Submit for Approval"}</button>
      </div>
    );
  }

  if (plan.status === "Pending Approval") {
    return (
      <div className="toolbar-actions">
        <button className="primary-button" type="button" onClick={onApprove} disabled={actor !== "Manager"}><CheckCircle2 aria-hidden="true" size={16} /> Approve</button>
        <button className="secondary-button danger-button" type="button" onClick={onReject} disabled={actor !== "Manager"}><XCircle aria-hidden="true" size={16} /> Reject</button>
      </div>
    );
  }

  if (plan.status === "Archived") {
    return <div className="toolbar-actions"><span className="status-pill approved">View only</span></div>;
  }

  return (
    <div className="toolbar-actions">
      <button className="secondary-button danger-button" type="button" onClick={onArchive} disabled={actor !== "Manager"}><FileArchive aria-hidden="true" size={16} /> Archive</button>
    </div>
  );
}

function ProgrammePlanEditor({
  actor,
  editor,
  months,
  onCancel,
  onChange,
  onSave,
}: {
  actor: ProgrammePlanActor;
  editor: PlanEditorState;
  months: ReturnType<typeof monthsForYear>;
  onCancel: () => void;
  onChange: (next: PlanEditorState) => void;
  onSave: () => void;
}) {
  const updateFieldMonth = (fieldId: string, monthKey: string) => {
    onChange({
      ...editor,
      fields: editor.fields.map((field) => {
        if (field.id !== fieldId) return field;
        const currentValue = Number(field.months[monthKey]) || 0;
        return {
          ...field,
          months: { ...field.months, [monthKey]: currentValue ? 0 : Number(field.hectares) || 0 },
        };
      }),
    });
  };

  const refreshYear = (year: number) => {
    const nextMonths = monthsForYear(year);
    onChange({
      ...editor,
      year,
      fields: editor.fields.map((field) => ({
        ...field,
        months: Object.fromEntries(nextMonths.map((month) => [month.key, 0])),
      })),
    });
  };

  return (
    <div className="data-panel programme-plan-editor-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{editor.mode === "create" ? "New programme" : "Draft edit"}</p>
          <h3>{editor.mode === "create" ? "Create Programme Plan" : "Edit Draft Programme"}</h3>
        </div>
        <div className="toolbar-actions">
          <button className="secondary-button" type="button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" type="button" onClick={onSave}>
            {editor.mode === "create" && actor === "Manager" ? <ShieldCheck aria-hidden="true" size={16} /> : <Send aria-hidden="true" size={16} />}
            {editor.mode === "create" && actor === "Manager" ? "Create & Approve" : "Save"}
          </button>
        </div>
      </div>

      <div className="programme-editor-form">
        <label className="compact-select programme-activity-code-field">
          <span>Activity Code *</span>
          <input value={editor.activityCode} onChange={(event) => onChange({ ...editor, activityCode: event.target.value.toUpperCase() })} placeholder="e.g. MC-001" />
        </label>
        <label className="compact-select">
          <span>Programme Name</span>
          <input value={editor.name} onChange={(event) => onChange({ ...editor, name: event.target.value })} placeholder="e.g. Bagworm Treatment" />
        </label>
        <label className="compact-select">
          <span>Year</span>
          <select value={editor.year} onChange={(event) => refreshYear(Number(event.target.value))}>
            {WORK_PROGRAM_YEARS.map((year) => <option key={year}>{year}</option>)}
          </select>
        </label>
      </div>

      <div className="programme-editor-hint">
        <LockKeyhole aria-hidden="true" size={15} />
        <span>Field, Category, Ha and Actual/Budget are fixed. Click a month to plan or clear the full field hectare value.</span>
      </div>

      <div className="wide-table-scroll programme-plan-table-scroll">
        <table className="programme-plan-table">
          <thead>
            <tr>
              <th>Field</th>
              <th>Category</th>
              <th>Ha</th>
              <th>Actual / Budget</th>
              {months.map((month) => <th key={month.key}>{month.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {editor.fields.map((field) => (
              <tr key={field.id}>
                <th>{field.field}</th>
                <td>{field.category}</td>
                <td>{formatNumber(field.hectares, 8)}</td>
                <td><span className="row-type programme">Programme</span></td>
                {months.map((month) => {
                  const value = Number(field.months[month.key]) || 0;
                  return (
                    <td key={month.key}>
                      <button
                        className={`plan-month-button ${value ? "planned" : ""}`}
                        type="button"
                        onClick={() => updateFieldMonth(field.id, month.key)}
                      >
                        {value ? formatNumber(value, 8) : "+"}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PlanPreviewTable({ fields, year }: { fields: ProgrammePlanField[]; year: number }) {
  const months = monthsForYear(year);

  return (
    <div className="wide-table-scroll programme-plan-table-scroll">
      <table className="programme-plan-table preview">
        <thead>
          <tr>
            <th>Field</th>
            <th>Category</th>
            <th>Ha</th>
            <th>Actual / Budget</th>
            {months.map((month) => <th key={month.key}>{month.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {fields.slice(0, 28).map((field) => (
            <tr key={field.id}>
              <th>{field.field}</th>
              <td>{field.category}</td>
              <td>{formatNumber(field.hectares, 8)}</td>
              <td><span className="row-type programme">Programme</span></td>
              {months.map((month) => {
                const value = Number(field.months[month.key]) || 0;
                return <td key={month.key}>{value ? <span className="preview-month-value">{formatNumber(value, 8)}</span> : ""}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {fields.length > 28 ? <p className="table-footnote">Showing first 28 fields for preview.</p> : null}
    </div>
  );
}

function ProgrammePlanLogPanel({ plan }: { plan: ProgrammePlan }) {
  const timeline = buildPlanTimeline(plan);
  const stages = buildPlanStages(plan);

  return (
    <div className="data-panel programme-plan-log-panel">
      <div className="panel-heading">
        <div>
          <h3><History aria-hidden="true" size={16} /> Process Flow</h3>
          <p>Follow the programme from draft preparation to approval and archive history.</p>
        </div>
      </div>
      <div className="programme-process-current">
        <PlanStatusBadge status={plan.status} />
        <strong>{currentProcessMessage(plan)}</strong>
      </div>

      <div className="programme-stage-flow" aria-label="Programme approval process stage">
        {stages.map((stage, index) => (
          <article className={`programme-stage-card ${stage.state}`} key={stage.id}>
            <div className="programme-stage-marker">
              {stage.state === "complete" ? <CheckCircle2 aria-hidden="true" size={15} /> : <span>{index + 1}</span>}
            </div>
            <div>
              <strong>{stage.title}</strong>
              <p>{stage.detail}</p>
              {stage.meta ? <small>{stage.meta}</small> : null}
            </div>
          </article>
        ))}
      </div>

      <div className="programme-audit-heading">
        <strong>Detailed Audit Trail</strong>
        <span>{timeline.length} event{timeline.length === 1 ? "" : "s"}</span>
      </div>
      <div className="programme-audit-list">
        {timeline.map((item, index) => (
          <article className={`programme-audit-step ${item.state}`} key={item.id}>
            <div className="programme-audit-marker">
              <span>{index + 1}</span>
            </div>
            <div className="programme-audit-card">
              <div>
                <strong>{item.action}</strong>
                <span>{item.actor} · {formatShortDateTime(item.at)}</span>
              </div>
              <p>{item.detail}</p>
              {item.reason ? <small>Reason: {item.reason}</small> : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function SummaryMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PlanStatusBadge({ status }: { status: ProgrammePlanStatus }) {
  return <span className={`plan-status-badge ${statusClass(status)}`}>{statusLabel(status)}</span>;
}

function statusClass(status: ProgrammePlanStatus) {
  return status.toLowerCase().replace(/\s+/g, "-");
}

function normalisePlanActivityCode(value: string) {
  return value.trim().toUpperCase();
}

function programmePlanCardMeta(plan: ProgrammePlan) {
  const activityCode = plan.activityCode || "";
  return [activityCode, String(plan.year), `v${plan.version}`].filter(Boolean).join(" · ");
}

function buildPlanTimeline(plan: ProgrammePlan) {
  const logs = [...plan.logs].reverse();
  const activeIndex = logs.length - 1;
  return logs.map((log, index) => ({
    ...log,
    state: index === activeIndex ? "current" : "complete",
  }));
}

function buildPlanStages(plan: ProgrammePlan) {
  const logs = plan.logs;
  const submitted = findLog(logs, "Submitted programme");
  const approved = findLog(logs, "Approved programme") || findLog(logs, "Approved baseline");
  const rejected = findLog(logs, "Rejected programme");
  const archived = findLog(logs, "Archived programme");
  const activeComplete = plan.status === "Approved" || plan.status === "Archived";

  const stages = [
    {
      id: "created",
      title: "Programme Created",
      detail: "Programme template is created with field, hectare and planned month setup.",
      meta: formatStageMeta(findLog(logs, "Created programme") || logs.at(-1)),
      state: "complete",
    },
    {
      id: "submitted",
      title: "Submitted for Approval",
      detail: plan.status === "Draft" && rejected ? "Rejected draft is back with AM for revision." : plan.status === "Draft" ? "Draft is still editable and has not been submitted." : "Programme has been submitted or approved directly by Manager.",
      meta: formatStageMeta(submitted),
      state: plan.status === "Draft" ? "current" : "complete",
    },
    ...(rejected && plan.status === "Draft" ? [{
      id: "rejected",
      title: "Rejected by Manager",
      detail: "Programme was returned to draft with Manager reason.",
      meta: formatStageMeta(rejected),
      state: "complete",
    }] : []),
    {
      id: "manager-approval",
      title: "Manager Approval",
      detail: plan.status === "Pending Approval" ? "Waiting for Manager decision." : "Manager approval controls when the programme becomes operational.",
      meta: formatStageMeta(approved),
      state: plan.status === "Draft" ? "future" : plan.status === "Pending Approval" ? "current" : activeComplete ? "complete" : "future",
    },
    {
      id: "active-baseline",
      title: "Active Baseline",
      detail: activeComplete ? "Approved programme is visible to Monthly View, Daily View and Program Tracker until archived." : "Programme remains hidden from operations until approved.",
      meta: plan.approvedAt ? `${plan.approvedBy || "Manager"} · ${formatShortDateTime(plan.approvedAt)}` : "",
      state: plan.status === "Approved" ? "current" : plan.status === "Archived" ? "complete" : "future",
    },
    {
      id: "archived",
      title: "Archived",
      detail: plan.status === "Archived" ? "Programme is retained for history and hidden from operations." : "Archive only when the approved programme needs replacement.",
      meta: formatStageMeta(archived),
      state: plan.status === "Archived" ? "current" : "future",
    },
  ];

  return stages;
}

function findLog(logs: ProgrammePlan["logs"], action: string) {
  return logs.find((log) => log.action === action);
}

function formatStageMeta(log?: ProgrammePlan["logs"][number]) {
  return log ? `${log.actor} · ${formatShortDateTime(log.at)}` : "";
}

function currentProcessMessage(plan: ProgrammePlan) {
  if (plan.status === "Draft" && plan.rejectedReason) return "Rejected draft is back with AM for revision before resubmission.";
  if (plan.status === "Draft") return "Draft is still editable. Submit this programme when it is ready for Manager approval.";
  if (plan.status === "Pending Approval") return "Waiting for Manager approval before this programme becomes visible to operations.";
  if (plan.status === "Archived") return "Archived programme is hidden from operations and retained for audit trail.";
  return "Approved baseline is active and visible to Monthly View, Daily View and Program Tracker.";
}

function formatShortDateTime(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
