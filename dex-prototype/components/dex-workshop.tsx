"use client";

import { MachineWorkspace } from "@/components/machine-workspace";
import { WarehouseWorkspace } from "@/components/warehouse-workspace";
import { warehouseCounts } from "@/lib/warehouse";
import { CheckrollWorkspace, CheckrollReferenceDetails } from "@/components/checkroll-workspace";
import { CompletionReview, CompletionFeedback } from "@/components/work-completion";
import Link from "next/link";
import { WorkProgramme } from "@/components/work-programme";
import { WorkRows, WorkComposer, type PhoneTab } from "@/components/phone-workspace";
import { PhonePortal, DEX_MODULES, type PhoneScreen } from "@/components/phone-portal";
import { HarvestingInterval } from "@/components/harvesting-interval";
import { HARVEST_ACTIVITY } from "@/lib/harvesting-interval";
import { morningView, morningSession, effectiveGang, saveDailyWorkChanges, submitDailyWork, receiveSharedPlan, submitAdditionalWorkDraft } from "@/lib/morning-work";
import { WORKSHOP_YEAR } from "@/lib/work-programme";

import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  ArrowRight, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronRight,
  ClipboardList, Clock3, Columns2, LayoutDashboard, Leaf, Monitor,
  Package, Plus, RotateCcw, Search, Send, Settings2, Smartphone,
  Trash2, TriangleAlert, Users, ShoppingBasket, X,
} from "lucide-react";
import {
  additionalWorkDraft, saveAdditionalWorkDraft, addHarvestField, addGeneralWork, addGeneralField, setGroupActivity, workKind, activitySourceLabel,
  activityName, addRecommendation, categories, createSession, formatDate, formatHa, materials, parseSession, planIssues, peopleActivityIssues, materialIssues, programmes,
  stockFor, stocks, stores, STORAGE_KEY, submitPlan, hasSharedPlan,
  dailyRecords, dailyWorkSummary, nextPlanningDate, createDailyPlan, openDailyRecord,
  gangs, workers, workerName, fieldMachines, type DailyRecord,
  activityGroupKey, programmeGroups, removePlanField, removeProgrammeGroup,
  updateItem, withEvent, type OfficeRole, type PhoneRole, type PlanItem, type ProgrammeGroup, type Session, type ViewMode,
} from "@/lib/workshop";

const initial = createSession();
let current = initial;
let initialized = false;
let storageMessage = "";
let storageBlocked = false;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!initialized) {
    initialized = true;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = parseSession(JSON.parse(saved));
        if (parsed) current = parsed;
        else { storageBlocked = true; storageMessage = "An earlier session could not be read. It has not been overwritten; load a starting point to replace it."; current = { ...current }; }
      }
    } catch { storageBlocked = true; storageMessage = "The saved workshop could not be restored. Its saved copy is unchanged; load a starting point to replace it."; current = { ...current }; }
  }
  return () => { listeners.delete(listener); };
}
function getSnapshot() { return current; }
function getServerSnapshot() { return initial; }
function commit(next: Session, reset = false) {
  if (reset) storageBlocked = false;
  if (next === current) return;
  current = next;
  try { if (!storageBlocked) { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); storageMessage = ""; } }
  catch { storageMessage = "Changes are in this session, but browser saving is unavailable."; }
  listeners.forEach((listener) => listener());
}
function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={"badge badge-" + tone}>{children}</span>;
}
function LeafMark({ small = false }: { small?: boolean }) {
  return <span className={small ? "leaf-mark leaf-mark-small" : "leaf-mark"}><Leaf size={small ? 18 : 25} strokeWidth={1.8} aria-hidden="true" /></span>;
}
const officeRoles: OfficeRole[] = ["Assistant Manager", "Manager", "Field Officer", "Store Clerk"];
const phoneRoles: PhoneRole[] = ["Assistant Manager", "Field Officer", "Manager", "Upkeep Mandor", "Harvesting Mandor", "Store Clerk", "Machine Operator", "Machine Specialist"];

