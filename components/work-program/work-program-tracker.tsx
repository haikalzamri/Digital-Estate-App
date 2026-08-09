"use client";

import { CheckCircle2, Plus, RefreshCcw, Save, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { useFieldMap } from "@/components/work-program/use-field-map";
import { useWorkProgramData } from "@/components/work-program/use-work-program-data";
import {
  fieldKey,
  formatDate,
  formatNumber,
  getProgrammeRows,
  monthKey,
  type DashboardRow,
  type FieldFeature,
} from "@/lib/work-program/analytics";
import { DASHBOARD_YEAR, MONTHS_2026, PROGRAM_TYPES, monthsForYear } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type TrackerDraft = {
  programType: string;
  blockField: string;
  hectares: string;
  actualCompletionDate: string;
  remarks: string;
};

type BatchEntry = TrackerDraft & { id: string };

type CoverageEntry = {
  id: string;
  date: string;
  hectares: number;
  status: "Approved" | "Pending Approval" | "Pending Sync" | "Batch" | "Typing";
};

type PlannedRound = {
  index: number;
  label: string;
  monthKey: string;
  monthLabel: string;
  targetHa: number;
};

type RoundState = PlannedRound & {
  coveredHa: number;
  approvedHa: number;
  unapprovedHa: number;
  progress: number;
};

type CoverageProjection = {
  ready: boolean;
  fieldName: string;
  fieldHa: number;
  programmeRow: DashboardRow | null;
  rounds: RoundState[];
  activeRound: RoundState | null;
  completedRounds: number;
  totalRounds: number;
  totalApprovedHa: number;
  totalPendingHa: number;
  entries: CoverageEntry[];
};

const emptyDraft = (overrides: Partial<TrackerDraft> = {}): TrackerDraft => ({
  programType: PROGRAM_TYPES[0],
  blockField: "",
  hectares: "",
  actualCompletionDate: localDateString(new Date()),
  remarks: "",
  ...overrides,
});

export function WorkProgramTracker() {
  const fieldMap = useFieldMap();
  const data = useWorkProgramData();
  const [draft, setDraft] = useState<TrackerDraft>(emptyDraft);
  const [batchEntries, setBatchEntries] = useState<BatchEntry[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<{ count: number; totalHa: number; syncStatus: string } | null>(null);

  const fields = useMemo(
    () => fieldMap.features
      .map((feature) => feature.properties.field_no || feature.properties.field_gis)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [fieldMap.features],
  );
  const currentCoverage = useMemo(
    () =>
      buildCoverageProjection({
        batchEntries,
        currentEntry: draft,
        fields: fieldMap.features,
        includeCurrentTyping: true,
        records: data.records,
      }),
    [batchEntries, data.records, draft, fieldMap.features],
  );
  const batchTotalHa = batchEntries.reduce((total, entry) => total + Number(entry.hectares || 0), 0);

  const update = (key: keyof TrackerDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "", batch: "" }));
  };

  const updateBatchEntry = (id: string, key: keyof TrackerDraft, value: string) => {
    setBatchEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, [key]: value } : entry)));
    setErrors((current) => ({ ...current, batch: "" }));
  };

  const reset = () => {
    setDraft(emptyDraft());
    setBatchEntries([]);
    setErrors({});
    setLastSubmission(null);
  };

  const addBatch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validation = validateEntry(draft, fields);
    if (Object.keys(validation).length) {
      setErrors(validation);
      return;
    }

    setBatchEntries((current) => [...current, { ...draft, id: createRecordId() }]);
    setDraft((current) =>
      emptyDraft({
        programType: current.programType,
        actualCompletionDate: current.actualCompletionDate,
      }),
    );
    setErrors({});
    setLastSubmission(null);
  };

  const removeBatchEntry = (id: string) => {
    setBatchEntries((current) => current.filter((entry) => entry.id !== id));
    setErrors((current) => ({ ...current, batch: "" }));
  };

  const submitBatch = async () => {
    if (!batchEntries.length) {
      setErrors((current) => ({ ...current, batch: "Add at least one batch entry before submitting." }));
      return;
    }

    const invalidIndex = batchEntries.findIndex((entry) => Object.keys(validateEntry(entry, fields)).length > 0);
    if (invalidIndex >= 0) {
      setErrors((current) => ({ ...current, batch: `Entry ${invalidIndex + 1} has missing or invalid information.` }));
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const records = batchEntries.map((entry) => entryToRecord(entry, fieldMap.features, fields));
      const saved = await data.saveRecords(records);
      setLastSubmission({
        count: saved.length,
        totalHa: saved.reduce((total, record) => total + Number(record.hectares || 0), 0),
        syncStatus: saved.some((record) => record.syncStatus === "Pending Sync") ? "Pending Sync" : "Synced",
      });
      setBatchEntries([]);
      setDraft((current) =>
        emptyDraft({
          programType: current.programType,
          actualCompletionDate: current.actualCompletionDate,
        }),
      );
    } finally {
      setSaving(false);
    }
  };

  const sync = useCallback(async () => {
    await data.syncPending();
  }, [data]);

  return (
    <ModuleShell
      audience="input"
      title="Program Tracker"
      subtitle="Field completion submission for Field Officers and Mandores"
      onSync={sync}
      syncBusy={saving}
    >
      <section className="tracker-workspace" aria-labelledby="tracker-heading">
        <div className="tracker-heading-row">
          <div className="section-heading">
            <p>Work Program input</p>
            <h2 id="tracker-heading">Submit field completion</h2>
          </div>
          <button className="secondary-button" type="button" onClick={reset}>
            <RefreshCcw aria-hidden="true" size={16} /> Clear
          </button>
        </div>

        {lastSubmission ? (
          <div className="submission-confirmation" role="status">
            <CheckCircle2 aria-hidden="true" size={22} />
            <div>
              <strong>{lastSubmission.count} entr{lastSubmission.count === 1 ? "y" : "ies"} submitted for approval</strong>
              <span>{formatNumber(lastSubmission.totalHa)} ha total</span>
              <small>{lastSubmission.syncStatus === "Pending Sync" ? "Stored on this device and queued for sync." : "Saved to the shared records database."}</small>
            </div>
          </div>
        ) : null}

        <form className="tracker-form" onSubmit={addBatch} noValidate>
          <section className="tracker-form-section" aria-labelledby="submission-details-heading">
            <div className="form-section-heading">
              <span>1</span>
              <div>
                <h3 id="submission-details-heading">Completion details</h3>
                <p>Add one or more completed work items before submitting for approval.</p>
              </div>
            </div>
            <div className="form-grid tracker-grid">
              <TrackerField label="Actual Completion Date" error={errors.actualCompletionDate} required>
                <input type="date" value={draft.actualCompletionDate} onChange={(event) => update("actualCompletionDate", event.target.value)} />
              </TrackerField>
              <TrackerField label="Work Program" error={errors.programType} required>
                <select value={draft.programType} onChange={(event) => update("programType", event.target.value)}>{PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}</select>
              </TrackerField>
              <TrackerField label="Field" error={errors.blockField} required>
                <select value={draft.blockField} onChange={(event) => update("blockField", event.target.value)} disabled={!fields.length}>
                  <option value="">{fields.length ? "Select field" : "Loading field list"}</option>
                  {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                </select>
              </TrackerField>
              <TrackerField label="Hectares Covered" error={errors.hectares} required>
                <div className="hectare-input-wrap">
                  <input inputMode="decimal" min="0.000001" step="any" type="number" value={draft.hectares} onChange={(event) => update("hectares", event.target.value)} placeholder="0.00" />
                  <span>ha</span>
                </div>
              </TrackerField>
              <TrackerField className="full-width" label="Remarks" error={errors.remarks}>
                <textarea rows={3} value={draft.remarks} onChange={(event) => update("remarks", event.target.value)} placeholder="Observations, exceptions or follow-up notes" />
              </TrackerField>
            </div>

            <CoverageCard coverage={currentCoverage} />
          </section>

          <div className="tracker-submit-bar batch-add-bar">
            <div>
              <strong>{batchEntries.length ? `${batchEntries.length} entr${batchEntries.length === 1 ? "y" : "ies"} ready` : "Add entries below, then submit all at once"}</strong>
              <span>{batchEntries.length ? `${formatNumber(batchTotalHa)} ha in current batch` : "Coverage preview includes approved, pending and current batch values."}</span>
            </div>
            <button className="primary-button tracker-submit" type="submit" disabled={saving || !fields.length}>
              <Plus aria-hidden="true" size={18} /> Add Batch
            </button>
          </div>
        </form>

        <BatchReview
          batchEntries={batchEntries}
          errors={errors}
          fields={fields}
          fieldFeatures={fieldMap.features}
          records={data.records}
          saving={saving}
          onRemove={removeBatchEntry}
          onSubmit={submitBatch}
          onUpdate={updateBatchEntry}
        />
      </section>
    </ModuleShell>
  );
}

