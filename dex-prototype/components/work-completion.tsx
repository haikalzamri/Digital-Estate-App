"use client";

import { MachineReview } from "@/components/machine-workspace";
import { checkrollSummary } from "@/lib/checkroll";
import { useId, useState } from "react";
import { ArrowRight, Check, ChevronDown, Plus, RotateCcw } from "lucide-react";
import { activityName, activities, fields, formatHa, workerName, workers, gangs, isManagement, type PhoneRole, type Session } from "@/lib/workshop";
import { effectiveGang, morningView } from "@/lib/morning-work";
import {
  completionWorks, latestReport, validatedReport, pendingReports, primaryWork, progressDestination,
  reportTicketHa, reviseWorkHa, reportSecondaryHa, recordSecondaryJob, secondaryJobs, reviewWorkHa, secondaryOptions, validationIssue,
  bunchTotal, qcWorkers, harvestingGangs, type CompletedWork, type HaInput, type HaRevision,
} from "@/lib/work-completion";

type Action = (action: (latest: Session) => Session, message?: string) => boolean;
function Ha({ value }: { value: number | null | undefined }) { return <>{value == null ? "Non-area work" : formatHa(value) + " ha"}</>; }
const reportLabel = (status: string) => status === "Validated" ? "Approved" : status === "Reported" ? "Awaiting approval" : status;
export function ProductionTasks({ report }: { report: HaRevision }) {
  if (!report.production) return null;
  return <div className="production-task-history">{report.production.rows.map((row,index)=><div key={index}><strong>{workerName(row.workerId)}</strong><small>Gang {row.gang} · Task {row.task}</small><span>{row.bunches.toLocaleString()} bunches</span></div>)}</div>;
}
function ReportHistory({ work }: { work: CompletedWork }) {
  return <details className="wc-history"><summary>Report history ({work.reports.length})</summary>{work.reports.map((r, index) => <div key={r.id}><strong>V{index + 1} · {r.production ? bunchTotal(r).toLocaleString()+" bunches" : <Ha value={r.ha} />} · {reportLabel(r.status)}</strong><span>{r.finish} · {r.actor}</span><p>{r.note}</p><ProductionTasks report={r}/>{r.production&&r.status==="Validated"?<p>Confirmed: <Ha value={r.ha}/></p>:null}{r.reviewNote ? <p>FO: {r.reviewNote}</p> : null}</div>)}</details>;
}
function ReportSummary({ work }: { work: CompletedWork }) {
  const latest = latestReport(work)!, validated = validatedReport(work);
  return <div className="wc-report-summary">
    <div className="wc-report-heading"><strong>{work.origin === "secondary" ? "Secondary work" : "Field completion"}</strong><span className={"wc-status wc-" + latest.status.toLowerCase()}>{reportLabel(latest.status)}</span></div>
    <p>{work.activityCode}{work.fieldNo ? " · " + work.fieldNo : ""}{work.programmeRound ? " · R" + work.programmeRound : ""}</p>
    <div className="wc-ha-number">{latest.production ? bunchTotal(latest).toLocaleString()+" bunches" : <Ha value={latest.ha} />}<small>{latest.finish}</small></div>
    {validated && latest.id !== validated.id ? <p className="wc-note">Currently credited: <Ha value={validated.ha} />. This revision replaces that total after validation.</p> : null}
    {latest.production ? <><ProductionTasks report={latest}/><p className="wc-note">{latest.status==="Validated"?"Confirmed: "+(latest.ha==null?"Non-area work":formatHa(latest.ha)+" ha"):"Harvesting Ha confirmed by FO on approval"}</p></> : null}
    <small className="wc-destination">{progressDestination(work)}</small>
    {latest.status === "Returned" ? <p className="wc-return-note">FO: {latest.reviewNote}</p> : null}
    <ReportHistory work={work} />
  </div>;
}