export function DexWorkshop() {
  const session = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [mode, setMode] = useState<ViewMode>("workshop");
  const [section, setSection] = useState<"programme" | "summary" | "machine" | "warehouse">("summary");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [selectedDailyId, setSelectedDailyId] = useState<string | null>(null);
  const [dailyDetail, setDailyDetail] = useState<{ id: string; tab: ReferenceTab } | null>(null);
  const [dailyQuery, setDailyQuery] = useState("");
  const [basketTarget,setBasketTarget]=useState<"preplan"|"additional">("preplan");
  const [additionalStep,setAdditionalStep]=useState<"activities"|"materials">("activities");
  const [programmeTab, setProgrammeTab] = useState<"upkeep" | "harvesting">("upkeep");
  const [harvestActivity, setHarvestActivity] = useState(HARVEST_ACTIVITY);
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [programmeView, setProgrammeView] = useState<"table" | "map">("table");
  const [programmeYear, setProgrammeYear] = useState(WORKSHOP_YEAR);
  const [programmeField, setProgrammeField] = useState("02D1");
  const [officeRole, setOfficeRole] = useState<OfficeRole>("Assistant Manager");
  const [phoneRole, setPhoneRole] = useState<PhoneRole>("Field Officer");
  const [phoneTab, setPhoneTab] = useState<PhoneTab>("listing");
  const [phoneScreen, setPhoneScreen] = useState<PhoneScreen>("menu");
  const [phoneSessionKey, setPhoneSessionKey] = useState(0);
  const [focused, setFocused] = useState("ITEM-1");
  const [resource, setResource] = useState<"allocation" | "materials">("allocation");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [materialCategory, setMaterialCategory] = useState("Fertiliser");
  const [inventoryStore, setInventoryStore] = useState("SR01");
  const [inventorySearch, setInventorySearch] = useState("");
  const [openMaterialGroups, setOpenMaterialGroups] = useState<Record<string, boolean>>({});
  const [notifications, setNotifications] = useState(false);
  const [additionalComposer,setAdditionalComposer]=useState<{items?:PlanItem[]}|null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setNotifications(false); document.querySelector("details.tools-menu")?.removeAttribute("open"); } };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, []);
  const warehouseNotifications = Object.values(warehouseCounts(session,officeRole)).reduce((n,value)=>n+value,0);
  const officeSection = section;
  const plan = session.plan;
  const draft = plan.status === "Draft";
  const canEdit = officeRole !== "Store Clerk";
  const basketAdditional=basketTarget==="additional"||!draft;
  const pendingAdditional=additionalWorkDraft(session),basketSession=basketAdditional?pendingAdditional:session;
  const pendingPeopleIssues=peopleActivityIssues(pendingAdditional),pendingIssues=planIssues(pendingAdditional);
  const live = morningSession(session), plannedIds = new Set(plan.items.map((item)=>item.id));
  const plannedItems = draft ? plan.items : live.plan.items.filter((item)=>plannedIds.has(item.id));
  const additionalItems = live.plan.items.filter((item)=>!plannedIds.has(item.id));
  const planning = {...session,plan:{...plan,status:"Draft" as const,items:plannedItems}};
  const additional = {...live,plan:{...live.plan,items:additionalItems}};
  const resources = {...planning,plan:{...planning.plan,items:[...plannedItems,...additionalItems]}};
  const activeItem = resources.plan.items.find((i) => i.id === focused) || resources.plan.items[0];
  const issues = planIssues(planning), peopleIssues = peopleActivityIssues(planning);
  const peopleReady = !draft || !plan.items.length&&additionalItems.length>0 || peopleIssues.length===0;
  const activeResource = peopleReady ? resource : "allocation";
  const lockedIds = morningView(session).items.filter((item)=>morningView(session).tickets.some((ticket)=>ticket.itemId===item.id&&(session.completions||[]).some((work)=>work.ticketId===ticket.id&&work.date===plan.date&&work.reports.length))).map((item)=>item.id);
  const unread = Math.max(0, session.sequence - session.readSequence);
  const clockLabel = session.clock === "office" ? "Day before · 15:30" : session.clock === "muster" ? "Muster · 06:30" : session.clock === "completion" ? "Completion · 17:00" : "In field · 07:00";

  const run = (action: () => Session, message?: string) => {
    try { const next = action(); commit(next); if (next.plan.status==="Draft" && next.plan.items.length && peopleActivityIssues(next).length) setResource("allocation"); setNotice(message ? { message, error: false } : null); }
    catch (error) { setNotice({ message: error instanceof Error ? error.message : "The action could not be completed.", error: true }); }
  };
  const openPreplan = () => {
    setSelectedDailyId(current.plan.id);
    setCollapsedGroups({}); setResource("allocation"); setSection("summary"); setDailyQuery(""); setAdditionalComposer(null); setAdditionalStep("activities");
    setExpandedDays((previous) => ({ ...previous, [current.plan.id]: true }));
    setDailyDetail({ id: current.plan.id, tab: "preplan" });
  };
  const openDay = (id: string, panel: "plan" | "morning") => {
    let opened = false;
    run(() => { const next = openDailyRecord(current, id); opened = true; return next; });
    if (!opened) return;
    setSelectedDailyId(id);
    setPhoneSessionKey((n) => n + 1); setFocused(current.plan.items[0]?.id || "");
    if (panel === "morning") { setPhoneRole(officeRole); setPhoneTab("listing"); setPhoneScreen("attendance"); setMode("workshop"); }
    else openPreplan();
  };
  const runDailyAction: DailyAction = (id, action, message) => {
    if (!canEdit) return false;
    let success = false;
    run(() => {
      const activeId = current.plan.id;
      const next = action(openDailyRecord(current, id));
      const restored = next.plan.id === activeId ? next : openDailyRecord(next, activeId);
      success = true;
      return restored;
    }, message);
    return success;
  };
  const reviewAttendance = (id: string) => {
    setSelectedDailyId(id);
    run(() => openDailyRecord(current, id));
    setPhoneSessionKey((n) => n + 1);
    setPhoneRole(officeRole); setPhoneTab("clock"); setPhoneScreen("attendance"); setMode("workshop");
  };
  const patchItem = (id: string, patch: Partial<PlanItem>) => run(() => {
    if(current.plan.status==="Draft" && current.plan.items.some((item)=>item.id===id)) return updateItem(current,id,patch);
    const item=morningView(current).items.find((item)=>item.id===id);
    if(!item) throw new Error("This work instruction is unavailable.");
    return saveDailyWorkChanges(current,[id],[{...item,...patch}],officeRole);
  });
  const load = (preset: "normal" | "muster" | "blank") => {
    if (!window.confirm("Reset the days and transactions saved in this browser? Sample references and starting balances will stay available.")) return;
    const next = createSession(preset); commit(next, true); setFocused(next.plan.items[0]?.id || "");
    setCollapsedGroups({}); setResource("allocation"); setOpenMaterialGroups({}); setInventoryStore("SR01"); setInventorySearch(""); setMaterialCategory("Fertiliser");
    setBasketTarget("preplan"); setExpandedDays({}); setSelectedDailyId(null); setDailyDetail(null); setDailyQuery(""); setSection("summary"); setOfficeRole("Assistant Manager"); setPhoneRole("Field Officer"); setPhoneTab("listing"); setPhoneScreen("menu"); setPhoneSessionKey((key) => key + 1);
    setNotice({ message: preset === "blank" ? "Local entries cleared. Sample programmes, materials and machines are ready for a new plan." : "Scenario loaded. You can now explore freely.", error: false });
  };
  const removeField = (itemId: string) => {
    if (!canEdit) return;
    const item = current.plan.items.find((i) => i.id === itemId); if (!item) return;
    const group = programmeGroups(current).find((g) => g.key === activityGroupKey(item));
    if ((item.workerIds.length || item.materialCode || item.evitCode || (group?.items.length === 1 && group.workers.length)) && !window.confirm("Remove field " + item.fieldNo + " and its worker allocations and material request from this plan?")) return;
    run(() => removePlanField(current, itemId));
  };
  const editBasket = (action:(value:Session)=>Session) => {if (!canEdit) return;run(()=>basketAdditional?saveAdditionalWorkDraft(current,action(additionalWorkDraft(current))):action(current));};
  const removeBasketField = (id:string) => {
    const item=(basketAdditional?additionalWorkDraft(current):current).plan.items.find((item)=>item.id===id);
    if(!item)return;
    if((item.materialCode||item.evitCode)&&!window.confirm("Remove this field and its planned resources?"))return;
    editBasket((value)=>removePlanField(value,id));
  };
  const addProgramme = (id:string,fieldNo:string) => {
    const selected=(basketAdditional?additionalWorkDraft(current):current).plan.items.find((item)=>item.programmeId===id&&item.fieldNo===fieldNo);
    if(selected){removeBasketField(selected.id);return;}
    const code=programmes.find((programme)=>programme.id===id)?.activityCode;
    editBasket((value)=>{
      if(basketAdditional&&[...morningView(current).items,...current.plan.items].some((item)=>item.activityCode===code&&item.fieldNo===fieldNo))throw new Error("This activity and field are already planned. Edit the existing instruction.");
      return addRecommendation(value,id,fieldNo);
    });
  };
  const browseProgramme = (id:string|null,kind:"upkeep"|"harvesting"="upkeep") => {
    setProgrammeTab(kind);setProgrammeId(id);setProgrammeYear(WORKSHOP_YEAR);setSection("programme");
  };
  const browsePlannedProgramme = (id:string|null,kind:"upkeep"|"harvesting"="upkeep") => {setBasketTarget("preplan");browseProgramme(id,kind);};
  const startAdditionalProgramme = () => {setAdditionalComposer(null);setBasketTarget("additional");browseProgramme(null);};
  const patchAdditional = (id:string,patch:Partial<PlanItem>) => run(()=>saveAdditionalWorkDraft(current,updateItem(additionalWorkDraft(current),id,patch)));
  const runAdditional = (action:()=>Session) => run(()=>saveAdditionalWorkDraft(current,action()));
  const addAdditionalGeneral = () => {
    run(()=>saveAdditionalWorkDraft(current,addGeneralWork(additionalWorkDraft(current))));
    openPreplan();
    const item=current.plan.workDraft?.at(-1);
    if(item)setCollapsedGroups((previous)=>({...previous,[activityGroupKey(item)]:false}));
  };
  const removeAdditionalField = (id:string) => run(()=>saveAdditionalWorkDraft(current,removePlanField(additionalWorkDraft(current),id)));
  const toggleHarvest = (fieldNo:string) => {
    const selected=(basketAdditional?additionalWorkDraft(current):current).plan.items.find((item)=>item.planningSource==="harvesting-interval"&&(!item.harvestType||item.harvestType==="FFB")&&item.fieldNo===fieldNo);
    if(selected){removeBasketField(selected.id);return;}
    editBasket((value)=>{
      if(basketAdditional&&[...morningView(current).items,...current.plan.items].some((item)=>workKind(item)==="harvesting"&&item.activityCode===harvestActivity&&item.fieldNo===fieldNo&&(!item.harvestType||item.harvestType==="FFB")))throw new Error("This harvesting field is already planned. Edit its instruction.");
      return addHarvestField(value,fieldNo,harvestActivity);
    });
  };
  const changeHarvestActivity = (code:string) => {
    setHarvestActivity(code);
    const group=(basketAdditional?additionalWorkDraft(current):current).plan.items.find((item)=>item.planningSource==="harvesting-interval"&&(!item.harvestType||item.harvestType==="FFB"));
    if(group)editBasket((value)=>setGroupActivity(value,activityGroupKey(group),code));
  };
  const addGeneral = () => {
    if (!canEdit) return;
    run(() => addGeneralWork(current));
    const item = current.plan.items.at(-1);
    if (item) { setFocused(item.id); setCollapsedGroups((previous) => ({ ...previous, [activityGroupKey(item)]: false })); }
    openPreplan();
    if (item) setCollapsedGroups({ [activityGroupKey(item)]: false });
  };
  const openNotifications = () => {
    setNotifications(!notifications);
    if (!notifications) commit({ ...current, readSequence: current.sequence });
  };
  const saveDraft = () => run(() => withEvent(current, "Draft saved", plan.id + " · " + plan.items.length + " activities", officeRole), "Draft saved in this workshop browser.");
  const totalShortages = resources.plan.items.filter((item) => materialStockIssue(resources, item)).length;

  const preplanEditor = <>
    <div className="plan-tabs" role="group" aria-label="Pre-plan section">
      <button className={activeResource==="allocation"?"active":""} onClick={()=>setResource("allocation")}><Users size={15}/> Activities</button>
      <button className={activeResource==="materials"?"active":""} disabled={!peopleReady} title={!peopleReady?"Complete Activities first":undefined} onClick={()=>setResource("materials")}><Package size={15}/> Materials {totalShortages>0?<span className="count-warning">{totalShortages}</span>:null}</button>
    </div>
    {activeResource==="allocation"?<>
      <ProgrammeBoard session={planning} canEdit={draft} focusedKey={activeItem?activityGroupKey(activeItem):""} collapsedGroups={collapsedGroups}
        showAddActions={draft} allowStructureChanges={draft} lockedIds={lockedIds} onEdit={!draft?(items)=>setAdditionalComposer({items}):undefined}
        onToggleGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:previous[key]===false}))}
        onExpandGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:false}))}
        onFocus={setFocused} run={run} onPatch={patchItem} onRemoveField={removeField}
        onBrowse={browsePlannedProgramme} onAdd={()=>browsePlannedProgramme(null)} onAddGeneral={addGeneral}/>
      <section className="additional-work" aria-label="Additional work">
        <header><h3>Additional work</h3><div className="additional-work-actions"><button className="button button-small" onClick={startAdditionalProgramme}><Plus size={14}/> Add work programme</button><button className="button button-small" onClick={addAdditionalGeneral}><Plus size={14}/> Add general work</button></div></header>
        {pendingAdditional.plan.items.length&&!additionalComposer?<section className="additional-draft" aria-label="Pending additional work">
          <h4>Pending additions <span>{pendingAdditional.plan.items.length}</span></h4>
          {additionalStep==="activities"?<ProgrammeBoard session={pendingAdditional} actionSession={pendingAdditional} canEdit={true} title="Pending additions" showAddActions={false}
            focusedKey={activeItem?activityGroupKey(activeItem):""} collapsedGroups={collapsedGroups}
            onToggleGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:previous[key]===false}))}
            onExpandGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:false}))}
            onFocus={setFocused} run={runAdditional} onPatch={patchAdditional} onRemoveField={removeAdditionalField}
            onBrowse={(id,kind)=>{setBasketTarget("additional");browseProgramme(id,kind);}} onAdd={startAdditionalProgramme} onAddGeneral={addAdditionalGeneral}/>:
            <MaterialsBoard session={pendingAdditional} canEdit={true} focusedId={focused} openGroups={openMaterialGroups}
              onToggle={(key)=>setOpenMaterialGroups((previous)=>({...previous,[key]:!previous[key]}))}
              inventoryStore={inventoryStore} inventoryCategory={materialCategory} inventorySearch={inventorySearch}
              onStore={setInventoryStore} onCategory={setMaterialCategory} onSearch={setInventorySearch} onFocus={setFocused} onPatch={patchAdditional} onBrowse={startAdditionalProgramme}/>}
          <div className="additional-draft-actions">
            {additionalStep==="activities"?<button className="button button-primary" disabled={pendingPeopleIssues.length>0} onClick={()=>setAdditionalStep("materials")}>Continue to Materials <ArrowRight size={13}/></button>:<>
              <button className="button" onClick={()=>setAdditionalStep("activities")}>Back to additional activities</button>
              <button className="button button-primary" disabled={pendingIssues.length>0} onClick={()=>run(()=>submitAdditionalWorkDraft(current,officeRole),"Additional work submitted.")}>Submit additional work <Send size={13}/></button>
            </>}
          </div>
        </section>:null}
        {additionalComposer?<WorkComposer key={plan.id+":"+(additionalComposer.items?.map((item)=>item.id).join(",")||"new")} session={session} date={plan.date} editing={additionalComposer.items} backLabel="Pre-plan"
          onCancel={()=>{if(window.confirm("Discard unsubmitted changes?"))setAdditionalComposer(null);}}
          onSubmit={(newWork)=>{let saved=false;run(()=>{const next=additionalComposer.items?saveDailyWorkChanges(current,additionalComposer.items.map((item)=>item.id),newWork.plan.items,officeRole):submitDailyWork(current,newWork,officeRole);saved=true;return next;},"Work programme added.");if(saved)setAdditionalComposer(null);}}/>:additionalItems.length?
          <ProgrammeBoard session={additional} canEdit={false} onEdit={(items)=>setAdditionalComposer({items})} title="Added activities" showAddActions={false} allowStructureChanges={false} lockedIds={lockedIds}
            focusedKey={activeItem?activityGroupKey(activeItem):""} collapsedGroups={collapsedGroups}
            onToggleGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:previous[key]===false}))}
            onExpandGroup={(key)=>setCollapsedGroups((previous)=>({...previous,[key]:false}))}
            onFocus={setFocused} run={run} onPatch={patchItem} onRemoveField={removeField}
            onBrowse={()=>setAdditionalComposer({})} onAdd={()=>setAdditionalComposer({})} onAddGeneral={()=>setAdditionalComposer({})}/>:null}
      </section>
    </>:<MaterialsBoard session={resources} canEdit={draft} onEdit={(items)=>{setResource("allocation");setAdditionalComposer({items});}} lockedIds={lockedIds} focusedId={activeItem?.id||""} openGroups={openMaterialGroups}
      onToggle={(key)=>setOpenMaterialGroups((previous)=>({...previous,[key]:!previous[key]}))}
      inventoryStore={inventoryStore} inventoryCategory={materialCategory} inventorySearch={inventorySearch}
      onStore={setInventoryStore} onCategory={setMaterialCategory} onSearch={setInventorySearch}
      onFocus={setFocused} onPatch={patchItem} onBrowse={()=>draft?browsePlannedProgramme(null):startAdditionalProgramme()}/>}
    {!(pendingAdditional.plan.items.length&&activeResource==="allocation")?<div className="plan-action-bar"><div>{draft&&plan.items.length>0?(activeResource==="allocation"?peopleIssues[0]:issues[0])||"":""}</div><div className="plan-buttons">
      <button className="button" onClick={saveDraft}>{draft?"Save draft":"Save changes"}</button>
      {activeResource==="allocation"?<button className="button button-primary" disabled={!peopleReady} onClick={()=>setResource("materials")}>Continue to Materials <ArrowRight size={14}/></button>:<>
        <button className="button" onClick={()=>setResource("allocation")}>Back to Activities</button>
        {draft&&plan.items.length>0?<button className="button button-primary" disabled={issues.length>0} onClick={()=>run(()=>{const next=submitPlan(current);return next.morning?receiveSharedPlan(next):next;},"Pre-plan submitted.")}>Submit pre-plan <Send size={14}/></button>:null}
      </>}
    </div></div>:null}
  </>;

  return <div className={"dex-app mode-" + mode}>
    <header className="app-header">
      <Link className="brand" href="/" aria-label="DEX home"><LeafMark /><span><strong>DEX<span className="brand-dot">.</span></strong><small>Digital Estate Extended</small></span></Link>
      <div className="estate-label"><span className="estate-dot" /><strong>Ldg Digital</strong><span className="muted">E063</span><span className="header-divider" /><span className="simulation-label">Workshop simulation</span></div>
      <div className="header-actions">
        {process.env.NEXT_PUBLIC_DEX_BASE_PATH?<a className="dex-return-link" href="/management/work-program">Digital Estate <ArrowRight size={13}/></a>:null}
        <div className="view-switch" role="group" aria-label="Display mode">
          {([{ value: "web", label: "Web", icon: Monitor }, { value: "phone", label: "Phone", icon: Smartphone }, { value: "workshop", label: "Workshop", icon: Columns2 }] as const).map(({ value, label, icon: Icon }) =>
            <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}><Icon size={15} /><span>{label}</span></button>)}
        </div>
        <button className="icon-button notification-trigger" aria-label={"Notifications" + (unread ? ", " + unread + " unread" : "")} aria-expanded={notifications} onClick={openNotifications}><Bell size={19} />{unread > 0 ? <span className="notification-dot" /> : null}</button>
      </div>
    </header>

    <div className="workshop-bar">
      <div className="workshop-bar-copy"><span className="live-dot" /><strong>One connected session</strong><span className="bar-description">Plan in the office. Follow the handoff in the field.</span></div>
      <div className="workshop-controls"><span className="clock-label"><Clock3 size={14} />{clockLabel}</span>
        <details className="tools-menu"><summary><Settings2 size={15} /> Workshop tools <ChevronDown size={13} /></summary><div className="tools-popover" onClick={(event) => { if ((event.target as Element).closest("button")) event.currentTarget.closest("details")?.removeAttribute("open"); }}>
          <p>STARTING POINT</p><button onClick={() => load("normal")}>Load sample day<span>Reset local entries to the original sample day</span></button>
          <button onClick={() => load("muster")}>Load morning muster<span>Pre-plan shared, attendance unconfirmed</span></button>
          <button onClick={() => load("blank")}><RotateCcw size={14} /> Start a blank plan<span>Clear local entries; keep sample reference data</span></button>
          <hr /><p>SIMULATED CLOCK</p>{(["office", "muster", "field", "completion"] as const).map((clock) => <button key={clock} onClick={() => { commit({ ...current, clock }); setNotice({ message: "Workshop clock changed. Your records are preserved.", error: false }); }}>{clock === "office" ? "Day before · 15:30" : clock === "muster" ? "Morning muster · 06:30" : clock === "completion" ? "Completion · 17:00" : "In field · 07:00"}{session.clock === clock ? <Check size={14} /> : null}</button>)}
        </div></details>
      </div>
    </div>
    {storageMessage ? <div className="session-warning" role="alert">{storageMessage}</div> : null}
    {notice ? <div className={"toast " + (notice.error ? "toast-error" : "")} role={notice.error ? "alert" : "status"}>{notice.error ? <TriangleAlert size={17} /> : <CheckCheck size={17} />}<span>{notice.message}</span><button aria-label="Dismiss notification" onClick={() => setNotice(null)}><X size={16} /></button></div> : null}

    <main className="presentation-grid">
      <section className="office-frame" aria-label="Office web view">
        <div className="surface-label"><span><Monitor size={14} /> OFFICE VIEW</span><span>Planning & oversight <span className="muted">/ Web</span></span><button className="text-button enlarge-button" onClick={() => setMode(mode === "web" ? "workshop" : "web")}>{mode === "web" ? "Show both views" : "Expand"} <ArrowRight size={13} /></button></div>
        <div className="office-app">
          <aside className="office-sidebar">
            <div className="sidebar-estate"><span className="estate-monogram">LD</span><div><strong>Ldg Digital</strong><small>Estate operations</small></div></div>
            <p className="nav-caption">WORKSPACE</p>
            <nav aria-label="Office navigation" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,130px),1fr))" }}>
              <button className={officeSection === "programme" ? "nav-active" : ""} onClick={() => setSection("programme")}><LayoutDashboard size={17} /><span>Work Programme</span><small>M1</small></button>
              <button className={officeSection === "summary" ? "nav-active" : ""} onClick={() => setSection("summary")}><ClipboardList size={17} /><span className="m2-navigation-label">Attendance and Productivity</span><small>M2</small></button>
              <button className={officeSection==="machine"?"nav-active":""} onClick={()=>setSection("machine")}><Settings2 size={17}/><span>Machine System</span><small>M3</small></button>
              <button className={officeSection === "warehouse" ? "nav-active" : ""} onClick={()=>setSection("warehouse")}><Package size={17}/><span>Warehouse{warehouseNotifications>0?<b className="wh-nav-count">{warehouseNotifications}</b>:null}</span><small>M4</small></button>
              {DEX_MODULES.filter((module)=>module.number>4).map(({number,title,icon:Icon})=><button key={number} className="dex-module-pending" disabled><Icon size={17}/><span>{title}<em>Work in progress</em></span><small>M{number}</small></button>)}
            </nav>
            <div className="sidebar-role"><span className="avatar">{officeRole === "Store Clerk" ? "SC" : officeRole === "Manager" ? "EM" : officeRole === "Field Officer" ? "FO" : "AM"}</span><label><span>VIEWING AS</span><select aria-label="Office role" value={officeRole} onChange={(e) => setOfficeRole(e.target.value as OfficeRole)}>{officeRoles.map((role) => <option key={role}>{role}</option>)}</select></label></div>
          </aside>

          <div className="office-main">
            <div className="breadcrumbs">Estate operations <ChevronRight size={12} /><span>{officeSection === "machine" ? "Machine System M3" : officeSection === "warehouse" ? "Warehouse M4" : officeSection === "programme" ? "Work Programme" : "Attendance and Productivity M2"}</span></div>
            {officeSection === "machine" ? <MachineWorkspace session={session} role={officeRole} platform="web" onAction={(action,message)=>{let success=false;run(()=>{const next=action(current);success=true;return next;},message);return success;}}/> : officeSection === "warehouse" ? <WarehouseWorkspace session={session} role={officeRole} platform="web" onAction={(action,message)=>{let success=false;run(()=>{const next=action(current);success=true;return next;},message);return success;}}/> : officeSection === "programme" ? <div className="programme-selection-layout"><div className="programme-source"><div className="programme-source-tabs" role="group" aria-label="Work programme type"><button aria-pressed={programmeTab === "upkeep"} onClick={() => setProgrammeTab("upkeep")}><Leaf size={15} /> Upkeep</button><button aria-pressed={programmeTab === "harvesting"} onClick={() => setProgrammeTab("harvesting")}><CalendarDays size={15} /> Harvesting interval</button></div><CompletionFeedback session={session} kind={programmeTab} programmeId={programmeTab === "upkeep" ? programmeId : null} />{programmeTab === "harvesting" ? <HarvestingInterval session={session} items={basketSession.plan.items.filter((i) => !i.harvestType || i.harvestType === "FFB")} planningDate={plan.date} canEdit={canEdit&&(basketAdditional||draft)} activityCode={basketSession.plan.items.find((i) => i.planningSource === "harvesting-interval" && (!i.harvestType || i.harvestType === "FFB"))?.activityCode || harvestActivity} onActivity={changeHarvestActivity} onToggleField={toggleHarvest} /> : <WorkProgramme
              session={session} programmeId={programmeId} onProgrammeChange={setProgrammeId}
              view={programmeView} onViewChange={setProgrammeView}
              year={programmeYear} onYearChange={setProgrammeYear}
              selectedField={programmeField} onFieldChange={setProgrammeField}
              onToggleField={addProgramme} items={basketSession.plan.items} canEdit={canEdit&&(basketAdditional||draft)} readOnly={!canEdit}
              onContinue={openPreplan}
            />}</div><PlanBasket session={basketSession} canEdit={canEdit&&(basketAdditional||draft)} onRemove={removeBasketField} onContinue={openPreplan} onBrowse={(id, kind) => { if (kind === "harvesting") browseProgramme(null, "harvesting"); else if (id) browseProgramme(id); else openPreplan(); }} /></div> : <DailyWorkSummary session={session} selectedDay={selectedDailyId} onSelected={setSelectedDailyId} role={officeRole} onAction={runDailyAction} onAttendance={reviewAttendance} canPlan={canEdit} onOpen={openDay} preplanEditor={preplanEditor} expanded={expandedDays} onExpanded={(id,open)=>setExpandedDays((previous)=>({...previous,[id]:open}))} detail={dailyDetail} onDetail={setDailyDetail} query={dailyQuery} onQuery={setDailyQuery} onCreate={(date) => { let success = false; run(() => { const next = createDailyPlan(current, date); success = true; return next; }, "New day created. Start with Pre-plan."); if (success) { setBasketTarget("preplan"); setPhoneSessionKey((n) => n + 1); setFocused(""); openPreplan(); } return success; }} />}
            <footer className="office-footer"><span><span className="footer-dot" /> Workshop session · familiar data, simulated operations</span><span>M1 · M2 · M4</span></footer>
          </div>
        </div>
      </section>

      <section className="phone-stage" aria-label="Field phone view">
        <div className="surface-label"><span><Smartphone size={14} /> FIELD VIEW</span><button className="text-button" onClick={() => setMode(mode === "phone" ? "workshop" : "phone")}>{mode === "phone" ? "Show both views" : "Expand"} <ArrowRight size={13} /></button></div>
        <div className="phone-role-control"><span>VIEWING AS</span><select aria-label="Phone role" value={phoneRole} onChange={(e) => { setPhoneRole(e.target.value as PhoneRole); setPhoneTab("listing"); setPhoneScreen("menu"); }}>{phoneRoles.map((role) => <option key={role} value={role}>{role.replace("Mandor","Mandore")}</option>)}</select></div>
        <div className="phone-device">
          <div className="phone-status"><span>{session.clock === "office" ? "15:30" : session.clock === "muster" ? "06:30" : session.clock === "completion" ? "17:00" : "07:00"}</span><span className="phone-camera" /><span className="phone-signal">▮▮▮ <span className="battery" /></span></div>
          <PhonePortal key={phoneRole + "-" + phoneSessionKey} session={session} role={phoneRole} screen={phoneScreen} onScreen={setPhoneScreen} tab={phoneTab} onTab={setPhoneTab} onAction={(action, message) => {
            let success = false;
            run(() => { const next = action(current); success = true; return next; }, message);
            return success;
          }} />
          <div className="phone-home-indicator" />
        </div>
        <p className="phone-stage-caption"><span className="live-dot" /> Interactive phone view · same records</p>
      </section>
    </main>

    {notifications ? <div className="notification-backdrop" onClick={() => setNotifications(false)}><aside className="notification-panel" aria-label="Notification inbox" onClick={(e) => e.stopPropagation()}><div><h2>Activity & notifications</h2><button className="icon-button" aria-label="Close notification inbox" onClick={() => setNotifications(false)}><X size={19} /></button></div><p>Every handoff, in the same session.</p>{session.events.map((event) => <article key={event.id}><span className="event-marker"><Check size={13} /></span><div><strong>{event.title}</strong><p>{event.detail}</p><small>{event.role} · {event.clock}</small></div></article>)}</aside></div> : null}
  </div>;
}