function CoverageCard({ coverage }: { coverage: CoverageProjection }) {
  if (!coverage.ready) {
    return (
      <div className="coverage-card muted">
        <div className="coverage-card-heading">
          <strong>Program Coverage</strong>
          <span>Select Work Program and Field</span>
        </div>
        <p>Select a work program and field to view round progress before adding the batch entry.</p>
      </div>
    );
  }

  if (!coverage.rounds.length) {
    return (
      <div className="coverage-card muted">
        <div className="coverage-card-heading">
          <strong>Program Coverage</strong>
          <span>{coverage.fieldHa ? `${formatNumber(coverage.fieldHa)} ha field` : "No plan"}</span>
        </div>
        <p>No programme round plan is available for this work program and field yet. The entry can still be submitted for approval.</p>
      </div>
    );
  }

  return (
    <div className="coverage-card">
      <div className="coverage-card-heading">
        <strong>Program Coverage</strong>
        <span>{coverage.completedRounds}/{coverage.totalRounds} rounds completed</span>
      </div>
      <div className="coverage-breakdown">
        <span><i className="approved" />Program Approved</span>
        <span><i className="unapproved" />Pending Approval</span>
      </div>
      <div className="coverage-round-list">
        {coverage.rounds.map((round) => (
          <CoverageRound key={round.index} round={round} />
        ))}
      </div>
      <div className="coverage-history">
        {coverage.entries.length ? coverage.entries.slice(0, 5).map((entry) => (
          <span key={entry.id}><b>{coverageStatusLabel(entry.status)}</b>{formatNumber(entry.hectares)} ha · {formatDate(entry.date)}</span>
        )) : <em>No submissions recorded for this field yet</em>}
      </div>
    </div>
  );
}

