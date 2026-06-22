"use client";

import { BatteryCharging, CheckCircle2, ClipboardCheck, PauseCircle, RefreshCcw, Save, Tractor, UserRound, Wrench } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { ModuleShell } from "@/components/module-shell";
import { usePmvData } from "@/components/pmv/use-pmv-data";
import { defaultPmvChecklist } from "@/lib/pmv/records";
import {
  PMV_CHECKLIST_ITEMS,
  PMV_DAMAGE_COMPONENTS,
  PMV_IDLE_REASONS,
  PMV_MACHINES,
  PMV_REPORTERS,
  PMV_STATUS_LABELS,
} from "@/lib/pmv/config";
import type { PmvRecord, PmvStatus } from "@/lib/types/pmv";

type PmvDraft = {
  reporterChoice: string;
  reporterOther: string;
  machineChoice: string;
  machineOther: string;
  machineStatus: PmvStatus;
  ipsBattery: string;
  checklist: Record<string, string>;
  damagedComponents: string[];
  damagedOther: string;
  idleReason: string;
  idleOther: string;
  assistantNotes: string;
};

function createDraft(previous?: PmvDraft): PmvDraft {
  return {
    reporterChoice: previous?.reporterChoice || "",
    reporterOther: previous?.reporterOther || "",
    machineChoice: previous?.machineChoice || "",
    machineOther: previous?.machineOther || "",
    machineStatus: "working",
    ipsBattery: "",
    checklist: defaultPmvChecklist(),
    damagedComponents: [],
    damagedOther: "",
    idleReason: "",
    idleOther: "",
    assistantNotes: "",
  };
}