export function TicketCompletion({ session, ticketId, role, onAction, secondaryOnly=false }: { session: Session; ticketId: string; role: PhoneRole; onAction: Action; secondaryOnly?: boolean }) {
  const primary = primaryWork(session, ticketId);
  const formPrefix = useId();
  const [recordingJob, setRecordingJob] = useState(false), [jobId, setJobId] = useState("");
  const [jobWorkers, setJobWorkers] = useState<string[]>([]), [jobGang, setJobGang] = useState(""), [jobGangFilter, setJobGangFilter] = useState(""), [jobNote, setJobNote] = useState(""), [jobTransfer, setJobTransfer] = useState(false);
  const [jobCode, setJobCode] = useState(primary.activityCode), [jobField, setJobField] = useState(primary.fieldNo), [jobNonArea, setJobNonArea] = useState(false);
  const [jobRequestKey, setJobRequestKey] = useState("");
  const jobs = secondaryJobs(session).filter((j) => j.ticketId === ticketId);
  const presentWorkers = workers.filter((w) => !w.needsReview && morningView(session).attendance[w.id] === "Present");
  const [form, setForm] = useState<"primary" | "secondary" | string | null>(null);
  const [ha, setHa] = useState(""), [note, setNote] = useState(""), [finish, setFinish] = useState<HaInput["finish"]>("Finished");
  const [requestKey, setRequestKey] = useState(""), [nonArea, setNonArea] = useState(false);
  const [same, setSame] = useState(true), [code, setCode] = useState(primary.activityCode), [field, setField] = useState(primary.fieldNo), [link, setLink] = useState(""), [newArea, setNewArea] = useState(false);
  const works = completionWorks(session).filter((w) => w.ticketId === ticketId && (!secondaryOnly || w.origin === "secondary"));
  const canReport = role === primary.recipient;
  const canRecordJob = canReport || isManagement(role);
  const editWork = form && form !== "secondary" ? form === "primary" ? primary : works.find((w) => w.id === form) : undefined;
  const formKind = form === "secondary" ? same ? primary.kind : link ? "upkeep" : code.startsWith("PH") ? "harvesting" : nonArea ? "general" : "upkeep" : editWork?.kind;
  const options = secondaryOptions(code, field);
  const open = (id: string) => {
    setRecordingJob(false); setJobId("");
    const w = id === "primary" ? primary : works.find((w) => w.id === id);
    setHa(w && latestReport(w)?.ha != null ? String(latestReport(w)!.ha) : "");
    setRequestKey("HA:" + ticketId + ":" + session.sequence + ":" + formPrefix); setNonArea(false);
    setFinish(latestReport(w || primary)?.finish || "Finished"); setNote(""); setSame(true); setCode(primary.activityCode); setField(primary.fieldNo); setLink(""); setNewArea(false); setForm(id);
  };
  const openJob = () => {
    setForm(null); setJobId(""); setJobWorkers(primary.workerIds.filter((id) => presentWorkers.some((w) => w.id === id)));
    setJobGang(""); setJobGangFilter(""); setJobTransfer(false); setJobCode(primary.activityCode); setJobField(primary.fieldNo); setJobNonArea(false); setJobNote("");
    setJobRequestKey("JOB:" + ticketId + ":" + session.sequence + ":" + formPrefix); setRecordingJob(true);
  };
  const reportJob = (id: string) => {
    const job = jobs.find((j) => j.id === id)!; open("secondary"); setJobId(job.id); setSame(false); setCode(job.activityCode); setField(job.fieldNo); setNonArea(!job.areaRequired);
  };
  const submit = () => {
    const input: HaInput = { requestKey, ha: ha.trim() ? Number(ha) : null, finish, note };
    const ok = onAction((s) => form === "secondary" ? reportSecondaryHa(s, ticketId, { ...input, secondaryJobId: jobId || undefined, sameWork: same, activityCode: code, fieldNo: field, programmeId: link.split("|")[0] || null, programmeRound: link ? Number(link.split("|")[1]) : undefined, newArea, nonArea }, role)
      : editWork?.origin === "secondary" ? reviseWorkHa(s, editWork.id, input, role) : reportTicketHa(s, ticketId, input, role), "Ha reported to the Field Officer. Checkroll remains pending.");
    if (ok) setForm(null);
  };
  const validHa = ha.trim() ? Number.isFinite(Number(ha)) && Number(ha) >= 0 : formKind === "general" || editWork?.harvestType === "Support";
  return <section className="wc-ticket-completion" aria-label={"Completion for " + ticketId}>
    <div className="wc-checkroll">Checkroll · {checkrollSummary(session).text}</div>
    {works.map((w) => <div className="wc-work" key={w.id}><ReportSummary work={w} />{canReport && latestReport(w)?.status !== "Reported" && !form ? <button className="text-button" aria-label={"Correct Ha " + w.id} onClick={() => open(w.origin === "primary" ? "primary" : w.id)}><RotateCcw size={12} /> Correct total</button> : null}</div>)}
    {canRecordJob && !form && !recordingJob ? <div className="wc-ticket-actions">
      {canReport && !secondaryOnly && !primary.reports.length ? <button className="button button-primary mw-wide" aria-label={"Report Ha " + ticketId} onClick={() => open("primary")}>Report completed Ha <ArrowRight size={13} /></button> : null}
      <button className="button mw-wide" aria-label={"Add secondary work " + ticketId} onClick={openJob}><Plus size={13} /> Add secondary job</button>
    </div> : null}
    {jobs.map((job) => <article className="wc-secondary-job" key={job.id} data-job={job.id}><strong>{job.id} · {activityName(job.activityCode)}</strong><p>{job.fieldNo} · {job.workerIds.length} workers{job.toGang ? " · T6 to Gang " + job.toGang : ""}</p><small>{job.note}</small><p>{job.reportWorkId ? "Ha reported separately" : job.areaRequired ? "Completed Ha pending" : "Non-area work"} · Checkroll pending</p>{canReport && !job.reportWorkId && !form && !recordingJob ? <button className="button button-small" aria-label={"Report secondary Ha " + job.id} onClick={() => reportJob(job.id)}>Report Ha</button> : null}</article>)}
    {recordingJob ? <div className="wc-report-form"><h4>Add secondary job</h4>
      <label className="mw-form-label"><span>Activity</span><select aria-label="Secondary job activity" value={jobCode} onChange={(e) => setJobCode(e.target.value)}>{activities.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label>
      <label className="mw-form-label"><span>Field</span><select aria-label="Secondary job field" value={jobField} onChange={(e) => setJobField(e.target.value)}>{fields.map((f) => <option key={f.fieldNo}>{f.fieldNo}</option>)}</select></label>
      <label className="mw-form-label"><span>Gang filter</span><select aria-label="Secondary job gang filter" value={jobGangFilter} onChange={(e) => setJobGangFilter(e.target.value)}><option value="">All present gangs</option>{gangs.map((g) => <option key={g} value={g}>Gang {g}</option>)}</select></label>
      <label className="mw-bulk-check"><input type="checkbox" aria-label="Secondary job select all shown" checked={presentWorkers.some((w) => !jobGangFilter || effectiveGang(session, w.id) === jobGangFilter) && presentWorkers.filter((w) => !jobGangFilter || effectiveGang(session, w.id) === jobGangFilter).every((w) => jobWorkers.includes(w.id))} onChange={(e) => { const ids = presentWorkers.filter((w) => !jobGangFilter || effectiveGang(session, w.id) === jobGangFilter).map((w) => w.id); setJobWorkers(e.target.checked ? [...new Set([...jobWorkers, ...ids])] : jobWorkers.filter((id) => !ids.includes(id))); }} />Select all shown</label>
      <div className="mw-worker-picker">{presentWorkers.filter((w) => !jobGangFilter || effectiveGang(session, w.id) === jobGangFilter).map((w) => <label key={w.id}><input type="checkbox" aria-label={"Secondary job worker " + w.id} checked={jobWorkers.includes(w.id)} onChange={() => setJobWorkers(jobWorkers.includes(w.id) ? jobWorkers.filter((id) => id !== w.id) : [...jobWorkers, w.id])} /><span><strong>{w.name}</strong><small>{w.id} · Gang {effectiveGang(session, w.id)}</small></span></label>)}</div>
      <label className="wc-confirm"><input type="checkbox" aria-label="Secondary job T6" checked={jobTransfer} onChange={(e) => { setJobTransfer(e.target.checked); setJobGang(""); }} /><span>Transfer gang for this secondary job</span></label>
      {jobTransfer ? <label className="mw-form-label"><span>Receiving gang</span><select aria-label="Secondary job receiving gang" value={jobGang} onChange={(e) => setJobGang(e.target.value)}><option value="">Choose gang</option>{gangs.filter((g) => !jobWorkers.some((id) => effectiveGang(session, id) === g)).map((g) => <option key={g} value={g}>Gang {g}</option>)}</select></label> : null}
      <label className="wc-confirm"><input type="checkbox" aria-label="Secondary job non-area" checked={jobNonArea} onChange={(e) => setJobNonArea(e.target.checked)} /><span>Non-area work · no Ha required</span></label>
      <label className="mw-form-label"><span>Job note / reason</span><textarea aria-label="Secondary job note" value={jobNote} onChange={(e) => setJobNote(e.target.value)} /></label>
      <p className="wc-note">Original work retained. Completed Ha and individual Checkroll details can follow.</p>
      <div className="wc-form-actions"><button className="button" onClick={() => setRecordingJob(false)}>Cancel</button><button className="button button-primary" disabled={!jobNote.trim() || jobTransfer && (!jobGang || !jobWorkers.length)} onClick={() => { if (onAction((latest) => recordSecondaryJob(latest, ticketId, { requestKey: jobRequestKey, activityCode: jobCode, fieldNo: jobField, workerIds: jobWorkers, toGang: jobTransfer ? jobGang : "", note: jobNote, nonArea: jobNonArea }, role), "Secondary job saved. Original work and Ha retained.")) setRecordingJob(false); }}>Save secondary job</button></div>
    </div> : null}
    {form ? <div className="wc-report-form">
      <h4>{form === "secondary" ? "Add secondary work" : editWork?.reports.length ? "Correct completed total" : "Report completed Ha"}</h4>
      {form === "secondary" ? <>
        <label className="mw-form-label"><span>Secondary activity</span><select disabled={!!jobId} aria-label="Secondary destination" value={same ? "same" : "different"} onChange={(e) => setSame(e.target.value === "same")}><option value="same">Same activity & field</option><option value="different">Different activity / field</option></select></label>
        {!same ? <>
          <label className="mw-form-label"><span>Activity</span><select disabled={!!jobId} aria-label="Secondary activity code" value={code} onChange={(e) => { setCode(e.target.value); setLink(""); }}>{activities.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label>
          <label className="mw-form-label"><span>Field</span><select disabled={!!jobId} aria-label="Secondary field" value={field} onChange={(e) => { setField(e.target.value); setLink(""); }}>{fields.map((f) => <option key={f.fieldNo}>{f.fieldNo}</option>)}</select></label>
          <label className="mw-form-label"><span>Progress destination</span><select aria-label="Secondary programme round" value={link} onChange={(e) => setLink(e.target.value)}><option value="">{code.startsWith("PH") ? "Harvesting interval (if field matches)" : "Unplanned · no programme credit"}</option>{options.map((o) => <option key={o.programmeId + o.round} value={o.programmeId + "|" + o.round}>{o.title} · R{o.round} · {o.year}</option>)}</select></label>
          {!link && !code.startsWith("PH") ? <label className="wc-confirm"><input type="checkbox" aria-label="Non-area General work" disabled={!!jobId} checked={nonArea} onChange={(e) => setNonArea(e.target.checked)} /><span>Non-area General work · Ha optional</span></label> : null}
        </> : <p className="wc-note">{primary.activityCode} · {primary.fieldNo}{primary.programmeRound ? " · R" + primary.programmeRound : ""}</p>}
        <label className="wc-confirm"><input type="checkbox" aria-label="Confirm additional work" checked={newArea} onChange={(e) => setNewArea(e.target.checked)} /><span>This is additional work. Any Ha entered covers new area, excluding area already reported.</span></label>
      </> : <p className="wc-note">{editWork?.reports.length ? "Enter the corrected total for this entry, including its previously reported Ha." : "Enter actual completed area for this ticket. Do not repeat it per worker."}</p>}
      <label className="mw-form-label"><span>{form === "secondary" ? "Additional completed Ha" : editWork?.reports.length ? "Corrected total Ha" : "Actual completed Ha"}{formKind === "general" ? " (optional)" : ""}</span><input type="number" aria-label="Completed hectares" min="0" step="0.01" value={ha} onChange={(e) => setHa(e.target.value)} /></label>
      <label className="mw-form-label"><span>Work status</span><select aria-label="Completion work status" value={finish} onChange={(e) => setFinish(e.target.value as HaInput["finish"])}><option>Finished</option><option>Partial</option></select></label>
      <label className="mw-form-label"><span>{editWork?.reports.length ? "Reason for correction" : "Remark (optional)"}</span><textarea aria-label="Ha report note" value={note} onChange={(e) => setNote(e.target.value)} /></label>
      <div className="wc-form-actions"><button className="button" onClick={() => setForm(null)}>Cancel</button><button className="button button-primary" disabled={!validHa || form === "secondary" && !newArea} onClick={submit}>Submit Ha <Check size={13} /></button></div>
    </div> : null}
  </section>;
}

export function CompletionReview({session,role,onAction}: {session:Session;role:PhoneRole;onAction:Action}) {
  const [category,setCategory]=useState<"activity"|"machine">("activity");
  return <div className="mc-m2-productivity"><div className="mc-category-tabs" role="group" aria-label="Productivity Ha category"><button aria-pressed={category==="activity"} onClick={()=>setCategory("activity")}>Activity Ha</button><button aria-pressed={category==="machine"} onClick={()=>setCategory("machine")}>Machine Ha</button></div>
    {category==="machine"?<MachineReview session={session} role={role} onAction={onAction}/>:<ActivityCompletionReview session={session} role={role} onAction={onAction}/>}
  </div>;
}
function ActivityCompletionReview({ session, role, onAction }: { session: Session; role: string; onAction: Action }) {
  const [notes,setNotes]=useState<Record<string,string>>({}),[areas,setAreas]=useState<Record<string,string>>({});
  const [showHistory,setShowHistory]=useState(role==="Store Clerk");
  const canReview=isManagement(role);
  if(!canReview&&role!=="Store Clerk") return <p className="wc-note">Productivity review is available to estate management.</p>;
  const pending=pendingReports(session).filter((w)=>w.date===session.plan.date);
  const visible=(showHistory?completionWorks(session).filter((w)=>w.date===session.plan.date):pending);
  return <section className="wc-review" aria-label="Productivity review">
    {!canReview?<p className="wc-note">View only</p>:null}
    <div className="wc-review-header"><h2>{showHistory?"All reports":"Pending reports"} <span>{visible.length}</span></h2><button className="text-button" aria-pressed={showHistory} onClick={()=>setShowHistory(!showHistory)}>{showHistory?"Pending only":"All reports"} <ChevronDown size={13}/></button></div>
    {!visible.length?<div className="wc-empty">{showHistory?"No productivity reported yet.":"No reports awaiting approval."}</div>:null}
    <div className="wc-review-list">{visible.map((w)=>{
      const r=latestReport(w)!,key=w.id+":"+r.id,areaText=areas[key]||"",area=areaText.trim()?Number(areaText):null;
      const validArea=!r.production || (area==null ? w.harvestType==="Support" : Number.isFinite(area)&&area>=0&&Math.round(area*100)/100===area);
      const issue=canReview&&r.status==="Reported"?validationIssue(session,w,r.production?area:undefined):"";
      return <article className="wc-review-card" key={w.id} data-work={w.id}>
        <header><div><strong>{w.activityCode} · {activityName(w.activityCode)}</strong><small>{w.ticketId} · {w.fieldNo?"Field "+w.fieldNo:"No field"}{w.programmeRound?" · R"+w.programmeRound:""}</small></div><span className={"wc-status wc-"+r.status.toLowerCase()}>{reportLabel(r.status)}</span></header>
        <div className="wc-review-values"><strong>{r.production?bunchTotal(r).toLocaleString()+" bunches":<Ha value={r.ha}/>}</strong><span>{r.finish==="Finished"?"Complete work":"Partial work"}</span></div>
        {r.production?<ProductionTasks report={r}/>:null}
        {w.plannedHa>0?<p className="wc-note">Planned: {formatHa(w.plannedHa)} ha</p>:null}
        {r.note?<p>{r.note}</p>:null}
        {r.production&&r.status==="Validated"?<p>Confirmed: <Ha value={r.ha}/></p>:null}
        <ReportHistory work={w}/>
        {issue?<p className="wc-error">{issue}</p>:null}
        {canReview&&r.status==="Reported"?<div className="wc-review-actions">
          {r.production?<label className="mw-form-label"><span>Confirmed completed Ha{w.harvestType==="Support"?" (optional)":""}</span><input type="number" min="0" step="0.01" aria-label={"FO completed Ha "+w.id} value={areaText} onChange={(e)=>setAreas({...areas,[key]:e.target.value})}/></label>:null}
          <label className="mw-form-label"><span>Remark / return reason</span><textarea aria-label={"FO note "+w.id} value={notes[key]||""} onChange={(e)=>setNotes({...notes,[key]:e.target.value})}/></label>
          <div className="wc-form-actions"><button className="button" disabled={!notes[key]?.trim()} onClick={()=>onAction((s)=>reviewWorkHa(s,w.id,r.id,"Returned",notes[key]||"",role),"Returned to Mandore for correction.")}>Return</button><button className="button button-primary" disabled={!validArea||!!issue} aria-label={"Approve productivity "+w.id} onClick={()=>onAction((s)=>reviewWorkHa(s,w.id,r.id,"Validated",notes[key]||"",role,r.production?area:undefined),"Productivity approved. Progress and Daily Work Summary updated.")}>Approve <Check size={13}/></button></div>
        </div>:null}
      </article>;
    })}</div>
  </section>;
}

export type FieldDraft = {
  edited?: boolean; ha: string; complete: boolean; note: string; gang: string;
  rows: { key: string; workerId: string; gang: string; task: string; bunches: string }[];
};
export function fieldDraft(work: CompletedWork): FieldDraft {
  const r=latestReport(work);
  return {ha:r?.ha==null?"":String(r.ha),complete:r?.finish==="Finished",note:r?.note||"",gang:r?.production?.rows[0]?.gang||"3",
    rows:r?.production?.rows.map((row,index)=>({...row,key:row.workerId+":"+index,bunches:String(row.bunches)}))||[]};
}
export function hasFieldEntry(draft: FieldDraft | undefined, work: CompletedWork) {
  return !!draft?.edited && (draft.complete || !!draft.note.trim() || (work.kind === "harvesting" ? draft.rows.some((row) => row.task.trim() || row.bunches.trim()) : !!draft.ha.trim()));
}
export function fieldInput(draft: FieldDraft, work: CompletedWork, requestKey: string): HaInput {
  if(work.kind!=="harvesting") {
    if(draft.ha.trim()&&!Number.isFinite(Number(draft.ha))) throw new Error("Enter valid completed hectares.");
    return {requestKey,ha:draft.ha.trim()?Number(draft.ha):null,finish:draft.complete?"Finished":"Partial",note:draft.note};
  }
  const entered=draft.rows.filter((row)=>row.task.trim()||row.bunches.trim());
  if(entered.some((row)=>!row.task.trim()||!row.bunches.trim())) throw new Error("Enter both task number and bunches for each started task.");
  return {requestKey,ha:null,finish:draft.complete?"Finished":"Partial",note:draft.note,
    production:{kind:"bunches",rows:entered.map((row)=>({workerId:row.workerId,gang:row.gang,task:row.task.trim(),bunches:Number(row.bunches)}))}};
}
export function FieldProduction({session,ticketId,draft,onChange,onHistory}: {session:Session;ticketId:string;draft:FieldDraft;onChange:(draft:FieldDraft)=>void;onHistory:()=>void}) {
  const work=primaryWork(session,ticketId),report=latestReport(work);
  const harvesting=work.kind==="harvesting";
  if(report?.status==="Reported") return <div className="production-sent"><span>Submitted · awaiting approval</span><button className="text-button" onClick={onHistory}>View report <ArrowRight size={12}/></button></div>;
  const patch=(changes:Partial<FieldDraft>)=>onChange({...draft,...changes,edited:draft.edited||Object.keys(changes).some((key)=>key!=="gang")});
  const updateTask=(workerId:string,key:string,changes:{task?:string;bunches?:string})=>{
    const previous=draft.rows.find((row)=>row.key===key);
    const row={key,workerId,gang:draft.gang,task:"",bunches:"",...previous,...changes};
    patch({rows:[...draft.rows.filter((entry)=>entry.key!==key),row]});
  };
  const pool=qcWorkers(session,draft.gang);
  return <div className="production-field-form">
    {report?<p className={"production-last-status "+(report.status==="Returned"?"is-returned":"")}>{reportLabel(report.status)}{report.reviewNote?" · "+report.reviewNote:""}</p>:null}
    {harvesting?<>
      <label className="mw-form-label"><span>Harvesting gang</span><select aria-label={"Harvesting gang "+work.fieldNo} value={draft.gang} onChange={(e)=>patch({gang:e.target.value})}>{harvestingGangs.map((g)=><option key={g} value={g}>Gang {g}</option>)}</select></label>
      <div className="production-qc-list">{pool.map((worker)=>{
        const entries=draft.rows.filter((row)=>row.workerId===worker.id&&row.gang===draft.gang);
        const rows=entries.length?entries:[{key:worker.id+":0",workerId:worker.id,gang:draft.gang,task:"",bunches:""}];
        return <div className="production-qc-worker" key={worker.id} data-qc={worker.id}><strong>{worker.name}</strong><small>{worker.id} · QC{morningView(session).attendance[worker.id]==="Present"?" · Clocked in":""}</small>
          {rows.map((row)=><div className="production-task-inputs" key={row.key}><label><span>Task no.</span><input aria-label={"Task "+work.fieldNo+" "+worker.id+" "+row.key} value={row.task} onChange={(e)=>updateTask(worker.id,row.key,{task:e.target.value})}/></label><label><span>Bunches</span><input type="number" inputMode="numeric" min="0" step="1" aria-label={"Bunches "+work.fieldNo+" "+worker.id+" "+row.key} value={row.bunches} onChange={(e)=>updateTask(worker.id,row.key,{bunches:e.target.value})}/></label><button className="icon-button" aria-label={"Remove task "+work.fieldNo+" "+row.key} onClick={()=>patch({rows:draft.rows.filter((entry)=>entry.key!==row.key)})}>×</button></div>)}
          <button className="text-button" onClick={()=>{const base=rows.filter((row)=>row.task||row.bunches);patch({rows:[...draft.rows.filter((row)=>row.workerId!==worker.id||row.gang!==draft.gang),...base,{key:worker.id+":"+Date.now(),workerId:worker.id,gang:draft.gang,task:"",bunches:""}]});}}><Plus size={11}/> Add task</button>
        </div>;
      })}</div>
      {!pool.length?<p className="wc-note">No QC workers in this working gang.</p>:null}
      <p className="production-field-total">{draft.rows.filter((row)=>row.task.trim()&&row.bunches.trim()).length} tasks · {draft.rows.reduce((n,row)=>n+(Number(row.bunches)||0),0).toLocaleString()} bunches across selected gangs</p>
    </>:<label className="mw-form-label"><span>Completed Ha{work.kind==="general"?" (optional)":""}</span><input type="number" inputMode="decimal" min="0" step="0.01" aria-label={"Completed Ha "+work.fieldNo} value={draft.ha} onChange={(e)=>patch({ha:e.target.value})}/></label>}
    <label className="wc-confirm"><input type="checkbox" aria-label={"Complete work "+work.fieldNo} checked={draft.complete} onChange={(e)=>patch({complete:e.target.checked})}/><span>Complete work</span></label>
    <label className="mw-form-label"><span>Remark (optional)</span><textarea aria-label={"Production remark "+work.fieldNo} value={draft.note} onChange={(e)=>patch({note:e.target.value})}/></label>
  </div>;
}
export function ProductivityReports({session,role,onAction,onWork}: {session:Session;role:PhoneRole;onAction:Action;onWork:()=>void}) {
  const fo=isManagement(role),readOnly=role==="Store Clerk",mandore=role==="Upkeep Mandor"||role==="Harvesting Mandor";
  const works=completionWorks(session).filter((w)=>w.date===session.plan.date&&w.recipient===role);
  const tickets=morningView(session).tickets.filter((t)=>fo||t.recipient===role);
  if(!fo&&!mandore&&!readOnly) return <p className="wc-note">Reports are available to the reporting Mandore and estate management.</p>;
  return <div className="productivity-reports">
    {fo||readOnly?<CompletionReview session={session} role={role} onAction={onAction}/>:<>
      <div className="mw-ticket-heading"><strong>{works.length}</strong><span>Your submitted reports</span></div>
      {!works.length?<div className="mw-empty"><h3>No submissions yet</h3><p>Report production from Work Listing.</p></div>:null}
      {works.map((w)=><article className="phone-card" key={w.id}><ReportSummary work={w}/>{latestReport(w)?.status!=="Reported"?<button className="text-button" onClick={onWork}>Open work to correct total <ArrowRight size={12}/></button>:null}</article>)}
    </>}
    {!readOnly&&tickets.length?<details className="production-secondary"><summary>Secondary work</summary>{tickets.map((ticket)=><details key={ticket.id}><summary>{ticket.id} · {activityName(morningView(session).items.find((item)=>item.id===ticket.itemId)!.activityCode)}</summary><TicketCompletion secondaryOnly session={session} ticketId={ticket.id} role={role} onAction={onAction}/></details>)}</details>:null}
  </div>;
}

export function CompletionFeedback({ session, kind, programmeId }: { session: Session; kind: "upkeep" | "harvesting"; programmeId?: string | null }) {
  const works = completionWorks(session).filter((w) => kind === "harvesting" ? w.kind === "harvesting" : programmeId ? w.programmeId === programmeId : w.kind !== "harvesting");
  if (!works.length) return null;
  const pending = works.filter((w) => latestReport(w)?.status === "Reported");
  const validated = works.reduce((n, w) => n + (validatedReport(w)?.ha || 0), 0);
  return <details className="wc-feedback"><summary><span><strong>{formatHa(validated)} ha validated</strong><span>{pending.length} reports awaiting validation · Checkroll pending</span></span><ChevronDown size={15} /></summary>
    {works.map((w) => <div key={w.id}><strong>{w.activityCode} · {w.fieldNo}{w.programmeRound ? " · R" + w.programmeRound : ""}</strong><span>Validated: <Ha value={validatedReport(w)?.ha ?? 0} />{latestReport(w)?.status === "Reported" ? " · Reported total: " + (latestReport(w)!.production ? bunchTotal(latestReport(w)).toLocaleString() + " bunches; Ha awaiting FO" : latestReport(w)!.ha == null ? "non-area work" : formatHa(latestReport(w)!.ha!) + " ha") + " (pending)" : ""}</span><small>{progressDestination(w)}</small></div>)}
  </details>;
}

