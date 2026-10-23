"use client";

import { useState, type ComponentProps } from "react";
import {
  CalendarDays, ChartNoAxesCombined, ChevronLeft, LayoutGrid,
  Leaf, Package, Sprout, Tractor, Users, Wheat, Wifi, Wrench,
} from "lucide-react";
import { MachineWorkspace } from "@/components/machine-workspace";
import { isMachineRole, machineOperators, machineUnread } from "@/lib/machine";
import { WarehouseWorkspace } from "@/components/warehouse-workspace";
import { warehouseCounts } from "@/lib/warehouse";
import { PhoneWorkspace } from "@/components/phone-workspace";
import { WorkProgramme } from "@/components/work-programme";
import { HarvestingInterval } from "@/components/harvesting-interval";
import { morningView } from "@/lib/morning-work";
import { HARVEST_ACTIVITY } from "@/lib/harvesting-interval";
import { WORKSHOP_YEAR } from "@/lib/work-programme";
import { isManagement } from "@/lib/workshop";

export type PhoneScreen = "menu" | "programme" | "attendance" | "machine" | "warehouse";

export const DEX_MODULES = [
  { number: 1, title: "Work Programme", description: "Upkeep · Harvesting interval", icon: CalendarDays, screen: "programme" },
  { number: 2, title: "Attendance", description: "Work · Clock/in · Productivity", icon: Users, screen: "attendance" },
  { number: 3, title: "Machine System", description: "Work · Tracking · Productivity", icon: Tractor, screen: "machine" },
  { number: 4, title: "Warehouse", description: "Requests · Stock · Issue", icon: Package, screen: "warehouse" },
  { number: 5, title: "Costbook", description: "Costs · Reporting", icon: ChartNoAxesCombined, screen: null },
  { number: 6, title: "Harvesting", description: "Harvesting insights", icon: Wheat, screen: null },
  { number: 7, title: "Upkeep", description: "Estate upkeep", icon: Sprout, screen: null },
  { number: 8, title: "General Tools", description: "GIS · Estate tools", icon: Wrench, screen: null },
] as const;

type Props = ComponentProps<typeof PhoneWorkspace> & {
  screen: PhoneScreen;
  onScreen: (screen: PhoneScreen) => void;
};