export function PmvTracker() {
  const data = usePmvData({ loadRecords: false });
  const [draft, setDraft] = useState<PmvDraft>(createDraft);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [startedAt, setStartedAt] = useState(() => new Date().toISOString());
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSubmission, setLastSubmission] = useState<PmvRecord | null>(null);

  const reporterName = draft.reporterChoice === "Other" ? draft.reporterOther.trim() : draft.reporterChoice;
  const machineNumber = draft.machineChoice === "Other" ? draft.machineOther.trim().toUpperCase() : draft.machineChoice;
  const faultCount = useMemo(
    () => Object.values(draft.checklist).filter((value) => value === "Kurang Baik").length,
    [draft.checklist],
  );

  const update = <K extends keyof PmvDraft>(key: K, value: PmvDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const relatedErrors: Partial<Record<keyof PmvDraft, string>> = {
      reporterOther: "reporterChoice",
      machineOther: "machineChoice",
      damagedOther: "damagedComponents",
      idleOther: "idleReason",
    };
    const relatedError = relatedErrors[key];
    setErrors((current) => ({ ...current, [key]: "", ...(relatedError ? { [relatedError]: "" } : {}) }));
  };

  const clear = () => {
    setDraft(createDraft());
    setStartedAt(new Date().toISOString());
    setErrors({});
    setLastSubmission(null);
  };

  const toggleChecklistFault = (key: string) => {
    setDraft((current) => ({
      ...current,
      checklist: { ...current.checklist, [key]: current.checklist[key] === "Kurang Baik" ? "Baik" : "Kurang Baik" },
    }));
  };

  const toggleDamage = (component: string) => {
    setDraft((current) => ({
      ...current,
      damagedComponents: current.damagedComponents.includes(component)
        ? current.damagedComponents.filter((item) => item !== component)
        : [...current.damagedComponents, component],
    }));
    setErrors((current) => ({ ...current, damagedComponents: "" }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!reporterName) nextErrors.reporterChoice = "Select your name or enter another name.";
    if (!machineNumber) nextErrors.machineChoice = "Select your machine or enter another machine.";
    if (draft.machineStatus === "working" && !draft.ipsBattery) nextErrors.ipsBattery = "Select Yes or No.";
    const damagedComponents = [
      ...draft.damagedComponents,
      ...(draft.damagedComponents.includes("Other") && draft.damagedOther.trim() ? [draft.damagedOther.trim()] : []),
    ].filter((component) => component !== "Other");
    if (draft.machineStatus === "breakdown" && !damagedComponents.length) nextErrors.damagedComponents = "Select at least one damaged component.";
    const idleReason = draft.idleReason === "Other" ? draft.idleOther.trim() : draft.idleReason;
    if (draft.machineStatus === "idle" && !idleReason) nextErrors.idleReason = "Select the idle reason.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    const completedAt = new Date().toISOString();
    const record: PmvRecord = {
      id: createRecordId(),
      source: "PMV Tracker",
      startTime: startedAt,
      completionTime: completedAt,
      reporterName,
      reportDate: localDateString(new Date()),
      machineType: "",
      machineNumber,
      machineStatus: draft.machineStatus,
      ipsBattery: draft.machineStatus === "working" ? draft.ipsBattery : "",
      checklist: draft.machineStatus === "working" ? draft.checklist : defaultPmvChecklist(),
      damagedComponents: draft.machineStatus === "breakdown" ? damagedComponents : [],
      idleReason: draft.machineStatus === "idle" ? idleReason : "",
      assistantNotes: draft.assistantNotes.trim(),
      syncStatus: "Synced",
      updatedAt: completedAt,
    };

    setSaving(true);
    setErrors({});
    try {
      const saved = await data.saveRecord(record);
      setLastSubmission(saved);
      setDraft((current) => createDraft(current));
      setStartedAt(new Date().toISOString());
    } finally {
      setSaving(false);
    }
  };

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await data.syncPending();
    } finally {
      setSyncing(false);
    }
  }, [data]);

  return (
    <ModuleShell
      audience="input"
      title="PMV Tracker"
      subtitle="Daily machine status and PMV checklist submission for drivers"
      onSync={sync}
      syncBusy={syncing}
    >
      <section className="pmv-tracker-workspace" aria-labelledby="pmv-tracker-heading">
        <div className="tracker-heading-row">
          <div className="section-heading">
            <p>PMV input</p>
            <h2 id="pmv-tracker-heading">Daily machine report</h2>
          </div>
          <div className="pmv-report-meta">
            <span>{new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</span>
            <button className="secondary-button" type="button" onClick={clear}><RefreshCcw size={16} /> Clear</button>
          </div>
        </div>

        {lastSubmission ? (
          <div className="submission-confirmation" role="status">
            <CheckCircle2 aria-hidden="true" size={22} />
            <div>
              <strong>PMV report submitted</strong>
              <span>{lastSubmission.machineNumber} · {PMV_STATUS_LABELS[lastSubmission.machineStatus]} · {lastSubmission.reporterName}</span>
              <small>{lastSubmission.syncStatus === "Pending Sync" ? "Stored on this device and queued for sync." : "Saved to the shared PMV records."}</small>
            </div>
          </div>
        ) : null}

        <form className="pmv-tracker-form" onSubmit={submit} noValidate>
          <div className="pmv-question-grid">
            <QuestionBlock number="1" title="Pilih nama anda" icon={<UserRound size={18} />} error={errors.reporterChoice}>
              <select value={draft.reporterChoice} onChange={(event) => update("reporterChoice", event.target.value)}>
                <option value="">Pilih nama</option>
                {PMV_REPORTERS.map((reporter) => <option key={reporter}>{reporter}</option>)}
                <option>Other</option>
              </select>
              {draft.reporterChoice === "Other" ? <input value={draft.reporterOther} onChange={(event) => update("reporterOther", event.target.value)} placeholder="Masukkan nama" autoFocus /> : null}
            </QuestionBlock>

            <QuestionBlock number="2" title="Pilih Mesin Anda" icon={<Tractor size={18} />} error={errors.machineChoice}>
              <select value={draft.machineChoice} onChange={(event) => update("machineChoice", event.target.value)}>
                <option value="">Pilih mesin</option>
                {PMV_MACHINES.map((machine) => <option key={machine}>{machine}</option>)}
                <option>Other</option>
              </select>
              {draft.machineChoice === "Other" ? <input value={draft.machineOther} onChange={(event) => update("machineOther", event.target.value)} placeholder="Masukkan nombor mesin" autoCapitalize="characters" autoFocus /> : null}
            </QuestionBlock>
          </div>

          <section className="pmv-status-section">
            <div className="pmv-question-title"><span>3</span><div><strong>Status Mesin</strong><small>Pilih keadaan mesin hari ini.</small></div></div>
            <div className="pmv-status-options">
              <StatusOption value="working" selected={draft.machineStatus === "working"} onSelect={() => update("machineStatus", "working")} icon={<CheckCircle2 size={21} />} />
              <StatusOption value="breakdown" selected={draft.machineStatus === "breakdown"} onSelect={() => update("machineStatus", "breakdown")} icon={<Wrench size={21} />} />
              <StatusOption value="idle" selected={draft.machineStatus === "idle"} onSelect={() => update("machineStatus", "idle")} icon={<PauseCircle size={21} />} />
            </div>
          </section>

          {draft.machineStatus === "working" ? (
            <section className="pmv-conditional-section working" aria-labelledby="pmv-working-heading">
              <div className="conditional-heading"><CheckCircle2 size={20} /><div><h3 id="pmv-working-heading">Mesin Berfungsi</h3><p>Checklist bermula dengan semua item ditanda Baik.</p></div></div>
              <div className="pmv-battery-question">
                <div><span>4</span><strong>IPS Battery Voltmeter &gt;13v</strong></div>
                <div className="pmv-binary-options">
                  {(["Yes", "No"] as const).map((value) => <button className={draft.ipsBattery === value ? "selected" : ""} type="button" key={value} onClick={() => update("ipsBattery", value)}>{value}</button>)}
                </div>
                {errors.ipsBattery ? <small className="field-error" role="alert">{errors.ipsBattery}</small> : null}
              </div>
              <details className="pmv-checklist-details" open>
                <summary><span><ClipboardCheck size={18} /><b>5. PMV Checklist</b></span><em className={faultCount ? "has-fault" : ""}>{faultCount ? `${faultCount} Kurang Baik` : "Semua Baik"}</em></summary>
                <div className="pmv-checklist-intro" role="note"><BatteryCharging size={19} /><strong>Tandakan hanya item yang Kurang Baik</strong></div>
                <div className="pmv-checklist-list">
                  {PMV_CHECKLIST_ITEMS.map((item) => {
                    const faulty = draft.checklist[item.key] === "Kurang Baik";
                    return <button className={faulty ? "faulty" : ""} type="button" key={item.key} onClick={() => toggleChecklistFault(item.key)}><span><strong>{item.label}</strong>{item.detail ? <small>{item.detail}</small> : null}</span><em>{faulty ? "Kurang Baik" : "Baik"}</em></button>;
                  })}
                </div>
              </details>
            </section>
          ) : null}

          {draft.machineStatus === "breakdown" ? (
            <section className="pmv-conditional-section breakdown" aria-labelledby="pmv-breakdown-heading">
              <div className="conditional-heading"><Wrench size={20} /><div><h3 id="pmv-breakdown-heading">Mesin Rusak</h3><p>Pilih semua komponen yang rosak.</p></div></div>
              <div className="pmv-choice-chips">
                {[...PMV_DAMAGE_COMPONENTS, "Other"].map((component) => <button className={draft.damagedComponents.includes(component) ? "selected" : ""} type="button" key={component} onClick={() => toggleDamage(component)}>{component}</button>)}
              </div>
              {draft.damagedComponents.includes("Other") ? <input className="pmv-other-input" value={draft.damagedOther} onChange={(event) => update("damagedOther", event.target.value)} placeholder="Nyatakan komponen lain" /> : null}
              {errors.damagedComponents ? <small className="field-error" role="alert">{errors.damagedComponents}</small> : null}
            </section>
          ) : null}

          {draft.machineStatus === "idle" ? (
            <section className="pmv-conditional-section idle" aria-labelledby="pmv-idle-heading">
              <div className="conditional-heading"><PauseCircle size={20} /><div><h3 id="pmv-idle-heading">Machine Idle</h3><p>Pilih satu sebab mesin tidak digunakan.</p></div></div>
              <div className="pmv-choice-chips single-choice">
                {[...PMV_IDLE_REASONS, "Other"].map((reason) => <button className={draft.idleReason === reason ? "selected" : ""} type="button" key={reason} onClick={() => { update("idleReason", reason); setErrors((current) => ({ ...current, idleReason: "" })); }}>{reason}</button>)}
              </div>
              {draft.idleReason === "Other" ? <input className="pmv-other-input" value={draft.idleOther} onChange={(event) => update("idleOther", event.target.value)} placeholder="Nyatakan sebab lain" /> : null}
              {errors.idleReason ? <small className="field-error" role="alert">{errors.idleReason}</small> : null}
            </section>
          ) : null}

          <label className="pmv-notes-field"><span>6. Catatan untuk Tuan Assistant</span><textarea rows={3} value={draft.assistantNotes} onChange={(event) => update("assistantNotes", event.target.value)} placeholder="Ringkasan isu, tindakan diperlukan, atau maklumat tambahan" /></label>

          <div className="pmv-submit-bar">
            <div><strong>{machineNumber || "Mesin belum dipilih"}</strong><span>{reporterName || "Nama belum dipilih"} · {PMV_STATUS_LABELS[draft.machineStatus]}</span></div>
            <button className="primary-button pmv-submit-button" type="submit" disabled={saving}><Save size={17} />{saving ? "Menghantar" : "Hantar Laporan"}</button>
          </div>
        </form>
      </section>
    </ModuleShell>
  );
}

function QuestionBlock({ number, title, icon, error, children }: { number: string; title: string; icon: React.ReactNode; error?: string; children: React.ReactNode }) {
  return <section className="pmv-question-block"><div className="pmv-question-title"><span>{number}</span><div>{icon}<strong>{title}</strong></div></div><div className="pmv-question-inputs">{children}</div>{error ? <small className="field-error" role="alert">{error}</small> : null}</section>;
}

function StatusOption({ value, selected, onSelect, icon }: { value: PmvStatus; selected: boolean; onSelect: () => void; icon: React.ReactNode }) {
  return <button className={`${value}${selected ? " selected" : ""}`} type="button" onClick={onSelect} aria-pressed={selected}>{icon}<span>{PMV_STATUS_LABELS[value]}</span></button>;
}

function createRecordId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `pmv-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
