import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const root=process.cwd(),nativeRequire=createRequire(import.meta.url),cache=new Map();
function load(name){
  let file=path.resolve(root,name);
  if(!path.extname(file))file+=fs.existsSync(file+".ts")?".ts":".json";
  if(cache.has(file))return cache.get(file).exports;
  const loaded={exports:{}};cache.set(file,loaded);
  if(file.endsWith(".json"))loaded.exports=JSON.parse(fs.readFileSync(file,"utf8"));
  else{
    const code=ts.transpileModule(fs.readFileSync(file,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    const require=(name)=>name.startsWith("@/")?load(name.slice(2)):name.startsWith(".")?load(path.relative(root,path.resolve(path.dirname(file),name))):nativeRequire(name);
    vm.runInThisContext("(function(require,module,exports){"+code+"\n})",{filename:file})(require,loaded,loaded.exports);
  }
  return loaded.exports;
}

const w=load("lib/workshop"),m=load("lib/morning-work"),h=load("lib/warehouse"),m3=load("lib/machine"),c=load("lib/work-completion");
let checks=0;
function check(label,run){run();checks++;console.log("PASS "+label);}
const clone=(v)=>JSON.parse(JSON.stringify(v)),t0=Date.parse("2026-10-20T00:00:00Z");
let s=w.createSession("blank");
const legacy=clone(s),p=w.programmes.find((p)=>p.activityCode==="PM1501");
const drivers=w.workers.filter((v)=>v.gang==="24"&&!v.needsReview).slice(0,2);
const a={role:"Machine Operator",workerId:drivers[0].id},b={role:"Machine Specialist",workerId:drivers[1].id};
check("Legacy sessions load without machine data",()=>assert(w.parseSession(clone(s))));
let draft=m.createWorkDraft(s,{kind:"upkeep",programmeId:p.id,activityCode:p.activityCode,fields:["02D1","05C1"]});
draft.plan.items=draft.plan.items.map((item,i)=>({...item,targetHa:2,evitCode:i?"RM209":"MB001",materialCode:i?"":"1300000147",storageLocation:i?"":"SR01",materialQuantity:i?0:1}));
s=m.submitDailyWork(s,draft,"Assistant Manager");
const items=m.morningView(s).items;
check("Draft/new instructions do not dispatch machine tickets",()=>assert.equal(m3.machineJobs(s).length,0));
check("EVIT assignment requires a clocked-in worker and management",()=>{
 assert.throws(()=>m.assignClockMachine(s,a.workerId,"MB001",a.role,"Field Officer"));
 assert.throws(()=>m.assignClockMachine(s,a.workerId,"MB001",a.role,"Store Clerk"));
});
s=m.clockWorkers(s,drivers.map((d)=>d.id),"Present","Field Officer");
s=m.assignClockMachine(s,a.workerId,"MB001",a.role,"Field Officer");
check("One EVIT cannot be assigned to two drivers on the same day",()=>assert.throws(()=>m.assignClockMachine(s,b.workerId,"MB001",b.role,"Field Officer")));
s=m.assignClockMachine(s,b.workerId,"RM209",b.role,"Field Officer");
check("EVIT assignments persist without allocating labour",()=>{
 assert.equal(m.morningView(s).workerAllocations.length,0);assert(w.parseSession(clone(s)));assert.equal(m3.machineJobs(s).length,0);
 assert.throws(()=>m.acceptDailyWork(s,items.map((i)=>i.id)));
});
s=m.saveAttendance(s,"Field Officer");
check("Submitted attendance alone does not dispatch unaccepted work",()=>assert.equal(m3.machineJobs(s).length,0));
s=m.acceptDailyWork(s,items.map((i)=>i.id));
const jobs=m3.machineJobs(s),ja=jobs.find((j)=>j.driverId===a.workerId).id,jb=jobs.find((j)=>j.driverId===b.workerId).id;
check("Accepted instructions match EVIT to the correct named driver",()=>{
 assert.equal(jobs.length,2);assert.equal(m3.machineUnread(s,a.role),1);assert.equal(m3.machineUnread(s,b.role),1);
 assert.equal(jobs.find((j)=>j.id===ja).item.fieldNo,"02D1");assert.equal(jobs.find((j)=>j.id===jb).item.fieldNo,"05C1");
 assert.deepEqual(m3.machineJobs(m.acceptDailyWork(s,items.map((i)=>i.id))).map((j)=>j.id),jobs.map((j)=>j.id));
});
const mandoreTickets=clone(m.morningView(s).tickets),activityBefore=JSON.stringify(s.completions||[]),programmeBefore=clone(c.programmesForSession(s));
check("Only the assigned driver can accept or edit a job",()=>{
 assert.throws(()=>m3.acceptMachineJob(s,ja,b,t0));assert.throws(()=>m3.acceptMachineJob(s,ja,{...a,role:"Field Officer"},t0));
 assert.throws(()=>m3.acceptMachineJob(s,jb,a,t0));
});
s=m3.openMachineJob(s,ja,a,t0);s=m3.acceptMachineJob(s,ja,a,t0);
check("Opening clears only the driver's own notification",()=>{assert.equal(m3.machineUnread(s,a.role),0);assert.equal(m3.machineUnread(s,b.role),1);assert.equal(m3.acceptMachineJob(s,ja,a,t0),s);});
check("Accepted job locks instruction and driver assignment",()=>{
 assert.throws(()=>m.assignClockMachine(s,a.workerId,"MB003",a.role,"Field Officer"));
 assert.throws(()=>m.clockWorkers(s,[a.workerId],"Unconfirmed","Field Officer"));
 assert.throws(()=>m.saveDailyWorkChanges(s,[items[0].id],[{...items[0],targetHa:1}],"Field Officer"));
});
let prep=m3.defaultMachineCheck();prep.fuelLitres=20;
check("Operating requires an IPS answer and valid issued-material references",()=>{
 assert.throws(()=>m3.prepareMachineJob(s,ja,prep,a,t0));
 assert.throws(()=>m3.prepareMachineJob(s,ja,{...prep,ips:"Yes",pickupIds:["fake"]},a,t0));
});
const request=h.materialRequests(s).find((r)=>r.itemId===items[0].id);
s=h.postMovement(s,{kind:"Issue out",estate:"E063",store:"SR01",materialCode:request.materialCode,quantity:1,requestKey:request.key,activityCode:request.activityCode,fieldNo:request.fieldNo,receiver:drivers[0].name,remark:""},"Store Clerk");
const stockAfterIssue=clone(h.warehouseStock(s)),issueId=m3.machinePickupItems(s,m3.machineJobs(s).find((j)=>j.id===ja))[0].id;
prep={...prep,ips:"No",items:{...prep.items,rops:"Kurang"},pickupIds:[issueId]};
s=m3.prepareMachineJob(s,ja,prep,a,t0+1000);
check("Checklist exceptions are recorded without extra approval/blocking",()=>{assert.equal(m3.machineJobs(s).find((j)=>j.id===ja).phase,"Ready");assert(w.parseSession(clone(s)));});
check("Confirming pickup does not deduct Warehouse stock a second time",()=>assert.deepEqual(h.warehouseStock(s),stockAfterIssue));
s=m3.startMachineJob(s,ja,a,t0+2000);
s=m3.addMachineIssue(s,ja,{category:"Pokok tumbang",remark:"Test",position:{x:.4,y:.5},photo:"data:image/png;base64,aGVsbG8="},a,t0+12000);
s=m3.breakMachineJob(s,ja,"Hydraulic","Hose",a,t0+32000);
check("Breakdown pauses operating time and starts downtime",()=>{
 const job=m3.machineJobs(s).find((j)=>j.id===ja);
 assert.equal(m3.machineElapsed(job,t0+42000).operating,30);assert.equal(m3.machineElapsed(job,t0+42000).downtime,10);
 assert.equal(m3.machineProgress(job,t0+42000),m3.machineProgress(job,t0+72000));assert(w.parseSession(clone(s)));
});
s=m3.resumeMachineJob(s,ja,a,t0+52000);
s=m3.endMachineJob(s,ja,a,t0+82000);
check("Resume and end preserve route, pins and both timers",()=>{
 const job=m3.machineJobs(s).find((j)=>j.id===ja),times=m3.machineElapsed(job,t0+200000);
 assert.equal(times.operating,60);assert.equal(times.downtime,20);assert.equal(job.issues.length,1);
 assert.equal(job.routeProgress,2/3);assert.equal(job.trackedHa,1.33);assert(w.parseSession(clone(s)));
});
s=m3.submitMachineReport(s,ja,1.25,"Manual area",a,0,t0+83000);
check("Machine completion is separate from M2 Activity Ha and M1",()=>{
 assert.equal(JSON.stringify(s.completions||[]),activityBefore);assert.deepEqual(c.programmesForSession(s),programmeBefore);
 assert.deepEqual(m.morningView(s).tickets,mandoreTickets);assert.equal(m3.machineSummary(s,s.plan.date).pending,1);assert(w.parseSession(clone(s)));
});
check("MO/MS and Store Clerk cannot approve machine productivity",()=>{
 for(const role of ["Machine Operator","Machine Specialist","Store Clerk","Upkeep Mandor"])assert.throws(()=>m3.approveMachineReports(s,[{id:ja,revision:1}],role,t0+84000));
});
check("Approval is atomic and rejects stale report versions",()=>{
 const before=JSON.stringify(s);assert.throws(()=>m3.approveMachineReports(s,[{id:ja,revision:2}],"Field Officer"));assert.equal(JSON.stringify(s),before);
});
s=m3.approveMachineReports(s,[{id:ja,revision:1}],"Field Officer",t0+84000);
check("FO approval changes machine status without programme credit",()=>{
 assert.equal(m3.latestMachineReport(m3.machineJobs(s).find((j)=>j.id===ja)).status,"Approved");
 assert.equal(m3.machineSummary(s,s.plan.date).approvedHa,1.25);assert.deepEqual(c.programmesForSession(s),programmeBefore);assert(w.parseSession(clone(s)));
});
s=m3.submitMachineReport(s,ja,1.5,"Corrected total",a,1,t0+85000);
check("Own-ticket corrections preserve prior approval and become pending again",()=>{
 const job=m3.machineJobs(s).find((j)=>j.id===ja);assert.equal(job.reports.length,2);assert.equal(job.reports[0].status,"Approved");
 assert.equal(m3.latestMachineReport(job).status,"Pending approval");assert.equal(m3.machineSummary(s,s.plan.date).approvedHa,0);assert(w.parseSession(clone(s)));
});
s=m3.acceptMachineJob(s,jb,b,t0+86000);
s=m3.prepareMachineJob(s,jb,{...m3.defaultMachineCheck(),status:"Breakdown",reason:"Tyre",remark:"Before moving"},b,t0+87000);
check("Pre-start breakdown closes with zero Ha and no tracking",()=>{
 const job=m3.machineJobs(s).find((j)=>j.id===jb);assert.equal(job.phase,"Submitted");assert.equal(m3.latestMachineReport(job).declaredHa,0);assert.equal(job.segments.length,0);
 assert.throws(()=>m3.startMachineJob(s,jb,b));assert.throws(()=>m3.submitMachineReport(s,jb,1,"",b,1));assert(w.parseSession(clone(s)));
});
s=m3.approveMachineReports(s,[{id:ja,revision:2},{id:jb,revision:1}],"Assistant Manager",t0+88000);
check("AM can approve several completed machine reports once",()=>{
 assert.equal(m3.machineSummary(s,s.plan.date).approved,2);assert.equal(m3.machineSummary(s,s.plan.date).approvedHa,1.5);
 assert.throws(()=>m3.approveMachineReports(s,[{id:ja,revision:2}],"Manager"));assert(w.parseSession(clone(s)));
});
check("Completed work is not re-dispatched when its EVIT later changes driver",()=>{
 let changed=m.assignClockMachine(s,a.workerId,"",a.role,"Field Officer");changed=m.assignClockMachine(changed,b.workerId,"MB001",b.role,"Field Officer");
 assert.equal(m3.machineJobs(changed).filter((j)=>j.itemId===items[0].id&&j.phase==="Pending").length,0);
});
check("Historical days and machine records survive day navigation",()=>{
 const current=s.plan.id;let future=w.createDailyPlan(s,"2026-10-21");assert.equal(m3.machineJobs(future).filter((j)=>j.reports.length).length,2);
 assert(w.parseSession(clone(future)));future=w.openDailyRecord(future,current);assert.equal(future.plan.id,current);assert(w.parseSession(clone(future)));
});
check("Malformed machine timers and assignments are rejected without migration loss",()=>{
 const bad=clone(s);bad.machine.jobs[0].segments=[{kind:"Operating",start:"not-time"}];assert.equal(w.parseSession(bad),null);
 const badDriver=clone(s);badDriver.morning.machineDrivers[a.workerId].evitCode="UNKNOWN";assert.equal(w.parseSession(badDriver),null);
 assert.deepEqual(legacy,w.createSession("blank"));
});

check("Activity Ha still updates M1 without adding the approved Machine Ha",()=>{
 const wp=load("lib/work-programme"),area=(state)=>{const programme=c.programmesForSession(state).find((v)=>v.id===p.id);return wp.roundActual(programme.fields.find((f)=>f.fieldNo===items[0].fieldNo).rounds.find((r)=>r.number===items[0].programmeRound));};
 const before=area(s);let activity=c.reportTicketHa(s,mandoreTickets.find((t)=>t.itemId===items[0].id).id,{ha:1,finish:"Finished",note:"Activity area"},"Upkeep Mandor"),work=c.completionWorks(activity)[0];
 activity=c.reviewWorkHa(activity,work.id,c.latestReport(work).id,"Validated","","Field Officer");assert.equal(area(activity),before+1);assert.equal(m3.machineSummary(activity,s.plan.date).approvedHa,1.5);assert(w.parseSession(clone(activity)));
});
check("A later machine activity stays pending until work is explicitly accepted",()=>{
 let next=m.createWorkDraft(s,{kind:"upkeep",programmeId:p.id,activityCode:p.activityCode,fields:["08C1"]});next.plan.items=next.plan.items.map((i)=>({...i,targetHa:1,evitCode:"MB001",materialCode:"",storageLocation:"",materialQuantity:0}));
 let added=m.submitDailyWork(s,next,"Assistant Manager");assert.equal(m3.machineJobs(added).length,2);const item=m.morningView(added).items.at(-1);added=m.acceptDailyWork(added,[item.id],"Field Officer");
 const job=m3.machineJobs(added).find((j)=>j.itemId===item.id);assert.equal(job.phase,"Pending");assert.equal(job.driverId,a.workerId);assert(w.parseSession(clone(added)));
});

console.log(checks+" machine workflow checks passed.");
