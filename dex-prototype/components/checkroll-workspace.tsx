"use client";

import { useState, type DragEvent } from "react";
import { ArrowLeft, Check, ChevronDown, Plus, Search, Users, X } from "lucide-react";
import { activities, activityName, fields, formatDate, formatHa, gangs, gangDescription, workerName, type Session } from "@/lib/workshop";
import { effectiveGang } from "@/lib/morning-work";
import { validatedReport } from "@/lib/work-completion";
import {
  approvedCheckrollWork, assignCheckrollWorkers, checkrollGang, checkrollIssues, checkrollRates, checkrollSummary, defaultPayment, paymentMethods, presentPool,
  refreshCheckrollGangs, removeCheckrollRow, saveCheckrollDraft, submitCheckroll, updateCheckrollRow, type CheckrollRow, type PaymentMethod,
} from "@/lib/checkroll";

type Action = (action: (latest:Session) => Session, message?:string) => boolean;
const paymentLabel = (method:PaymentMethod) => paymentMethods.find((item) => item.id===method)!.label;
const workerMime = "application/x-dex-checkroll-workers";

export function CheckrollWorkspace({session,role,onAction,onAttendance,onBack}: {session:Session;role:string;onAction:Action;onAttendance?:()=>void;onBack?:()=>void}) {
  const [query,setQuery]=useState(""),[gang,setGang]=useState(""),[method,setMethod]=useState<"all"|PaymentMethod>("all");
  const [selected,setSelected]=useState<string[]>([]),[open,setOpen]=useState<Record<string,boolean>>({}),[fieldOpen,setFieldOpen]=useState<Record<string,boolean>>({});
  const [over,setOver]=useState(""),[notice,setNotice]=useState("");
  const summary=checkrollSummary(session),day=summary.day,work=approvedCheckrollWork(session),pool=presentPool(session),issues=checkrollIssues(session);
  const canEdit=["Field Officer","Assistant Manager","Manager"].includes(role);
  const shown=pool.filter((worker)=>(!gang||effectiveGang(session,worker.id)===gang)&&(method==="all"||defaultPayment(session,worker.id)===method)&&(worker.name+" "+worker.id).toLowerCase().includes(query.trim().toLowerCase()));
  const groups=work.reduce<Array<{key:string;code:string;items:typeof work}>>((all,item)=>{
    const key=item.kind+":"+item.activityCode,previous=all.find((group)=>group.key===key);
    if(previous)previous.items.push(item);else all.push({key,code:item.activityCode,items:[item]});
    return all;
  },[]);
  const assign=(workId:string,ids:string[])=>{
    if(onAction((s)=>assignCheckrollWorkers(s,workId,ids,role),"Workers allocated to the completed field.")) {
      setSelected([]);setFieldOpen((previous)=>({...previous,[workId]:true}));setNotice("");
    }
  };
  const drop=(event:DragEvent,workId:string)=>{
    event.preventDefault();setOver("");
    try {const ids=JSON.parse(event.dataTransfer.getData(workerMime));if(!Array.isArray(ids)||ids.some((id)=>typeof id!=="string"))throw Error();assign(workId,ids);}
    catch {setNotice("Select workers from the present-worker panel.");}
  };
  const patch=(row:CheckrollRow,changes:Parameters<typeof updateCheckrollRow>[2])=>onAction((s)=>updateCheckrollRow(s,row.id,changes,role));
  const toggleWorker=(id:string)=>setSelected((previous)=>previous.includes(id)?previous.filter((value)=>value!==id):[...previous,id]);
  if(!canEdit) return <p className="wc-note">Checkroll input is available to estate management.</p>;
  return <section className="checkroll-workspace" aria-label="Checkroll workspace">
    {onBack?<button className="mw-back" onClick={onBack}><ArrowLeft size={13}/> Productivity</button>:null}
    <header className="cr-heading"><div><p className="eyebrow">M2 · CHECKROLL</p><h1>Checkroll input</h1><p>{formatDate(session.plan.date,true)} · {summary.text}</p></div><div className="cr-heading-actions"><button className="button" onClick={()=>onAction((s)=>saveCheckrollDraft(s,role),"Checkroll draft saved.")}>Save draft</button><button className="button button-primary" disabled={!!issues.length} onClick={()=>onAction((s)=>submitCheckroll(s,role,"CR:"+s.plan.date+":"+s.sequence+":"+Date.now()),"Checkroll submitted for this workshop.")}>Submit Checkroll <Check size={13}/></button></div></header>
    <div className="cr-tabs" role="group" aria-label="Checkroll payment method">{([{id:"all",label:"All"},...paymentMethods] as const).map((item)=><button key={item.id} aria-pressed={method===item.id} onClick={()=>{setMethod(item.id);setSelected([]);}}>{item.label}<span>{item.id==="all"?pool.length:pool.filter((worker)=>defaultPayment(session,worker.id)===item.id).length}</span></button>)}</div>
    <p className="cr-assumption">Payment defaults are workshop assumptions and can be changed per allocation.</p>
    {notice?<p className="cr-alert" role="status">{notice}</p>:null}
    <div className="cr-layout">
      <aside className="cr-pool panel" aria-label="Present worker pool">
        <header><div><span className="eyebrow">PRESENT WORKERS</span><h2>Worker pool <span>{pool.length}</span></h2></div><Users size={19}/></header>
        <label className="mw-search"><Search size={14}/><input aria-label="Search Checkroll workers" placeholder="Worker name or ID" value={query} onChange={(e)=>{setQuery(e.target.value);setSelected([]);}}/></label>
        <label className="mw-form-label"><span>Working gang</span><select aria-label="Checkroll gang filter" value={gang} onChange={(e)=>{setGang(e.target.value);setSelected([]);}}><option value="">All present gangs</option>{gangs.filter((g)=>pool.some((worker)=>effectiveGang(session,worker.id)===g)).map((g)=><option key={g} value={g}>Gang {g} · {gangDescription(g)}</option>)}</select></label>
        <label className="cr-select-shown"><input type="checkbox" aria-label="Select shown Checkroll workers" checked={shown.length>0&&shown.every((worker)=>selected.includes(worker.id))} onChange={(e)=>setSelected(e.target.checked?[...new Set([...selected,...shown.map((worker)=>worker.id)])]:selected.filter((id)=>!shown.some((worker)=>worker.id===id)))}/> Select shown ({shown.length})</label>
        <div className="cr-worker-list">{[...new Set(shown.map((worker)=>effectiveGang(session,worker.id)))].map((g)=><section key={g}><h3>Gang {g}</h3>{shown.filter((worker)=>effectiveGang(session,worker.id)===g).map((worker)=>{
          const allocated=day.rows.filter((row)=>row.workerId===worker.id).length;
          return <label className={"cr-worker "+(selected.includes(worker.id)?"is-selected":"")} key={worker.id} data-cr-worker={worker.id} draggable onDragStart={(event)=>{const ids=selected.includes(worker.id)?selected:[worker.id];event.dataTransfer.setData(workerMime,JSON.stringify(ids));event.dataTransfer.effectAllowed="copy";}}><input type="checkbox" aria-label={"Select Checkroll worker "+worker.id} checked={selected.includes(worker.id)} onChange={()=>toggleWorker(worker.id)}/><span><strong>{worker.name}</strong><small>{worker.id}{effectiveGang(session,worker.id)!==worker.gang?" · T6 from "+worker.gang:""}</small><small>{paymentLabel(defaultPayment(session,worker.id))} · {allocated?allocated+" field allocations":"Unallocated"}</small></span><span className="cr-drag-handle" aria-hidden="true">⠿</span></label>;
        })}</section>)}</div>
        {!shown.length?<p className="cr-empty">No present workers match.</p>:null}
        <footer>{selected.length} selected · {summary.remaining} present workers unallocated{onAttendance?<button className="text-button" onClick={onAttendance}>Review attendance</button>:null}</footer>
      </aside>
      <div className="cr-programmes" aria-label="Completed work allocation"><div className="cr-board-heading"><h2>Completed activities <span>{groups.length}</span></h2><small>Approved work</small></div>
        {groups.map((group)=><article className="cr-programme panel" key={group.key} data-cr-activity={group.code}>
          <button className="cr-programme-toggle" aria-label={"Show Checkroll activity "+group.code} aria-expanded={!!open[group.key]} onClick={()=>setOpen((previous)=>({...previous,[group.key]:!previous[group.key]}))}><span><strong>{group.code} · {activityName(group.code)}</strong><small>{group.items.length} completed field records · {day.rows.filter((row)=>group.items.some((item)=>item.id===row.workId)).length} worker allocations</small></span><ChevronDown size={17}/></button>
          {open[group.key]?<div className="cr-fields">{group.items.map((item)=>{
            const report=validatedReport(item)!,allRows=day.rows.filter((row)=>row.workId===item.id),rows=allRows.filter((row)=>method==="all"||row.method===method);
            return <section className="cr-field" key={item.id} data-cr-work={item.id}>
              <button className="cr-field-toggle" aria-label={"Show Checkroll field "+item.id} aria-expanded={!!fieldOpen[item.id]} onClick={()=>setFieldOpen((previous)=>({...previous,[item.id]:!previous[item.id]}))}><span><strong>{item.fieldNo||"No field specified"}</strong><small>{report.ha==null?"Non-area work":formatHa(report.ha)+" completed ha"} · {item.origin==="secondary"?"Secondary work · ":""}{allRows.length} workers</small></span><ChevronDown size={14}/></button>
              <div className={"cr-dropzone "+(over===item.id?"is-over":"")} onDragOver={(event)=>{event.preventDefault();event.dataTransfer.dropEffect="copy";setOver(item.id);}} onDragLeave={()=>setOver("")} onDrop={(event)=>drop(event,item.id)} aria-label={"Allocate workers to "+item.id}><span>Drop workers here</span><button className="button button-small" disabled={!selected.length} aria-label={"Allocate selected to "+item.id} onClick={()=>assign(item.id,selected)}><Plus size={12}/> Add selected ({selected.length})</button></div>
              {fieldOpen[item.id]?<div className="cr-allocations">{rows.map((row)=>{
                const missing=issues.some((issue)=>issue.startsWith(workerName(row.workerId)+":")),present=pool.some((worker)=>worker.id===row.workerId);
                return <article className={"cr-allocation "+(missing?"needs-input":"")} key={row.id} data-cr-row={row.id}><header><div><strong>{workerName(row.workerId)}</strong><small>{row.workerId} · Gang {row.gang}{!present?" · Not clocked in":""}</small></div>{row.source==="manual"?<button className="icon-button" aria-label={"Remove Checkroll allocation "+row.id} onClick={()=>onAction((s)=>removeCheckrollRow(s,row.id,role))}><X size={14}/></button>:<span className="cr-prefilled">Prefilled</span>}</header>
                  <label className="mw-form-label"><span>Payment method</span><select aria-label={"Payment method "+row.id} value={row.method} onChange={(e)=>patch(row,{method:e.target.value as PaymentMethod})}>{paymentMethods.map((item)=><option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
                  {row.method==="daily"?<div className="cr-row-inputs"><label className="mw-form-label"><span>Secondary activity</span><select aria-label={"Secondary activity "+row.id} value={row.secondaryActivity} onChange={(e)=>patch(row,{secondaryActivity:e.target.value,secondaryField:e.target.value?row.secondaryField:""})}><option value="">None</option>{activities.map((activity)=><option key={activity.code} value={activity.code}>{activity.code} · {activity.name}</option>)}</select></label><label className="mw-form-label"><span>OT hours</span><input aria-label={"OT hours "+row.id} type="number" min="0" max="24" step="0.25" value={row.otHours} onChange={(e)=>patch(row,{otHours:e.target.value})}/></label>{row.secondaryActivity?<label className="mw-form-label"><span>Secondary field (optional)</span><select aria-label={"Secondary field "+row.id} value={row.secondaryField} onChange={(e)=>patch(row,{secondaryField:e.target.value})}><option value="">No field specified</option>{fields.map((field)=><option key={field.fieldNo}>{field.fieldNo}</option>)}</select></label>:null}</div>:row.method==="piece"?<div className="cr-row-inputs"><label className="mw-form-label"><span>Quantity</span><input aria-label={"Piece quantity "+row.id} type="number" min="0" step="any" value={row.quantity} onChange={(e)=>patch(row,{quantity:e.target.value})}/></label><label className="mw-form-label"><span>Rate type</span><select aria-label={"Piece rate "+row.id} value={row.rateCode} onChange={(e)=>patch(row,{rateCode:e.target.value})}><option value="">Choose rate type</option>{checkrollRates.filter((rate)=>rate.unit!=="Daily").map((rate)=><option key={rate.code} value={rate.code}>{rate.code} · {rate.unit} · {rate.value}</option>)}</select></label></div>:row.source==="productivity"?<div className="cr-bunches"><strong>{row.bunches?.toLocaleString()} bunches</strong><small>From approved productivity</small>{row.tasks?.map((task,index)=><p key={index}>Gang {task.gang} · Task {task.task}<span>{task.bunches.toLocaleString()}</span></p>)}</div>:<p className="cr-alert">No approved bunch records for this worker and field. Choose another payment method if applicable.</p>}
                  <details className="cr-row-remark"><summary>Remark (optional)</summary><textarea aria-label={"Checkroll remark "+row.id} value={row.note} onChange={(e)=>patch(row,{note:e.target.value})}/></details>
                </article>;
              })}{!rows.length?<p className="cr-empty">{allRows.length?"Allocations are in another payment tab.":"Add present workers to this field."}</p>:null}</div>:null}
            </section>;
          })}</div>:null}
        </article>)}
        {!work.length?<div className="panel cr-empty"><h3>No approved completed work yet</h3><p>Completed activities appear after FO approves productivity.</p></div>:null}
      </div>
    </div>
    <footer className="cr-status-footer"><span>{summary.workers} workers allocated · {summary.remaining} present workers unallocated · {summary.unallocatedWork} completed fields unallocated</span>
      {day.rows.some((row)=>row.gang!==checkrollGang(session,row.workId,row.workerId))?<button className="text-button" onClick={()=>onAction((s)=>refreshCheckrollGangs(s,role),"Working gangs refreshed.")}>Refresh working gangs</button>:null}
      {issues.length?<details className="cr-missing"><summary>{issues.length} input checks · {issues[0]}</summary>{issues.slice(1).map((issue)=><p key={issue}>{issue}</p>)}</details>:null}
    </footer>
    <CheckrollHistory session={session}/>
  </section>;
}

export function CheckrollHistory({session}: {session:Session}) {
  const day=checkrollSummary(session).day;
  return day.submissions.length?<details className="cr-history"><summary>Submission history ({day.submissions.length})</summary>{day.submissions.toReversed().map((submission)=><article key={submission.revision}><strong>V{submission.revision} · {submission.actor}</strong><small>{new Date(submission.submittedAt).toLocaleString("en-MY")}</small><CheckrollReadRows session={session} rows={submission.rows}/></article>)}</details>:null;
}
function CheckrollReadRows({session,rows}: {session:Session;rows:CheckrollRow[]}) {
  return <div className="reference-table-scroll"><table className="reference-table"><thead><tr><th>Worker / gang</th><th>Activity / field</th><th>Payment</th><th>Details</th></tr></thead><tbody>{rows.map((row)=>{
    const work=approvedCheckrollWork(session).find((item)=>item.id===row.workId);
    return <tr key={row.id}><td><strong>{workerName(row.workerId)}</strong><small>{row.workerId} · Gang {row.gang}</small></td><td>{work?.activityCode} · {work?.fieldNo||"No field"}</td><td>{paymentLabel(row.method)}</td><td>{row.method==="daily"?<>{row.secondaryActivity||"No secondary activity"}{row.secondaryField?" · "+row.secondaryField:""} · {row.otHours} OT hours</>:row.method==="piece"?<>{row.quantity||"—"} · {row.rateCode||"Rate pending"}</>:<>{row.bunches??"—"} bunches{row.tasks?.map((task,index)=><small key={index}>Task {task.task} · {task.bunches}</small>)}</>}{row.note?<small>{row.note}</small>:null}</td></tr>;
  })}</tbody></table></div>;
}
export function CheckrollReferenceDetails({session}: {session:Session}) {
  const summary=checkrollSummary(session);
  return <><div className="reference-section-heading"><div><h3>Checkroll input</h3><p>{summary.text}</p></div></div>
    {summary.changed?<p className="cr-alert">Attendance, approved work or Checkroll input has changed since the last submission.</p>:null}
    {summary.day.rows.length?<CheckrollReadRows session={session} rows={summary.day.rows}/>:<p className="reference-note">No Checkroll allocations recorded.</p>}
    <CheckrollHistory session={session}/>
  </>;
}
