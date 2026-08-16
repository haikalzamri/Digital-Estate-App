"use client";

import { CheckCircle2, ChevronDown, Plus, RefreshCcw, Save, X } from "lucide-react";
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
  activityCode: string;
  blockField: string;
  activityRound: string;
  hectares: string;
  actualCompletionDate: string;
  remarks: string;
};

type BatchEntry = TrackerDraft & { id: string };

type TrackerHeader = Pick<TrackerDraft, "programType" | "activityCode">;

type ActivityDraft = TrackerHeader & {
  id: string;
  entries: BatchEntry[];
};

type TrackerFormState = {
  actualCompletionDate: string;
  activities: ActivityDraft[];
  activeActivityId: string;
  expandedFieldId: string;
};

type CoverageEntry = {
  id: string;
  date: string;
  hectares: number;
  activityRound: number;
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
  overTargetRounds: RoundState[];
  entries: CoverageEntry[];
};

const emptyHeader = (overrides: Partial<TrackerHeader> = {}): TrackerHeader => ({
  programType: "",
  activityCode: "",
  ...overrides,
});

const emptyEntryRow = (header: TrackerHeader & Pick<TrackerDraft, "actualCompletionDate">, overrides: Partial<BatchEntry> = {}): BatchEntry => ({
  id: createRecordId(),
  programType: header.programType,
  activityCode: header.activityCode,
  blockField: "",
  activityRound: "1",
  hectares: "",
  actualCompletionDate: header.actualCompletionDate,
  remarks: "",
  ...overrides,
});

const emptyActivity = (actualCompletionDate: string, overrides: Partial<TrackerHeader> = {}): ActivityDraft => {
  const header = emptyHeader(overrides);
  return {
    id: createRecordId(),
    ...header,
    entries: [emptyEntryRow({ ...header, actualCompletionDate })],
  };
};

const createTrackerFormState = (overrides: Partial<TrackerHeader> & Pick<Partial<TrackerDraft>, "actualCompletionDate"> = {}): TrackerFormState => {
  const actualCompletionDate = overrides.actualCompletionDate || localDateString(new Date());
  const activity = emptyActivity(actualCompletionDate, overrides);
  return {
    actualCompletionDate,
    activities: [activity],
    activeActivityId: "",
    expandedFieldId: "",
  };
};