function PlanBasket({ session, canEdit, onRemove, onContinue, onBrowse }: { session: Session; canEdit: boolean; onRemove: (id: string) => void; onContinue: () => void; onBrowse: (id: string | null, kind?: "upkeep" | "harvesting" | "general") => void }) {
  const groups = programmeGroups(session), missing = session.plan.items.filter((i) => workKind(i) !== "general" && !(i.targetHa > 0)).length;
  return <aside className="plan-basket panel" aria-label="Selected day’s activities">
    <div className="basket-heading"><span><ShoppingBasket size={18} /></span><div><h2>Selected activities</h2><p>{formatDate(session.plan.date, true)}</p></div><strong>{session.plan.items.length}</strong></div>
    <div className="basket-content">{groups.length ? groups.map((g) => <section key={g.key} className="basket-group">
      <span className={"basket-work-kind kind-" + g.kind}>{g.kind === "upkeep" ? "Upkeep work" : g.kind === "harvesting" ? "Harvesting work" : "Other work"}</span><button className="basket-programme" onClick={() => onBrowse(g.programmeId, g.kind)}>{g.title}<ChevronRight size={12} /></button><small>{g.activityCode} · {g.items.length} fields</small>
      {g.items.map((item) => <div key={item.id} className="basket-field"><div><strong>{item.fieldNo || "No field specified"}</strong><span>{item.programmeRound ? "Round " + item.programmeRound : g.kind === "harvesting" ? "Harvesting" : "No programme"}</span></div><span className={item.targetHa > 0 ? "" : "basket-missing-ha"}>{item.targetHa > 0 ? formatHa(item.targetHa) + " ha" : g.kind === "general" ? "Ha optional" : "Ha to declare"}</span><button className="icon-button" aria-label={"Remove " + g.title + " field " + item.fieldNo + " from basket"} disabled={!canEdit} onClick={() => onRemove(item.id)}><X size={13} /></button></div>)}
    </section>) : <div className="basket-empty"><Leaf size={24} /><p>Select fields from any programme. They stay here while you browse.</p></div>}</div>
    <div className="basket-footer"><div><span>{groups.length} activities · {session.plan.items.length} fields</span><strong>{formatHa(session.plan.items.reduce((sum, i) => sum + i.targetHa, 0))} ha</strong></div>{missing > 0 ? <p>{missing} field{missing === 1 ? "" : "s"} need planned hectares in Pre-Plan.</p> : null}<button className="button button-primary" disabled={!groups.length} onClick={onContinue}>{canEdit?"Review Pre-Plan":"View Pre-plan"} <ArrowRight size={14} /></button></div>
  </aside>;
}

