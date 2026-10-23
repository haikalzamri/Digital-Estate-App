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
const w=load("lib/workshop"),h=load("lib/warehouse"),m=load("lib/morning-work");
let checks=0;
function check(label,run){run();checks++;console.log("PASS "+label);}
let s=w.createSession("normal");
const clone=(v)=>JSON.parse(JSON.stringify(v));
const baseline=clone(s);
check("Legacy sessions migrate without replacing M2",()=>assert(w.parseSession(clone(s))));
check("Warehouse sample references and approvals are valid",()=>assert(h.warehouseValid(h.warehouseFor(s))));
const balance=(session,store="SR01",material="1300000147",estate="E063")=>h.warehouseBalance(session,estate,store,material)?.onHandQuantity||0;
const input={estate:"E063",store:"SR01",neededDate:"2026-10-25",remark:"Test replenishment",lines:[{...h.newPurchaseLine(),quantity:500,unitPrice:4.5,activityCode:"PF3001",accountCode:"DEMO-5101"}]};
check("Mandore cannot request, receive or move warehouse stock",()=>{
 assert.throws(()=>h.saveRequisition(s,input,"Upkeep Mandor"));
 assert.throws(()=>h.receiveDelivery(s,"DO-DEMO-003",[{deliveredQuantity:100,acceptedQuantity:100}],"","Harvesting Mandor"));
 assert.throws(()=>h.postMovement(s,{kind:"Transfer",estate:"E063",store:"SR01",materialCode:"1300000147",quantity:10,toEstate:"E063",toStore:"SR04",receiver:"Test",remark:""},"Field Officer"));
});
s=h.saveRequisition(s,input,"Field Officer");const prId=h.warehouseFor(s).requests[0].id;
check("PR submission never changes stock",()=>{assert.equal(balance(s),balance(baseline));assert.deepEqual(s.plan,baseline.plan);});
check("PO creation is blocked before both PR approvals",()=>assert.throws(()=>h.savePurchaseOrder(s,prId,{...input,supplierId:h.suppliers[0].id},"Store Clerk","web")));
check("AM and Manager approvals must be in order; FO cannot approve purchasing",()=>{
 assert.throws(()=>h.approvePurchase(s,"pr",prId,"Manager"));assert.throws(()=>h.approvePurchase(s,"pr",prId,"Field Officer"));
});
s=h.approvePurchase(s,"pr",prId,"Assistant Manager");s=h.approvePurchase(s,"pr",prId,"Manager");
check("Only Store Clerk on web creates PO",()=>{
 assert.throws(()=>h.savePurchaseOrder(s,prId,{...input,supplierId:h.suppliers[0].id},"Store Clerk","phone"));
 assert.throws(()=>h.savePurchaseOrder(s,prId,{...input,supplierId:h.suppliers[0].id},"Manager","web"));
});
s=h.savePurchaseOrder(s,prId,{...input,supplierId:h.suppliers[0].id},"Store Clerk","web");const poId=h.warehouseFor(s).orders[0].id;
check("Pending PO cannot receive a supplier delivery",()=>assert.throws(()=>h.simulateDelivery(s,poId,"Store Clerk")));
s=h.approvePurchase(s,"po",poId,"Assistant Manager");s=h.approvePurchase(s,"po",poId,"Manager");
s=h.simulateDelivery(s,poId,"Store Clerk");const doId=h.warehouseFor(s).deliveries[0].id;
check("Only one unreceived simulated DO exists for a PO",()=>assert.throws(()=>h.simulateDelivery(s,poId,"Store Clerk")));
check("Discrepancy and over-receipt checks preserve stock on failure",()=>{
 const before=JSON.stringify(s);
 assert.throws(()=>h.receiveDelivery(s,doId,[{deliveredQuantity:500,acceptedQuantity:400}],"","Store Clerk"));
 assert.throws(()=>h.receiveDelivery(s,doId,[{deliveredQuantity:501,acceptedQuantity:501}],"Extra","Store Clerk"));
 assert.equal(JSON.stringify(s),before);
});
s=h.receiveDelivery(s,doId,[{deliveredQuantity:450,acceptedQuantity:400}],"50 damaged, 50 short","Store Clerk");
check("Only usable accepted quantity enters stock, with original DO preserved",()=>{
 assert.equal(balance(s),balance(baseline)+400);
 const d=h.warehouseFor(s).deliveries.find((d)=>d.id===doId);assert.equal(d.lines[0].declaredQuantity,500);assert.equal(d.lines[0].deliveredQuantity,450);
 assert.throws(()=>h.receiveDelivery(s,doId,[{deliveredQuantity:450,acceptedQuantity:400}],"Again","Store Clerk"));
});
s=h.simulateDelivery(s,poId,"Store Clerk");const balanceDo=h.warehouseFor(s).deliveries[0];
check("Partial receipt leaves a PO balance for the next DO",()=>assert.equal(balanceDo.lines[0].declaredQuantity,100));
s=h.receiveDelivery(s,balanceDo.id,[{deliveredQuantity:100,acceptedQuantity:0}],"Wrong material","Store Clerk",true);
check("Rejected delivery does not add stock",()=>assert.equal(balance(s),balance(baseline)+400));
check("Programme suggestion uses selected period and remaining Ha",()=>{
 const programme=w.programmes.find((p)=>p.activityCode==="PF3001"),line={...input.lines[0],programmeId:programme.id,period:"round",periodValue:"3"};
 const result=h.purchaseSuggestion(s,line,"E063","SR04","2026-10-25");assert(result);assert(result.ha>0);assert.equal(result.demand,Math.round(result.ha*result.perHa*100)/100);
 const month={...line,period:"month",periodValue:programme.fields[0].rounds[2].dueDate.slice(0,7)};assert(h.purchaseSuggestion(s,month,"E063","SR04","2026-10-25"));
});
check("Above-suggestion PO requires a reason; approved incoming stock reduces recommendation",()=>{
 let t=w.createSession("blank");const programme=w.programmes.find((p)=>p.activityCode==="PF3001"),line={...input.lines[0],programmeId:programme.id,period:"round",periodValue:"3"};
 const suggestion=h.purchaseSuggestion(t,line,"E063","SR04","2026-10-25");line.quantity=suggestion.quantity+1;
 const draft={...input,store:"SR04",lines:[line]};
 t=h.saveRequisition(t,draft,"Field Officer");const pr=h.warehouseFor(t).requests[0].id;
 t=h.approvePurchase(t,"pr",pr,"Assistant Manager");t=h.approvePurchase(t,"pr",pr,"Manager");
 assert.throws(()=>h.savePurchaseOrder(t,pr,{...draft,supplierId:h.suppliers[0].id},"Store Clerk","web"));
 line.excessReason="Contingency";t=h.savePurchaseOrder(t,pr,{...draft,lines:[line],supplierId:h.suppliers[0].id},"Store Clerk","web");const po=h.warehouseFor(t).orders[0].id;
 t=h.approvePurchase(t,"po",po,"Assistant Manager");t=h.approvePurchase(t,"po",po,"Manager");
 const after=h.purchaseSuggestion(t,line,"E063","SR04","2026-10-25");assert.equal(after.quantity,0);assert(after.incoming>=line.quantity);
});
check("M2 draft materials create no issuance request",()=>assert.equal(h.materialRequests(w.createSession()).length,0));
let day=w.submitPlan(w.createSession("normal"));const request=h.materialRequests(day)[0];
check("Submitted M2 material request leaves physical stock unchanged and needs acceptance",()=>{
 assert(request);assert.equal(request.accepted,false);
 assert.throws(()=>h.postMovement(day,{kind:"Issue out",estate:"E063",store:request.store,materialCode:request.materialCode,quantity:10,requestKey:request.key,activityCode:request.activityCode,fieldNo:request.fieldNo,receiver:"Haikal",remark:""},"Store Clerk"));
});
day=m.clockWorkers(day,[w.workers.find((x)=>!x.needsReview).id],"Present","Field Officer");day=m.saveAttendance(day,"Field Officer");day=m.acceptDailyWork(day,[request.itemId],"Field Officer");
const linked={kind:"Issue out",estate:"E063",store:request.store,materialCode:request.materialCode,quantity:50,requestKey:request.key,activityCode:request.activityCode,fieldNo:request.fieldNo,receiver:"Haikal",remark:"Partial collection"};
const stockBefore=h.warehouseBalance(day,"E063",request.store,request.materialCode).onHandQuantity;
day=h.postMovement(day,linked,"Store Clerk");
check("M2 availability reads the transaction balance",()=>assert.equal(w.stockFor(day.plan.items[0],day).onHandQuantity,stockBefore-50));
check("Manual upkeep issue requires an accepted M2 work instruction",()=>{
 assert.throws(()=>h.postMovement(w.createSession("normal"),{...linked,requestKey:undefined,remark:"Extra material"},"Store Clerk"));
 const manual=h.postMovement(day,{...linked,requestKey:undefined,workKey:day.plan.id+"|"+request.itemId,quantity:5,remark:"Additional material for accepted work"},"Store Clerk");
 assert.equal(h.warehouseBalance(manual,"E063",request.store,request.materialCode).onHandQuantity,stockBefore-55);
});
check("Partial issuance deducts actual stock and tracks outstanding quantity",()=>{
 assert.equal(h.warehouseBalance(day,"E063",request.store,request.materialCode).onHandQuantity,stockBefore-50);
 assert.equal(h.materialRequests(day)[0].remaining,request.quantity-50);
 assert.throws(()=>h.postMovement(day,{...linked,quantity:request.quantity},"Store Clerk"));
});
const issued=h.warehouseFor(day).movements[0];
day=h.postMovement(day,{kind:"Return to store",estate:"E063",store:request.store,materialCode:request.materialCode,quantity:20,reference:issued.id,receiver:"Clerk",remark:"Unused"},"Store Clerk");
check("Return is tied to original issue and cannot exceed it",()=>{
 assert.equal(h.warehouseBalance(day,"E063",request.store,request.materialCode).onHandQuantity,stockBefore-30);
 assert.throws(()=>h.postMovement(day,{kind:"Return to store",estate:"E063",store:request.store,materialCode:request.materialCode,quantity:31,reference:issued.id,receiver:"Clerk",remark:""},"Store Clerk"));
});
const transfer={kind:"Transfer",estate:"E063",store:"SR01",toEstate:"E063",toStore:"SR04",materialCode:"1300000147",quantity:100,receiver:"Division A Clerk",remark:"Rebalance"};
const from=balance(s),to=balance(s,"SR04");s=h.postMovement(s,transfer,"Store Clerk");
check("Store transfer conserves quantity and separates store keys",()=>{assert.equal(balance(s),from-100);assert.equal(balance(s,"SR04"),to+100);assert.throws(()=>h.postMovement(s,{...transfer,toStore:"SR01"},"Store Clerk"));});
const destination=h.warehouseEstates.find((e)=>e.code!=="E063"&&h.warehouseStores(e.code).length);
const destinationStore=h.warehouseStores(destination.code)[0].code;
const destinationBefore=balance(s,destinationStore,"1300000147",destination.code),sourceBefore=balance(s);
s=h.postMovement(s,{...transfer,kind:"Remove and replace",toEstate:destination.code,toStore:destinationStore},"Store Clerk");const inter=h.warehouseFor(s).movements[0];
check("Inter-estate dispatch remains in transit until receipt",()=>{assert.equal(balance(s),sourceBefore-100);assert.equal(balance(s,destinationStore,"1300000147",destination.code),destinationBefore);});
s=h.receiveTransfer(s,inter.id,"Store Clerk");
check("Inter-estate receipt posts destination once",()=>{assert.equal(balance(s,destinationStore,"1300000147",destination.code),destinationBefore+100);assert.throws(()=>h.receiveTransfer(s,inter.id,"Store Clerk"));});
check("Oversized or negative movements cannot produce negative stock",()=>{assert.throws(()=>h.postMovement(s,{...transfer,quantity:99999999},"Store Clerk"));assert.throws(()=>h.postMovement(s,{...transfer,quantity:-1},"Store Clerk"));});
check("Role-specific notification counts exclude Mandore",()=>{assert.equal(Object.values(h.warehouseCounts(s,"Harvesting Mandor")).reduce((n,v)=>n+v,0),0);assert(h.warehouseCounts(s,"Store Clerk").gr>0);});
check("Session reload preserves warehouse ledger and M2 tickets",()=>{assert(w.parseSession(clone(s)));const restored=w.parseSession(clone(day));assert(restored);assert.deepEqual(restored.morning.tickets,day.morning.tickets);assert.equal(h.materialRequests(restored)[0].issued,50);});
check("Changing daily record does not lose warehouse stock",()=>{const next=w.createDailyPlan(s,"2026-10-19");assert.equal(balance(next),balance(s));assert.deepEqual(next.warehouse,s.warehouse);});
check("Corrupt stock quantities are rejected without overwriting saved session",()=>{const invalid=clone(s);invalid.warehouse.movements[0].quantity=-1;assert.equal(w.parseSession(invalid),null);});
console.log("Warehouse workflow checks passed: "+checks);
