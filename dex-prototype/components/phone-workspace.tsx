"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ChevronDown, ClipboardList, Clock3, Plus, Search, X } from "lucide-react";
import { assignClockMachine } from "@/lib/morning-work";
import { driverAssignmentLocked, type MachineRole } from "@/lib/machine";
import { CheckrollWorkspace, CheckrollReferenceDetails } from "@/components/checkroll-workspace";
import { FieldProduction, ProductivityReports, fieldDraft, fieldInput, hasFieldEntry, type FieldDraft } from "@/components/work-completion";
import { programmesForSession, latestReport, primaryWork, submitFieldReports } from "@/lib/work-completion";
import { nextRound } from "@/lib/work-programme";
import {
  activities, activityGroupKey, createSession, dailyRecords, fieldMachines, fieldProgress, fields, formatDate, formatHa,
  gangs, gangDescription, machines, materials, openDailyRecord, peopleActivityIssues, planIssues, programmeGroups, stocks, stores,
  stockFor, workKind, isManagement, type PhoneRole, type PlanItem, type Session,
} from "@/lib/workshop";
import {
  acceptDailyWork, openMandoreWork, attendanceReady, attendanceSummary, clockWorker, clockWorkers, createWorkDraft, effectiveGang, hasNewSharedPlan,
  morningEditable, morningSession, morningView, receiveSharedPlan, saveAttendance, saveDailyWorkChanges, submitDailyWork,
  transferAttendanceGang, type DailyChoice,
} from "@/lib/morning-work";
import { HARVEST_ACTIVITY, harvestFieldNames } from "@/lib/harvesting-interval";
import { workers } from "@/lib/workshop";

export type PhoneTab = "listing" | "clock" | "tickets";
type Action = (action: (latest: Session) => Session, message?: string) => boolean;
type Props = { session: Session; role: PhoneRole; tab: PhoneTab; onTab: (tab: PhoneTab) => void; onAction: Action };
const kindNames = { upkeep:"Upkeep",harvesting:"Harvesting",general:"Other work" };
const toggle = (ids: string[], id: string) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids,id];
const unitFor = (i: PlanItem) => stocks.find((s) => s.materialCode === i.materialCode && s.storageLocation === i.storageLocation)?.unit || "";
const fieldLabel = (i: PlanItem) => i.fieldNo || "No field specified";