export function PhonePortal({ session, role, screen: requestedScreen, onScreen, ...workspace }: Props) {
  const [operatorIdentity,setOperatorIdentity]=useState("");
  const [programmeTab, setProgrammeTab] = useState<"upkeep" | "harvesting">("upkeep");
  const [programmeId, setProgrammeId] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");
  const [year, setYear] = useState(WORKSHOP_YEAR);
  const [field, setField] = useState("02D1");
  const management = isManagement(role), operator=isMachineRole(role);
  const clerk = role === "Store Clerk";
  const warehouseAccess = management || clerk;
  const programmeAccess = management || clerk;
  const machineAccess=management||clerk||operator,attendanceAccess=management||clerk||role==="Upkeep Mandor"||role==="Harvesting Mandor";
  const canOpen = (next: Exclude<PhoneScreen,"menu">) => next === "programme" ? programmeAccess : next === "warehouse" ? warehouseAccess : next==="machine"?machineAccess:attendanceAccess;
  const operatorOptions=machineOperators(session,operator?role:undefined),operatorId=operatorOptions.some((v)=>v.id===operatorIdentity)?operatorIdentity:operatorOptions[0]?.id||"";
  const machineNotifications=machineUnread(session,role,operator?operatorId||undefined:undefined);
  const warehouseUnread = warehouseAccess?Object.values(warehouseCounts(session,role)).reduce((n,value)=>n+value,0):0;
  const screen = requestedScreen !== "menu" && !canOpen(requestedScreen) ? "menu" : requestedScreen;
  const morning = morningView(session);
  const unread = management
    ? morning.items.filter((item) => !morning.tickets.some((ticket) => ticket.itemId === item.id)).length
    : morning.tickets.filter((ticket) => ticket.status === "Assigned" && ticket.recipient === role).length;
  const notificationLabel = management ? "new work instructions" : "new tickets";
  const name = operator ? operatorOptions.find((v)=>v.id===operatorId)?.name||role : clerk ? "Store Clerk" : role === "Harvesting Mandor" ? "Adam" : role === "Upkeep Mandor" ? "Jia Wei" : "Haikal";
  const title = role === "Harvesting Mandor" ? "Harvesting Mandore" : role === "Upkeep Mandor" ? "Upkeep Mandore" : role;
  const openModule = (next: "programme" | "attendance" | "machine" | "warehouse") => {
    if (!canOpen(next)) return;
    if (next === "attendance") workspace.onTab("listing");
    onScreen(next);
  };

  return <>
    <header className="phone-app-header phone-portal-header">
      <button className="phone-menu-back" aria-label="Back to module menu" disabled={screen === "menu"} onClick={() => onScreen("menu")}><ChevronLeft size={22} /></button>
      <span className="phone-brand"><span className="leaf-mark leaf-mark-small"><Leaf size={18} strokeWidth={1.8} /></span><strong>DEX<span>.</span></strong></span>
      <span className="phone-module-label">{screen === "machine" ? "M3 · Machine System" : screen === "warehouse" ? "M4 · Warehouse" : screen === "programme" ? "M1 · Work Programme" : screen === "attendance" ? "M2 · Attendance" : "Digital Estate Extended"}</span>
    </header>

    <div className="phone-module-pane" hidden={screen !== "menu"}>
      <div className="phone-content phone-module-home">
        <section className={"phone-greeting"+(operator?" mc-operator-greeting":"")} aria-label="Your estate profile">
          <div><p>Good morning,</p><h1>{name}</h1><span>{title}</span></div>
          <div className="phone-home-estate"><strong>Ladang Digital</strong><span className="phone-online"><Wifi size={13} />Online</span></div>
        </section>
        <div className="phone-modules-heading"><h2>Modules</h2><span>E063</span></div>
        <nav className="phone-module-grid" aria-label="Mobile modules">
          {DEX_MODULES.map(({ number, title: label, description, icon: Icon, screen: target }) => {
            const allowed=!!target&&canOpen(target),restricted=!!target&&!allowed,viewOnly=clerk&&!!target&&number!==4;
            return <button
              key={number} disabled={!allowed} className={"phone-module-card"+(allowed?"":" phone-module-unavailable")}
              onClick={()=>{if(target&&allowed)openModule(target);}}
              aria-label={"M"+number+" "+label+(number===4&&warehouseUnread?" · "+warehouseUnread+" pending warehouse items":number===2&&unread?" · "+unread+" "+notificationLabel:number===3&&machineNotifications?" · "+machineNotifications+" new machine tickets":"")+(restricted?" · Restricted":!target?" · Work in progress":viewOnly?" · View only":"")}
            >
              <span className="phone-module-top"><span className="phone-module-icon"><Icon size={23}/></span><small>M{number}</small></span>
              {number===3&&machineNotifications>0?<span className="phone-module-badge" aria-label={machineNotifications+" new machine tickets"}>{machineNotifications}</span>:number===4&&warehouseUnread>0?<span className="phone-module-badge" aria-label={warehouseUnread+" pending warehouse items"}>{warehouseUnread}</span>:number===2&&unread>0?<span className="phone-module-badge" aria-label={unread+" "+notificationLabel}>{unread}</span>:null}
              <strong>{label}</strong><span className="phone-module-description">{description}</span>
              {restricted||!target||viewOnly?<span className="phone-module-wip">{restricted?"Restricted":!target?"Work in progress":"View only"}</span>:null}
            </button>;
          })}
        </nav>
      </div>
      <div className="phone-menu-footer"><LayoutGrid size={17} /><span>Menu</span></div>
    </div>

    {programmeAccess ? <div className="phone-module-pane" hidden={screen !== "programme"}>
      <div className="phone-content phone-m1">
        {clerk?<p className="reference-note">View only</p>:null}
        <div className="phone-m1-tabs" role="group" aria-label="Mobile work programme type">
          <button aria-pressed={programmeTab === "upkeep"} onClick={() => setProgrammeTab("upkeep")}><Leaf size={14} />Upkeep</button>
          <button aria-pressed={programmeTab === "harvesting"} onClick={() => setProgrammeTab("harvesting")}><Wheat size={14} />Harvesting</button>
        </div>
        <div className="phone-m1-source" hidden={programmeTab !== "upkeep"}>
          <WorkProgramme compact session={session} programmeId={programmeId} onProgrammeChange={setProgrammeId}
            view={view} onViewChange={setView} year={year} onYearChange={setYear}
            selectedField={field} onFieldChange={setField} onToggleField={() => {}}
            items={morning.items} canEdit={false} readOnly={clerk} onContinue={() => openModule("attendance")} />
        </div>
        <div className="phone-m1-source" hidden={programmeTab !== "harvesting"}>
          <HarvestingInterval session={session} items={morning.items} planningDate={session.plan.date} canEdit={false}
            activityCode={HARVEST_ACTIVITY} onActivity={() => {}} onToggleField={() => {}} />
        </div>
      </div>
    </div> : null}

    {machineAccess?<div className="phone-module-pane" hidden={screen!=="machine"}><MachineWorkspace session={session} role={role} onAction={workspace.onAction} selectedDriver={operatorId} onDriver={setOperatorIdentity}/></div>:null}
    {warehouseAccess ? <div className="phone-module-pane" hidden={screen !== "warehouse"}><WarehouseWorkspace session={session} role={role} platform="phone" onAction={workspace.onAction}/></div> : null}
    {attendanceAccess?<div className="phone-module-pane" hidden={screen !== "attendance"}>
      <PhoneWorkspace {...workspace} session={session} role={role} />
    </div>:null}
  </>;
}