type BoardProps = {
  session: Session; canEdit: boolean; focusedKey: string;
  collapsedGroups: Record<string, boolean>;
  onToggleGroup: (key: string) => void; onExpandGroup: (key: string) => void;
  onFocus: (itemId: string) => void; run: (action: () => Session, message?: string) => void;
  onPatch: (id: string, patch: Partial<PlanItem>) => void;
  onRemoveField: (id: string) => void; onBrowse: (programmeId: string | null, kind?: "upkeep" | "harvesting") => void;
  onAdd: () => void; onAddGeneral: () => void;
  actionSession?:Session;title?:string;showAddActions?:boolean;allowStructureChanges?:boolean;lockedIds?:string[];onEdit?:(items:PlanItem[])=>void;
};
function ProgrammeBoard({ session, canEdit, collapsedGroups, onToggleGroup, onFocus, run, onPatch, onRemoveField, onBrowse, onAdd, onAddGeneral, title="Planned activities",showAddActions=true,allowStructureChanges=true,lockedIds=[],onEdit,actionSession }: BoardProps) {
  const groups = programmeGroups(session);
  return <section className="simple-plan-board" aria-label="Pre-plan activities">
    <div className="board-heading"><div><p className="eyebrow">PRE-PLAN</p><h2>{title} <span>{groups.length}</span></h2></div>{showAddActions?<div className="board-add-actions"><button className="button button-small" disabled={!canEdit} onClick={onAdd}><Plus size={14}/> Add from Work Programme</button><button className="button button-small" disabled={!canEdit} onClick={onAddGeneral}><Plus size={14}/> Add other work</button></div>:null}</div>
    {!groups.length ? <div className="empty-state panel"><Leaf size={28}/><h3>No activities yet.</h3><button className="button" onClick={() => onBrowse(null)}>Browse Work Programme</button></div> : null}
    {groups.map((g,index) => {
      const collapsed = collapsedGroups[g.key] !== false,missing = peopleActivityIssues(session,g.key),first=g.items[0];
      return <article className={"programme-allocation-card simple-plan-card " + (missing.length ? "activity-incomplete " : "") + (collapsed ? "programme-card-collapsed" : "")} key={g.key} data-group={g.key}>
        <header className="programme-card-header"><button className="programme-card-toggle" type="button" aria-label={(collapsed?"Expand ":"Collapse ")+g.title} aria-expanded={!collapsed} onClick={() => { onFocus(first.id);onToggleGroup(g.key); }}><span className="programme-card-number">{String(index+1).padStart(2,"0")}</span><span className="programme-toggle-copy"><small>{g.activityCode || "Activity code to select"} · {g.kind === "general" ? "Other work" : g.kind === "harvesting" ? "Harvesting" : "Upkeep"}</small><strong>{g.title}</strong></span><ProgrammeActivitySummary group={g} inline/><Badge tone="sage">{g.items.filter((i)=>i.fieldNo).length} fields</Badge><ChevronDown size={17}/></button><button className="icon-button" aria-label={"Remove activity "+g.title} disabled={!canEdit||!allowStructureChanges} onClick={() => {if(window.confirm("Remove this activity and its planned resources?"))run(() => removeProgrammeGroup(actionSession||current,g.key));}}><Trash2 size={15}/></button></header>
        {missing.length ? <p className="activity-missing"><TriangleAlert size={14}/><span>{missing[0]}</span></p> : null}
        {!collapsed ? <div className="simple-plan-body"><WorkRows session={session} items={g.items} canEdit={canEdit} onPatch={onPatch} lockedIds={lockedIds} onRemove={allowStructureChanges?onRemoveField:undefined} onCode={allowStructureChanges&&g.kind === "general" ? (key,code) => run(() => setGroupActivity(actionSession||current,key,code)) : undefined}/>{allowStructureChanges?<button className="text-button" disabled={!canEdit} onClick={() => first.planningSource === "general" ? run(() => addGeneralField(actionSession||current,g.key)) : first.planningSource === "harvesting-interval" || workKind(first) === "harvesting" ? onBrowse(null,"harvesting") : g.programmeId ? onBrowse(g.programmeId) : onAdd()}><Plus size={13}/> Add field</button>:null}{onEdit?<button className="button button-small" disabled={g.items.some((item)=>lockedIds.includes(item.id))} onClick={()=>onEdit(g.items)}>Edit work programme</button>:null}</div>:null}
      </article>;
    })}
  </section>;
}

