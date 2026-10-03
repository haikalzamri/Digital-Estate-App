"use client";

import { useEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { CalendarDays, Check, CheckCheck, ChevronRight, ClipboardList, FlaskConical, GripVertical, Plus, RotateCcw, Save, Search, Trash2, Users, X } from "lucide-react";
import { ModuleShell } from "@/components/module-shell";
import { DEMO_WORKERS } from "@/lib/pre-plan/dummy-workers";
import {
  addProgramme, addProgrammeField, addWorkersToProgramme, applyFieldsToWorkers, emptyPlan,
  finalisationIssues, finalisePlan, isPlanDate, removeProgramme, removeProgrammeField,
  removeWorker, toggleWorkerField, tomorrowDate,
} from "@/lib/pre-plan/planning";
import { PROGRAM_TYPES } from "@/lib/work-program/config";
import type { PrePlanDay, PrePlanProgramme } from "@/lib/types/pre-plan";
import { usePrePlanData } from "./use-pre-plan-data";
import styles from "./pre-plan.module.css";

const gangs = [...new Set(DEMO_WORKERS.map((worker) => worker.gang))];
const workersById = new Map(DEMO_WORKERS.map((worker) => [worker.id, worker]));
// These codes are intentionally fictional; the prototype has no SAP integration.
const catalogue = PROGRAM_TYPES.map((programme, index) => ({ programme, code: "DEMO-" + String(index + 1).padStart(2, "0") }));
type FieldOption = { id: string; name: string };
type Confirmation = { kind: "finalise" } | { kind: "field"; programme: string; fieldId: string } | { kind: "programme"; programme: string };

export function PrePlanBoard() {
  const data = usePrePlanData();
  const [programmeInput, setProgrammeInput] = useState("");
  const [gang, setGang] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [fieldError, setFieldError] = useState("");
  const [fieldLoad, setFieldLoad] = useState(0);
  const [notice, setNotice] = useState({ message: "", error: false });
  const [focusedProgramme, setFocusedProgramme] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [pointerDrag, setPointerDrag] = useState<{ x: number; y: number; count: number; programme: string } | null>(null);
  const gesture = useRef<{ x: number; y: number; ids: string[]; active: boolean } | null>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());
  const dialog = useRef<HTMLDialogElement>(null);
  const programmeListId = useId();
  const plan = data.days[data.date] || emptyPlan(data.date);
  const locked = !data.ready || plan.status === "Finalised";
  const fieldNames = useMemo(() => Object.fromEntries(fields.map((field) => [field.id, field.name])), [fields]);
  const assignedIds = new Set(plan.allocations.map((item) => item.workerId));
  const selectedIds = selected.filter((id) => !assignedIds.has(id));
  const missingFields = plan.allocations.filter((item) => !item.fieldIds.length).length;
  const visibleWorkers = DEMO_WORKERS.filter((worker) => (!gang || worker.gang === gang)
    && (worker.name + " " + worker.id).toLowerCase().includes(search.trim().toLowerCase()));
  const availableWorkers = visibleWorkers.filter((worker) => !assignedIds.has(worker.id));
  const allSelected = availableWorkers.length > 0 && availableWorkers.every((worker) => selectedIds.includes(worker.id));
  const issues = finalisationIssues(plan);
  const cannotSave = !data.ready || Boolean(data.storageError) || data.externalChange;
  const dirty = data.dirtyDates.includes(data.date);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/data/field-map-data.geojson", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("The field list could not be loaded.");
        const collection = await response.json() as { features?: { properties: { field_gis: string; field_no: string } }[] };
        if (!collection.features?.length) throw new Error("The field list is empty.");
        const options = collection.features.map(({ properties }) => ({ id: properties.field_gis, name: properties.field_no || properties.field_gis }));
        setFields(options.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
        setFieldError("");
      })
      .catch((error) => {
        if (!controller.signal.aborted) setFieldError(error instanceof Error ? error.message : "Field list unavailable.");
      });
    return () => controller.abort();
  }, [fieldLoad]);

  useEffect(() => {
    if (confirmation && !dialog.current?.open) dialog.current?.showModal();
    if (!confirmation && dialog.current?.open) dialog.current.close();
  }, [confirmation]);

  const reportError = (message: string) => setNotice({ message, error: true });
  const runAction = (action: () => void) => {
    try { action(); } catch (error) { reportError(error instanceof Error ? error.message : "The action could not be completed."); }
  };
  const focusCard = (programme: string) => {
    setFocusedProgramme(programme);
    window.requestAnimationFrame(() => cardRefs.current.get(programme)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };
  const changeDate = (date: string) => {
    if (!isPlanDate(date)) return;
    data.setDate(date);
    setSelected([]);
    setFocusedProgramme("");
    setNotice({ message: "", error: false });
  };
  const addCard = () => runAction(() => {
    const value = programmeInput.trim().toLowerCase();
    const found = catalogue.find((item) => [item.programme, item.code, item.code + " · " + item.programme].some((text) => text.toLowerCase() === value));
    if (!found) throw new Error("Choose a programme by its name or demo activity code from the list.");
    const next = addProgramme(plan, found.programme);
    if (next !== plan) data.updatePlan(next);
    focusCard(found.programme);
    setProgrammeInput("");
    setNotice({ message: next === plan ? "This programme already has a card. Its existing card is highlighted." : found.programme + " added. List its fields, then add workers.", error: false });
  });
  const assign = (programme: string, ids = selectedIds) => runAction(() => {
    if (!data.ready || ids.some((id) => !workersById.has(id))) throw new Error("Select workers from the demo list.");
    const next = addWorkersToProgramme(plan, ids, programme);
    if (next !== plan) data.updatePlan(next);
    setSelected((current) => current.filter((id) => !ids.includes(id)));
    setFocusedProgramme(programme);
    setNotice({ message: next === plan ? "These workers are already in this programme." : ids.length + " worker" + (ids.length === 1 ? "" : "s") + " added to " + programme + ". Click the fields beside each name.", error: false });
  });
  const programmeAtPoint = (x: number, y: number) =>
    document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-programme-card]")?.dataset.programmeCard || "";
  const startDrag = (event: PointerEvent<HTMLElement>, ids: string[]) => {
    const target = event.target as HTMLElement;
    if (locked || !ids.length || event.button !== 0 || target.closest("input, select, textarea") || target.closest("button:not([data-drag-handle])")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { x: event.clientX, y: event.clientY, ids, active: false };
    setSelected(ids);
  };
  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    if (!current) return;
    if (!current.active && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 6) return;
    current.active = true;
    setPointerDrag({ x: event.clientX, y: event.clientY, count: current.ids.length, programme: programmeAtPoint(event.clientX, event.clientY) });
  };
  const cancelDrag = () => { gesture.current = null; setPointerDrag(null); };
  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const current = gesture.current;
    cancelDrag();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!current?.active) return;
    const programme = programmeAtPoint(event.clientX, event.clientY);
    if (programme) assign(programme, current.ids);
    else reportError("Drop workers inside a programme card, or use its Add selected button.");
  };
  const save = (finalise = false) => runAction(() => {
    data.savePlan(finalise ? finalisePlan(plan) : plan);
    setConfirmation(null);
    setNotice({ message: finalise ? "Demo plan finalised in this browser only. Nothing was sent to workers." : "Draft saved in this browser only.", error: false });
  });
  const requestFieldRemoval = (programme: string, fieldId: string) => {
    if (plan.allocations.some((item) => item.programme === programme && item.fieldIds.includes(fieldId))) {
      setConfirmation({ kind: "field", programme, fieldId });
    } else runAction(() => data.updatePlan(removeProgrammeField(plan, programme, fieldId)));
  };
  const confirmAction = () => {
    if (!confirmation) return;
    if (confirmation.kind === "finalise") { save(true); return; }
    runAction(() => {
      if (confirmation.kind === "field") {
        data.updatePlan(removeProgrammeField(plan, confirmation.programme, confirmation.fieldId));
        setNotice({ message: "Field removed. Workers stay in their programme; review any rows that need a field.", error: false });
      } else {
        data.updatePlan(removeProgramme(plan, confirmation.programme));
        setNotice({ message: "Programme removed. Its workers are available for another programme.", error: false });
      }
      setConfirmation(null);
    });
  };
  const affectedWorkers = confirmation?.kind === "field"
    ? plan.allocations.filter((item) => item.programme === confirmation.programme && item.fieldIds.includes(confirmation.fieldId))
    : confirmation?.kind === "programme" ? plan.allocations.filter((item) => item.programme === confirmation.programme) : [];

  return (
    <ModuleShell audience="management" title="Pre-Plan" subtitle="Plan tomorrow’s programmes and assign fields to each worker">
      <div className={styles.board}>
        <div className={styles.demoBanner} role="note"><FlaskConical size={18} aria-hidden="true" /><strong>Prototype — Demo data</strong><span>For workflow review. Workers and activity codes are fictional; plans stay in this browser.</span></div>
        <section className={styles.toolbar} aria-label="Planning controls">
          <div className={styles.dateGroup}><label className={styles.control}><span><CalendarDays size={15} aria-hidden="true" /> Planning date</span><input type="date" value={data.date} disabled={!data.ready} onChange={(event) => changeDate(event.target.value)} /></label><button className={styles.textButton} type="button" disabled={!data.ready} onClick={() => changeDate(tomorrowDate())}>Tomorrow</button></div>
          <div className={styles.saveActions}>
            <span className={styles.status} data-finalised={plan.status === "Finalised"}>{plan.status === "Finalised" ? <CheckCheck size={14} aria-hidden="true" /> : null}{plan.status}{dirty ? " · Unsaved" : ""}</span>
            {plan.status === "Finalised" ? <button className={styles.button} type="button" disabled={!data.ready || data.externalChange} onClick={() => {
              data.updatePlan({ ...plan, status: "Draft" }); setNotice({ message: "Demo plan reopened. Save Draft after editing.", error: false });
            }}><RotateCcw size={16} aria-hidden="true" /> Reopen demo</button> : <>
              <button className={styles.button} type="button" disabled={cannotSave} onClick={() => save()}><Save size={16} aria-hidden="true" /> Save Draft</button>
              <button className={styles.primaryButton} type="button" disabled={cannotSave || issues.length > 0} title={issues[0] || "Finalise all programmes for this date"} onClick={() => setConfirmation({ kind: "finalise" })}><CheckCheck size={16} aria-hidden="true" /> Finalise Demo</button>
            </>}
          </div>
        </section>
        {data.storageError || data.externalChange ? <p className={styles.error} role="alert">{data.storageError || "Demo data changed in another tab. Reload before saving to avoid overwriting it."}</p> : null}
        {fieldError ? <div className={styles.error} role="alert">{fieldError} <button type="button" className={styles.textButton} onClick={() => setFieldLoad((current) => current + 1)}>Retry field list</button></div> : null}
        <div className={notice.error ? styles.error : styles.feedback} role={notice.error ? "alert" : "status"} aria-live="polite">{notice.message || (locked && data.ready ? "Demo plan locked. Reopen it to continue testing." : "Add a programme → list its fields → add workers → click fields beside each name.")}</div>

        <div className={styles.workspace}>
          <section className={styles.workerPanel} aria-labelledby="pre-plan-workers">
            <div className={styles.panelHeading}><div><p>MANPOWER</p><h2 id="pre-plan-workers">Workers <span>{DEMO_WORKERS.length}</span></h2></div><Users size={20} aria-hidden="true" /></div>
            <div className={styles.workerFilters}>
              <label className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label="Search workers by name or ID" placeholder="Search name or ID" value={search} onChange={(event) => { setSearch(event.target.value); setSelected([]); }} /></label>
              <label className={styles.control}><span>Gang</span><select value={gang} onChange={(event) => { setGang(event.target.value); setSelected([]); }}><option value="">All gangs</option>{gangs.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label className={styles.selectAll}><input type="checkbox" checked={allSelected} disabled={locked || !availableWorkers.length} onChange={() => setSelected(allSelected ? [] : availableWorkers.map((worker) => worker.id))} /><span>Select unassigned workers <small>({availableWorkers.length})</small></span></label>
            </div>
            <div className={styles.workerList}>
              {!visibleWorkers.length ? <p className={styles.empty}>No matching workers.</p> : visibleWorkers.map((worker) => {
                const allocation = plan.allocations.find((item) => item.workerId === worker.id);
                const checked = selectedIds.includes(worker.id);
                return <div className={styles.worker} data-selected={checked} data-assigned={Boolean(allocation)} data-draggable={!locked && !allocation} key={worker.id}
                  onPointerDown={(event) => { if (!allocation) startDrag(event, checked ? selectedIds : [worker.id]); }} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag} onKeyDown={(event) => { if (event.key === "Escape") cancelDrag(); }}>
                  <input type="checkbox" aria-label={"Select " + worker.name} checked={checked} disabled={locked || Boolean(allocation)} onChange={() => setSelected((current) => checked ? current.filter((id) => id !== worker.id) : [...current, worker.id])} />
                  <div className={styles.workerCopy}><strong>{worker.name}</strong><small>{worker.id} · Gang {worker.gang}</small>
                    {allocation ? <><button type="button" className={styles.programmeLink} onClick={() => focusCard(allocation.programme)}>{allocation.programme} <ChevronRight size={12} aria-hidden="true" /></button><small className={!allocation.fieldIds.length ? styles.needsField : undefined}>{allocation.fieldIds.length ? allocation.fieldIds.map((id) => fieldNames[id] || id).join(", ") : "Needs fields"}</small></> : <span className={styles.unassignedLabel}>Unassigned</span>}
                  </div>
                  {!locked && !allocation ? <button className={styles.dragHandle} type="button" data-drag-handle aria-label={"Select " + worker.name + " for dragging"} onClick={() => { if (!checked) setSelected([worker.id]); }}><GripVertical size={16} aria-hidden="true" /></button> : null}
                </div>;
              })}
            </div>
            <div className={styles.selectionBar} data-draggable={!locked && selectedIds.length > 0} onPointerDown={(event) => startDrag(event, selectedIds)} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={cancelDrag}>
              <button className={styles.dragHandle} data-drag-handle type="button" aria-label="Drag selected workers" disabled={locked || !selectedIds.length}><GripVertical size={18} aria-hidden="true" /></button>
              <span>{selectedIds.length ? <><strong>{selectedIds.length} selected</strong><small>Drag to a programme card</small></> : "Select workers to add"}</span>
              {selectedIds.length ? <button className={styles.textButton} type="button" onClick={() => setSelected([])}>Clear</button> : null}
            </div>
            <div className={styles.workerFoot}>One programme per worker, per date.<br />Choose multiple fields beside their name.</div>
          </section>

          <section className={styles.programmeBoard} aria-labelledby="programme-board-heading">
            <div className={styles.boardHeading}><div><p>DAILY ALLOCATION</p><h2 id="programme-board-heading">Programme board <span>{plan.programmes.length}</span></h2></div>
              <form className={styles.addProgramme} onSubmit={(event) => { event.preventDefault(); addCard(); }}>
                <label className={styles.search}><Search size={16} aria-hidden="true" /><input aria-label="Activity code or programme" list={programmeListId} placeholder="Activity code or programme" value={programmeInput} disabled={locked} onChange={(event) => setProgrammeInput(event.target.value)} /></label>
                <datalist id={programmeListId}>{catalogue.map((item) => <option key={item.code} value={item.code + " · " + item.programme} />)}</datalist>
                <button className={styles.primaryButton} type="submit" disabled={locked || !programmeInput.trim()}><Plus size={16} aria-hidden="true" /> Add programme</button>
              </form>
            </div>
            <div className={styles.boardMeta}>One card per programme · Demo activity codes <span>Fields are selected separately for each worker</span></div>
            {!plan.programmes.length ? <div className={styles.emptyBoard}><ClipboardList size={38} aria-hidden="true" /><h3>Start with tomorrow’s programmes</h3><p>Search a programme or demo activity code above.<br />Each programme gets a card for its fields and workers.</p></div> : (
              <div className={styles.programmeGrid}>{plan.programmes.map((card, index) => <ProgrammeCard
                key={data.date + ":" + card.programme}
                card={card} index={index} plan={plan} fields={fields} fieldNames={fieldNames} locked={locked}
                selectedCount={selectedIds.length} focused={focusedProgramme === card.programme} hovered={pointerDrag?.programme === card.programme}
                setRef={(element) => { if (element) cardRefs.current.set(card.programme, element); else cardRefs.current.delete(card.programme); }}
                onAssign={() => assign(card.programme)}
                onChange={data.updatePlan} onError={reportError}
                onRemoveField={(id) => requestFieldRemoval(card.programme, id)}
                onRemoveProgramme={() => setConfirmation({ kind: "programme", programme: card.programme })}
              />)}</div>
            )}
            {data.ready && plan.status === "Draft" && issues.length && plan.programmes.length ? <div className={styles.readiness}><strong>Before finalising</strong><ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul><span>You can save an incomplete draft.</span></div> : null}
          </section>
        </div>
        <div className={styles.summaryStrip} aria-live="polite"><span>Selected date · All programmes</span><div><strong>{plan.programmes.length}</strong> programmes</div><div><strong>{assignedIds.size}</strong> assigned workers</div><div><strong>{missingFields}</strong> need fields</div><div><strong>{DEMO_WORKERS.length - assignedIds.size}</strong> unassigned</div></div>
        <details className={styles.summaryTable}><summary><ChevronRight size={17} aria-hidden="true" /> Allocation summary <span>Each worker counted once</span></summary>
          {plan.allocations.length ? <table><thead><tr><th scope="col">Worker</th><th scope="col">Gang</th><th scope="col">Programme</th><th scope="col">Assigned fields</th></tr></thead><tbody>{plan.allocations.map((item) => <tr key={item.workerId}><td>{workersById.get(item.workerId)?.name || item.workerId}</td><td>{workersById.get(item.workerId)?.gang || "—"}</td><td>{item.programme}</td><td className={!item.fieldIds.length ? styles.needsField : undefined}>{item.fieldIds.length ? item.fieldIds.map((id) => fieldNames[id] || id).join(", ") : "Needs fields"}</td></tr>)}</tbody></table> : <p className={styles.empty}>Add workers to build your demo plan.</p>}
        </details>
        <div className={styles.saveNote}>{data.ready ? (plan.savedAt ? "Last saved in this browser: " + new Date(plan.savedAt).toLocaleString() + "." : "No saved plan for this date yet.") : "Loading your demo planner…"}{data.dirtyDates.length ? " Unsaved dates: " + data.dirtyDates.join(", ") + ". Save each date before leaving." : ""}</div>
      </div>
      {pointerDrag ? <div className={styles.dragPreview} style={{ left: pointerDrag.x, top: pointerDrag.y }} aria-hidden="true"><Users size={16} />{pointerDrag.count} workers<span>{pointerDrag.programme ? "Add to " + pointerDrag.programme : "Drop inside a programme"}</span></div> : null}
      <dialog className={styles.confirmDialog} ref={dialog} aria-labelledby="pre-plan-confirm-title" onCancel={() => setConfirmation(null)}>
        <h2 id="pre-plan-confirm-title">{confirmation?.kind === "finalise" ? "Finalise this demo plan?" : confirmation?.kind === "field" ? "Remove this field?" : "Remove this programme?"}</h2>
        {confirmation?.kind === "finalise" ? <><p>{data.date} · {plan.programmes.length} programmes · {assignedIds.size} unique workers</p><p>The plan will be saved and locked in this browser. You can reopen it to keep testing. No work instructions are sent.</p></> : <>
          <p><strong>{confirmation?.kind === "field" ? (fieldNames[confirmation.fieldId] || confirmation.fieldId) + " · " + confirmation.programme : confirmation?.programme}</strong></p>
          <p>{confirmation?.kind === "field" ? "This field will be removed from " + affectedWorkers.length + " worker(s). They stay in this programme; any worker left without a field will need a new selection." : "The card and its field notes will be removed. Its " + affectedWorkers.length + " worker(s) will become available for another programme."}</p>
          {affectedWorkers.length ? <p className={styles.affectedNames}>{affectedWorkers.map((item) => workersById.get(item.workerId)?.name || item.workerId).join(", ")}</p> : null}
        </>}
        <div className={styles.dialogActions}><button className={styles.button} type="button" onClick={() => setConfirmation(null)}>Cancel</button><button className={confirmation?.kind === "finalise" ? styles.primaryButton : styles.dangerButton} type="button" onClick={confirmAction} disabled={confirmation?.kind === "finalise" && cannotSave}>{confirmation?.kind === "finalise" ? "Finalise Demo" : confirmation?.kind === "field" ? "Remove field" : "Remove programme"}</button></div>
        {notice.error ? <p className={styles.error} role="alert">{notice.message}</p> : null}
      </dialog>
    </ModuleShell>
  );
}