/** Shared compact planning rows on web and phone. */
export function WorkRows({ session, items, canEdit, onPatch, onRemove, onCode, lockedIds=[] }: {
  session: Session; items: PlanItem[]; canEdit: boolean; onPatch: (id: string, patch: Partial<PlanItem>) => void;
  lockedIds?:string[]; onRemove?: (id: string) => void; onCode?: (key: string, code: string) => void;
}) {
  return <div className="simple-work-rows">{items.map((item) => {
    const optional = workKind(item) === "general", progress = fieldProgress(session,item);
    const tooltip = progress ? (progress.completed == null ? "Field area: " + formatHa(progress.total) : formatHa(progress.completed) + " / " + formatHa(progress.total)) + " ha" : undefined;
    return <div className={"simple-work-row " + (optional && onCode ? "with-activity-code" : "")} key={item.id} data-item={item.id}>
      {optional && onCode ? <label className="simple-row-code"><span>Activity code *</span><select aria-label={"Activity code " + item.id} disabled={!canEdit||lockedIds.includes(item.id)} value={item.activityCode} onChange={(e) => onCode(activityGroupKey(item),e.target.value)}><option value="">Select activity</option>{activities.map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label> : null}
      <label className="simple-row-field" title={tooltip}><span>Field{optional ? " (optional)" : ""}</span>{optional ? <select aria-label={"Field " + item.id} value={item.fieldNo} disabled={!canEdit||lockedIds.includes(item.id)} onChange={(e) => onPatch(item.id,{fieldNo:e.target.value})}><option value="">—</option>{fields.map((f) => <option key={f.fieldNo} value={f.fieldNo}>{f.fieldNo}</option>)}</select> : <strong>{item.fieldNo}</strong>}{progress && item.programmeId && progress.completed != null ? <span className="field-mini-status" aria-label={"Field progress " + item.id} title={progress.label}><small>{formatHa(progress.completed)} / {formatHa(progress.total)} ha</small><span role="progressbar" aria-label={"Programme completion for field " + item.fieldNo} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.percent)}><i style={{width:progress.percent+"%"}} /></span></span> : null}</label>
      <label className="simple-row-ha"><span>Planned Ha{optional || item.harvestType === "Support" ? " (optional)" : " *"}</span><input aria-label={"Planned Ha " + item.id} disabled={!canEdit||lockedIds.includes(item.id)} type="number" min="0" step="0.01" placeholder="—" value={item.targetHa || ""} onChange={(e) => onPatch(item.id,{targetHa:Number(e.target.value)})} /></label>
      <label className="simple-row-evit"><span>EVIT (optional)</span><select aria-label={"EVIT " + item.id} disabled={!canEdit||lockedIds.includes(item.id)} value={item.evitCode} onChange={(e) => onPatch(item.id,{evitCode:e.target.value})}><option value="">—</option>{machines.map((m) => <option key={m.code} value={m.code} disabled={m.pmvStatus === "breakdown" || m.planningAvailability !== "available"}>{m.code} · {m.name} · {m.pmvStatus} · {m.planningAvailability}</option>)}</select></label>
      <label className="simple-row-remark"><span>Remark (optional)</span><input aria-label={"Remark " + item.id} disabled={!canEdit||lockedIds.includes(item.id)} placeholder="—" value={item.remark || ""} onChange={(e) => onPatch(item.id,{remark:e.target.value})} /></label>
      {onRemove ? <button className="icon-button simple-row-remove" aria-label={"Remove work row " + item.id} disabled={!canEdit||lockedIds.includes(item.id)} onClick={() => onRemove(item.id)}><X size={14} /></button> : null}
    </div>;
  })}</div>;
}
export function WorkMaterials({ session, items, canEdit, onPatch }: { session: Session; items: PlanItem[]; canEdit: boolean; onPatch: (id: string,patch: Partial<PlanItem>) => void }) {
  return <div className="simple-materials">{items.map((i) => {
    const stock = stockFor(i,session);
    return <section className="simple-material-row" key={i.id}><strong>{i.activityCode} · {fieldLabel(i)}</strong>
      <label><span>Material</span><select aria-label={"Material " + i.id} disabled={!canEdit} value={i.materialCode} onChange={(e) => onPatch(i.id,{materialCode:e.target.value,materialQuantity:e.target.value ? i.materialQuantity : 0})}><option value="">No material required</option>{materials.map((m) => <option key={m.code} value={m.code}>{m.code} · {m.name}</option>)}</select></label>
      <div className="simple-material-inputs"><label><span>Store</span><select aria-label={"Store " + i.id} disabled={!canEdit || !i.materialCode} value={i.storageLocation} onChange={(e) => onPatch(i.id,{storageLocation:e.target.value})}>{stores.map((s) => <option key={s.code} value={s.code}>{s.code} · {s.name}</option>)}</select></label><label><span>Requested quantity {unitFor(i) ? "(" + unitFor(i) + ")" : ""}</span><input aria-label={"Material quantity " + i.id} type="number" min="0" step="0.01" disabled={!canEdit || !i.materialCode} value={i.materialQuantity || ""} placeholder="—" onChange={(e) => onPatch(i.id,{materialQuantity:Number(e.target.value)})} /></label></div>
      {i.materialCode ? <small className={stock && i.materialQuantity > stock.availableQuantity ? "simple-stock-low" : ""}>{stock ? "Available: " + formatHa(stock.availableQuantity) + " " + stock.unit + (i.materialQuantity > stock.availableQuantity ? " · Request exceeds availability" : "") : "Balance not supplied for this store"} · Illustrative stock</small> : null}
    </section>;
  })}</div>;
}