function requestedMaterialTotal(session: Session, materialCode: string, storageLocation: string) {
  return Math.round(session.plan.items.filter((item) => item.materialCode === materialCode && item.storageLocation === storageLocation).reduce((sum, item) => sum + (Number.isFinite(item.materialQuantity) && item.materialQuantity > 0 ? item.materialQuantity : 0), 0) * 100) / 100;
}
function materialStockIssue(session: Session, item: PlanItem) {
  const balance = stockFor(item,session);
  return !!item.materialCode && (!balance || requestedMaterialTotal(session, item.materialCode, item.storageLocation) > balance.availableQuantity);
}
function materialUnit(materialCode: string, storageLocation: string) {
  return stocks.find((s) => s.materialCode === materialCode && s.storageLocation === storageLocation)?.unit || stocks.find((s) => s.materialCode === materialCode)?.unit || "";
}
function ProgrammeActivitySummary({ group:g, inline=false }: { group:ProgrammeGroup;inline?:boolean }) {
  const ha=g.items.reduce((n,i)=>n+i.targetHa,0);
  const summary=<><strong>{ha ? formatHa(ha)+" planned ha" : "Ha optional"}</strong><span>{g.items.map((i)=>i.fieldNo||"No field specified").join(", ")}</span></>;
  return inline ? <span className="programme-header-summary">{summary}</span> : <div className="simple-collapsed-summary">{summary}</div>;
}
type MaterialsBoardProps = {
  session: Session; canEdit: boolean; focusedId: string; openGroups: Record<string, boolean>;
  inventoryStore: string; inventoryCategory: string; inventorySearch: string; lockedIds?:string[];onEdit?:(items:PlanItem[])=>void;
  onToggle: (key: string) => void; onFocus: (id: string) => void;
  onStore: (store: string) => void; onCategory: (category: string) => void; onSearch: (search: string) => void;
  onPatch: (id: string, patch: Partial<PlanItem>) => void; onBrowse: () => void;
};
function MaterialsBoard({ session, canEdit, focusedId, openGroups, inventoryStore, inventoryCategory, inventorySearch, onToggle, onFocus, onStore, onCategory, onSearch, onPatch, onBrowse, lockedIds=[],onEdit }: MaterialsBoardProps) {
  const groups = programmeGroups(session);
  const query = inventorySearch.toLowerCase().trim();
  const shown = materials.filter((m) => (!inventoryCategory || m.category === inventoryCategory) && (m.name + " " + m.code).toLowerCase().includes(query));
  const focusField = (item: PlanItem) => { onFocus(item.id); onStore(item.storageLocation); };
  return <div className="allocation-workspace allocation-materials">
    <section className="inventory-pool panel" aria-label="Inventory availability">
      <div className="inventory-pool-heading"><div><p className="eyebrow">STORE INVENTORY</p><h2>Inventory</h2></div><span className="round-count">{materials.length}</span></div>
      <label className="search-field"><Search size={15} /><input aria-label="Search inventory" placeholder="Material name or code" value={inventorySearch} onChange={(event) => onSearch(event.target.value)} /></label>
      <label className="inventory-filter-control"><span>Store</span><select aria-label="Inventory store" value={inventoryStore} onChange={(event) => onStore(event.target.value)}>{stores.map((store) => <option key={store.code} value={store.code}>{store.code} · {store.name}</option>)}</select></label>
      <label className="inventory-filter-control"><span>Category</span><select aria-label="Inventory category" value={inventoryCategory} onChange={(event) => onCategory(event.target.value)}><option value="">All categories</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <div className="inventory-pool-list">{shown.map((material) => {
        const balance = stockFor({ materialCode: material.code, storageLocation: inventoryStore },session);
        const requested = requestedMaterialTotal(session, material.code, inventoryStore);
        const shortage = !!balance && requested > balance.availableQuantity;
        return <article key={material.code} className={"inventory-entry " + (shortage ? "inventory-entry-shortage" : "")} data-material={material.code}><strong>{material.name}</strong><small>{material.code}</small>
          <div className="inventory-balance"><span>{balance ? formatHa(balance.availableQuantity) + " " + balance.unit : "No balance"}</span><Badge tone={!balance ? "neutral" : balance.availableQuantity === 0 ? "red" : balance.availabilityBand === "low" ? "amber" : "green"}>{balance ? balance.availabilityBand.replaceAll("_", " ") : "Not supplied"}</Badge></div>
          {balance ? <p>On hand {formatHa(balance.onHandQuantity)} · Reserved {formatHa(balance.reservedQuantity)}</p> : <p>Stock balance not supplied for {inventoryStore}.</p>}
          {requested > 0 ? <p className={shortage ? "inventory-plan-shortage" : "inventory-plan-request"}>This plan: {formatHa(requested)} {balance?.unit || materialUnit(material.code, inventoryStore)}{shortage ? " · exceeds availability" : ""}</p> : null}
        </article>;
      })}{!shown.length ? <p className="inventory-empty">No inventory matches this search.</p> : null}</div>
      <div className="inventory-pool-footer"><span>{shown.length} shown · {inventoryStore}</span><small>Illustrative stock quantities</small></div>
    </section>
    <section className="activity-board programme-board materials-programme-board" aria-label="Material requests by activity">
      <div className="board-heading"><div><p className="eyebrow">MATERIAL REQUESTS</p><h2>Programme board <span>{groups.length}</span></h2></div></div>
      {!groups.length ? <div className="empty-state panel"><Package size={29} /><h3>No activities in Pre-plan.</h3><button className="button" onClick={onBrowse}>Browse Work Programme <ArrowRight size={14} /></button></div> : null}
      {groups.map((g, index) => {
        const opened = !!openGroups[g.key], first = g.items[0];
        const missing = materialIssues(session, g.key);
        const active = g.items.some((item) => item.id === focusedId);
        const detailsId = "material-inputs-" + g.key.replace(/[^a-zA-Z0-9_-]/g, "-");
        return <article key={g.key} data-group={g.key} className={"programme-allocation-card material-programme-card " + (active ? "programme-card-active " : "") + (!opened ? "programme-card-collapsed " : "") + (missing.length ? "activity-incomplete" : "")}>
          <header className="programme-card-header"><button type="button" className="programme-card-toggle" aria-label={(opened ? "Close material inputs for " : "Add materials to ") + g.title} aria-expanded={opened} aria-controls={detailsId} onClick={() => { onToggle(g.key); if (!opened) focusField(first); }}><span className="programme-card-number">{String(index + 1).padStart(2, "0")}</span><span className="programme-toggle-copy"><small>{g.activityCode || "Select activity"} · {activitySourceLabel(g.items[0])}</small><strong>{g.title}</strong></span><span className="material-action-label">{opened ? "Close" : "Add material"}</span><ChevronDown className="programme-card-chevron" size={18} /></button></header>
          <ProgrammeActivitySummary group={g} />
          {(!canEdit||g.items.some((item)=>item.instructionOrigin==="onsite"))&&onEdit?<button className="button button-small material-edit-work" disabled={g.items.some((item)=>lockedIds.includes(item.id))} onClick={()=>onEdit(g.items)}>Edit work programme</button>:null}
          {missing.length ? <p className="activity-missing"><TriangleAlert size={14} /><span>{missing[0]}</span></p> : null}
          <div className="material-inputs" id={detailsId} hidden={!opened}>{opened ? <>
            <div className="material-columns"><span>Field</span><span>Store</span><span>Requested quantity</span><span>Material</span></div>
            {g.items.map((item) => {
              const balance = stockFor(item,session), unit = materialUnit(item.materialCode, item.storageLocation);
              const requested = requestedMaterialTotal(session, item.materialCode, item.storageLocation);
              const shortage = materialStockIssue(session, item);
              return <div className={"material-request-row " + (focusedId === item.id ? "material-request-active" : "")} key={item.id} data-item={item.id} data-field={item.fieldNo} onFocusCapture={() => focusField(item)}>
                <div className="material-request-field"><strong>{item.fieldNo || "No field specified"}</strong><small>{item.programmeRound ? "Round " + item.programmeRound : g.kind === "harvesting" ? "Harvesting" : "General"}</small></div>
                <label className="material-request-store"><span>Store</span><select aria-label={"Material store " + g.title + " field " + item.fieldNo} value={item.storageLocation} disabled={!canEdit||item.instructionOrigin==="onsite"||lockedIds.includes(item.id)} onChange={(event) => { onPatch(item.id, { storageLocation: event.target.value }); onStore(event.target.value); }}>{stores.map((store) => <option key={store.code} value={store.code}>{store.code} · {store.name}</option>)}</select></label>
                <label className="material-request-quantity"><span>Requested quantity {unit ? "(" + unit + ")" : ""}</span><input aria-label={"Requested quantity " + g.title + " field " + item.fieldNo} type="number" min="0" step="0.01" placeholder={unit || "Qty"} value={item.materialQuantity > 0 ? item.materialQuantity : ""} disabled={!canEdit || item.instructionOrigin==="onsite" || lockedIds.includes(item.id) || !item.materialCode} onChange={(event) => onPatch(item.id, { materialQuantity: Number(event.target.value) })} /></label>
                <label className="material-request-material"><span>Material</span><select aria-label={"Material " + g.title + " field " + item.fieldNo} value={item.materialCode} disabled={!canEdit||item.instructionOrigin==="onsite"||lockedIds.includes(item.id)} onChange={(event) => onPatch(item.id, { materialCode: event.target.value, materialQuantity: event.target.value === item.materialCode ? item.materialQuantity : 0 })}><option value="">No material required</option>{materials.map((material) => <option key={material.code} value={material.code}>{material.code} · {material.name}</option>)}</select></label>
                {item.materialCode ? <div className={"material-request-balance " + (shortage ? "material-request-warning" : "")}>{!balance ? <><TriangleAlert size={13} /><span>Stock balance not supplied for {item.storageLocation}.</span></> : <><Package size={13} /><span>{formatHa(balance.availableQuantity)} {balance.unit} available · This plan: {formatHa(requested)} {balance.unit}{requested > balance.availableQuantity ? " · Combined requests exceed availability" : ""}</span></>}</div> : null}
              </div>;
            })}
            <p className="material-request-footnote">Requests do not issue materials or deduct stock.</p>
          </> : null}</div>
        </article>;
      })}
      {groups.length ? <button className="add-programme-link" disabled={!canEdit} onClick={onBrowse}><Plus size={15} /> Add fields from Work Programme <ArrowRight size={14} /></button> : null}
    </section>
  </div>;
}



