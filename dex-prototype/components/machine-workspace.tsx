"use client";

import NextImage from "next/image";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardList, Clock3, MapPin, Navigation, Pause, Play, Search, Square, Tractor, TriangleAlert } from "lucide-react";
import { MachineMap } from "@/components/machine-map";
import {
  acceptMachineJob, addMachineIssue, approveMachineReports, breakMachineJob, defaultMachineCheck, endMachineJob,
  isMachineRole, latestMachineReport, machineElapsed, machineJobLabel, machineJobs, machineOperators, machinePickupItems,
  machineProgress, machineScenario, machineTrackedHa, machineUnread, openMachineJob, prepareMachineJob,
  resumeMachineJob, startMachineJob, submitMachineReport, type MachineActor, type MachineCheck, type MachineJob, type MachinePoint,
} from "@/lib/machine";
import { activityName, formatDate, formatHa, isManagement, materials, stocks, workerName, type PhoneRole, type Session } from "@/lib/workshop";

type Action = (action: (latest: Session) => Session, message?: string) => boolean;
type Props = { session: Session; role: PhoneRole; onAction: Action; platform?: "phone" | "web"; selectedDriver?:string; onDriver?:(id:string)=>void };
const timeLabel=(seconds:number)=>Math.floor(seconds/3600)+"h "+String(Math.floor(seconds/60)%60).padStart(2,"0")+"m "+String(Math.floor(seconds)%60).padStart(2,"0")+"s";
const materialName=(code:string)=>materials.find((m)=>m.code===code)?.name||code;
const unit=(code:string,store:string)=>stocks.find((m)=>m.materialCode===code&&m.storageLocation===store)?.unit||"";
function useMachineTime() {
  const [at,setAt]=useState(()=>Date.now());
  useEffect(()=>{const id=window.setInterval(()=>setAt(Date.now()),1000);return()=>window.clearInterval(id);},[]);
  return at;
}
function Status({job}: {job:MachineJob}) {
  const report=latestMachineReport(job);
  return <span className={"mc-status "+(report?.status==="Approved"?"mc-status-approved":job.phase==="Breakdown"||job.check?.status==="Breakdown"?"mc-status-breakdown":["Running","Ready"].includes(job.phase)?"mc-status-operating":"mc-status-pending")}>{report?.status||machineJobLabel(job)}</span>;
}
function Empty({children}: {children:React.ReactNode}) {return <div className="mc-empty"><Tractor size={28}/><p>{children}</p></div>;}
function MachineDetails({session,job,full=false}: {session:Session;job:MachineJob;full?:boolean}) {
  const check=job.check,pickups=machinePickupItems(session,job),times=machineElapsed(job);
  return <div className="mc-details">
    <dl className="mc-reference"><div><dt>Driver</dt><dd>{workerName(job.driverId)}<small>{job.role}</small></dd></div><div><dt>Field / EVIT</dt><dd>{job.item.fieldNo||"—"} · {job.evitCode}</dd></div><div><dt>Planned Ha</dt><dd>{formatHa(job.item.targetHa)} ha</dd></div>
      <div><dt>Material</dt><dd>{job.item.materialCode?materialName(job.item.materialCode)+" · "+formatHa(job.item.materialQuantity)+" "+unit(job.item.materialCode,job.item.storageLocation):"No material required"}{job.item.storageLocation?<small>Store {job.item.storageLocation}</small>:null}</dd></div>
      {job.item.remark?<div><dt>Instruction</dt><dd>{job.item.remark}</dd></div>:null}
    </dl>
    {full&&check?<><div className="mc-metrics"><span><strong>{timeLabel(times.operating)}</strong>Operating</span><span><strong>{timeLabel(times.downtime)}</strong>Downtime</span><span><strong>{formatHa(check.fuelLitres)} L</strong>Fuel issued</span></div>
      <details className="mc-detail-disclosure"><summary>Checklist & material collection <ChevronDown size={13}/></summary><dl className="mc-reference"><div><dt>Machine status</dt><dd>{check.status}{check.reason?" · "+check.reason:""}</dd></div>{check.status==="Operating"?<div><dt>IPS battery &gt;13V</dt><dd>{check.ips}</dd></div>:null}{check.remark?<div><dt>Remark</dt><dd>{check.remark}</dd></div>:null}</dl>
        {check.status==="Operating"?<div className="mc-check-readonly">{machineScenario.checklist.map((item)=><div key={item.key}><span>{item.label}</span><strong className={check.items[item.key]==="Kurang"?"mc-warning-text":""}>{check.items[item.key]}</strong></div>)}</div>:null}
        <p className="mc-note">Material collection</p>{check.pickupIds.length?check.pickupIds.map((id)=>{const movement=pickups.find((p)=>p.id===id);return <p className="mc-pickup-reference" key={id}>{movement?materialName(movement.materialCode)+" · "+formatHa(movement.quantity)+" "+unit(movement.materialCode,movement.store)+" · "+movement.store:"Warehouse issue "+id}<small>{id}</small></p>;}):<p className="mc-note">No issued materials collected for this job.</p>}
      </details></>:null}
    {full&&job.issues.length?<details className="mc-detail-disclosure"><summary>Issue pins ({job.issues.length}) <ChevronDown size={13}/></summary>{job.issues.map((issue,index)=><div className="mc-issue-record" key={issue.id}><strong>{index+1}. {issue.category}</strong><small>{new Date(issue.at).toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit"})}</small>{issue.remark?<p>{issue.remark}</p>:null}{issue.photo?<NextImage unoptimized src={issue.photo} alt={issue.category+" issue photo"} width="160" height="120"/>:null}</div>)}</details>:null}
    {full&&job.breakdowns.length?<details className="mc-detail-disclosure"><summary>Breakdowns ({job.breakdowns.length}) <ChevronDown size={13}/></summary>{job.breakdowns.map((b,i)=><p key={i}><strong>{b.component}</strong> · {b.remark||"No remark"}<small>{new Date(b.start).toLocaleTimeString("en-MY")} → {b.end?new Date(b.end).toLocaleTimeString("en-MY"):"Ongoing"}</small></p>)}</details>:null}
  </div>;
}
function Preparation({session,job,actor,onAction,onTracking}: {session:Session;job:MachineJob;actor:MachineActor;onAction:Action;onTracking:()=>void}) {
  const [check,setCheck]=useState<MachineCheck>(()=>structuredClone(job.check||defaultMachineCheck()));
  const [step,setStep]=useState<"check"|"fuel">("check"),[editing,setEditing]=useState(false);
  const patch=(part:Partial<MachineCheck>)=>setCheck({...check,...part});
  const pickups=machinePickupItems(session,job),ready=job.phase==="Ready"&&!editing;
  const carried=machineScenario.openIssues.filter((issue)=>issue.evitCode===job.evitCode);
  if(ready)return <div className="mc-preparation">
    <div className="mc-confirmed"><span><Check size={20}/></span><h3>Ready to start</h3><p>{job.evitCode} · {formatDate(job.date,true)}</p></div>
    <div className="mc-ready-summary"><div><span>IPS battery &gt;13V</span><strong>{job.check!.ips}</strong></div><div><span>Items Baik</span><strong>{Object.values(job.check!.items).filter((v)=>v==="Baik").length} / 20</strong></div><div><span>Items Kurang</span><strong>{Object.values(job.check!.items).filter((v)=>v==="Kurang").length}</strong></div><div><span>Fuel issued</span><strong>{formatHa(job.check!.fuelLitres)} L</strong></div><div><span>Material collections</span><strong>{job.check!.pickupIds.length}</strong></div></div>
    <button className="button button-primary mc-wide" onClick={()=>{if(onAction((s)=>startMachineJob(s,job.id,actor),"Tracking started · simulated estate route."))onTracking();}}>Start Tracking <Navigation size={14}/></button>
    <button className="text-button" onClick={()=>{setCheck(structuredClone(job.check!));setEditing(true);setStep("check");}}>Edit preparation</button>
  </div>;
  return <div className="mc-preparation">
    <h3>{step==="check"?"Declare status & checklist":"Fuel & material collection"}</h3>
    {carried.map((issue)=><div className="mc-carried-issue" key={issue.component}><TriangleAlert size={15}/><span><strong>Open issue from a previous day</strong>{issue.component} · {formatDate(issue.date,true)}</span></div>)}
    {step==="check"?<>
      <span className="mc-field-label">Machine status — before it moves</span>
      <div className="mc-choice" role="group" aria-label="Machine pre-start status"><button aria-pressed={check.status==="Operating"} onClick={()=>patch({status:"Operating",reason:""})}>Operating</button><button aria-pressed={check.status!=="Operating"} onClick={()=>patch({status:"Idling",reason:""})}>Not operating</button></div>
      {check.status!=="Operating"?<>
        <div className="mc-choice" role="group" aria-label="Not operating reason type">{(["Idling","Breakdown"] as const).map((v)=><button key={v} className={v==="Breakdown"?"mc-danger-choice":""} aria-pressed={check.status===v} onClick={()=>patch({status:v,reason:""})}>{v}</button>)}</div>
        <label className="mw-form-label"><span>{check.status==="Breakdown"?"Breakdown component":"Idling reason"}</span><select aria-label="Machine non-operating reason" value={check.reason} onChange={(e)=>patch({reason:e.target.value})}><option value="">Select {check.status==="Breakdown"?"component":"reason"}</option>{(check.status==="Breakdown"?machineScenario.damageComponents:machineScenario.idleReasons).map((v)=><option key={v}>{v}</option>)}</select></label>
      </>:<>
        <span className="mc-field-label">IPS battery &gt;13V</span><div className="mc-choice" role="group" aria-label="IPS battery greater than 13V">{(["Yes","No"] as const).map((v)=><button key={v} aria-pressed={check.ips===v} onClick={()=>patch({ips:v})}>{v}</button>)}</div>
        <div className="mc-checklist-heading"><strong>PMV checklist</strong><small>20 items · tap Kurang where needed</small></div>
        <div className="mc-checklist">{machineScenario.checklist.map((item)=><div key={item.key}><span>{item.label}</span><div>{(["Baik","Kurang"] as const).map((v)=><button key={v} aria-label={item.label+" "+v} aria-pressed={check.items[item.key]===v} onClick={()=>patch({items:{...check.items,[item.key]:v}})}>{v}</button>)}</div></div>)}</div>
      </>}
      <label className="mw-form-label"><span>Remark (optional)</span><textarea aria-label="Machine checklist remark" value={check.remark} onChange={(e)=>patch({remark:e.target.value})}/></label>
      {check.status==="Operating"?<button className="button button-primary mc-wide" disabled={!check.ips} onClick={()=>setStep("fuel")}>Confirm checklist <ArrowRight size={13}/></button>:<button className="button button-primary mc-wide" disabled={!check.reason} onClick={()=>onAction((s)=>prepareMachineJob(s,job.id,check,actor),"Job closed · "+check.status+". Available in M2 Productivity.")}>Close job & submit <Check size={14}/></button>}
    </>:<>
      <label className="mw-form-label"><span>Fuel issued (litres)</span><input type="number" inputMode="decimal" min="0" step=".01" aria-label="Machine fuel issued litres" value={check.fuelLitres} onChange={(e)=>patch({fuelLitres:e.target.value===""?0:Number(e.target.value)})}/></label>
      <div className="mc-pickup-list"><strong>Pick up issued materials</strong><p className="mc-note">Confirm the Warehouse items collected for this field.</p>{pickups.length?pickups.map((movement)=><label key={movement.id}><input type="checkbox" aria-label={"Collect warehouse issue "+movement.id} checked={check.pickupIds.includes(movement.id)} onChange={(e)=>patch({pickupIds:e.target.checked?[...check.pickupIds,movement.id]:check.pickupIds.filter((id)=>id!==movement.id)})}/><span>{materialName(movement.materialCode)}<small>{formatHa(movement.availableQuantity)} {unit(movement.materialCode,movement.store)} · {movement.store} · {movement.id}</small></span></label>):<p className="mc-note">{job.item.materialCode?"No Warehouse issue posted yet.":"No materials required."}</p>}</div>
      <div className="mc-actions"><button className="button" onClick={()=>setStep("check")}><ArrowLeft size={13}/>Checklist</button><button className="button button-primary" disabled={!Number.isFinite(check.fuelLitres)||check.fuelLitres<0} onClick={()=>{if(onAction((s)=>prepareMachineJob(s,job.id,check,actor),"Machine preparation saved."))setEditing(false);}}>Review summary <ArrowRight size={13}/></button></div>
    </>}
  </div>;
}
function CompletionForm({job,actor,onAction}: {job:MachineJob;actor:MachineActor;onAction:Action}) {
  const latest=latestMachineReport(job),[editing,setEditing]=useState(job.phase==="Ended"),[ha,setHa]=useState(latest?String(latest.declaredHa):""),[remark,setRemark]=useState(latest?.remark||"");
  if(!editing)return <div className="mc-completion-reference"><div><strong>{formatHa(latest?.declaredHa||0)} machine ha</strong><Status job={job}/></div>{latest?.remark?<p>{latest.remark}</p>:null}<button className="text-button" onClick={()=>{setHa(String(latest?.declaredHa||0));setRemark(latest?.remark||"");setEditing(true);}}>Edit my completion</button></div>;
  const value=ha.trim()?Number(ha):NaN,nonOperating=job.check?.status!=="Operating";
  return <div className="mc-completion-form"><h3>{latest?"Edit my completion":"Work summary"}</h3><div className="mc-ready-summary"><div><span>GPS Ha reference</span><strong>{formatHa(job.trackedHa||0)} ha</strong></div><div><span>Operating</span><strong>{timeLabel(machineElapsed(job).operating)}</strong></div><div><span>Downtime</span><strong>{timeLabel(machineElapsed(job).downtime)}</strong></div></div>
    <p className="mc-note">GPS Ha is simulated. Your declared Ha is recorded separately as Machine Ha.</p>
    <label className="mw-form-label"><span>Declared machine Ha</span><input type="number" inputMode="decimal" min="0" step=".01" aria-label="Declared machine Ha" disabled={nonOperating} value={nonOperating?"0":ha} onChange={(e)=>setHa(e.target.value)}/></label>
    <label className="mw-form-label"><span>Remark (optional)</span><textarea aria-label="Machine completion remark" value={remark} onChange={(e)=>setRemark(e.target.value)}/></label>
    <div className="mc-actions">{latest?<button className="button" onClick={()=>setEditing(false)}>Cancel</button>:null}<button className="button button-primary" disabled={!nonOperating&&(!Number.isFinite(value)||value<0)} onClick={()=>{if(onAction((s)=>submitMachineReport(s,job.id,nonOperating?0:value,remark,actor,latest?.revision||0),"Machine completion submitted for M2 approval."))setEditing(false);}}>Submit completion <Check size={14}/></button></div>
  </div>;
}
async function photoData(file:File):Promise<string> {
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Choose a JPEG, PNG or WebP photo.");
  const url=URL.createObjectURL(file);
  try {
    const image=new Image();image.src=url;await image.decode();const scale=Math.min(1,720/Math.max(image.width,image.height));
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));canvas.getContext("2d")!.drawImage(image,0,0,canvas.width,canvas.height);
    const result=canvas.toDataURL("image/jpeg",.6);if(result.length>450000)throw new Error("This photo is too large. Choose a smaller image.");return result;
  } finally {URL.revokeObjectURL(url);}
}
function Tracking({job,actor,onAction,onEnd,at}: {job:MachineJob;actor?:MachineActor;onAction:Action;onEnd:()=>void;at:number}) {
  const [panel,setPanel]=useState<"pin"|"breakdown"|null>(null),[category,setCategory]=useState(""),[remark,setRemark]=useState(""),[component,setComponent]=useState(""),[photo,setPhoto]=useState(""),[photoError,setPhotoError]=useState(""),[loading,setLoading]=useState(false);
  const progress=machineProgress(job,at),[position,setPosition]=useState<MachinePoint|null>(null),elapsed=machineElapsed(job,at);
  const own=!!actor&&actor.workerId===job.driverId&&actor.role===job.role;
  return <div className="mc-tracking">
    <div className="mc-tracking-heading"><div><strong>{job.evitCode} · {job.item.fieldNo}</strong><small>{activityName(job.item.activityCode)} · {workerName(job.driverId)}</small></div><Status job={job}/></div>
    <div className="mc-tracking-stats"><div><Clock3 size={13}/><span><strong>{timeLabel(elapsed.operating)}</strong>Operating</span></div><div><strong>{formatHa(machineTrackedHa(job,at))} ha</strong><small>GPS reference · {formatHa(job.item.targetHa)} planned</small></div>{job.phase==="Breakdown"?<div className="mc-downtime"><Pause size={13}/><span><strong>{timeLabel(elapsed.downtime)}</strong>Downtime</span></div>:null}</div>
    <MachineMap job={job} progress={progress} picking={panel==="pin"} position={position||undefined} onPosition={setPosition}/>
    {own&&panel==="pin"?<section className="mc-inline-form" aria-label="Pin machine issue"><h3>Pin an issue</h3><p className="mc-note">Tap the map to adjust the pin location.</p><label className="mw-form-label"><span>Issue category</span><select aria-label="Machine issue category" value={category} onChange={(e)=>setCategory(e.target.value)}><option value="">Choose category</option>{machineScenario.issueCategories.map((v)=><option key={v}>{v}</option>)}</select></label>
      <label className="mw-form-label"><span>Photo (optional)</span><input type="file" accept="image/jpeg,image/png,image/webp" aria-label="Machine issue photo" onChange={async(e)=>{const file=e.target.files?.[0];if(!file)return;setLoading(true);setPhotoError("");try{setPhoto(await photoData(file));}catch(error){setPhotoError(error instanceof Error?error.message:"Photo could not be loaded.");}finally{setLoading(false);}}}/></label>
      {photo?<NextImage unoptimized src={photo} alt="Issue photo preview" width="160" height="120" className="mc-photo-preview"/>:null}{photoError?<p role="alert" className="wc-error">{photoError}</p>:null}<label className="mw-form-label"><span>Remark (optional)</span><textarea aria-label="Machine issue remark" value={remark} onChange={(e)=>setRemark(e.target.value)}/></label>
      <div className="mc-actions"><button className="button" onClick={()=>setPanel(null)}>Cancel</button><button className="button button-primary" disabled={!category||!position||loading} onClick={()=>{if(onAction((s)=>addMachineIssue(s,job.id,{category,remark,position:position!,...(photo?{photo}:{})},actor!),"Issue pinned. Tracking continues.")){setPanel(null);setPhoto("");}}}>Save pin <MapPin size={13}/></button></div>
    </section>:own&&panel==="breakdown"?<section className="mc-inline-form" aria-label="Declare machine breakdown"><h3>Declare breakdown</h3><label className="mw-form-label"><span>Breakdown component</span><select aria-label="Tracking breakdown component" value={component} onChange={(e)=>setComponent(e.target.value)}><option value="">Choose component</option>{machineScenario.damageComponents.map((v)=><option key={v}>{v}</option>)}</select></label><label className="mw-form-label"><span>Remark (optional)</span><textarea aria-label="Tracking breakdown remark" value={remark} onChange={(e)=>setRemark(e.target.value)}/></label><div className="mc-actions"><button className="button" onClick={()=>setPanel(null)}>Cancel</button><button className="button mc-danger" disabled={!component} onClick={()=>{if(onAction((s)=>breakMachineJob(s,job.id,component,remark,actor!),"Operating time paused. Downtime started."))setPanel(null);}}>Confirm breakdown</button></div></section>:null}
    {own&&!panel?<div className="mc-tracking-actions">{job.phase==="Running"?<div className="mc-actions"><button className="button mc-pin-button" onClick={()=>{setPanel("pin");setCategory("");setRemark("");setPhoto("");setPhotoError("");setPosition(null);}}><MapPin size={14}/>Pin issue</button><button className="button mc-danger" onClick={()=>{setComponent("");setRemark("");setPanel("breakdown");}}><TriangleAlert size={14}/>Breakdown</button></div>:job.phase==="Breakdown"?<><p className="mc-breakdown-banner"><Pause size={14}/>Tracking paused · {job.breakdowns.at(-1)?.component}</p><button className="button button-primary mc-wide" onClick={()=>onAction((s)=>resumeMachineJob(s,job.id,actor!),"Repair recorded. Tracking resumed.")}><Play size={14}/>Resume after repair</button></>:null}
      <button className="button mc-stop mc-wide" onClick={()=>{if(onAction((s)=>endMachineJob(s,job.id,actor!),"Tracking ended. Enter your completed Machine Ha."))onEnd();}}><Square size={14}/>End work</button></div>:null}
  </div>;
}
function MachineProductivity({session,role,onAction,review=false,date}: {session:Session;role:PhoneRole;onAction:Action;review?:boolean;date?:string}) {
  const [expanded,setExpanded]=useState<Record<string,boolean>>({}),[selected,setSelected]=useState<string[]>([]),[status,setStatus]=useState("all"),[query,setQuery]=useState("");
  const jobs=machineJobs(session).filter((j)=>j.reports.length&&(!date||j.date===date));
  const shown=jobs.filter((j)=>(status==="all"||latestMachineReport(j)?.status===status)&&(workerName(j.driverId)+" "+j.evitCode+" "+j.item.fieldNo+" "+j.item.activityCode).toLowerCase().includes(query.trim().toLowerCase()));
  const canReview=review&&isManagement(role),canSelect=isManagement(role);
  const selectedJobs=shown.filter((j)=>selected.includes(j.id+":"+latestMachineReport(j)!.revision)&&(!review||latestMachineReport(j)?.status==="Pending approval"));
  const total=selectedJobs.reduce((n,j)=>n+latestMachineReport(j)!.declaredHa,0),pending=jobs.filter((j)=>latestMachineReport(j)?.status==="Pending approval").length;
  return <section className="mc-productivity" aria-label={review?"Machine productivity review":"Machine productivity view only"}>
    <div className="mc-productivity-heading"><div><h3>{review?"Machine Ha":"Machine productivity"}</h3><p>{jobs.length} reports · {pending} pending approval</p></div><span className="mc-view-only">{canReview?"Approve in M2":"View only"}</span></div>
    <div className="mc-report-filters"><label className="mw-search"><Search size={13}/><input aria-label="Search machine reports" placeholder="Driver, EVIT or field" value={query} onChange={(e)=>setQuery(e.target.value)}/></label><select aria-label="Machine approval status filter" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="all">All statuses</option><option>Pending approval</option><option>Approved</option></select></div>
    {canSelect?<div className="mc-selection-summary"><div><small>{selectedJobs.length} selected</small><strong>{formatHa(total)} machine ha</strong></div>{canReview?<button className="button button-primary button-small" disabled={!selectedJobs.length} onClick={()=>{if(onAction((s)=>approveMachineReports(s,selectedJobs.map((j)=>({id:j.id,revision:latestMachineReport(j)!.revision})),role),"Machine reports approved. Activity Ha remains separate."))setSelected([]);}}>Approve selected <Check size={13}/></button>:null}</div>:null}
    <p className="mc-note">Machine Ha is separate from Activity Ha. Only approved Activity Ha updates Work Programme.</p>
    {!shown.length?<Empty>No machine reports {query||status!=="all"?"match these filters.":"submitted yet."}</Empty>:null}
    <div className="mc-report-list">{shown.map((job)=>{
      const report=latestMachineReport(job)!,key=job.id+":"+report.revision;
      return <article key={job.id} className="mc-report-card" data-machine-report={job.id}>
        <header>{canSelect&&(!review||report.status==="Pending approval")?<input type="checkbox" aria-label={"Select machine report "+job.evitCode+" "+job.item.fieldNo+" "+job.driverId} checked={selected.includes(key)} onChange={(e)=>setSelected(e.target.checked?[...selected,key]:selected.filter((id)=>id!==key))}/>:null}
          <button className="mc-report-toggle" aria-label={"View machine report "+job.evitCode+" "+job.item.fieldNo+" "+job.driverId} aria-expanded={!!expanded[job.id]} onClick={()=>setExpanded({...expanded,[job.id]:!expanded[job.id]})}><strong>{job.item.activityCode} · {activityName(job.item.activityCode)}</strong><small>{workerName(job.driverId)} · {job.evitCode} · {job.item.fieldNo}</small><span>{formatHa(report.declaredHa)} machine ha · {formatDate(job.date,true)}</span></button><ChevronDown size={14}/></header>
        <div className="mc-report-status"><Status job={job}/>{report.approvedBy?<small>{report.approvedBy} · {formatDate(report.approvedAt!.slice(0,10),true)}</small>:null}</div>
        {expanded[job.id]?<div className="mc-report-body"><MachineMap compact job={job} progress={job.routeProgress||0}/><MachineDetails session={session} job={job} full/><div className="mc-ready-summary"><div><span>GPS Ha reference</span><strong>{formatHa(job.trackedHa||0)} ha</strong></div><div><span>Declared machine Ha</span><strong>{formatHa(report.declaredHa)} ha</strong></div></div>{report.remark?<p>{report.remark}</p>:null}{job.reports.length>1?<details className="mc-detail-disclosure"><summary>Earlier submissions ({job.reports.length-1})</summary>{job.reports.slice(0,-1).map((r)=><p key={r.revision}>V{r.revision} · {formatHa(r.declaredHa)} ha · {r.status}<small>{r.remark}</small></p>)}</details>:null}</div>:null}
      </article>;
    })}</div>
  </section>;
}
export function MachineReview({session,role,onAction}: {session:Session;role:PhoneRole;onAction:Action}) {
  return <MachineProductivity session={session} role={role} onAction={onAction} review date={session.plan.date}/>;
}
export function MachineWorkspace({session,role,onAction,platform="phone",selectedDriver,onDriver}:Props) {
  const [tab,setTab]=useState<"listing"|"tracking"|"productivity">("listing"),[date,setDate]=useState(session.plan.date),[query,setQuery]=useState(""),[driver,setDriver]=useState(""),[expanded,setExpanded]=useState<string|null>(null),[trackingId,setTrackingId]=useState("");
  const at=useMachineTime(),operator=isMachineRole(role),management=isManagement(role),allowed=operator||management||role==="Store Clerk";
  const options=machineOperators(session,operator?role:undefined),chosenDriver=selectedDriver??driver,driverId=operator?(options.some((o)=>o.id===chosenDriver)?chosenDriver:options[0]?.id||""):"";
  const actor=operator?{role,workerId:driverId}:undefined;
  const all=machineJobs(session),mine=all.filter((j)=>!operator||j.role===role&&j.driverId===driverId);
  const jobs=mine.filter((j)=>j.date===date&&(j.item.activityCode+" "+activityName(j.item.activityCode)+" "+j.item.fieldNo+" "+j.evitCode+" "+workerName(j.driverId)).toLowerCase().includes(query.trim().toLowerCase()));
  const active=mine.filter((j)=>["Running","Breakdown"].includes(j.phase)),tracking=active.find((j)=>j.id===trackingId)||active[0];
  const unread=machineUnread(session,role,driverId||undefined);
  if(!allowed)return <Empty>Machine System is unavailable for this role.</Empty>;
  const openJob=(job:MachineJob)=>{
    if(expanded===job.id){setExpanded(null);return;}
    if(operator&&actor&&!job.openedAt&&!onAction((s)=>openMachineJob(s,job.id,actor)))return;
    setExpanded(job.id);
  };
  const navigate=(next:typeof tab)=>{setTab(next);};
  return <div className={"machine-workspace mc-"+platform}>
    <div className="phone-content mc-content">
      <div className="mc-page-heading"><div><p className="eyebrow">M3 · MACHINE SYSTEM</p><h2>{tab==="listing"?"Work Listing":tab==="tracking"?"Tracking":"Productivity"}</h2></div>{!operator?<span className="mc-view-only">View only</span>:null}</div>
      {operator?<label className="mc-driver-selector"><span>Viewing driver</span><select aria-label="Machine operator identity" value={driverId} onChange={(e)=>{if(onDriver)onDriver(e.target.value);else setDriver(e.target.value);setExpanded(null);setTrackingId("");}}>{!options.length?<option value="">No EVIT assignments yet</option>:options.map((o)=><option key={o.id} value={o.id}>{o.name} · {o.evits.join(", ")}</option>)}</select></label>:null}
      {tab==="listing"?<>
        <div className="mc-list-filters"><label><span>Work date</span><input type="date" aria-label="Machine work date" value={date} onChange={(e)=>{setDate(e.target.value);setExpanded(null);}}/></label><label className="mw-search"><Search size={13}/><input aria-label="Search machine tickets" placeholder="Activity, field or EVIT" value={query} onChange={(e)=>setQuery(e.target.value)}/></label></div>
        {!jobs.length?<Empty>{operator?"Tickets appear after attendance is submitted, EVIT is assigned and the work instruction is accepted.":"No machine tickets for this date. Assign EVIT to a clocked-in driver in M2."}</Empty>:null}
        <div className="mc-job-list">{jobs.map((job)=>{
          const own=operator&&job.driverId===driverId&&job.role===role,open=expanded===job.id;
          return <article className={"mc-job-card "+(open?"mc-job-open":"")} key={job.id} data-machine-job={job.id}>
            <button className="mc-job-toggle" aria-label={"Open machine ticket "+job.evitCode+" "+job.item.fieldNo} aria-expanded={open} onClick={()=>openJob(job)}><div><strong>{job.item.activityCode} · {activityName(job.item.activityCode)}</strong><span>{job.item.fieldNo} · {job.evitCode} · {formatHa(job.item.targetHa)} planned ha</span></div><ChevronDown size={14}/></button>
            <div className="mc-job-subline"><span>{operator?machineJobLabel(job):workerName(job.driverId)}</span>{job.phase==="Pending"&&!job.openedAt?<b className="production-new-tag">New</b>:null}<Status job={job}/></div>
            {open?<div className="mc-job-body"><MachineDetails session={session} job={job}/>
              {own&&job.phase==="Pending"?<button className="button button-primary mc-wide" onClick={()=>onAction((s)=>acceptMachineJob(s,job.id,actor!),"Machine job accepted. Declare machine status next.")}>Accept job <Check size={14}/></button>:null}
              {own&&["Accepted","Ready"].includes(job.phase)?<Preparation key={job.id} session={session} job={job} actor={actor!} onAction={onAction} onTracking={()=>{setTrackingId(job.id);setTab("tracking");}}/>:null}
              {["Running","Breakdown"].includes(job.phase)?<button className="button button-primary mc-wide" onClick={()=>{setTrackingId(job.id);setTab("tracking");}}>Open Tracking <Navigation size={14}/></button>:null}
              {own&&["Ended","Submitted","Approved"].includes(job.phase)?<CompletionForm key={job.id+":"+job.phase} job={job} actor={actor!} onAction={onAction}/>:null}
              {!own&&job.reports.length?<button className="text-button" onClick={()=>setTab("productivity")}>View productivity <ArrowRight size={13}/></button>:null}
            </div>:null}
          </article>;
        })}</div>
      </>:tab==="tracking"?<>
        {active.length>1?<label className="mw-form-label"><span>Active machine</span><select aria-label="Tracking machine job" value={tracking?.id||""} onChange={(e)=>setTrackingId(e.target.value)}>{active.map((j)=><option key={j.id} value={j.id}>{j.evitCode} · {j.item.fieldNo} · {workerName(j.driverId)}</option>)}</select></label>:null}
        {tracking?<Tracking key={tracking.id} job={tracking} actor={actor} onAction={onAction} at={at} onEnd={()=>{setDate(tracking.date);setExpanded(tracking.id);setTab("listing");}}/>:<><Empty>No machine tracking is active.</Empty><button className="button mc-wide" onClick={()=>setTab("listing")}>Go to Work Listing <ArrowRight size={13}/></button></>}
      </>:<MachineProductivity session={session} role={role} onAction={onAction}/>}
    </div>
    <nav className={platform==="phone"?"phone-bottom-nav mc-bottom-nav":"mc-web-tabs"} aria-label="Machine navigation">{([{id:"listing",label:"Work Listing",icon:ClipboardList},{id:"tracking",label:"Tracking",icon:Navigation},{id:"productivity",label:"Productivity",icon:Check}] as const).map(({id,label,icon:Icon})=><button key={id} className={tab===id?"active":""} onClick={()=>navigate(id)}><span className="phone-nav-icon"><Icon size={18}/>{id==="listing"&&unread>0?<span className="work-alert-badge" aria-label={unread+" new machine tickets"}>{unread}</span>:null}</span><span>{label}</span></button>)}</nav>
  </div>;
}