export function WorkProgramTracker() {
  const fieldMap = useFieldMap();
  const data = useWorkProgramData();
  const [tracker, setTracker] = useState<TrackerFormState>(() => createTrackerFormState());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submissionEntries, setSubmissionEntries] = useState<BatchEntry[] | null>(null);
  const [lastSubmission, setLastSubmission] = useState<{ count: number; totalHa: number; syncStatus: string } | null>(null);

  const fields = useMemo(
    () => fieldMap.features
      .map((feature) => feature.properties.field_no || feature.properties.field_gis)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [fieldMap.features],
  );
  const activeActivity = tracker.activities.find((activity) => activity.id === tracker.activeActivityId) || null;
  const activityForAdd = activeActivity || tracker.activities.at(-1) || null;
  const activeEntriesReady = activityForAdd ? getEntriesForSubmission(activityForAdd.entries) : [];
  const inactiveBlankActivity = tracker.activities.find((activity) => activity.id !== tracker.activeActivityId && isBlankActivity(activity)) || null;
  const canUseAddActivity = Boolean(fields.length && tracker.actualCompletionDate && (inactiveBlankActivity || activeEntriesReady.length));
  const readyEntries = getEntriesForSubmission(tracker.activities.flatMap((activity) => activity.entries));
  const readyTotalHa = readyEntries.reduce((total, entry) => total + Number(entry.hectares || 0), 0);

  const updateCompletionDate = (value: string) => {
    setTracker((current) => ({
      ...current,
      actualCompletionDate: value,
      activities: current.activities.map((activity) => ({
        ...activity,
        entries: activity.entries.map((entry) => ({
          ...entry,
          actualCompletionDate: value,
        })),
      })),
    }));
    setErrors((current) => ({ ...current, [formErrorKey("actualCompletionDate")]: "", batch: "" }));
    setSubmissionEntries(null);
  };

  const updateActivityHeader = (activityId: string, key: keyof TrackerHeader, value: string) => {
    setTracker((current) => ({
      ...current,
      activities: current.activities.map((activity) => (
        activity.id === activityId
          ? {
              ...activity,
              [key]: value,
              entries: activity.entries.map((entry) => ({
                ...entry,
                [key]: value,
                ...(key === "programType" ? { activityRound: "1" } : {}),
              })),
            }
          : activity
      )),
    }));
    setErrors((current) => ({ ...current, [activityErrorKey(activityId, key)]: "", batch: "" }));
    setSubmissionEntries(null);
  };

  const updateFieldRow = (activityId: string, id: string, key: keyof TrackerDraft, value: string) => {
    setTracker((current) => ({
      ...current,
      activities: current.activities.map((activity) => (
        activity.id === activityId
          ? {
              ...activity,
              entries: activity.entries.map((entry) => (
                entry.id === id
                  ? { ...entry, [key]: value, ...(key === "blockField" ? { activityRound: "1" } : {}) }
                  : entry
              )),
            }
          : activity
      )),
    }));
    setErrors((current) => ({ ...current, [rowErrorKey(id, key)]: "", batch: "" }));
    setSubmissionEntries(null);
  };

  const reset = () => {
    setTracker(createTrackerFormState());
    setErrors({});
    setSubmissionEntries(null);
    setLastSubmission(null);
  };

  const addField = () => {
    if (!activeActivity) return;
    if (!tracker.actualCompletionDate) {
      setErrors((current) => ({ ...current, [formErrorKey("actualCompletionDate")]: "Select the completion date.", batch: "Select the completion date before adding fields." }));
      return;
    }
    if (!canAddAnotherField(activeActivity)) {
      setErrors((current) => ({ ...current, batch: getActivityFieldDuplicateError(activeActivity) || "Select the field and enter Ha Covered before adding another field." }));
      return;
    }
    const duplicateActivityError = getDuplicateActivityError(activeActivity, tracker.activities);
    if (duplicateActivityError) {
      setErrors((current) => ({
        ...current,
        [activityErrorKey(activeActivity.id, "activityCode")]: duplicateActivityError,
        batch: duplicateActivityError,
      }));
      return;
    }
    const nextEntry = emptyEntryRow({ ...activeActivity, actualCompletionDate: tracker.actualCompletionDate });
    setTracker((current) => ({
      ...current,
      activeActivityId: activeActivity.id,
      expandedFieldId: nextEntry.id,
      activities: current.activities.map((activity) => (
        activity.id === activeActivity.id
          ? { ...activity, entries: [...activity.entries, nextEntry] }
          : activity
      )),
    }));
    setErrors((current) => ({ ...current, batch: "" }));
    setLastSubmission(null);
  };

  const addActivity = () => {
    const sourceActivity = activeActivity || tracker.activities.at(-1) || null;
    if (!sourceActivity) return;
    if (!tracker.actualCompletionDate) {
      setErrors((current) => ({ ...current, [formErrorKey("actualCompletionDate")]: "Select the completion date.", batch: "Select the completion date before adding another activity." }));
      return;
    }
    const currentEntries = getEntriesForSubmission(sourceActivity.entries);
    if (!currentEntries.length) {
      setErrors((current) => ({ ...current, batch: "Add at least one field before adding another activity." }));
      return;
    }

    const rowErrors = buildActivityErrors(sourceActivity, fields, {
      batchEntries: tracker.activities.flatMap((activity) => activity.entries),
      fields: fieldMap.features,
      records: data.records,
    });
    if (Object.keys(rowErrors).length) {
      setErrors((current) => ({ ...current, ...rowErrors, batch: "Complete the current activity before adding another activity." }));
      return;
    }
    const duplicateActivityError = getDuplicateActivityError(sourceActivity, tracker.activities);
    if (duplicateActivityError) {
      setErrors((current) => ({
        ...current,
        [activityErrorKey(sourceActivity.id, "activityCode")]: duplicateActivityError,
        batch: duplicateActivityError,
      }));
      return;
    }

    const nextActivity = emptyActivity(tracker.actualCompletionDate);
    setTracker((current) => ({
      ...current,
      activities: [...current.activities, nextActivity],
      activeActivityId: nextActivity.id,
      expandedFieldId: "",
    }));
    setErrors({});
    setSubmissionEntries(null);
    setLastSubmission(null);
  };

  const handleAddActivity = () => {
    if (inactiveBlankActivity) {
      toggleActivity(inactiveBlankActivity.id);
      return;
    }
    addActivity();
  };

  const removeActivity = (activityId: string) => {
    setTracker((current) => {
      const activityToRemove = current.activities.find((activity) => activity.id === activityId);
      const activities = current.activities.filter((activity) => activity.id !== activityId);
      if (!activities.length) {
        const blankActivity = emptyActivity(current.actualCompletionDate);
        return {
          ...current,
          activities: [blankActivity],
          activeActivityId: "",
          expandedFieldId: "",
        };
      }

      const removedExpandedField = Boolean(activityToRemove?.entries.some((entry) => entry.id === current.expandedFieldId));
      return {
        ...current,
        activities,
        activeActivityId: current.activeActivityId === activityId ? "" : current.activeActivityId,
        expandedFieldId: removedExpandedField ? "" : current.expandedFieldId,
      };
    });
    setErrors((current) => ({ ...current, batch: "" }));
    setSubmissionEntries(null);
    setLastSubmission(null);
  };

  const removeEntry = (activityId: string, id: string) => {
    setTracker((current) => {
      let nextExpandedFieldId = current.expandedFieldId;
      const activities = current.activities.map((activity) => {
        if (activity.id !== activityId) return activity;
        if (activity.entries.length <= 1) {
          const nextEntry = emptyEntryRow({ ...activity, actualCompletionDate: current.actualCompletionDate });
          nextExpandedFieldId = "";
          return { ...activity, entries: [nextEntry] };
        }
        const entries = activity.entries.filter((entry) => entry.id !== id);
        if (current.expandedFieldId === id) nextExpandedFieldId = "";
        return { ...activity, entries };
      });
      return {
        ...current,
        activities,
        activeActivityId: activityId,
        expandedFieldId: nextExpandedFieldId,
      };
    });
    setErrors((current) => ({ ...current, batch: "" }));
    setSubmissionEntries(null);
  };

  const toggleActivity = (activityId: string) => {
    setTracker((current) => {
      const nextOpen = current.activeActivityId !== activityId;
      return {
        ...current,
        activeActivityId: nextOpen ? activityId : "",
        expandedFieldId: "",
      };
    });
    setSubmissionEntries(null);
  };

  const toggleField = (activityId: string, entryId: string) => {
    setTracker((current) => ({
      ...current,
      activeActivityId: activityId,
      expandedFieldId: current.activeActivityId === activityId && current.expandedFieldId === entryId ? "" : entryId,
    }));
    setSubmissionEntries(null);
  };

  const openSubmissionSummary = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!tracker.actualCompletionDate) {
      setErrors((current) => ({ ...current, [formErrorKey("actualCompletionDate")]: "Select the completion date.", batch: "Select the completion date before submitting." }));
      return;
    }
    const activitiesToSubmit = tracker.activities.filter((activity) => getEntriesForSubmission(activity.entries).length);
    const entriesToSubmit = activitiesToSubmit.flatMap((activity) => getEntriesForSubmission(activity.entries));
    if (!entriesToSubmit.length) {
      setErrors((current) => ({ ...current, batch: "Add at least one field with hectares before submitting." }));
      return;
    }
    const duplicateActivityErrors = buildDuplicateActivityErrors(activitiesToSubmit);
    if (Object.keys(duplicateActivityErrors).length) {
      setErrors((current) => ({
        ...current,
        ...duplicateActivityErrors,
        batch: "Duplicate Activity Code found for the same Work Program and date. Add fields under the existing activity instead.",
      }));
      return;
    }

    const rowErrors = activitiesToSubmit.reduce<Record<string, string>>((nextErrors, activity) => ({
      ...nextErrors,
      ...buildActivityErrors(activity, fields, {
        batchEntries: tracker.activities.flatMap((item) => item.entries),
        fields: fieldMap.features,
        records: data.records,
      }),
    }), {});
    if (Object.keys(rowErrors).length) {
      setErrors((current) => ({ ...current, ...rowErrors, batch: "One or more field rows need attention." }));
      return;
    }

    setErrors({});
    setSubmissionEntries(entriesToSubmit);
  };

  const submitBatch = async () => {
    if (!submissionEntries?.length) {
      setErrors((current) => ({ ...current, batch: "Confirm at least one entry before submitting." }));
      return;
    }

    const invalidIndex = submissionEntries.findIndex((entry) => Object.keys(validateEntry(entry, fields)).length > 0);
    if (invalidIndex >= 0) {
      setErrors((current) => ({ ...current, batch: `Entry ${invalidIndex + 1} has missing or invalid information.` }));
      return;
    }

    setSaving(true);
    setErrors({});
    try {
      const records = submissionEntries.map((entry) => entryToRecord(entry, fieldMap.features, fields));
      const saved = await data.saveRecords(records);
      setLastSubmission({
        count: saved.length,
        totalHa: saved.reduce((total, record) => total + Number(record.hectares || 0), 0),
        syncStatus: saved.some((record) => record.syncStatus === "Pending Sync") ? "Pending Sync" : "Synced",
      });
      setSubmissionEntries(null);
      setTracker(createTrackerFormState({
        actualCompletionDate: tracker.actualCompletionDate,
      }));
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

        <form className="tracker-form" onSubmit={openSubmissionSummary} noValidate>
          <section className="tracker-form-section" aria-labelledby="submission-details-heading">
            <div className="form-section-heading">
              <span>1</span>
              <div>
                <h3 id="submission-details-heading">Completion details</h3>
                <p>Select the completion date first. Activities added in this form will use the same date.</p>
              </div>
            </div>
            <div className="form-grid tracker-grid tracker-date-grid">
              <TrackerField label="Actual Completion Date" error={errors[formErrorKey("actualCompletionDate")]} required>
                <input type="date" value={tracker.actualCompletionDate} onChange={(event) => updateCompletionDate(event.target.value)} />
              </TrackerField>
            </div>
            <div className="activity-entry-list" aria-label="Activity drafts">
              {tracker.activities.map((activity, activityIndex) => {
                const activityOpen = activity.id === tracker.activeActivityId;
                const activityCodeReady = Boolean(activity.activityCode.trim());
                const activityProgramReady = Boolean(activity.programType);
                const activityDuplicateError = getDuplicateActivityError(activity, tracker.activities);
                const activityDetailsReady = activityCodeReady && activityProgramReady && !activityDuplicateError;
                const fieldReadyForNext = canAddAnotherField(activity);
                const activityReadyEntries = getEntriesForSubmission(activity.entries);
                const activityTotalHa = activityReadyEntries.reduce((total, entry) => total + Number(entry.hectares || 0), 0);
                const activityTitle = getActivitySummaryTitle(activity);
                const canRemoveActivity = tracker.activities.length > 1 || !isBlankActivity(activity);
                if (!activityOpen && isBlankActivity(activity)) {
                  return null;
                }
                return (
                  <article className={`activity-entry-card ${activityOpen ? "is-open" : ""}`} key={activity.id}>
                    <div className="activity-entry-title">
                      <button className="activity-entry-summary" type="button" onClick={() => toggleActivity(activity.id)} aria-expanded={activityOpen}>
                        <span>{activityIndex + 1}</span>
                        <div>
                          <strong>{activityTitle}</strong>
                          <small>{formatDate(tracker.actualCompletionDate)} · {activityReadyEntries.length} field{activityReadyEntries.length === 1 ? "" : "s"} · {formatNumber(activityTotalHa)} ha</small>
                        </div>
                        <ChevronDown aria-hidden="true" size={17} />
                      </button>
                      {canRemoveActivity ? (
                        <button className="activity-row-remove" type="button" onClick={() => removeActivity(activity.id)} aria-label={`Delete activity ${activityIndex + 1}`}>
                          <X aria-hidden="true" size={16} /> Delete
                        </button>
                      ) : null}
                    </div>

                    {activityOpen ? (
                      <div className="activity-entry-details">
                        <div className="form-grid tracker-grid activity-header-grid">
                          <TrackerField label="Activity Code" error={errors[activityErrorKey(activity.id, "activityCode")] || activityDuplicateError} required>
                            <input value={activity.activityCode} onChange={(event) => updateActivityHeader(activity.id, "activityCode", event.target.value.toUpperCase())} placeholder="e.g. MC-001" />
                          </TrackerField>
                          <TrackerField label="Work Program" error={errors[activityErrorKey(activity.id, "programType")]} required>
                            <select value={activity.programType} onChange={(event) => updateActivityHeader(activity.id, "programType", event.target.value)}>
                              <option value="">Select work program</option>
                              {PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}
                            </select>
                          </TrackerField>
                        </div>

                        <div className="field-entry-list" aria-label={`Field completion rows for activity ${activityIndex + 1}`}>
                          {activity.entries.map((entry, index) => {
                            const fieldOpen = tracker.expandedFieldId === entry.id;
                            const fieldSelected = Boolean(entry.blockField);
                            const duplicateFieldError = getDuplicateFieldError(entry, activity.entries);
                            const fieldInputReady = Boolean(tracker.actualCompletionDate) && activityDetailsReady && fieldSelected && !duplicateFieldError;
                            const otherDraftEntries = tracker.activities
                              .flatMap((item) => item.entries)
                              .filter((row) => row.id !== entry.id && hasDraftInput(row));
                            const coverage = buildCoverageProjection({
                              batchEntries: otherDraftEntries,
                              currentEntry: entry,
                              fields: fieldMap.features,
                              includeCurrentTyping: true,
                              records: data.records,
                            });
                            const roundLockCoverage = buildCoverageProjection({
                              batchEntries: otherDraftEntries,
                              currentEntry: entry,
                              fields: fieldMap.features,
                              includeCurrentTyping: false,
                              records: data.records,
                            });
                            const roundOptions = getActivityRoundOptions(roundLockCoverage);
                            const selectedRound = coverage.rounds.find((round) => round.index + 1 === normaliseActivityRound(entry.activityRound));
                            const selectedRoundOverTarget = Boolean(selectedRound && isRoundOverTarget(selectedRound));
                            const enteredHectares = Number(entry.hectares || 0);
                            const showCollapsedRoundPreview = !fieldOpen && Boolean(selectedRound && entry.blockField && enteredHectares > 0);
                            return (
                              <article className={`field-entry-card ${fieldOpen ? "is-open" : ""} ${activityDetailsReady ? "" : "is-disabled"}`} key={entry.id}>
                                <div className="field-entry-title">
                                  <button className="field-entry-toggle" type="button" onClick={() => toggleField(activity.id, entry.id)} aria-expanded={fieldOpen}>
                                    <div className={`field-entry-summary-copy ${showCollapsedRoundPreview ? "has-round-preview" : ""}`}>
                                      <strong>{entry.blockField || "Select field"}</strong>
                                      {showCollapsedRoundPreview && selectedRound ? (
                                        <>
                                          <span className="field-entry-input-pill">Input: {formatNumber(enteredHectares)} ha</span>
                                          <CompactRoundPreview round={selectedRound} />
                                        </>
                                      ) : null}
                                      {!fieldOpen && !showCollapsedRoundPreview && enteredHectares > 0 ? <small>R{normaliseActivityRound(entry.activityRound)} · {formatNumber(enteredHectares)} ha</small> : null}
                                      {!fieldOpen && entry.remarks.trim() ? <small className="field-entry-remark">Remark: {entry.remarks.trim()}</small> : null}
                                    </div>
                                    <ChevronDown aria-hidden="true" size={17} />
                                  </button>
                                  <button className="field-row-remove" type="button" onClick={() => removeEntry(activity.id, entry.id)} aria-label={`Remove field ${index + 1}`}>
                                    <X aria-hidden="true" size={16} /> Remove
                                  </button>
                                </div>

                                {fieldOpen ? (
                                  <div className="field-entry-body">
                                    <div className="field-row-grid">
                                      <TrackerField className={`field-dependent ${tracker.actualCompletionDate && activityDetailsReady ? "" : "is-disabled"}`} label="Field" error={errors[rowErrorKey(entry.id, "blockField")] || duplicateFieldError} required>
                                        <select value={entry.blockField} onChange={(event) => updateFieldRow(activity.id, entry.id, "blockField", event.target.value)} disabled={!fields.length || !tracker.actualCompletionDate || !activityDetailsReady}>
                                          <option value="">{fields.length ? "Select field" : "Loading field list"}</option>
                                          {fields.map((field) => <option key={field} value={field} disabled={isFieldSelectedByOtherEntry(field, entry.id, activity.entries)}>{field}</option>)}
                                        </select>
                                      </TrackerField>
                                      <TrackerField className={`field-dependent ${fieldInputReady ? "" : "is-disabled"}`} label="Round" error={errors[rowErrorKey(entry.id, "activityRound")]} required>
                                        <select value={entry.activityRound} onChange={(event) => updateFieldRow(activity.id, entry.id, "activityRound", event.target.value)} disabled={!fieldInputReady}>
                                          {roundOptions.map((round) => <option key={round.value} value={round.value} disabled={round.disabled}>{round.label}</option>)}
                                        </select>
                                      </TrackerField>
                                      <TrackerField className={`field-dependent ${fieldInputReady ? "" : "is-disabled"}`} label="Ha Covered" error={errors[rowErrorKey(entry.id, "hectares")]} required>
                                        <div className="hectare-input-wrap">
                                          <input inputMode="decimal" min="0.000001" step="any" type="number" value={entry.hectares} onChange={(event) => updateFieldRow(activity.id, entry.id, "hectares", event.target.value)} placeholder="0.00" disabled={!fieldInputReady} />
                                          <span>ha</span>
                                        </div>
                                      </TrackerField>
                                      <TrackerField className={`field-row-remarks field-dependent ${fieldInputReady ? "" : "is-disabled"}`} label="Remarks" error={errors[rowErrorKey(entry.id, "remarks")]}>
                                        <textarea rows={2} value={entry.remarks} onChange={(event) => updateFieldRow(activity.id, entry.id, "remarks", event.target.value)} placeholder="Optional notes" disabled={!fieldInputReady} />
                                      </TrackerField>
                                      {selectedRoundOverTarget ? (
                                        <p className="field-row-warning" role="alert">
                                          Program coverage exceeded. Please review the entered hectares.
                                        </p>
                                      ) : null}
                                    </div>
                                    <div className={`coverage-gate ${fieldInputReady ? "" : "is-disabled"}`}>
                                      {fieldInputReady ? <BatchCoverageScale coverage={coverage} /> : (
                                        <div className="batch-coverage-scale muted">
                                          <strong>Program Coverage</strong>
                                          <span>{getFieldGateMessage({ hasDate: Boolean(tracker.actualCompletionDate), activityCodeReady, activityProgramReady, activityDuplicateError })}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ) : null}
                              </article>
                            );
                          })}
                          <button
                            className="secondary-button add-field-button"
                            type="button"
                            onClick={addField}
                            disabled={saving || !fields.length || !tracker.actualCompletionDate || !activityDetailsReady || !fieldReadyForNext}
                            title={fieldReadyForNext ? undefined : "Select the field and enter Ha Covered before adding another field."}
                          >
                            <Plus aria-hidden="true" size={17} /> Add Field
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </section>

          <div className="tracker-submit-bar batch-add-bar">
            <div>
              <strong>{readyEntries.length ? `${readyEntries.length} record${readyEntries.length === 1 ? "" : "s"} ready` : "Add field completion"}</strong>
              <span>{readyEntries.length ? `${formatNumber(readyTotalHa)} ha ready to submit` : "Use Add Field for the same activity, or Add Activity for another activity on the same date."}</span>
              {tracker.activities.length > 1 ? <small>{tracker.activities.length} activities in draft.</small> : null}
            </div>
            <div className="tracker-submit-actions">
              <button className="secondary-button optional-add-button" type="button" onClick={handleAddActivity} disabled={saving || !canUseAddActivity}>
                <Plus aria-hidden="true" size={17} /> Add Activity
              </button>
              <button className="primary-button tracker-submit" type="submit" disabled={saving || !fields.length || !tracker.actualCompletionDate || !readyEntries.length}>
                <Save aria-hidden="true" size={18} /> Submit for Approval
              </button>
            </div>
          </div>
        </form>

        {errors.batch ? <p className="form-error" role="alert">{errors.batch}</p> : null}
        {submissionEntries ? (
          <BatchSubmitSummaryModal
            entries={submissionEntries}
            saving={saving}
            onCancel={() => setSubmissionEntries(null)}
            onConfirm={submitBatch}
          />
        ) : null}
      </section>
    </ModuleShell>
  );
}

function CoverageRound({ round }: { round: RoundState }) {
  const targetHa = round.targetHa || 0;
  const approvedHa = round.approvedHa || 0;
  const pendingHa = round.unapprovedHa || 0;
  const percentage = targetHa > 0 ? (round.coveredHa / targetHa) * 100 : 0;
  const isOverTarget = percentage > 100;
  const excessHa = Math.max(round.coveredHa - targetHa, 0);
  const scaleTotalHa = isOverTarget ? round.coveredHa : targetHa;
  const approvedWidth = !isOverTarget && targetHa > 0 ? Math.min(100, (approvedHa / targetHa) * 100) : 0;
  const pendingWidth = !isOverTarget && targetHa > 0 ? Math.min(100 - approvedWidth, (pendingHa / targetHa) * 100) : 0;
  const targetWidth = isOverTarget && scaleTotalHa > 0 ? Math.min(100, (targetHa / scaleTotalHa) * 100) : 0;
  const excessWidth = isOverTarget && scaleTotalHa > 0 ? Math.min(100 - targetWidth, (excessHa / scaleTotalHa) * 100) : 0;

  return (
    <div className={`coverage-round ${isOverTarget ? "is-over-target" : ""}`}>
      <div className="coverage-round-header">
        <strong>R{round.index + 1}</strong>
        <strong>{formatNumber(percentage, 0)}%</strong>
      </div>
      <div className="coverage-progress stacked" aria-label={`R${round.index + 1}: ${formatNumber(percentage, 0)} percent covered`}>
        {isOverTarget ? (
          <>
            <span className="approved" style={{ width: `${targetWidth}%` }} />
            <span className="excess" style={{ width: `${excessWidth}%` }} />
          </>
        ) : (
          <>
            <span className="approved" style={{ width: `${approvedWidth}%` }} />
            <span className="unapproved" style={{ width: `${pendingWidth}%` }} />
          </>
        )}
      </div>
      <span className="coverage-round-ha">{formatNumber(round.coveredHa)} / {formatNumber(targetHa)} ha</span>
    </div>
  );
}

function CompactRoundPreview({ round }: { round: RoundState }) {
  const targetHa = round.targetHa || 0;
  const approvedHa = round.approvedHa || 0;
  const pendingHa = round.unapprovedHa || 0;
  const percentage = targetHa > 0 ? (round.coveredHa / targetHa) * 100 : 0;
  const isOverTarget = percentage > 100;
  const scaleTotalHa = isOverTarget ? round.coveredHa : targetHa;
  const approvedWidth = !isOverTarget && targetHa > 0 ? Math.min(100, (approvedHa / targetHa) * 100) : 0;
  const pendingWidth = !isOverTarget && targetHa > 0 ? Math.min(100 - approvedWidth, (pendingHa / targetHa) * 100) : 0;
  const targetWidth = isOverTarget && scaleTotalHa > 0 ? Math.min(100, (targetHa / scaleTotalHa) * 100) : 0;
  const excessWidth = isOverTarget && scaleTotalHa > 0 ? Math.min(100 - targetWidth, ((round.coveredHa - targetHa) / scaleTotalHa) * 100) : 0;

  return (
    <div className={`compact-round-preview ${isOverTarget ? "is-over-target" : ""}`}>
      <div className="compact-round-progress" aria-label={`R${round.index + 1}: ${formatNumber(percentage, 0)} percent covered`}>
        {isOverTarget ? (
          <>
            <span className="approved" style={{ width: `${targetWidth}%` }} />
            <span className="excess" style={{ width: `${excessWidth}%` }} />
          </>
        ) : (
          <>
            <span className="approved" style={{ width: `${approvedWidth}%` }} />
            <span className="unapproved" style={{ width: `${pendingWidth}%` }} />
          </>
        )}
      </div>
      <small>R{round.index + 1} · {formatNumber(round.coveredHa)} / {formatNumber(targetHa)} ha</small>
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
    <div className="batch-coverage-scale" aria-label="Entry program coverage">
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

function BatchSubmitSummaryModal({
  entries,
  saving,
  onCancel,
  onConfirm,
}: {
  entries: BatchEntry[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const groupedActivities = groupSubmissionEntries(entries);
  const submissionDate = entries[0]?.actualCompletionDate ? formatDate(entries[0].actualCompletionDate) : "";

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-card batch-submit-modal" role="dialog" aria-modal="true" aria-labelledby="batch-submit-title">
        <div className="modal-heading batch-submit-heading">
          <p className="eyebrow">Final Review</p>
          <h2 id="batch-submit-title">Confirm submission</h2>
          <p>Review the entries below before sending these records for approval.</p>
        </div>
        <div className="batch-submit-summary">
          <span><strong>{groupedActivities.length}</strong> Total Activities Today</span>
        </div>
        <div className="batch-submit-grouped">
          {submissionDate ? <strong className="batch-submit-date">{submissionDate}</strong> : null}
          <div className="batch-submit-grid">
            {groupedActivities.map((activity) => (
              <article className="batch-submit-card" key={activity.id}>
                <div className="batch-submit-card-heading">
                  <strong>{activity.programType}</strong>
                  <span>{activity.activityCode} · {formatNumber(activity.totalHa)} ha</span>
                </div>
                <div className="batch-submit-card-list">
                  {activity.entries.map((entry) => (
                    <div key={entry.id}>
                      <span>{entry.blockField} - {formatNumber(Number(entry.hectares || 0))} ha</span>
                      {entry.remarks.trim() ? <small>{entry.remarks.trim()}</small> : null}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
        <div className="modal-actions batch-submit-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={saving}>Back to edit</button>
          <button className="primary-button" type="button" onClick={onConfirm} disabled={saving}>
            <Save aria-hidden="true" size={17} /> {saving ? "Submitting" : "Submit for approval"}
          </button>
        </div>
      </section>
    </div>
  );
}

function TrackerField({ label, error, required, className = "", children }: { label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={className}><span>{label}{required ? " *" : ""}</span>{children}{error ? <small className="field-error" role="alert">{error}</small> : null}</label>;
}

function groupSubmissionEntries(entries: BatchEntry[]) {
  const groups = new Map<string, { id: string; activityCode: string; programType: string; totalHa: number; entries: BatchEntry[] }>();
  entries.forEach((entry) => {
    const key = [
      entry.actualCompletionDate,
      normaliseActivityCode(entry.activityCode),
      entry.programType,
    ].join("|");
    const group = groups.get(key) || {
      id: key,
      activityCode: normaliseActivityCode(entry.activityCode),
      programType: entry.programType,
      totalHa: 0,
      entries: [],
    };
    group.totalHa += Number(entry.hectares || 0);
    group.entries.push(entry);
    groups.set(key, group);
  });
  return Array.from(groups.values());
}

function getEntriesForSubmission(entries: BatchEntry[]) {
  return entries.filter(hasDraftInput);
}

function canAddAnotherField(activity: ActivityDraft) {
  if (!activity.activityCode.trim()) return false;
  if (!activity.programType) return false;
  if (!activity.entries.length) return false;
  if (getActivityFieldDuplicateError(activity)) return false;
  return activity.entries.every((entry) => Boolean(entry.blockField) && Number(entry.hectares) > 0);
}

function isBlankActivity(activity: ActivityDraft) {
  return !activity.activityCode.trim() && !activity.programType && activity.entries.every((entry) => !hasDraftInput(entry));
}

function buildDuplicateActivityErrors(activities: ActivityDraft[]) {
  return activities.reduce<Record<string, string>>((nextErrors, activity) => {
    const error = getDuplicateActivityError(activity, activities);
    if (error) nextErrors[activityErrorKey(activity.id, "activityCode")] = error;
    return nextErrors;
  }, {});
}

function getDuplicateActivityError(activity: ActivityDraft, activities: ActivityDraft[]) {
  const activityCode = normaliseActivityCode(activity.activityCode);
  if (!activityCode || !activity.programType) return "";
  const duplicate = activities.some((item) => (
    item.id !== activity.id &&
    normaliseActivityCode(item.activityCode) === activityCode &&
    item.programType === activity.programType
  ));
  return duplicate ? "This Activity Code is already used for this Work Program on the selected date. Add fields under the existing activity instead." : "";
}

function getActivityFieldDuplicateError(activity: ActivityDraft) {
  const duplicate = activity.entries.find((entry) => getDuplicateFieldError(entry, activity.entries));
  return duplicate ? getDuplicateFieldError(duplicate, activity.entries) : "";
}

function getDuplicateFieldError(entry: BatchEntry, entries: BatchEntry[]) {
  if (!entry.blockField) return "";
  return isFieldSelectedByOtherEntry(entry.blockField, entry.id, entries)
    ? "This field is already selected in this activity. Edit the existing field row instead."
    : "";
}

function isFieldSelectedByOtherEntry(field: string, entryId: string, entries: BatchEntry[]) {
  const selectedField = fieldKey(field);
  if (!selectedField) return false;
  return entries.some((entry) => entry.id !== entryId && fieldKey(entry.blockField) === selectedField);
}

function getFieldGateMessage({
  hasDate,
  activityCodeReady,
  activityProgramReady,
  activityDuplicateError,
}: {
  hasDate: boolean;
  activityCodeReady: boolean;
  activityProgramReady: boolean;
  activityDuplicateError: string;
}) {
  if (!hasDate) return "Select the completion date before adding field details.";
  if (activityDuplicateError) return "Use Add Field under the existing activity, or enter a different Activity Code.";
  if (!activityCodeReady || !activityProgramReady) return "Enter the Activity Code and select Work Program before adding field details.";
  return "Select a field to view round progress.";
}

function normaliseActivityCode(value: string) {
  return value.trim().toUpperCase();
}

function getActivitySummaryTitle(activity: ActivityDraft) {
  const activityCode = normaliseActivityCode(activity.activityCode);
  if (!activityCode && !activity.programType) return "Activity details";
  if (!activityCode) return `Activity details · ${activity.programType}`;
  return `${activityCode} · ${activity.programType || "Select work program"}`;
}

function hasDraftInput(draft: TrackerDraft) {
  return Boolean(draft.blockField || draft.hectares || draft.remarks.trim());
}

function buildActivityErrors(
  activity: ActivityDraft,
  fieldList: string[],
  coverageContext?: { batchEntries: BatchEntry[]; fields: FieldFeature[]; records: WorkProgramRecord[] },
) {
  return getEntriesForSubmission(activity.entries).reduce<Record<string, string>>((nextErrors, entry) => {
    const validation = validateEntry(entry, fieldList);
    Object.entries(validation).forEach(([key, message]) => {
      if (key === "actualCompletionDate") {
        nextErrors[formErrorKey(key)] = message;
        return;
      }
      if (key === "programType" || key === "activityCode") {
        nextErrors[activityErrorKey(activity.id, key)] = message;
        return;
      }
      nextErrors[rowErrorKey(entry.id, key)] = message;
    });
    const duplicateFieldError = getDuplicateFieldError(entry, activity.entries);
    if (duplicateFieldError) {
      nextErrors[rowErrorKey(entry.id, "blockField")] = duplicateFieldError;
    }
    if (coverageContext && !validation.programType && !validation.blockField && !validation.actualCompletionDate && !validation.activityRound) {
      const coverage = buildCoverageProjection({
        batchEntries: coverageContext.batchEntries.filter((row) => row.id !== entry.id && hasDraftInput(row)),
        currentEntry: entry,
        fields: coverageContext.fields,
        includeCurrentTyping: false,
        records: coverageContext.records,
      });
      if (!isActivityRoundSelectable(coverage, normaliseActivityRound(entry.activityRound))) {
        nextErrors[rowErrorKey(entry.id, "activityRound")] = "Complete the previous round before selecting this round.";
      }
    }
    return nextErrors;
  }, {});
}

function formErrorKey(key: string) {
  return `form.${key}`;
}

function activityErrorKey(id: string, key: string) {
  return `activity.${id}.${key}`;
}

function rowErrorKey(id: string, key: string) {
  return `row.${id}.${key}`;
}

function validateEntry(entry: TrackerDraft, fields: string[]) {
  const nextErrors: Record<string, string> = {};
  const listedField = fields.find((field) => fieldKey(field) === fieldKey(entry.blockField));
  if (!PROGRAM_TYPES.includes(entry.programType as (typeof PROGRAM_TYPES)[number])) nextErrors.programType = "Select a listed Work Program.";
  if (!entry.activityCode.trim()) nextErrors.activityCode = "Enter the activity code.";
  if (!entry.blockField) nextErrors.blockField = "Select a field.";
  else if (!listedField) nextErrors.blockField = "Select a field from the approved list.";
  if (normaliseActivityRound(entry.activityRound) <= 0) nextErrors.activityRound = "Select an activity round.";
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
    taskName: entry.activityCode.trim(),
    schedulerStage: "Completed",
    activityRound: normaliseActivityRound(entry.activityRound),
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
    overTargetRounds: afterRounds.filter(isRoundOverTarget),
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
      activityRound: normaliseActivityRound(record.activityRound),
      status: record.syncStatus === "Pending Sync" ? "Pending Sync" : record.approvalStatus === "Approved" ? "Approved" : "Pending Approval",
    }) satisfies CoverageEntry);
  const queuedEntries = batchEntries
    .filter((entry) => sameSelection(entry.programType, entry.blockField, entry.actualCompletionDate))
    .map((entry) => ({
      id: entry.id,
      date: entry.actualCompletionDate,
      hectares: Number(entry.hectares || 0),
      activityRound: normaliseActivityRound(entry.activityRound),
      status: "Batch" as const,
    }));
  const typingEntry = includeCurrentTyping && Number(currentEntry.hectares) > 0 && currentEntry.blockField
    ? [{
        id: "typing-entry",
        date: currentEntry.actualCompletionDate,
        hectares: Number(currentEntry.hectares),
        activityRound: normaliseActivityRound(currentEntry.activityRound),
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
  entries
    .filter((entry) => entry.hectares > 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach((entry) => {
      const roundIndex = Math.min(Math.max(normaliseActivityRound(entry.activityRound) - 1, 0), Math.max(states.length - 1, 0));
      const round = states[roundIndex];
      if (!round) return;
      round.coveredHa += entry.hectares;
      addStatusCoverage(round, entry.status, entry.hectares);
    });

  return states.map((round) => ({
    ...round,
    progress: round.targetHa > 0 ? Math.min(100, (round.coveredHa / round.targetHa) * 100) : 0,
  }));
}

function getActivityRoundOptions(coverage: CoverageProjection) {
  const rounds = coverage.rounds.length ? coverage.rounds : [{ index: 0, label: "Round 1" }];
  const maxSelectableRound = getMaxSelectableRound(coverage);
  return rounds.map((round) => ({
    label: String(round.index + 1),
    value: String(round.index + 1),
    disabled: round.index + 1 > maxSelectableRound,
  }));
}

function isActivityRoundSelectable(coverage: CoverageProjection, activityRound: number) {
  if (activityRound <= 0) return false;
  const options = getActivityRoundOptions(coverage);
  const option = options.find((item) => item.value === String(activityRound));
  return Boolean(option && !option.disabled);
}

function getMaxSelectableRound(coverage: CoverageProjection) {
  if (!coverage.rounds.length) return 1;
  const firstIncompleteIndex = coverage.rounds.findIndex((round) => !isRoundComplete(round));
  return firstIncompleteIndex === -1 ? coverage.rounds.length : firstIncompleteIndex + 1;
}

function isRoundComplete(round: RoundState) {
  const tolerance = Math.max(0.01, round.targetHa * 0.0001);
  return round.targetHa > 0 && round.coveredHa >= round.targetHa - tolerance;
}

function normaliseActivityRound(value: unknown) {
  const round = Number(value);
  return Number.isFinite(round) && round > 0 ? Math.floor(round) : 1;
}

function isRoundOverTarget(round: RoundState) {
  const tolerance = Math.max(0.01, round.targetHa * 0.0001);
  return round.targetHa > 0 && round.coveredHa > round.targetHa + tolerance;
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