type DailyAction = (id:string, action:(latest:Session)=>Session, message?:string)=>boolean;
type ReferenceTab = "preplan" | "acceptance" | "attendance" | "tickets" | "ha" | "checkroll";
const referenceTabs: { id: ReferenceTab; label: string }[] = [
  {id:"preplan",label:"Pre-plan"},{id:"acceptance",label:"Work acceptance"},{id:"attendance",label:"Attendance"},
  {id:"tickets",label:"Tickets"},{id:"ha",label:"Productivity"},{id:"checkroll",label:"Checkroll input"},
];
const referenceId = (id: string) => "daily-reference-" + id.replace(/[^a-zA-Z0-9_-]/g,"-");
function recordedAt(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "—";
  return new Intl.DateTimeFormat("en-MY",{day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"Asia/Kuala_Lumpur"}).format(new Date(value));
}
function ReferenceEmpty({ children }: { children: ReactNode }) { return <p className="reference-empty">{children}</p>; }
function ReadWorkTable({ session,items }: { session:Session;items:PlanItem[] }) {
  if (!items.length) return <ReferenceEmpty>No activities recorded.</ReferenceEmpty>;
  return <div className="reference-table-scroll"><table className="reference-table"><thead><tr><th>Activity</th><th>Field</th><th>Planned Ha</th><th>EVIT</th><th>Material / quantity / store</th><th>Remark</th></tr></thead><tbody>{items.map((i)=>{
    const material=materials.find((m)=>m.code===i.materialCode),unit=stocks.find((st)=>st.materialCode===i.materialCode&&st.storageLocation===i.storageLocation)?.unit||"";
    return <tr key={i.id}><td><strong>{i.activityCode || "—"}</strong><small>{programmes.find((p)=>p.id===i.programmeId)?.title||activityName(i.activityCode)||"Other work"}{i.harvestType?" · "+i.harvestType:""}</small></td><td>{i.fieldNo||"—"}{i.programmeRound?<small>Round {i.programmeRound}</small>:null}</td><td>{i.targetHa?formatHa(i.targetHa):"—"}</td><td>{fieldMachines(session,i).join(", ")||"—"}</td><td>{material?<><strong>{material.name}</strong><small>{i.materialCode} · {formatHa(i.materialQuantity)} {unit} · {i.storageLocation}</small></>:"No material requested"}</td><td>{i.remark||"—"}</td></tr>;
  })}</tbody></table></div>;
}
function AcceptanceReference({ day }: {day:Session}) {
  const morning=morningView(day),view=morningSession(day);
  return <>
    {morning.items.length?<><div className="reference-instruction-list">{morning.items.map((i)=>{const ticket=morning.tickets.find((t)=>t.itemId===i.id);return <article key={i.id}><div><strong>{i.activityCode} · {i.fieldNo||"No field specified"}</strong><span className={"reference-status "+(ticket?"is-done":"is-pending")}>{ticket?"Work accepted":"Pending acceptance"}</span></div><p>{i.instructionOrigin==="onsite"?"Created on the spot":morning.approvedItems.some((p)=>p.id===i.id)?"From pre-plan":"Morning work"}{ticket?" · "+ticket.id+" · "+ticket.recipient:""}</p></article>;})}</div><ReadWorkTable session={view} items={morning.items}/></>:<ReferenceEmpty>No submitted work instructions for this date.</ReferenceEmpty>}
    {morning.changes.length?<details className="reference-history"><summary>Morning changes & T6 history ({morning.changes.length})</summary>{morning.changes.map((change)=><article key={change.id}><strong>{change.action}</strong><p>{change.reason}</p><small>{change.actor} · {recordedAt(change.effectiveTime)}</small><details><summary>Before / after instructions</summary><h4>Before</h4><ReadWorkTable session={{...day,plan:{...day.plan,items:change.before,workerAllocations:change.beforeWorkers}}} items={change.before}/><h4>After</h4><ReadWorkTable session={{...day,plan:{...day.plan,items:change.after,workerAllocations:change.afterWorkers}}} items={change.after}/></details></article>)}</details>:null}
  </>;
}
function AttendanceReference({ day }: {day:Session}) {
  const morning=morningView(day),[query,setQuery]=useState(""),[gang,setGang]=useState("");
  const population=workers.filter((w)=>!w.needsReview),present=population.filter((w)=>morning.attendance[w.id]==="Present");
  const shown=workers.filter((w)=>(!gang||effectiveGang(day,w.id)===gang)&&(w.id+" "+w.name).toLowerCase().includes(query.trim().toLowerCase()));
  const t6=population.filter((w)=>effectiveGang(day,w.id)!==w.gang);
  const changes=morning.changes.filter((c)=>/T6/i.test(c.action));
  return <>
    <div className="reference-metrics"><span><strong>{present.length}</strong>Clocked in</span><span><strong>{population.length-present.length}</strong>Not clocked in</span><span><strong>{t6.length}</strong>Current T6</span></div>
    <div className="reference-filters"><label className="search-field"><Search size={14}/><input aria-label="Search reference attendance" placeholder="Worker name or ID" value={query} onChange={(e)=>setQuery(e.target.value)}/></label><label><span>Working gang</span><select aria-label="Reference attendance gang" value={gang} onChange={(e)=>setGang(e.target.value)}><option value="">All gangs</option>{gangs.map((g)=><option key={g} value={g}>Gang {g}</option>)}</select></label></div>
    <div className="reference-table-scroll reference-attendance-scroll"><table className="reference-table"><thead><tr><th>Worker</th><th>Home gang</th><th>Working gang</th><th>Attendance</th><th>EVIT</th></tr></thead><tbody>{shown.map((w)=><tr key={w.id}><td><strong>{w.name}</strong><small>{w.id}{w.needsReview?" · Identity review":""}</small></td><td>{w.gang}</td><td>{effectiveGang(day,w.id)}{effectiveGang(day,w.id)!==w.gang?<small>T6</small>:null}</td><td>{morning.attendance[w.id]==="Present"?"Clocked in":morning.attendance[w.id]==="Absent"?"Earlier absence record":"—"}</td><td>{morning.machineDrivers?.[w.id]?.evitCode||"—"}{morning.machineDrivers?.[w.id]?<small>{morning.machineDrivers[w.id].role}</small>:null}</td></tr>)}</tbody></table></div>{!shown.length?<ReferenceEmpty>No workers match.</ReferenceEmpty>:null}
    <p className="reference-note">Not clocked in means unconfirmed. It does not declare the worker absent.</p>
    {changes.length?<details className="reference-history"><summary>T6 records ({changes.length})</summary>{changes.map((c)=><article key={c.id}><strong>{c.action}</strong><p>{c.reason}</p><small>{recordedAt(c.effectiveTime)}</small>{Object.entries(c.afterGangs).filter(([id,g])=>g!==c.beforeGangs[id]).map(([id,g])=><p key={id}>{workerName(id)} · Gang {c.beforeGangs[id]||workers.find((w)=>w.id===id)?.gang} → Gang {g}</p>)}</article>)}</details>:null}
  </>;
}
function TicketsReference({ day }: {day:Session}) {
  const morning=morningView(day),view=morningSession(day);
  return <>
    {!morning.tickets.length?<ReferenceEmpty>No tickets have been issued for this date.</ReferenceEmpty>:morning.tickets.map((t)=>{const item=morning.items.find((i)=>i.id===t.itemId);return <article className="reference-ticket" key={t.id}><header><div><strong>{t.id}</strong><p>{t.recipient}</p></div><span className={"reference-status "+(t.status==="Accepted"?"is-done":"is-pending")}>{t.status==="Accepted"?"Opened":"Sent"}</span></header>{item?<ReadWorkTable session={view} items={[item]}/>:null}{t.workerIds.length?<details><summary>Previously recorded worker details ({t.workerIds.length})</summary><p>{t.workerIds.map(workerName).join(", ")}</p></details>:null}</article>;})}
  </>;
}
type SectionStatus = {done:boolean;text:string;pending?:number};
function sectionStatuses(session:Session,record:DailyRecord):Record<ReferenceTab,SectionStatus> {
  const day={...session,plan:record.plan,morning:record.morning,days:undefined};
  const effective=record.morning||hasSharedPlan(day)?{...record,morning:morningView(day)}:record;
  const r=dailyWorkSummary(session,effective),m=morningView(day);
  const count=new Set(r.items.map(activityGroupKey)).size,fields=new Set(r.items.map((i)=>i.fieldNo).filter(Boolean)).size;
  const planned=record.plan.items.length>0;
  const preplanDone=!(record.plan.workDraft?.length)&&(planned?hasSharedPlan(day)&&record.plan.status!=="Draft":m.items.length>0);
  const issued=m.tickets.length,opened=m.tickets.filter((t)=>t.status==="Accepted").length;
  return {
    preplan:{done:preplanDone,text:record.plan.workDraft?.length?record.plan.workDraft.length+" additional entries awaiting submission":planned?(preplanDone?"Submitted":"Draft")+" · "+count+" activities · "+fields+" fields":m.items.length?count+" work programmes added":"No activities added"},
    acceptance:{done:r.items.length>0&&issued===r.items.length,text:r.morning},
    attendance:{done:r.attendanceDone,text:record.morning?.attendanceSubmittedAt&&!record.morning.attendanceComplete?r.attendance.replace("Submitted","Updated · submit again"):r.attendance},
    tickets:{done:issued>0&&issued===r.items.length&&opened===issued,text:issued+" issued · "+opened+" opened by Mandore"},
    ha:{done:r.productivityDone,text:r.productivityDone?"All productivity approved":r.productivityPending+" awaiting completion or approval",pending:r.productivityPending},
    checkroll:{done:r.checkrollDone,text:r.checkroll+(r.checkrollPending?" · "+r.checkrollPending+" inputs missing":""),pending:r.checkrollPending},
  };
}
function ReadonlyPreplan({day}:{day:Session}) {
  const [resource,setResource]=useState<"activities"|"materials">("activities");
  const [collapsed,setCollapsed]=useState<Record<string,boolean>>({});
  const [opened,setOpened]=useState<Record<string,boolean>>({});
  const [focused,setFocused]=useState("");
  const [store,setStore]=useState("SR01"),[category,setCategory]=useState("Fertiliser"),[query,setQuery]=useState("");
  const effective=morningView(day).items;
  const plannedIds=new Set(day.plan.items.map((item)=>item.id));
  const planned=day.plan.status==="Draft"?day.plan.items:effective.filter((item)=>plannedIds.has(item.id)),additional=effective.filter((item)=>!plannedIds.has(item.id));
  const pending=day.plan.workDraft||[],all=[...planned,...additional,...pending];
  const view={...day,plan:{...day.plan,items:all}};
  const noop=()=>{};
  const board=(items:PlanItem[],title:string)=><ProgrammeBoard session={{...view,plan:{...view.plan,items}}} canEdit={false} focusedKey="" collapsedGroups={collapsed}
    onToggleGroup={(key)=>setCollapsed((previous)=>({...previous,[key]:previous[key]===false}))}
    onExpandGroup={(key)=>setCollapsed((previous)=>({...previous,[key]:false}))} onFocus={setFocused}
    run={noop} onPatch={noop} onRemoveField={noop} onBrowse={noop} onAdd={noop} onAddGeneral={noop}
    title={title} showAddActions={false} allowStructureChanges={false}/>;
  return <div className="daily-inline-preplan" aria-label="View-only pre-plan">
    <p className="reference-note">View only</p>
    <div className="plan-tabs" role="group" aria-label="Pre-plan section">
      <button className={resource==="activities"?"active":""} onClick={()=>setResource("activities")}><Users size={15}/> Activities</button>
      <button className={resource==="materials"?"active":""} onClick={()=>setResource("materials")}><Package size={15}/> Materials</button>
    </div>
    {!all.length?<ReferenceEmpty>No activities recorded for this day.</ReferenceEmpty>:resource==="activities"?<>
      {planned.length?board(planned,"Planned activities"):null}
      {additional.length?<section className="additional-work">{board(additional,"Additional work")}</section>:null}
      {pending.length?<section className="additional-work">{board(pending,"Pending additions")}</section>:null}
    </>:<MaterialsBoard session={view} canEdit={false} focusedId={focused||all[0]?.id||""} openGroups={opened}
      inventoryStore={store} inventoryCategory={category} inventorySearch={query}
      onToggle={(key)=>setOpened((previous)=>({...previous,[key]:!previous[key]}))}
      onFocus={setFocused} onStore={setStore} onCategory={setCategory} onSearch={setQuery} onPatch={noop} onBrowse={noop}/>}
  </div>;
}
function DailyReference({session,record,tab,onTab,onClose,onOpen,role,onAction,onAttendance,preplanEditor}: {
  session:Session;record:DailyRecord;tab:ReferenceTab|null;onTab:(tab:ReferenceTab)=>void;onClose:()=>void;
  onOpen:(id:string,panel:"plan"|"morning")=>void;role:OfficeRole;onAction:DailyAction;onAttendance:(id:string)=>void;preplanEditor?:ReactNode;
}) {
  const id=referenceId(record.plan.id),day={...session,plan:record.plan,morning:record.morning,days:undefined},statuses=sectionStatuses(session,record);
  return <section className="daily-reference compact-daily-reference" aria-label={"Details for "+record.plan.id} id={id}>
    <div className="reference-tabs" role="tablist" aria-label="Daily reference categories">{referenceTabs.map(({id:key,label},index)=>{
      const status=statuses[key],badge=status.pending||0;
      return <button id={id+"-tab-"+key} key={key} type="button" role="tab" aria-label={label+(badge?" ("+badge+")":"")} aria-selected={tab===key} aria-controls={id+"-panel"} tabIndex={tab===key||!tab&&index===0?0:-1}
        className={status.done?"tab-complete":"tab-pending"} title={status.done?"Completed":"Pending"} onClick={()=>tab===key?onClose():onTab(key)}
        onKeyDown={(e)=>{if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;e.preventDefault();const next=e.key==="Home"?0:e.key==="End"?referenceTabs.length-1:(index+(e.key==="ArrowRight"?1:-1)+referenceTabs.length)%referenceTabs.length;onTab(referenceTabs[next].id);requestAnimationFrame(()=>document.getElementById(id+"-tab-"+referenceTabs[next].id)?.focus());}}>
        {status.done?<CheckCheck size={13} aria-hidden="true"/>:<Clock3 size={13} aria-hidden="true"/>}<span>{label}</span>{badge?<span className="daily-pending-count" aria-hidden="true">({badge})</span>:null}
      </button>;
    })}</div>
    {tab?<div className="reference-tab-panel" id={id+"-panel"} role="tabpanel" aria-labelledby={id+"-tab-"+tab} tabIndex={0}>
      <h3 className="daily-section-title">{referenceTabs.find((t)=>t.id===tab)!.label}</h3>
      <p className={"daily-status-line "+(statuses[tab].done?"status-complete":"status-incomplete")} role="status" aria-label={referenceTabs.find((t)=>t.id===tab)!.label+" status"}>{statuses[tab].done?<CheckCheck size={14}/>:<Clock3 size={14}/>}<span>{statuses[tab].text}</span></p>
      {tab==="preplan"?role==="Store Clerk"?<ReadonlyPreplan key={record.plan.id} day={day}/>:preplanEditor?<div className="daily-inline-preplan">{preplanEditor}</div>:<><ReadWorkTable session={day} items={morningView(day).items}/><button className="button button-small" onClick={()=>onOpen(record.plan.id,"plan")}>Open instructions</button></>:tab==="acceptance"?<AcceptanceReference day={day}/>:tab==="attendance"?<AttendanceReference day={day}/>:tab==="tickets"?<TicketsReference day={day}/>:tab==="ha"?<div className="daily-inline-review"><CompletionReview key={record.plan.id+":"+role} session={day} role={role} onAction={(action,message)=>onAction(record.plan.id,action,message)}/></div>:<div className="daily-inline-checkroll">{role==="Store Clerk"?<CheckrollReferenceDetails session={day}/>:<CheckrollWorkspace key={record.plan.id+":"+role} session={day} role={role} onAttendance={()=>onAttendance(record.plan.id)} onAction={(action,message)=>onAction(record.plan.id,action,message)}/>}</div>}
      {role!=="Store Clerk"&&["acceptance","tickets"].includes(tab)?<footer className="reference-workspace-link"><button className="text-button" onClick={()=>onOpen(record.plan.id,"morning")}>Open field workspace <ArrowRight size={13}/></button></footer>:null}
    </div>:null}
  </section>;
}
function DailyWorkSummary({session,selectedDay,onSelected,canPlan,onOpen,onCreate,role,onAction,onAttendance,preplanEditor,expanded,onExpanded,detail,onDetail,query,onQuery}: {
  session:Session;canPlan:boolean;onOpen:(id:string,panel:"plan"|"morning")=>void;onCreate:(date:string)=>boolean;
  role:OfficeRole;onAction:DailyAction;onAttendance:(id:string)=>void;preplanEditor:ReactNode;
  expanded:Record<string,boolean>;onExpanded:(id:string,open:boolean)=>void;
  detail:{id:string;tab:ReferenceTab}|null;onDetail:(detail:{id:string;tab:ReferenceTab}|null)=>void;
  query:string;onQuery:(query:string)=>void;
  selectedDay:string|null;onSelected:(id:string)=>void;
}) {
  const [selectedDate,setDate]=useState<string|null>(null),date=selectedDate??nextPlanningDate(session.plan.date);
  const records=dailyRecords(session),shown=records.filter((record)=>(record.plan.id+" "+record.plan.date+" "+dailyWorkSummary(session,record).origin).toLowerCase().includes(query.trim().toLowerCase()));
  const openDetails=(id:string,tab:ReferenceTab)=>{if(tab==="preplan"&&canPlan){onOpen(id,"plan");return;}onDetail({id,tab});};
  return <>
    <div className="page-heading"><div><p className="eyebrow">M2 · DAILY WORK</p><h1>Attendance and Productivity</h1></div><Badge tone="sage">{records.length} {records.length===1?"day":"days"}</Badge></div>
    <section className="panel daily-summary-controls" aria-label="Daily summary controls"><label className="search-field"><Search size={15}/><input aria-label="Find daily work" placeholder="Reference, date or work source" value={query} onChange={(e)=>onQuery(e.target.value)}/></label>{canPlan?<><label className="execution-date"><CalendarDays size={15}/><input aria-label="New daily plan date" type="date" value={date} onChange={(e)=>setDate(e.target.value)}/></label><button className="button" disabled={!date} onClick={()=>{if(onCreate(date))setDate(nextPlanningDate(date));}}><Plus size={14}/> New day</button></>:<span className="reference-note">View only</span>}</section>
    {!shown.length?<div className="empty-state panel"><ClipboardList size={27}/><h2>No matching days</h2><p>Try a reference, date or work source.</p></div>:null}
    <div className="daily-summary-list">{shown.map((record)=>{
      const id=record.plan.id,open=!!expanded[id],panelId="daily-summary-"+id.replace(/[^a-zA-Z0-9_-]/g,"-"),r=dailyWorkSummary(session,record);
      return <article className={"panel daily-summary-card "+(open?"is-open ":"")+(id===selectedDay?"is-selected":"")} key={id} data-day={id} onClick={()=>onSelected(id)} aria-current={id===selectedDay?"true":undefined} aria-label={"Daily summary "+r.reference}>
        <button type="button" className="daily-summary-toggle" aria-label={"Show daily summary "+id} aria-expanded={open} aria-controls={panelId} onClick={()=>onExpanded(id,!open)}><span><strong>{r.reference}</strong><small>{formatDate(record.plan.date,true)} · {r.origin}</small></span><Badge tone={id===session.plan.id?"green":"neutral"}>{id===session.plan.id?"Current day":"Saved day"}</Badge><ChevronDown size={18}/></button>
        {open?<div className="daily-summary-body" id={panelId}><DailyReference session={session} record={record} role={role} onAction={onAction} onAttendance={onAttendance}
          tab={detail?.id===id?detail.tab:null} onTab={(tab)=>openDetails(id,tab)} onClose={()=>onDetail(null)} onOpen={onOpen} preplanEditor={id===session.plan.id?preplanEditor:undefined}/></div>:null}
      </article>;
    })}</div>
  </>;
}