function CoverageRound({ round }: { round: RoundState }) {
  const targetHa = round.targetHa || 0;
  const approvedHa = round.approvedHa || 0;
  const pendingHa = round.unapprovedHa || 0;
  const remainingHa = Math.max(targetHa - approvedHa - pendingHa, 0);
  const approvedWidth = targetHa > 0 ? Math.min(100, (approvedHa / targetHa) * 100) : 0;
  const pendingWidth = targetHa > 0 ? Math.min(100 - approvedWidth, (pendingHa / targetHa) * 100) : 0;

  return (
    <div className="coverage-round">
      <div className="coverage-round-header">
        <strong>{round.label}</strong>
        <span>{formatNumber(round.coveredHa)} / {formatNumber(targetHa)} ha</span>
      </div>
      <div className="coverage-progress stacked" aria-label={`${round.label}: ${formatNumber(round.progress, 0)} percent covered`}>
        <span className="approved" style={{ width: `${approvedWidth}%` }} />
        <span className="unapproved" style={{ width: `${pendingWidth}%` }} />
      </div>
      <div className="coverage-round-meta">
        <span>{round.monthLabel}</span>
        <span>Remaining for the round: {formatNumber(remainingHa)} ha</span>
      </div>
    </div>
  );
}

function BatchCoverageScale({ coverage }: { coverage: CoverageProjection }) {
  if (!coverage.ready) return null;

  if (!coverage.rounds.length) {
    return (
      <div className="batch-coverage-scale muted">
        <strong>Program Coverage</strong>
        <span>No programme round plan is available for this work program and field yet.</span>
      </div>
    );
  }

  return (
    <div className="batch-coverage-scale" aria-label="Batch entry program coverage">
      <div className="batch-coverage-heading">
        <strong>Program Coverage</strong>
        <span>{coverage.completedRounds}/{coverage.totalRounds} rounds completed</span>
      </div>
      <div className="coverage-breakdown">
        <span><i className="approved" />Program Approved</span>
        <span><i className="unapproved" />Pending Approval</span>
      </div>
      <div className="coverage-round-list">
        {coverage.rounds.map((round) => (
          <CoverageRound key={round.index} round={round} />
        ))}
      </div>
    </div>
  );
}

