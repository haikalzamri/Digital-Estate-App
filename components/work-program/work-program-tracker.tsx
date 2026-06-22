"use client";

import { Camera, CheckCircle2, LocateFixed, RefreshCcw, Save, Trash2 } from "lucide-react";
import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { useFieldMap } from "@/components/work-program/use-field-map";
import { useWorkProgramData } from "@/components/work-program/use-work-program-data";
import { fieldKey } from "@/lib/work-program/analytics";
import { PROGRAM_TYPES } from "@/lib/work-program/config";
import type { WorkProgramRecord } from "@/lib/types/work-program";

type TrackerDraft = {
  reporterName: string;
  programType: string;
  blockField: string;
  hectares: string;
  actualCompletionDate: string;
  remarks: string;
  latitude: string;
  longitude: string;
  gpsAccuracy: string;
  photoData: string;
};

const emptyDraft = (): TrackerDraft => ({
  reporterName: "",
  programType: PROGRAM_TYPES[0],
  blockField: "",
  hectares: "",
  actualCompletionDate: localDateString(new Date()),
  remarks: "",
  latitude: "",
  longitude: "",
  gpsAccuracy: "",
  photoData: "",
});

export function WorkProgramTracker() {
  const fieldMap = useFieldMap();
  const data = useWorkProgramData();
  const [draft, setDraft] = useState<TrackerDraft>(emptyDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<WorkProgramRecord | null>(null);

  const fields = useMemo(
    () => fieldMap.features
      .map((feature) => feature.properties.field_no || feature.properties.field_gis)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [fieldMap.features],
  );

  const update = (key: keyof TrackerDraft, value: string) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const reset = () => {
    setDraft(emptyDraft());
    setErrors({});
    setLastSubmission(null);
  };

  const captureGps = () => {
    if (!window.navigator.geolocation) {
      setErrors((current) => ({ ...current, gps: "GPS is unavailable. Enter coordinates manually." }));
      return;
    }
    setLocating(true);
    setErrors((current) => ({ ...current, gps: "" }));
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        setDraft((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
          gpsAccuracy: position.coords.accuracy ? position.coords.accuracy.toFixed(1) : "",
        }));
        setLocating(false);
      },
      () => {
        setErrors((current) => ({ ...current, gps: "GPS permission was not granted. Enter coordinates manually." }));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const attachPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProcessingPhoto(true);
    setErrors((current) => ({ ...current, photoData: "" }));
    try {
      const photoData = await compressEvidencePhoto(file);
      update("photoData", photoData);
    } catch {
      setErrors((current) => ({ ...current, photoData: "Unable to process this photo. Please choose another image." }));
    } finally {
      setProcessingPhoto(false);
      event.target.value = "";
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    const listedField = fields.find((field) => fieldKey(field) === fieldKey(draft.blockField));
    if (!draft.reporterName.trim()) nextErrors.reporterName = "Enter the reporter name.";
    if (!PROGRAM_TYPES.includes(draft.programType as (typeof PROGRAM_TYPES)[number])) nextErrors.programType = "Select a listed Work Program.";
    if (!draft.blockField) nextErrors.blockField = "Select a field.";
    else if (!listedField) nextErrors.blockField = "Select a field from the approved list.";
    if (!Number(draft.hectares) || Number(draft.hectares) <= 0) nextErrors.hectares = "Enter hectares above zero.";
    if (!draft.actualCompletionDate) nextErrors.actualCompletionDate = "Select the completion date.";
    if (draft.latitude && !Number.isFinite(Number(draft.latitude))) nextErrors.gps = "Enter a valid latitude.";
    if (draft.longitude && !Number.isFinite(Number(draft.longitude))) nextErrors.gps = "Enter a valid longitude.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const fieldFeature = fieldMap.features.find(
      (feature) => fieldKey(feature.properties.field_no || feature.properties.field_gis) === fieldKey(listedField),
    );
    const record: WorkProgramRecord = {
      id: createRecordId(),
      source: "Program Tracker",
      reporterName: draft.reporterName.trim(),
      programType: draft.programType,
      blockField: listedField || draft.blockField,
      taskName: draft.programType,
      schedulerStage: "Completed",
      hectares: Number(draft.hectares),
      actualCompletionDate: draft.actualCompletionDate,
      deadline: draft.actualCompletionDate,
      priority: "Must",
      approvalStatus: "Pending Approval",
      remarks: draft.remarks.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      gpsAccuracy: draft.gpsAccuracy,
      photoData: draft.photoData,
      syncStatus: "Synced",
      category: String(fieldFeature?.properties.field_type || "").includes("IMMATURE") ? "Immature" : "Mature",
      updatedAt: new Date().toISOString(),
    };

    setSaving(true);
    setErrors({});
    try {
      const saved = await data.saveRecord(record);
      setLastSubmission(saved);
      setDraft((current) => ({ ...emptyDraft(), reporterName: current.reporterName, programType: current.programType }));
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
              <strong>Submitted for approval</strong>
              <span>{lastSubmission.blockField} · {lastSubmission.programType} · {lastSubmission.hectares} ha</span>
              <small>{lastSubmission.syncStatus === "Pending Sync" ? "Stored on this device and queued for sync." : "Saved to the shared records database."}</small>
            </div>
          </div>
        ) : null}

        <form className="tracker-form" onSubmit={submit} noValidate>
          <section className="tracker-form-section" aria-labelledby="submission-details-heading">
            <div className="form-section-heading"><span>1</span><div><h3 id="submission-details-heading">Completion details</h3><p>All required fields use controlled lists for consistent reporting.</p></div></div>
            <div className="form-grid tracker-grid">
              <TrackerField label="Reporter Name" error={errors.reporterName} required>
                <input autoComplete="name" value={draft.reporterName} onChange={(event) => update("reporterName", event.target.value)} placeholder="Enter your full name" />
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
                <input inputMode="decimal" min="0.000001" step="any" type="number" value={draft.hectares} onChange={(event) => update("hectares", event.target.value)} placeholder="0.00" />
              </TrackerField>
              <TrackerField label="Actual Completion Date" error={errors.actualCompletionDate} required>
                <input type="date" value={draft.actualCompletionDate} onChange={(event) => update("actualCompletionDate", event.target.value)} />
              </TrackerField>
              <TrackerField className="full-width" label="Remarks" error={errors.remarks}>
                <textarea rows={3} value={draft.remarks} onChange={(event) => update("remarks", event.target.value)} placeholder="Observations, exceptions or follow-up notes" />
              </TrackerField>
            </div>
          </section>

          <section className="tracker-form-section" aria-labelledby="evidence-heading">
            <div className="form-section-heading"><span>2</span><div><h3 id="evidence-heading">Location and evidence</h3><p>GPS and photos are optional but help management validate the work.</p></div></div>
            <div className="evidence-layout">
              <div className="gps-capture">
                <button className="secondary-button gps-button" type="button" onClick={captureGps} disabled={locating}>
                  <LocateFixed aria-hidden="true" size={17} /> {locating ? "Locating" : "Capture GPS"}
                </button>
                <div className="gps-inputs">
                  <label><span>Latitude</span><input inputMode="decimal" value={draft.latitude} onChange={(event) => update("latitude", event.target.value)} placeholder="2.86667" /></label>
                  <label><span>Longitude</span><input inputMode="decimal" value={draft.longitude} onChange={(event) => update("longitude", event.target.value)} placeholder="101.36667" /></label>
                  <label><span>Accuracy (m)</span><input inputMode="decimal" value={draft.gpsAccuracy} onChange={(event) => update("gpsAccuracy", event.target.value)} placeholder="Optional" /></label>
                </div>
                {errors.gps ? <small className="field-error" role="alert">{errors.gps}</small> : null}
              </div>
              <div className="photo-capture">
                {draft.photoData ? (
                  <div className="photo-preview"><Image src={draft.photoData} alt="Attached field evidence" fill sizes="(max-width: 720px) 100vw, 320px" unoptimized /><button type="button" onClick={() => update("photoData", "")} aria-label="Remove attached photo"><Trash2 size={16} /></button></div>
                ) : (
                  <label className="photo-upload">
                    <Camera aria-hidden="true" size={23} />
                    <span>{processingPhoto ? "Processing photo" : "Attach photo evidence"}</span>
                    <small>Camera or image library</small>
                    <input type="file" accept="image/*" capture="environment" onChange={attachPhoto} disabled={processingPhoto} />
                  </label>
                )}
                {errors.photoData ? <small className="field-error" role="alert">{errors.photoData}</small> : null}
              </div>
            </div>
          </section>

          <div className="tracker-submit-bar">
            <div><strong>Approval status: Pending</strong><span>Dashboard totals update only after management approval.</span></div>
            <button className="primary-button tracker-submit" type="submit" disabled={saving || processingPhoto || !fields.length}>
              <Save aria-hidden="true" size={17} /> {saving ? "Submitting" : "Submit record"}
            </button>
          </div>
        </form>
      </section>
    </ModuleShell>
  );
}

function TrackerField({ label, error, required, className = "", children }: { label: string; error?: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={className}><span>{label}{required ? " *" : ""}</span>{children}{error ? <small className="field-error" role="alert">{error}</small> : null}</label>;
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

async function compressEvidencePhoto(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Unsupported file type.");
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.76);
}