type ProgrammeCardProps = {
  card: PrePlanProgramme; index: number; plan: PrePlanDay; fields: FieldOption[]; fieldNames: Record<string, string>;
  locked: boolean; selectedCount: number; focused: boolean; hovered: boolean;
  setRef: (element: HTMLElement | null) => void;
  onAssign: () => void; onChange: (plan: PrePlanDay) => void; onError: (message: string) => void;
  onRemoveField: (fieldId: string) => void; onRemoveProgramme: () => void;
};

function ProgrammeCard({ card, index, plan, fields, fieldNames, locked, selectedCount, focused, hovered, setRef, onAssign, onChange, onError, onRemoveField, onRemoveProgramme }: ProgrammeCardProps) {
  const [fieldInput, setFieldInput] = useState("");
  const [rowSelection, setRowSelection] = useState<string[]>([]);
  const [bulkFields, setBulkFields] = useState<string[]>([]);
  const fieldListId = useId();
  const headingId = useId();
  const workers = plan.allocations.filter((item) => item.programme === card.programme);
  const selectedRows = rowSelection.filter((id) => workers.some((worker) => worker.workerId === id));
  const chosenBulkFields = bulkFields.filter((id) => card.fieldIds.includes(id));
  const missing = workers.filter((item) => !item.fieldIds.length).length;
  const code = catalogue.find((item) => item.programme === card.programme)?.code;
  const run = (action: () => void) => { try { action(); } catch (error) { onError(error instanceof Error ? error.message : "Unable to change this card."); } };
  const addField = () => run(() => {
    const value = fieldInput.trim().toLowerCase();
    const field = fields.find((item) => item.name.toLowerCase() === value || item.id.toLowerCase() === value);
    if (!field) throw new Error("Choose a valid field from the field list.");
    onChange(addProgrammeField(plan, card.programme, field.id));
    setFieldInput("");
  });

  return <section ref={setRef} className={styles.programmeCard} aria-labelledby={headingId} data-programme-card={card.programme} data-focused={focused} data-hovered={hovered}>
    <div className={styles.cardHeading}><span className={styles.cardNumber}>{String(index + 1).padStart(2, "0")}</span><div><span className={styles.activityCode}>{code ? code + " · Demo activity" : "Programme"}</span><h3 id={headingId}>{card.programme}</h3></div><button className={styles.removeButton} type="button" aria-label={"Remove programme " + card.programme} disabled={locked} onClick={onRemoveProgramme}><Trash2 size={15} aria-hidden="true" /></button></div>
    <div className={styles.fieldPool}><div className={styles.stepLabel}><span>1</span><strong>Programme fields</strong><small>{card.fieldIds.length} listed</small></div>
      <div className={styles.poolChips}>{card.fieldIds.length ? card.fieldIds.map((id) => <span className={styles.poolChip} key={id}>{fieldNames[id] || id}<button type="button" aria-label={"Remove field " + (fieldNames[id] || id) + " from " + card.programme} disabled={locked} onClick={() => onRemoveField(id)}><X size={12} aria-hidden="true" /></button></span>) : <span className={styles.muted}>Add the fields available for this programme.</span>}</div>
      {!locked ? <form className={styles.fieldForm} onSubmit={(event) => { event.preventDefault(); addField(); }}><input aria-label={"Add field to " + card.programme} list={fieldListId} placeholder={fields.length ? "Type or choose a field" : "Loading field list…"} value={fieldInput} disabled={!fields.length} onChange={(event) => setFieldInput(event.target.value)} /><datalist id={fieldListId}>{fields.filter((field) => !card.fieldIds.includes(field.id)).map((field) => <option key={field.id} value={field.name} />)}</datalist><button className={styles.button} type="submit" disabled={!fieldInput.trim() || !fields.length}><Plus size={14} aria-hidden="true" /> Add field</button></form> : null}
    </div>
    <div className={styles.peopleHeading}><div className={styles.stepLabel}><span>2</span><strong>Workers &amp; their fields</strong></div>{missing ? <span className={styles.incomplete}>{missing} need fields</span> : workers.length ? <span className={styles.complete}><Check size={12} aria-hidden="true" /> Ready</span> : null}</div>
    {workers.length ? <>
      <div className={styles.rowHeader}><label><input type="checkbox" aria-label={"Select all rows in " + card.programme} checked={selectedRows.length === workers.length} disabled={locked} onChange={() => setRowSelection(selectedRows.length === workers.length ? [] : workers.map((item) => item.workerId))} /><span>Worker</span></label><span>Click fields to select / deselect</span></div>
      {selectedRows.length && !locked ? <div className={styles.bulkBar}><strong>{selectedRows.length} workers selected</strong><div className={styles.fieldChoices}>{card.fieldIds.map((id) => <button type="button" className={styles.fieldToggle} aria-pressed={chosenBulkFields.includes(id)} aria-label={"Bulk field " + (fieldNames[id] || id) + " in " + card.programme} key={id} onClick={() => setBulkFields((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}>{chosenBulkFields.includes(id) ? <Check size={11} aria-hidden="true" /> : <span className={styles.uncheckedMark} />}{fieldNames[id] || id}</button>)}</div><div className={styles.bulkActions}><small>Adds to their existing fields</small><button className={styles.button} type="button" disabled={!chosenBulkFields.length} onClick={() => run(() => { onChange(applyFieldsToWorkers(plan, card.programme, selectedRows, chosenBulkFields)); setRowSelection([]); setBulkFields([]); })}>Apply fields</button></div></div> : null}
      <div className={styles.cardWorkers}>{workers.map((allocation) => {
        const worker = workersById.get(allocation.workerId);
        const name = worker?.name || allocation.workerId;
        const checked = selectedRows.includes(allocation.workerId);
        return <div className={styles.allocationRow} key={allocation.workerId} data-incomplete={!allocation.fieldIds.length}>
          <label className={styles.rowIdentity}><input type="checkbox" aria-label={"Select row " + name + " in " + card.programme} checked={checked} disabled={locked} onChange={() => setRowSelection((current) => checked ? current.filter((id) => id !== allocation.workerId) : [...current, allocation.workerId])} /><span><strong>{name}</strong><small>Gang {worker?.gang || "—"}</small></span></label>
          <div className={styles.rowFields}><div className={styles.fieldChoices}>{card.fieldIds.map((id) => <button className={styles.fieldToggle} type="button" key={id} aria-label={"Field " + (fieldNames[id] || id) + " for " + name} aria-pressed={allocation.fieldIds.includes(id)} disabled={locked} onClick={() => run(() => onChange(toggleWorkerField(plan, allocation.workerId, id)))}>{allocation.fieldIds.includes(id) ? <Check size={11} aria-hidden="true" /> : <span className={styles.uncheckedMark} />}{fieldNames[id] || id}</button>)}</div>
            <div className={styles.rowFieldFoot}>{!allocation.fieldIds.length ? <small className={styles.needsField}>{card.fieldIds.length ? "Select at least one field" : "Add programme fields above"}</small> : <small>{allocation.fieldIds.length} field{allocation.fieldIds.length === 1 ? "" : "s"}</small>}{card.fieldIds.length && !locked ? <button className={styles.textButton} type="button" aria-label={"Assign all fields to " + name} onClick={() => run(() => onChange(applyFieldsToWorkers(plan, card.programme, [allocation.workerId], card.fieldIds)))}>All fields</button> : null}</div>
          </div>
          <button className={styles.removeButton} type="button" aria-label={"Remove " + name + " from " + card.programme} disabled={locked} onClick={() => run(() => { onChange(removeWorker(plan, card.programme, allocation.workerId)); setRowSelection((current) => current.filter((id) => id !== allocation.workerId)); })}><X size={14} aria-hidden="true" /></button>
        </div>;
      })}</div>
    </> : <div className={styles.emptyWorkers}><Users size={21} aria-hidden="true" /><strong>No workers added yet</strong><span>Select workers from the left, then drag them here.</span></div>}
    {!locked ? <div className={styles.dropZone} data-active={hovered}><GripVertical size={17} aria-hidden="true" /><span>{hovered ? "Release to add workers" : "Drop workers here"}</span><button className={styles.button} type="button" disabled={!selectedCount} onClick={onAssign}><Plus size={14} aria-hidden="true" /> Add selected ({selectedCount})</button></div> : null}
    <div className={styles.cardFooter}><span>{workers.length} workers · {card.fieldIds.length} available fields</span><span>{missing ? missing + " need fields" : workers.length ? "All workers have fields" : "Awaiting workers"}</span></div>
  </section>;
}