function coverageStatusLabel(status: CoverageEntry["status"]) {
  return status === "Approved" ? "Program Approved" : "Pending Approval";
}

function BatchReview({
  batchEntries,
  errors,
  fields,
  fieldFeatures,
  records,
  saving,
  onRemove,
  onSubmit,
  onUpdate,
}: {
  batchEntries: BatchEntry[];
  errors: Record<string, string>;
  fields: string[];
  fieldFeatures: FieldFeature[];
  records: WorkProgramRecord[];
  saving: boolean;
  onRemove: (id: string) => void;
  onSubmit: () => void;
  onUpdate: (id: string, key: keyof TrackerDraft, value: string) => void;
}) {
  const totalHa = batchEntries.reduce((total, entry) => total + Number(entry.hectares || 0), 0);

  return (
    <section className="batch-review-section" aria-labelledby="batch-review-heading">
      <div className="batch-review-heading">
        <div>
          <h3 id="batch-review-heading">Review & edit before submitting <span>{batchEntries.length}</span></h3>
          <p>{batchEntries.length ? `${formatNumber(totalHa)} ha total` : "No batch entries added yet."}</p>
        </div>
        <button className="primary-button" type="button" onClick={onSubmit} disabled={saving || !batchEntries.length}>
          <Save aria-hidden="true" size={17} /> {saving ? "Submitting" : "Submit records"}
        </button>
      </div>
      {errors.batch ? <p className="form-error" role="alert">{errors.batch}</p> : null}
      <div className="batch-entry-list">
        {batchEntries.map((entry, index) => {
          const coverage = buildCoverageProjection({
            batchEntries,
            currentEntry: entry,
            fields: fieldFeatures,
            includeCurrentTyping: false,
            records,
          });
          return (
            <article className="batch-entry-card" key={entry.id}>
              <div className="batch-entry-title">
                <span>{index + 1}</span>
                <div>
                  <strong>Entry {index + 1}</strong>
                  <small>{entry.blockField || "No field"} · {formatNumber(Number(entry.hectares || 0))} ha</small>
                </div>
                <button type="button" onClick={() => onRemove(entry.id)} aria-label={`Remove entry ${index + 1}`}>
                  <X aria-hidden="true" size={17} />
                </button>
              </div>
              <div className="form-grid tracker-grid batch-entry-grid">
                <TrackerField label="Work Program" required>
                  <select value={entry.programType} onChange={(event) => onUpdate(entry.id, "programType", event.target.value)}>{PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}</select>
                </TrackerField>
                <TrackerField label="Field" required>
                  <select value={entry.blockField} onChange={(event) => onUpdate(entry.id, "blockField", event.target.value)}>
                    <option value="">Select field</option>
                    {fields.map((field) => <option key={field} value={field}>{field}</option>)}
                  </select>
                </TrackerField>
                <TrackerField label="Hectares Covered" required>
                  <div className="hectare-input-wrap">
                    <input inputMode="decimal" min="0.000001" step="any" type="number" value={entry.hectares} onChange={(event) => onUpdate(entry.id, "hectares", event.target.value)} />
                    <span>ha</span>
                  </div>
                </TrackerField>
                <TrackerField label="Actual Completion Date" required>
                  <input type="date" value={entry.actualCompletionDate} onChange={(event) => onUpdate(entry.id, "actualCompletionDate", event.target.value)} />
                </TrackerField>
                <TrackerField className="full-width" label="Remarks">
                  <textarea rows={2} value={entry.remarks} onChange={(event) => onUpdate(entry.id, "remarks", event.target.value)} placeholder="Observations, exceptions or follow-up notes" />
                </TrackerField>
              </div>
              <BatchCoverageScale coverage={coverage} />
            </article>
          );
        })}
      </div>
    </section>
  );
}