export function WorkComposer({ session, date, editing, onCancel, onSubmit, backLabel="Work Listing" }: { session: Session; date: string; editing?: PlanItem[]; backLabel?:string; onCancel: () => void; onSubmit: (draft: Session) => void }) {
  const programmes = programmesForSession(session);
  const first = editing?.[0];
  const [kind,setKind] = useState<DailyChoice["kind"]>(first ? workKind(first) : "upkeep");
  const [programme,setProgramme] = useState(first?.programmeId || (first ? "" : programmes[0]?.id || ""));
  const [code,setCode] = useState(first?.activityCode || programmes[0]?.activityCode || "");
  const [harvestType,setHarvestType] = useState<"FFB"|"LF"|"Support">(first?.harvestType || "FFB");
  const [selected,setSelected] = useState<string[]>(editing?.map((i) => i.fieldNo).filter(Boolean) || []);
  const [search,setSearch] = useState(""),[step,setStep] = useState<"work"|"materials">("work"),[error,setError]=useState("");
  const [draft,setDraft] = useState<Session>(() => { const blank = createSession("blank"); return { ...blank,plan:{...blank.plan,date,items:editing ? structuredClone(editing) : []} }; });
  const selectedProgramme = programmes.find((p) => p.id === programme);
  const available = kind === "upkeep" && selectedProgramme ? selectedProgramme.fields.filter((f) => nextRound(f)).map((f) => f.fieldNo) : kind === "harvesting" ? harvestFieldNames : fields.map((f) => f.fieldNo);
  const rebuild = (nextKind: DailyChoice["kind"], nextProgramme: string,nextCode: string,nextFields: string[],nextHarvest = harvestType) => {
    setError("");
    if (!nextCode || nextKind !== "general" && !nextFields.length) { setDraft((d) => ({...d,plan:{...d.plan,items:[]}})); return; }
    try {
      const next = createWorkDraft(session,{kind:nextKind,programmeId:nextProgramme,activityCode:nextCode,fields:nextFields,harvestType:nextCode === "PH4008" ? "Support" : nextHarvest},date);
      next.plan.items = next.plan.items.map((i) => { const previous = draft.plan.items.find((p) => p.fieldNo === i.fieldNo); return previous ? { ...i,targetHa:previous.targetHa,evitCode:previous.evitCode,remark:previous.remark,materialCode:previous.materialCode,materialQuantity:previous.materialQuantity,storageLocation:previous.storageLocation } : i; });
      setDraft(next);
    } catch(e) { setError(e instanceof Error ? e.message : "Check the work details."); }
  };
  const patch = (id: string,values: Partial<PlanItem>) => setDraft((d) => ({...d,plan:{...d.plan,items:d.plan.items.map((i) => i.id === id ? {...i,...values}:i)}}));
  const changeCode = (newCode: string) => {
    setCode(newCode);
    if (editing) setDraft((d) => ({...d,plan:{...d.plan,items:d.plan.items.map((i) => newCode === first!.activityCode ? {...i,...Object.fromEntries(["programmeId","programmeRound","programmeYear","planningSource","groupId","workCategory","harvestType"].map((key) => [key,editing.find((row) => row.id === i.id)?.[key as keyof PlanItem]])),activityCode:newCode} : {...i,activityCode:newCode,programmeId:null,programmeRound:undefined,programmeYear:undefined,planningSource:kind === "general" ? "general" : "daily-work",workCategory:kind,groupId:(kind === "general" ? "general:changed:" : "daily:changed:") + newCode})}}));
    else rebuild(kind,programme,newCode,selected);
  };
  const issues = step === "work" ? peopleActivityIssues(draft) : planIssues(draft);
  return <section className="simple-composer" aria-label={editing ? "Edit work programme" : "New work programme"}>
    <button className="mw-back" onClick={onCancel}><ArrowLeft size={14} /> {backLabel}</button><h3>{editing ? "Edit work programme" : "Add work programme"}</h3><p className="simple-form-date">{formatDate(date,true)}</p>
    <div className="mw-resource-tabs" role="group" aria-label="Work programme form steps"><button aria-pressed={step === "work"} onClick={() => setStep("work")}>Work details</button><button aria-pressed={step === "materials"} disabled={!!peopleActivityIssues(draft).length} onClick={() => setStep("materials")}>Materials</button></div>
    {step === "work" ? <>
      {!editing ? <div className="mw-kind-switch" role="group" aria-label="New work type">{(["upkeep","harvesting","general"] as const).map((k) => <button key={k} aria-pressed={kind === k} onClick={() => { const p = k === "upkeep" ? programmes[0] : undefined; const c = p?.activityCode || (k === "harvesting" ? HARVEST_ACTIVITY : "");setKind(k);setProgramme(p?.id || "");setCode(c);setSelected([]);rebuild(k,p?.id || "",c,[]); }}>{kindNames[k]}</button>)}</div> : null}
      {!editing && kind === "upkeep" ? <label className="mw-form-label"><span>Work Programme</span><select aria-label="New work programme source" value={programme} onChange={(e) => { const p=programmes.find((p) => p.id===e.target.value);setProgramme(e.target.value);setCode(p?.activityCode || "");setSelected([]);rebuild(kind,e.target.value,p?.activityCode || "",[]); }}><option value="">Other upkeep activity</option>{programmes.map((p) => <option key={p.id} value={p.id}>{p.activityCode} · {p.title}</option>)}</select></label> : null}
      <label className="mw-form-label"><span>Activity code *</span><select aria-label="Work programme activity code" disabled={!editing && !!programme} value={code} onChange={(e) => changeCode(e.target.value)}><option value="">Select activity</option>{activities.filter((a) => programme && !editing ? a.code === code : kind === "harvesting" ? a.code.startsWith("PH") : kind === "upkeep" ? !a.code.startsWith("PH") : true).map((a) => <option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label>
      {!editing && kind === "harvesting" ? <label className="mw-form-label"><span>Harvesting work</span><select aria-label="Harvesting work type" value={code === "PH4008" ? "Support" : harvestType} onChange={(e) => {const type=e.target.value as typeof harvestType;setHarvestType(type);rebuild(kind,"",code,selected,type);}}><option value="FFB">FFB harvesting</option><option value="LF">Loose fruit</option><option value="Support">Harvesting support</option></select></label> : null}
      {!editing ? <details className="simple-field-select" open={selected.length === 0 && kind !== "general"}><summary>{kind === "general" ? "Fields (optional)" : "Select fields *"} <span>{selected.length} selected</span></summary><label className="mw-search"><Search size={13} /><input aria-label="Find work programme field" value={search} placeholder="Find field" onChange={(e) => setSearch(e.target.value)} /></label><div className="mw-field-picker">{available.filter((f) => f.toLowerCase().includes(search.toLowerCase())).map((f) => <label key={f}><input type="checkbox" aria-label={"Select work field " + f} checked={selected.includes(f)} onChange={() => {const next=toggle(selected,f);setSelected(next);rebuild(kind,programme,code,next);}} /><strong>{f}</strong></label>)}</div></details> : null}
      <WorkRows session={{...draft,completions:session.completions}} items={draft.plan.items} canEdit={true} onPatch={patch} />
      {error ? <p className="wc-error">{error}</p> : null}<p className="simple-form-note">{issues[0] || "Work details ready."}</p>
      <button className="button button-primary mw-wide" disabled={!!issues.length} onClick={() => setStep("materials")}>Continue to Materials</button>
    </> : <><WorkMaterials session={session} items={draft.plan.items} canEdit={true} onPatch={patch} /><p className="simple-form-note">{issues[0] || "Review the material requirements, then submit."}</p><button className="button mw-wide" onClick={() => setStep("work")}>Back to work details</button><button className="button button-primary mw-wide" disabled={!!issues.length} onClick={() => onSubmit(draft)}>{editing ? "Save changes" : "Submit work programme"} <Check size={14} /></button></>}
  </section>;
}

export function PhoneWorkspace({session,role,tab,onTab,onAction:commitAction}: Props) {
  const fo=isManagement(role),readOnly=role==="Store Clerk",mandor=role==="Upkeep Mandor"||role==="Harvesting Mandor";
  const onAction:Action=(action,message)=>readOnly?false:commitAction(action,message);
  const [listingDate,setListingDate]=useState(session.plan.date),[search,setSearch]=useState(""),[gang,setGang]=useState("");
  const [expanded,setExpanded]=useState<Record<string,boolean>>({}),[selected,setSelected]=useState<string[]>([]);
  const [fieldExpanded,setFieldExpanded]=useState<Record<string,boolean>>({}),[drafts,setDrafts]=useState<Record<string,FieldDraft>>({});
  const [checkroll,setCheckroll]=useState(false);
  const [composer,setComposer]=useState<{date:string;itemIds?:string[]}|null>(null);
  const [t6WorkerId,setT6WorkerId]=useState<string|null>(null),[t6Gang,setT6Gang]=useState("");
  const [machineWorkerId,setMachineWorkerId]=useState<string|null>(null),[driverEvit,setDriverEvit]=useState(""),[driverRole,setDriverRole]=useState<MachineRole>("Machine Operator");
  const [attendanceResult,setAttendanceResult]=useState<ReturnType<typeof attendanceSummary>|null>(null);
  const content=useRef<HTMLDivElement>(null),origin=useRef<HTMLButtonElement|null>(null),scroll=useRef(0),dialog=useRef<HTMLElement>(null);
  const overlay=!!t6WorkerId||!!machineWorkerId||!!attendanceResult;
  useEffect(()=>{if(overlay)dialog.current?.querySelector<HTMLElement>("select,button")?.focus({preventScroll:true});},[overlay]);
  useEffect(()=>{content.current?.scrollTo(0,0);},[tab,composer]);
  const records=dailyRecords(session),record=records.find((r)=>r.plan.date===listingDate);
  const listingSession=record ? {...session,...record,morning:record.morning} : null;
  const displaySession=readOnly&&listingSession?listingSession:session;
  const morning=morningView(displaySession),editable=!readOnly&&morningEditable(displaySession);
  const listingMorning=listingSession ? morningView(listingSession) : null;
  const listingView=listingSession ? morningSession(listingSession) : null;
  const visibleListing=listingView&&mandor ? {...listingView,plan:{...listingView.plan,items:listingView.plan.items.filter((item)=>listingMorning?.tickets.some((ticket)=>ticket.itemId===item.id&&ticket.recipient===role))}} : listingView;
  const cards=visibleListing ? programmeGroups(visibleListing).reduce<Array<{key:string;title:string;code:string;items:PlanItem[]}>>((all,g)=>{
    const key=g.kind+":"+g.activityCode;
    const previous=all.find((c)=>c.key===key);
    if(previous)previous.items.push(...g.items);else all.push({key,title:g.title,code:g.activityCode,items:[...g.items]});
    return all;
  },[]) : [];
  const shownCards=cards.filter((c)=>(c.code+" "+c.title+" "+c.items.map((i)=>i.fieldNo+" "+(i.remark||"")).join(" ")).toLowerCase().includes(search.toLowerCase().trim()));
  const selectedIds=shownCards.filter((c)=>selected.includes(c.key)).flatMap((c)=>c.items.filter((i)=>!listingMorning?.tickets.some((t)=>t.itemId===i.id)).map((i)=>i.id));
  const scopeGangs=mandor ? gangs.filter((g)=>role === "Upkeep Mandor" ? ["21","23","24"].includes(g):!["21","23","24"].includes(g)) : gangs;
  const attendanceWorkers=workers.filter((w)=>(!mandor||scopeGangs.includes(effectiveGang(displaySession,w.id)))&&(!gang||effectiveGang(displaySession,w.id)===gang)&&(w.name+" "+w.id).toLowerCase().includes(search.toLowerCase().trim()));
  const unreadWork=readOnly?0:mandor?morning.tickets.filter((ticket)=>ticket.recipient===role&&ticket.status==="Assigned").length:morning.items.filter((item)=>!morning.tickets.some((ticket)=>ticket.itemId===item.id)).length;
  const openCard=(key:string,items:PlanItem[])=>{
    if(!expanded[key]&&mandor&&listingMorning) {
      const ids=listingMorning.tickets.filter((ticket)=>ticket.recipient===role&&items.some((item)=>item.id===ticket.itemId)).map((ticket)=>ticket.id);
      if(!onAction((s)=>openMandoreWork(switchDate(s,listingDate),ids,role)))return;
    }
    setExpanded((previous)=>({...previous,[key]:!previous[key]}));
  };
  const submitCard=(items:PlanItem[])=>{
    const ids=listingMorning?.tickets.filter((ticket)=>ticket.recipient===role&&items.some((item)=>item.id===ticket.itemId)&&hasFieldEntry(drafts[ticket.id],primaryWork(listingSession!,ticket.id))&&latestReport(primaryWork(listingSession!,ticket.id))?.status!=="Reported").map((ticket)=>ticket.id)||[];
    const ok=onAction((s)=>{
      const current=switchDate(s,listingDate);
      return submitFieldReports(current,ids.map((ticketId)=>({ticketId,input:fieldInput(drafts[ticketId],primaryWork(current,ticketId),"PROD:"+ticketId+":"+current.sequence+":"+Date.now())})),role);
    },"Completion submitted. Available in Productivity for approval.");
    if(ok)setDrafts((previous)=>Object.fromEntries(Object.entries(previous).filter(([id])=>!ids.includes(id))));
  };
  const t6Worker=workers.find((w)=>w.id===t6WorkerId),machineWorker=workers.find((w)=>w.id===machineWorkerId);
  const switchDate=(s:Session,date:string)=>{const day=dailyRecords(s).find((r)=>r.plan.date===date);if(!day)throw new Error("This work date is unavailable.");return openDailyRecord(s,day.plan.id);};
  const closeOverlay=()=>{setT6WorkerId(null);setMachineWorkerId(null);setAttendanceResult(null);requestAnimationFrame(()=>{if(content.current)content.current.scrollTop=scroll.current;const target=origin.current?.isConnected?origin.current:content.current?.querySelector<HTMLElement>("select,button");target?.focus({preventScroll:true});});};
  const openT6=(id:string,button:HTMLButtonElement)=>{scroll.current=content.current?.scrollTop||0;origin.current=button;setT6Gang("");setT6WorkerId(id);};
  const openEvit=(id:string,button:HTMLButtonElement)=>{scroll.current=content.current?.scrollTop||0;origin.current=button;const assignment=morning.machineDrivers?.[id];setDriverEvit(assignment?.evitCode||"");setDriverRole(assignment?.role||"Machine Operator");setMachineWorkerId(id);};
  const closeComposer=()=>{if(window.confirm("Discard unsubmitted changes?"))setComposer(null);};
  const accept=()=>{if(onAction((s)=>acceptDailyWork(switchDate(s,listingDate),selectedIds),"Work accepted. Relevant Mandore notified."))setSelected([]);};
  const headerDate=readOnly||tab === "listing" ? listingDate : session.plan.date;
  return <>
    <div className="phone-content phone-workspace simple-phone" ref={content} inert={overlay}>
      <div className="phone-greeting mw-greeting"><p>{role.toUpperCase()}</p><h2>{checkroll?"Checkroll input":tab==="listing"?"Work Listing":tab==="clock"?"Clock/in":"Productivity"}</h2><span><Clock3 size={12}/>{formatDate(headerDate,true)}</span></div>
      {readOnly?<p className="reference-note">View only</p>:null}
      {readOnly&&!listingSession&&tab!=="listing"?<p className="simple-form-note">No records for this date.</p>:checkroll?readOnly?<><button className="mw-back" onClick={()=>setCheckroll(false)}><ArrowLeft size={13}/> Productivity</button><CheckrollReferenceDetails session={displaySession}/></>:<CheckrollWorkspace session={session} role={role} onAction={onAction} onBack={()=>setCheckroll(false)} onAttendance={()=>{setCheckroll(false);onTab("clock");}}/>:composer ? <WorkComposer key={composer.date+":"+(composer.itemIds?.join(",")||"new")} session={composer.itemIds&&listingSession?listingSession:session} date={composer.date} editing={composer.itemIds?listingMorning?.items.filter((i)=>composer.itemIds?.includes(i.id)):undefined} onCancel={closeComposer} onSubmit={(draft)=>{
        if(onAction((s)=>composer.itemIds?saveDailyWorkChanges(switchDate(s,composer.date),composer.itemIds,draft.plan.items,isManagement(role)?role:"Field Officer"):submitDailyWork(s,draft,isManagement(role)?role:"Field Officer"),composer.itemIds?"Work instruction updated.":"Work programme submitted.")){setListingDate(draft.plan.date);setComposer(null);}
      }}/> : tab==="listing" ? <>
        {!mandor&&!readOnly?<button className="button button-primary mw-wide" onClick={()=>setComposer({date:listingDate})}><Plus size={14}/> Add work programme</button>:null}
        <div className="simple-list-filters"><label><span>Work date</span><input aria-label="Work Listing date" type="date" value={listingDate} onChange={(e)=>{const date=e.target.value;if(!date)return;setListingDate(date);setSelected([]);setExpanded({});const day=records.find((r)=>r.plan.date===date);if(day&&!readOnly)onAction((s)=>openDailyRecord(s,day.plan.id));}}/></label><label className="mw-search"><Search size={14}/><input aria-label="Search Work Listing" placeholder="Activity or field" value={search} onChange={(e)=>setSearch(e.target.value)}/></label></div>
        {fo&&listingSession&&hasNewSharedPlan(listingSession)?<button className="simple-receive button mw-wide" onClick={()=>onAction((s)=>receiveSharedPlan(switchDate(s,listingDate)),"New shared instructions received; issued work retained.")}>Update from shared pre-plan</button>:null}
        {shownCards.map((card)=>{
          const accepted=card.items.filter((i)=>listingMorning?.tickets.some((t)=>t.itemId===i.id)).length,allAccepted=accepted===card.items.length,green=allAccepted||selected.includes(card.key);
          const fieldCount=new Set(card.items.map((i)=>i.fieldNo).filter(Boolean)).size;
          return <article key={card.key} className={"simple-list-card "+(green?"simple-list-green":"")} data-activity={card.code}>
            <header><button className="simple-card-toggle" aria-label={"Show work "+card.code} aria-expanded={!!expanded[card.key]} onClick={()=>openCard(card.key,card.items)}><strong>{card.code} · {card.title}</strong><span>{fieldCount} {fieldCount===1?"field":"fields"} · {mandor?"Received":allAccepted?"Accepted":accepted?accepted+"/"+card.items.length+" accepted":"Planned"} <ChevronDown size={14}/></span></button>{(!readOnly&&(mandor?card.items.some((i)=>listingMorning?.tickets.some((t)=>t.itemId===i.id&&t.status==="Assigned")):!allAccepted))?<span className="production-new-tag">New</span>:null}{fo?<label className="simple-accept-check"><input type="checkbox" aria-label={"Select work "+card.code} disabled={allAccepted} checked={green} onChange={()=>setSelected(toggle(selected,card.key))}/><span><Check size={14}/></span></label>:null}</header>
            {expanded[card.key]?<div className="simple-card-fields">{card.items.map((i)=>{
              const material=materials.find((m)=>m.code===i.materialCode),evits=listingView?fieldMachines(listingView,i):[];
              const ticket=listingMorning?.tickets.find((t)=>t.itemId===i.id),open=!mandor||!!fieldExpanded[i.id];
              const work=mandor&&ticket?primaryWork(listingSession!,ticket.id):null;
              return <section key={i.id} data-field={i.fieldNo}>
                {mandor?<button className="production-field-toggle" aria-label={"Open field "+i.fieldNo} aria-expanded={open} onClick={()=>setFieldExpanded((previous)=>({...previous,[i.id]:!previous[i.id]}))}><span><strong>{fieldLabel(i)}</strong><small>{i.targetHa>0?formatHa(i.targetHa)+" planned ha":"Ha not specified"}{i.harvestType?" · "+i.harvestType:""}</small></span><ChevronDown size={14}/></button>:<div><strong>{fieldLabel(i)}</strong>{i.harvestType?<small>{i.harvestType}</small>:null}<span>{i.targetHa>0?formatHa(i.targetHa)+" planned ha":"Ha not specified"}</span></div>}
                {open?<><p><strong>EVIT</strong><span>{evits.join(", ")||"—"}</span></p><p><strong>Material</strong><span>{material?material.name+" · "+formatHa(i.materialQuantity)+" "+unitFor(i)+" · "+i.storageLocation:"No material required"}</span></p>{i.remark?<p><strong>Remark</strong><span>{i.remark}</span></p>:null}
                  {mandor&&ticket&&work?<FieldProduction session={listingSession!} ticketId={ticket.id} draft={drafts[ticket.id]||fieldDraft(work)} onChange={(draft)=>setDrafts((previous)=>({...previous,[ticket.id]:draft}))} onHistory={()=>onTab("tickets")}/>:null}
                </>:null}
              </section>;
            })}{mandor?<div className="production-submit-bar"><button className="button button-primary mw-wide" disabled={!card.items.some((item)=>listingMorning?.tickets.some((ticket)=>ticket.itemId===item.id&&hasFieldEntry(drafts[ticket.id],primaryWork(listingSession!,ticket.id))&&latestReport(primaryWork(listingSession!,ticket.id))?.status!=="Reported"))} onClick={()=>submitCard(card.items)}>Submit completion <Check size={13}/></button></div>:null}{!mandor&&!readOnly?<button className="button button-small" disabled={!!(session.completions||[]).find((work)=>work.reports.length&&card.items.some((i)=>listingMorning?.tickets.some((t)=>t.itemId===i.id&&t.id===work.ticketId)))} onClick={()=>setComposer({date:listingDate,itemIds:card.items.map((i)=>i.id)})}>Edit work programme</button>:null}</div>:null}
          </article>;
        })}
        {!shownCards.length?<div className="mw-empty"><ClipboardList size={28}/><h3>No submitted work</h3><p>{search?"No activities match your search.":mandor?"Work appears here when it is accepted.":readOnly?"No submitted instructions for this date.":"Add a work programme or submit a pre-plan for this date."}</p></div>:null}
        {fo&&cards.some((c)=>c.items.some((i)=>!listingMorning?.tickets.some((t)=>t.itemId===i.id)))?<div className="simple-accept-bar">{listingSession&&!attendanceReady(listingSession)?<p className="attendance-work-gate">Submit attendance before accepting work. <button className="text-button" onClick={()=>onTab("clock")}>Go to Clock/in</button></p>:null}<button className="button button-primary mw-wide" disabled={!selectedIds.length||!listingSession||!attendanceReady(listingSession)} onClick={accept}>Accept work{selectedIds.length?" ("+selectedIds.length+" field instructions)":""} <Check size={14}/></button></div>:null}
      </> : tab==="clock" ? <>
        <label className="mw-search"><Search size={14}/><input aria-label="Search Clock/in workers" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Worker name or ID"/></label>
        <label className="mw-form-label"><span>Gang filter</span><select aria-label="Clock/in gang filter" value={gang} onChange={(e)=>setGang(e.target.value)}><option value="">All gangs</option>{scopeGangs.map((g)=><option key={g} value={g}>Gang {g}</option>)}</select></label>
        <div className="simple-attendance-totals"><strong>{attendanceWorkers.filter((w)=>!w.needsReview&&morning.attendance[w.id]==="Present").length} clocked in</strong><span>{attendanceWorkers.filter((w)=>!w.needsReview).length} shown</span></div>
        {!readOnly?<><div className="attendance-bulk-select" aria-label="Select shown attendance"><span>Shown workers</span><button disabled={!attendanceWorkers.some((w)=>!w.needsReview&&morning.attendance[w.id]!=="Present")} onClick={()=>onAction((s)=>clockWorkers(s,attendanceWorkers.filter((w)=>!w.needsReview).map((w)=>w.id),"Present",role),"Shown workers selected.")}>Select all</button><span aria-hidden="true">·</span><button disabled={!attendanceWorkers.some((w)=>!w.needsReview&&morning.attendance[w.id]==="Present")} onClick={()=>onAction((s)=>clockWorkers(s,attendanceWorkers.filter((w)=>!w.needsReview).map((w)=>w.id),"Unconfirmed",role),"Shown workers deselected.")}>Deselect all</button></div>
        <div className="simple-attendance-actions"><button className="button button-primary button-small" onClick={(event)=>{origin.current=event.currentTarget;scroll.current=content.current?.scrollTop||0;let summary=attendanceSummary(session,role);if(onAction((s)=>{summary=attendanceSummary(s,role);return saveAttendance(s,role);},"Attendance submitted."))setAttendanceResult(summary);}}>Submit attendance</button></div></>:null}
        {attendanceWorkers.map((w)=>{const present=morning.attendance[w.id]==="Present",changed=effectiveGang(displaySession,w.id)!==w.gang;
          return <article className={"simple-clock-worker "+(present?"simple-clock-green":"")} key={w.id} data-worker={w.id}><div><strong>{w.name}</strong><small>{w.id} · Gang {effectiveGang(displaySession,w.id)}{changed?" · T6 from "+w.gang:""}</small>{w.needsReview?<small>Identity review</small>:null}{morning.machineDrivers?.[w.id]?<small className="mc-clock-assignment">{morning.machineDrivers[w.id].evitCode} · {morning.machineDrivers[w.id].role==="Machine Specialist"?"MS":"MO"}</small>:null}</div><div className="simple-clock-buttons"><button className="simple-clock-toggle" aria-label={"Clock in "+w.name} aria-pressed={present} disabled={readOnly||w.needsReview} onClick={()=>onAction((s)=>clockWorker(s,w.id,present?"Unconfirmed":"Present",role))}><span>{present?<Check size={16}/>:null}</span><small>{present?"Clocked in":""}</small></button>{fo?<button className="simple-t6" aria-label={"T6 for "+w.name} disabled={!present||w.needsReview||!editable} onClick={(event)=>openT6(w.id,event.currentTarget)}>T6</button>:null}{fo?<button className="simple-t6 mc-evit-button" aria-label={"EVIT for "+w.name} disabled={!present||w.needsReview||driverAssignmentLocked(displaySession,w.id)} onClick={(event)=>openEvit(w.id,event.currentTarget)}>EVIT</button>:null}</div></article>;
        })}
        {!attendanceWorkers.length?<p className="simple-form-note">No workers match.</p>:null}
      </> : <>
        {fo||readOnly?<button className="button mw-wide cr-phone-entry" onClick={()=>setCheckroll(true)}>Checkroll input <ArrowLeft size={13} style={{transform:"rotate(180deg)"}}/></button>:null}
        <ProductivityReports session={displaySession} role={role} onAction={onAction} onWork={()=>onTab("listing")}/>
      </>}
    </div>
    {overlay?<div className="mw-t6-overlay" onClick={(e)=>{if(e.target===e.currentTarget)closeOverlay();}}><section ref={dialog} className="mw-t6-card" role="dialog" aria-modal="true" aria-labelledby="simple-dialog-title" onKeyDown={(e)=>{
      if(e.key==="Escape"){e.preventDefault();closeOverlay();}
      if(e.key==="Tab"){const nodes=e.currentTarget.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled)");const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    }}><header><h3 id="simple-dialog-title">{machineWorker?"Assign driver EVIT":t6Worker?"T6 gang transfer":"Attendance submitted"}</h3><button className="icon-button" aria-label="Close attendance dialog" onClick={closeOverlay}><X size={16}/></button></header>
      {machineWorker?<><strong className="mw-t6-worker-name">{machineWorker.name}</strong><p className="mw-t6-worker-meta">{machineWorker.id} · Gang {effectiveGang(displaySession,machineWorker.id)}</p>
        <label className="mw-form-label"><span>EVIT</span><select aria-label="Clock/in driver EVIT" value={driverEvit} onChange={(e)=>setDriverEvit(e.target.value)}><option value="">No machine assigned</option>{machines.map((machine)=><option key={machine.code} value={machine.code}>{machine.code} · {machine.name}</option>)}</select></label>
        <label className="mw-form-label"><span>Driver role</span><select aria-label="Clock/in driver machine role" value={driverRole} onChange={(e)=>setDriverRole(e.target.value as MachineRole)}><option>Machine Operator</option><option>Machine Specialist</option></select></label>
        <p className="mc-note">Accepted work for this EVIT appears in the driver&apos;s M3 Work Listing after attendance is submitted.</p>
        <div className="mw-t6-actions"><button className="button" onClick={closeOverlay}>Cancel</button><button className="button button-primary" disabled={morning.attendance[machineWorker.id]!=="Present"} onClick={()=>{if(onAction((s)=>assignClockMachine(s,machineWorker.id,driverEvit,driverRole,isManagement(role)?role:"Field Officer"),"Driver EVIT saved."))closeOverlay();}}>Save EVIT <Check size={13}/></button></div>
      </>:t6Worker?<><strong className="mw-t6-worker-name">{t6Worker.name}</strong><p className="mw-t6-worker-meta">{t6Worker.id} · From Gang {effectiveGang(displaySession,t6Worker.id)}</p><label className="mw-form-label"><span>Receiving gang</span><select aria-label="Worker T6 receiving gang" value={t6Gang} onChange={(e)=>setT6Gang(e.target.value)}><option value="">Choose receiving gang</option>{gangs.filter((g)=>g!==effectiveGang(displaySession,t6Worker.id)).map((g)=><option key={g} value={g}>Gang {g} · {gangDescription(g)}</option>)}</select></label><div className="mw-t6-actions"><button className="button" onClick={closeOverlay}>Cancel</button><button className="button button-primary" disabled={!editable||!t6Gang||morning.attendance[t6Worker.id]!=="Present"} onClick={()=>{if(onAction((s)=>transferAttendanceGang(s,t6Worker.id,t6Gang,isManagement(role)?role:"Field Officer"),"T6 recorded. Attendance and work instructions retained."))closeOverlay();}}>Confirm T6 <Check size={13}/></button></div></>:attendanceResult?<><div className="simple-attendance-result"><span><strong>{attendanceResult.clockedIn}</strong>Clocked in</span><span><strong>{attendanceResult.neutral}</strong>Not clocked in</span><span><strong>{attendanceResult.t6}</strong>T6 workers</span></div><p className="simple-form-note">Final outturn is recorded later.</p><button className="button button-primary mw-wide" onClick={closeOverlay}>Done</button></>:null}
    </section></div>:null}
    <nav className="phone-bottom-nav" aria-label="Phone navigation" inert={overlay}>{([{id:"listing",label:"Work Listing",icon:ClipboardList},{id:"clock",label:"Clock/in",icon:Clock3},{id:"tickets",label:"Productivity",icon:Check}] as const).map(({id,label,icon:Icon})=><button key={id} className={tab===id?"active":""} onClick={()=>{setComposer(null);setCheckroll(false);setSearch("");setGang("");onTab(id);}}><span className="phone-nav-icon"><Icon size={18}/>{id==="listing"&&unreadWork>0?<span className="work-alert-badge" aria-label={unreadWork+(mandor?" new work tickets":" new work instructions")}>{unreadWork}</span>:null}</span><span>{label}</span></button>)}</nav>
  </>;
}


