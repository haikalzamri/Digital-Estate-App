"use client";

import { Save, X } from "lucide-react";
import { useState } from "react";
import type { FieldFeatureCollection } from "@/lib/work-program/analytics";
import { PROGRAM_TYPES } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type RecordEditorProps = {
  record: WorkProgramRecord;
  fieldMap: FieldFeatureCollection;
  onClose: () => void;
  onSave: (record: WorkProgramRecord) => Promise<WorkProgramRecord>;
};

export function RecordEditor({ record, fieldMap, onClose, onSave }: RecordEditorProps) {
  const [draft, setDraft] = useState(record);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fields = fieldMap.features
    .map((feature) => feature.properties.field_no || feature.properties.field_gis)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const update = (key: keyof WorkProgramRecord, value: string | number) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.reporterName.trim() || !draft.blockField || !draft.actualCompletionDate || Number(draft.hectares) <= 0) {
      setError("Reporter, field, completion date and hectares are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ ...draft, taskName: draft.programType, deadline: draft.actualCompletionDate });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save this record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal-card record-editor" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Work Program record</p>
            <h2>Edit {record.blockField}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close editor">
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <div className="form-grid">
          <label><span>Reporter</span><input value={draft.reporterName} onChange={(event) => update("reporterName", event.target.value)} required /></label>
          <label><span>Work Program</span><select value={draft.programType} onChange={(event) => update("programType", event.target.value)}>{PROGRAM_TYPES.map((program) => <option key={program}>{program}</option>)}</select></label>
          <label><span>Field</span><select value={draft.blockField} onChange={(event) => update("blockField", event.target.value)} required>{fields.map((field) => <option key={field}>{field}</option>)}</select></label>
          <label><span>Hectares</span><input min="0.000001" step="any" type="number" value={draft.hectares} onChange={(event) => update("hectares", Number(event.target.value))} required /></label>
          <label><span>Completion date</span><input type="date" value={draft.actualCompletionDate} onChange={(event) => update("actualCompletionDate", event.target.value)} required /></label>
          <label><span>Approval</span><select value={draft.approvalStatus || "Pending Approval"} onChange={(event) => update("approvalStatus", event.target.value)}><option>Pending Approval</option><option>Approved</option></select></label>
          <label><span>Latitude</span><input inputMode="decimal" value={draft.latitude || ""} onChange={(event) => update("latitude", event.target.value)} /></label>
          <label><span>Longitude</span><input inputMode="decimal" value={draft.longitude || ""} onChange={(event) => update("longitude", event.target.value)} /></label>
          <label className="full-width"><span>Remarks</span><textarea rows={3} value={draft.remarks || ""} onChange={(event) => update("remarks", event.target.value)} /></label>
        </div>
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="submit" disabled={saving}>
            <Save aria-hidden="true" size={16} /> {saving ? "Saving" : "Save record"}
          </button>
        </div>
      </form>
    </div>
  );
}