function TrackerField({ label, error, required, className = "", children }: { label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={className}><span>{label}{required ? " *" : ""}</span>{children}{error ? <small className="field-error" role="alert">{error}</small> : null}</label>;
}

function validateEntry(entry: TrackerDraft, fields: string[]) {
  const nextErrors: Record<string, string> = {};
  const listedField = fields.find((field) => fieldKey(field) === fieldKey(entry.blockField));
  if (!PROGRAM_TYPES.includes(entry.programType as (typeof PROGRAM_TYPES)[number])) nextErrors.programType = "Select a listed Work Program.";
  if (!entry.blockField) nextErrors.blockField = "Select a field.";
  else if (!listedField) nextErrors.blockField = "Select a field from the approved list.";
  if (!Number(entry.hectares) || Number(entry.hectares) <= 0) nextErrors.hectares = "Enter hectares above zero.";
  if (!entry.actualCompletionDate) nextErrors.actualCompletionDate = "Select the completion date.";
  return nextErrors;
}

function entryToRecord(entry: BatchEntry, fields: FieldFeature[], fieldList: string[]): WorkProgramRecord {
  const listedField = fieldList.find((field) => fieldKey(field) === fieldKey(entry.blockField)) || entry.blockField;
  const fieldFeature = fields.find(
    (feature) => fieldKey(feature.properties.field_no || feature.properties.field_gis) === fieldKey(listedField),
  );

  return {
    id: entry.id,
    source: "Program Tracker",
    reporterName: "Field Officer",
    programType: entry.programType,
    blockField: listedField,
    taskName: entry.programType,
    schedulerStage: "Completed",
    hectares: Number(entry.hectares),
    actualCompletionDate: entry.actualCompletionDate,
    deadline: entry.actualCompletionDate,
    priority: "Must",
    approvalStatus: "Pending Approval",
    remarks: entry.remarks.trim(),
    photoData: "",
    syncStatus: "Synced",
    category: String(fieldFeature?.properties.field_type || "").includes("IMMATURE") ? "Immature" : "Mature",
    updatedAt: new Date().toISOString(),
  };
}

function buildCoverageProjection({
  batchEntries,
  currentEntry,
  fields,
  includeCurrentTyping,
  records,
}: {
  batchEntries: BatchEntry[];
  currentEntry: TrackerDraft;
  fields: FieldFeature[];
  includeCurrentTyping: boolean;
  records: WorkProgramRecord[];
}): CoverageProjection {
  const fieldName = currentEntry.blockField;
  const fieldFeature = fields.find(
    (feature) => fieldKey(feature.properties.field_no || feature.properties.field_gis) === fieldKey(fieldName),
  );
  const year = getEntryYear(currentEntry.actualCompletionDate);
  const programmeRow = fieldName ? getProgrammeRows(currentEntry.programType, fields).find((row) => fieldKey(row.field) === fieldKey(fieldName)) || null : null;
  const rounds = getPlannedRounds(programmeRow, year);
  const fieldHa = Number(programmeRow?.hect || fieldFeature?.properties.ha_gis || 0);
  const baseEntries = getCoverageEntries({
    batchEntries,
    currentEntry,
    fields,
    includeCurrentTyping,
    records,
    year,
  });
  const beforeTypingEntries = baseEntries.filter((entry) => entry.status !== "Typing");
  const beforeRounds = allocateRounds(rounds, beforeTypingEntries);
  const afterRounds = allocateRounds(rounds, baseEntries);
  const activeBefore = beforeRounds.find((round) => round.coveredHa < round.targetHa - 0.0001) || beforeRounds.at(-1) || null;
  const activeAfter = activeBefore ? afterRounds.find((round) => round.index === activeBefore.index) || activeBefore : afterRounds.at(-1) || null;
  const totalApprovedHa = baseEntries.reduce((total, entry) => total + (entry.status === "Approved" ? entry.hectares : 0), 0);
  const totalPendingHa = baseEntries.reduce((total, entry) => total + (entry.status === "Approved" ? 0 : entry.hectares), 0);

  return {
    ready: Boolean(currentEntry.programType && fieldName),
    fieldName,
    fieldHa,
    programmeRow,
    rounds: afterRounds,
    activeRound: activeAfter,
    completedRounds: afterRounds.filter((round) => round.coveredHa >= round.targetHa - 0.0001).length,
    totalRounds: afterRounds.length,
    totalApprovedHa,
    totalPendingHa,
    entries: baseEntries.sort((a, b) => b.date.localeCompare(a.date)),
  };
}

function getCoverageEntries({
  batchEntries,
  currentEntry,
  includeCurrentTyping,
  records,
  year,
}: {
  batchEntries: BatchEntry[];
  currentEntry: TrackerDraft;
  fields: FieldFeature[];
  includeCurrentTyping: boolean;
  records: WorkProgramRecord[];
  year: number;
}): CoverageEntry[] {
  const sameSelection = (programType: string, blockField: string, date: string) =>
    programType === currentEntry.programType &&
    fieldKey(blockField) === fieldKey(currentEntry.blockField) &&
    String(date || "").startsWith(`${year}-`);
  const savedEntries = records
    .filter((record) => sameSelection(record.programType, record.blockField, record.actualCompletionDate || record.deadline || ""))
    .map((record) => ({
      id: record.id,
      date: record.actualCompletionDate || record.deadline || "",
      hectares: Number(record.hectares || 0),
      status: record.syncStatus === "Pending Sync" ? "Pending Sync" : record.approvalStatus === "Approved" ? "Approved" : "Pending Approval",
    }) satisfies CoverageEntry);
  const queuedEntries = batchEntries
    .filter((entry) => sameSelection(entry.programType, entry.blockField, entry.actualCompletionDate))
    .map((entry) => ({
      id: entry.id,
      date: entry.actualCompletionDate,
      hectares: Number(entry.hectares || 0),
      status: "Batch" as const,
    }));
  const typingEntry = includeCurrentTyping && Number(currentEntry.hectares) > 0 && currentEntry.blockField
    ? [{
        id: "typing-entry",
        date: currentEntry.actualCompletionDate,
        hectares: Number(currentEntry.hectares),
        status: "Typing" as const,
      }]
    : [];

  return [...savedEntries, ...queuedEntries, ...typingEntry].filter((entry) => entry.hectares > 0);
}

function getPlannedRounds(programmeRow: DashboardRow | null, year: number): PlannedRound[] {
  if (!programmeRow) return [];
  const yearMonths = monthsForYear(year);
  return MONTHS_2026.flatMap((sourceMonth, index) => {
    const targetHa = Number(programmeRow.months[sourceMonth.key]) || 0;
    if (targetHa <= 0) return [];
    const month = yearMonths[index];
    return [{
      index,
      label: `Round ${index + 1}`,
      monthKey: month.key,
      monthLabel: month.label,
      targetHa,
    }];
  }).map((round, roundIndex) => ({ ...round, index: roundIndex, label: `Round ${roundIndex + 1}` }));
}

function allocateRounds(rounds: PlannedRound[], entries: CoverageEntry[]): RoundState[] {
  const states: RoundState[] = rounds.map((round) => ({
    ...round,
    coveredHa: 0,
    approvedHa: 0,
    unapprovedHa: 0,
    progress: 0,
  }));
  let activeRoundIndex = 0;

  entries
    .filter((entry) => entry.hectares > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((entry) => {
      let remaining = entry.hectares;
      while (remaining > 0 && states[activeRoundIndex]) {
        const round = states[activeRoundIndex];
        const balance = Math.max(round.targetHa - round.coveredHa, 0);
        if (balance <= 0.0001) {
          activeRoundIndex += 1;
          continue;
        }
        const assigned = Math.min(remaining, balance);
        round.coveredHa += assigned;
        addStatusCoverage(round, entry.status, assigned);
        remaining -= assigned;
        if (round.coveredHa >= round.targetHa - 0.0001) activeRoundIndex += 1;
      }

      if (remaining > 0 && states.length) {
        const lastRound = states[states.length - 1];
        lastRound.coveredHa += remaining;
        addStatusCoverage(lastRound, entry.status, remaining);
      }
    });

  return states.map((round) => ({
    ...round,
    progress: round.targetHa > 0 ? Math.min(100, (round.coveredHa / round.targetHa) * 100) : 0,
  }));
}

function addStatusCoverage(round: RoundState, status: CoverageEntry["status"], hectares: number) {
  if (status === "Approved") {
    round.approvedHa += hectares;
    return;
  }
  round.unapprovedHa += hectares;
}

function getEntryYear(date: string) {
  const parsed = Number(monthKey(date).slice(0, 4));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DASHBOARD_YEAR;
}

function createRecordId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `work-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
