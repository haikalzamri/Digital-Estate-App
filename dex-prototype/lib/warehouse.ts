import scenario from "@/data/scenarios/warehouse.json";
import stockSource from "@/data/scenarios/material-stock.json";
import estateSource from "@/data/reference/estates.json";
import storeSource from "@/data/reference/storage-locations.json";
import { activities, fields, isManagement, withEvent, workKind, type Session, type PhoneRole } from "@/lib/workshop";
import { programmesForSession } from "@/lib/work-completion";
import { roundRemaining } from "@/lib/work-programme";

export type WarehouseRole = PhoneRole;
export type ApprovalStatus = "Draft" | "Pending AM" | "Pending Manager" | "Approved" | "Returned";
export type Approval = { role: "Assistant Manager" | "Manager"; at: string; remark: string };
export type PurchaseLine = { materialCode: string; quantity: number; unitPrice: number; activityCode: string; accountCode: string; programmeId: string; period: "manual" | "month" | "round"; periodValue: string; excessReason: string; suggestion?: number };
export type Requisition = { id: string; creator: string; createdAt: string; estate: string; store: string; neededDate: string; remark: string; status: ApprovalStatus; approvals: Approval[]; lines: PurchaseLine[]; returnReason?: string };
export type PurchaseOrder = Requisition & { prId: string; supplierId: string };
export type Delivery = { id: string; poId: string; createdAt: string; status: "Pending" | "Received" | "Rejected"; remark: string; receivedAt?: string; lines: { poLine: number; declaredQuantity: number; deliveredQuantity: number; acceptedQuantity: number }[] };
export type Movement = { id: string; kind: "Receipt" | "Issue out" | "Transfer" | "Remove and replace" | "Return to store"; status: "Posted" | "In transit"; materialCode: string; quantity: number; estate: string; store: string; toEstate?: string; toStore?: string; activityCode?: string; fieldNo?: string; workKey?: string; requestKey?: string; reference?: string; receiver: string; remark: string; at: string; receivedAt?: string };
export type WarehouseData = { schemaVersion: 1; nextId: number; requests: Requisition[]; orders: PurchaseOrder[]; deliveries: Delivery[]; movements: Movement[] };
export type WarehouseTab = "pr" | "po" | "gr" | "stock" | "issue";
export const suppliers = scenario.suppliers;
export const purchaseRules = scenario.rules;
export const warehouseEstates = estateSource.records.map((e) => ({ code: e.estateCode, name: e.estateName }));
export const warehouseStores = (estate: string) => storeSource.records.filter((r) => r.estateCode === estate).map((r) => ({ code:r.storageLocation,name:r.description }));
const round = (n:number) => Math.round((n + Number.EPSILON)*100)/100;
const finite = (n:unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0;
const now = () => new Date().toISOString();
const requireAccess = (role:WarehouseRole) => { if (!isManagement(role) && role !== "Store Clerk") throw new Error("Warehouse is available to estate management and the Store Clerk."); };
const requireClerk = (role:WarehouseRole) => { if (role !== "Store Clerk") throw new Error("This action is available to the Store Clerk."); };
const placeValid = (estate:string,store:string) => warehouseStores(estate).some((r)=>r.code===store);
export function warehouseFor(s:Session): WarehouseData {
  return s.warehouse || structuredClone({schemaVersion:1,nextId:scenario.nextId,requests:scenario.requests,orders:scenario.orders,deliveries:scenario.deliveries,movements:scenario.movements}) as WarehouseData;
}
function update(s:Session,data:WarehouseData,title:string,detail:string,role:WarehouseRole):Session {
  return withEvent({...s,warehouse:data},title,detail,role);
}
function nextId(data:WarehouseData,prefix:string) { return prefix+"-"+String(data.nextId++).padStart(4,"0"); }
export function warehouseStock(s:Session) {
  const data=warehouseFor(s);
  const keys=new Set(stockSource.records.map((r)=>[r.estateCode,r.storageLocation,r.materialCode].join("|")));
  for(const m of data.movements) { keys.add([m.estate,m.store,m.materialCode].join("|")); if(m.toEstate && m.toStore)keys.add([m.toEstate,m.toStore,m.materialCode].join("|")); }
  return [...keys].map((key)=>{
    const [estateCode,storageLocation,materialCode]=key.split("|"),base=stockSource.records.find((r)=>r.estateCode===estateCode && r.storageLocation===storageLocation && r.materialCode===materialCode);
    let onHandQuantity=base?.onHandQuantity || 0;
    for(const m of data.movements.filter((m)=>m.materialCode===materialCode)) {
      if(m.estate===estateCode && m.store===storageLocation) onHandQuantity += ["Receipt","Return to store"].includes(m.kind)?m.quantity:-m.quantity;
      if(m.toEstate===estateCode && m.toStore===storageLocation && m.status==="Posted")onHandQuantity+=m.quantity;
    }
    onHandQuantity=round(onHandQuantity);
    const reservedQuantity=base?.reservedQuantity || 0,availableQuantity=round(onHandQuantity-reservedQuantity),lowStockThreshold=base?.lowStockThreshold || 0;
    return {estateCode,storageLocation,materialCode,unit:base?.unit || stockSource.records.find((r)=>r.materialCode===materialCode)?.unit || "UNIT",onHandQuantity,reservedQuantity,availableQuantity,lowStockThreshold,availabilityBand:availableQuantity<=0?"out_of_stock":availableQuantity<lowStockThreshold?"low":"available",simulated:true};
  });
}
export function warehouseBalance(s:Session,estate:string,store:string,material:string) {
  return warehouseStock(s).find((r)=>r.estateCode===estate&&r.storageLocation===store&&r.materialCode===material);
}
export function purchaseSuggestion(s:Session,line:PurchaseLine,estate:string,store:string,neededDate:string,excludeOrder="") {
  const rule=purchaseRules.find((r)=>r.activityCode===line.activityCode&&r.materialCode===line.materialCode);
  const programme=programmesForSession(s).find((p)=>p.id===line.programmeId&&p.activityCode===line.activityCode);
  if(!rule || !programme || line.period==="manual")return null;
  const rounds=programme.fields.flatMap((f)=>f.rounds.filter((r)=>line.period==="round"?String(r.number)===line.periodValue:r.dueDate.slice(0,7)===line.periodValue));
  if(!rounds.length)return null;
  const ha=round(rounds.reduce((sum,r)=>sum+roundRemaining(r),0)),demand=round(ha*rule.perHa);
  const available=Math.max(0,warehouseBalance(s,estate,store,line.materialCode)?.availableQuantity || 0);
  const data=warehouseFor(s);
  const incoming=round(data.orders.filter((o)=>o.id!==excludeOrder&&o.status==="Approved"&&o.estate===estate&&o.store===store&&o.neededDate<=neededDate).reduce((sum,o)=>sum+o.lines.reduce((n,l,index)=>n+(l.materialCode===line.materialCode?Math.max(0,l.quantity-data.deliveries.filter((d)=>d.poId===o.id&&d.status==="Received").flatMap((d)=>d.lines).filter((r)=>r.poLine===index).reduce((q,r)=>q+r.acceptedQuantity,0)):0),0),0));
  return {ha,perHa:rule.perHa,demand,available,incoming,quantity:round(Math.max(0,demand-available-incoming)),accountCode:rule.accountCode};
}
export function newPurchaseLine():PurchaseLine {return {materialCode:"1300000147",quantity:0,unitPrice:0,activityCode:"",accountCode:"",programmeId:"",period:"manual",periodValue:"",excessReason:""};}
export type PurchaseInput = Pick<Requisition,"estate"|"store"|"neededDate"|"remark"|"lines">;
function validatePurchase(input:PurchaseInput,submit:boolean) {
  if(!placeValid(input.estate,input.store))throw new Error("Choose an estate and store from the master list.");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(input.neededDate)||!Number.isFinite(Date.parse(input.neededDate+"T12:00:00Z")))throw new Error("Choose a valid required delivery date.");
  if(!input.lines.length)throw new Error("Add a material.");
  if(new Set(input.lines.map((l)=>[l.materialCode,l.activityCode,l.programmeId,l.period,l.periodValue].join("|"))).size!==input.lines.length)throw new Error("Combine duplicate material lines for the same activity and purchasing period.");
  for(const l of input.lines) {
    if(!stockSource.records.some((r)=>r.materialCode===l.materialCode)||!finite(l.quantity)||!finite(l.unitPrice)||submit&&l.quantity<=0)throw new Error("Choose a material and enter a positive quantity.");
    if(l.activityCode&&!activities.some((a)=>a.code===l.activityCode))throw new Error("Choose an activity from the master list.");
    if(!["manual","month","round"].includes(l.period))throw new Error("Choose a purchasing period.");
  }
}
export function saveRequisition(s:Session,input:PurchaseInput,role:WarehouseRole,submit=true,id?:string) {
  requireAccess(role);validatePurchase(input,submit);
  const data=structuredClone(warehouseFor(s)),old=data.requests.find((r)=>r.id===id);
  if(id&&(!old||!["Draft","Returned"].includes(old.status)))throw new Error("Only draft or returned requests can be changed.");
  if(old&&old.creator!==role&&!isManagement(role))throw new Error("Only the requester or estate management can edit this request.");
  const request:Requisition={...input,lines:structuredClone(input.lines),id:old?.id||nextId(data,"PR"),creator:old?.creator||role,createdAt:old?.createdAt||now(),status:submit?"Pending AM":"Draft",approvals:[],returnReason:undefined};
  data.requests=old?data.requests.map((r)=>r.id===old.id?request:r):[request,...data.requests];
  return update(s,data,submit?"Purchase requisition submitted":"Purchase requisition draft saved",request.id,role);
}
export function savePurchaseOrder(s:Session,prId:string,input:PurchaseInput&{supplierId:string},role:WarehouseRole,platform:"web"|"phone",submit=true,id?:string) {
  requireClerk(role);if(platform!=="web")throw new Error("Create purchase orders on web.");
  const data=structuredClone(warehouseFor(s)),pr=data.requests.find((r)=>r.id===prId),old=data.orders.find((r)=>r.id===id);
  if(!pr||pr.status!=="Approved")throw new Error("Both PR approvals are required before creating a PO.");
  if(id&&(!old||!["Draft","Returned"].includes(old.status)||old.prId!==prId))throw new Error("Only draft or returned purchase orders can be changed.");
  if(data.orders.some((o)=>o.prId===prId&&o.id!==id))throw new Error("This requisition already has a purchase order.");
  validatePurchase(input,submit);
  if(!suppliers.some((r)=>r.id===input.supplierId))throw new Error("Choose a supplier.");
  const lines=input.lines.map((l)=>{const suggestion=purchaseSuggestion(s,l,input.estate,input.store,input.neededDate,id);if(submit&&suggestion&&l.quantity>suggestion.quantity&&!l.excessReason.trim())throw new Error("Add a reason for purchasing above the suggested quantity.");if(submit&&!l.accountCode.trim())throw new Error("Enter the account charged for each PO line.");return {...l,suggestion:suggestion?.quantity};});
  const order:PurchaseOrder={...input,lines,id:old?.id||nextId(data,"PO"),prId,creator:role,createdAt:old?.createdAt||now(),status:submit?"Pending AM":"Draft",approvals:[],returnReason:undefined};
  data.orders=old?data.orders.map((o)=>o.id===id?order:o):[order,...data.orders];
  return update(s,data,submit?"Purchase order submitted":"Purchase order draft saved",order.id,role);
}
export function approvePurchase(s:Session,kind:"pr"|"po",id:string,role:WarehouseRole,approve=true,remark="") {
  if(role!=="Assistant Manager"&&role!=="Manager")throw new Error("AM and Manager approve purchasing.");
  const data=structuredClone(warehouseFor(s)),record=(kind==="pr"?data.requests:data.orders).find((r)=>r.id===id);
  if(!record||record.status!==(role==="Assistant Manager"?"Pending AM":"Pending Manager"))throw new Error("This item is not awaiting your approval.");
  if(!approve&&!remark.trim())throw new Error("Enter a reason when returning an item.");
  if(approve){record.approvals.push({role,at:now(),remark:remark.trim()});record.status=role==="Assistant Manager"?"Pending Manager":"Approved";}else{record.status="Returned";record.returnReason=remark.trim();}
  return update(s,data,approve?"Purchase "+kind.toUpperCase()+" approved":"Purchase "+kind.toUpperCase()+" returned",id,role);
}
export function simulateDelivery(s:Session,poId:string,role:WarehouseRole) {
  requireClerk(role);const data=structuredClone(warehouseFor(s)),po=data.orders.find((o)=>o.id===poId);
  if(!po||po.status!=="Approved")throw new Error("Choose an approved PO.");
  if(data.deliveries.some((d)=>d.poId===poId&&d.status==="Pending"))throw new Error("A delivery is already awaiting receipt for this PO.");
  const lines=po.lines.map((l,index)=>{const received=data.deliveries.filter((d)=>d.poId===po.id&&d.status==="Received").flatMap((d)=>d.lines).filter((r)=>r.poLine===index).reduce((sum,r)=>sum+r.acceptedQuantity,0);return {poLine:index,declaredQuantity:round(Math.max(0,l.quantity-received)),deliveredQuantity:round(Math.max(0,l.quantity-received)),acceptedQuantity:0};}).filter((l)=>l.declaredQuantity>0);
  if(!lines.length)throw new Error("This PO has been fully received.");
  const delivery:Delivery={id:nextId(data,"DO"),poId,createdAt:now(),status:"Pending",remark:"Simulated supplier delivery",lines};
  data.deliveries.unshift(delivery);return update(s,data,"Supplier delivery received",delivery.id,role);
}
export function receiveDelivery(s:Session,id:string,rows:{deliveredQuantity:number;acceptedQuantity:number}[],remark:string,role:WarehouseRole,reject=false) {
  requireClerk(role);const data=structuredClone(warehouseFor(s)),d=data.deliveries.find((r)=>r.id===id),po=data.orders.find((o)=>o.id===d?.poId);
  if(!d||d.status!=="Pending"||!po||po.status!=="Approved")throw new Error("This delivery cannot be received again.");
  if(rows.length!==d.lines.length)throw new Error("Review every delivery line.");
  let total=0,discrepancy=reject;
  d.lines=d.lines.map((l,index)=>{
    const r=rows[index],line=po.lines[l.poLine];if(!line||!finite(r.deliveredQuantity)||!finite(r.acceptedQuantity)||r.acceptedQuantity>r.deliveredQuantity)throw new Error("Accepted quantity must be between zero and the delivered quantity.");
    const previous=data.deliveries.filter((other)=>other.id!==id&&other.poId===po.id&&other.status==="Received").flatMap((other)=>other.lines).filter((x)=>x.poLine===l.poLine).reduce((sum,x)=>sum+x.acceptedQuantity,0);
    if(!reject&&r.acceptedQuantity>round(line.quantity-previous))throw new Error("Accepted quantity exceeds the remaining PO quantity.");
    const acceptedQuantity=reject?0:r.acceptedQuantity;
    discrepancy ||= r.deliveredQuantity!==l.declaredQuantity||acceptedQuantity!==r.deliveredQuantity||r.deliveredQuantity!==round(line.quantity-previous);
    total+=acceptedQuantity;return {...l,deliveredQuantity:r.deliveredQuantity,acceptedQuantity};
  });
  if(discrepancy&&!remark.trim())throw new Error("Enter a remark for a rejected, short, damaged or amended delivery.");
  if(!reject&&total<=0)throw new Error("Receive a usable quantity or reject this delivery.");
  d.status=reject?"Rejected":"Received";d.remark=remark.trim();d.receivedAt=now();
  for(const l of d.lines.filter((l)=>l.acceptedQuantity>0)){const line=po.lines[l.poLine];data.movements.unshift({id:nextId(data,"GR"),kind:"Receipt",status:"Posted",materialCode:line.materialCode,quantity:l.acceptedQuantity,estate:po.estate,store:po.store,reference:d.id,receiver:role,remark:remark.trim(),at:d.receivedAt});}
  return update(s,data,reject?"Delivery rejected":"Goods receipt posted",d.id,role);
}
export function warehouseWork(s:Session) {
  return [{plan:s.plan,morning:s.morning},...(s.days||[])].flatMap((d)=>(d.morning?.items||(d.plan.status==="Draft"?[]:d.plan.baseline||d.plan.items)).map((item)=>({item,key:d.plan.id+"|"+item.id,dayId:d.plan.id,date:d.plan.date,accepted:(d.morning?.tickets||d.plan.tickets).some((t)=>t.itemId===item.id)})));
}
export type MaterialRequest = {key:string;dayId:string;date:string;itemId:string;activityCode:string;fieldNo:string;materialCode:string;estate:string;store:string;quantity:number;issued:number;remaining:number;overIssued:number;accepted:boolean};
export function materialRequests(s:Session):MaterialRequest[] {
  const data=warehouseFor(s),days=[{plan:s.plan,morning:s.morning},...(s.days||[])];
  return days.flatMap((day)=>{
    const items=day.morning?.items || (day.plan.status==="Draft"?[]:day.plan.baseline||day.plan.items);
    return items.filter((i)=>i.materialCode&&i.materialQuantity>0).map((i)=>{
      const key=[day.plan.id,i.id,i.storageLocation,i.materialCode].join("|"),issued=round(data.movements.filter((m)=>m.kind==="Issue out"&&m.requestKey===key).reduce((n,m)=>n+m.quantity,0));
      return {key,dayId:day.plan.id,date:day.plan.date,itemId:i.id,activityCode:i.activityCode,fieldNo:i.fieldNo,materialCode:i.materialCode,estate:"E063",store:i.storageLocation,quantity:i.materialQuantity,issued,remaining:round(Math.max(0,i.materialQuantity-issued)),overIssued:round(Math.max(0,issued-i.materialQuantity)),accepted:(day.morning?.tickets||day.plan.tickets).some((t)=>t.itemId===i.id)};
    });
  }).sort((a,b)=>b.date.localeCompare(a.date));
}
export type MovementInput = Omit<Movement,"id"|"status"|"at"|"receivedAt">;
export function postMovement(s:Session,input:MovementInput,role:WarehouseRole) {
  requireClerk(role);
  if(!["Issue out","Transfer","Remove and replace","Return to store"].includes(input.kind))throw new Error("Choose a stock movement type. Post receipts from the delivery order.");
  if(!placeValid(input.estate,input.store)||!stockSource.records.some((r)=>r.materialCode===input.materialCode)||!finite(input.quantity)||input.quantity<=0)throw new Error("Choose a material, store and positive quantity.");
  if(!input.receiver.trim())throw new Error("Enter the collector or receiver.");
  if(input.fieldNo&&!fields.some((f)=>f.fieldNo===input.fieldNo))throw new Error("Choose a field from the master list.");
  const data=structuredClone(warehouseFor(s));
  if(input.kind==="Return to store"){
    const issue=data.movements.find((m)=>m.id===input.reference&&m.kind==="Issue out"&&m.estate===input.estate&&m.store===input.store&&m.materialCode===input.materialCode);
    const returned=data.movements.filter((m)=>m.kind==="Return to store"&&m.reference===input.reference).reduce((n,m)=>n+m.quantity,0);
    if(!issue||input.quantity>round(issue.quantity-returned))throw new Error("Return quantity exceeds the original issue balance.");
  }else if(input.quantity>(warehouseBalance(s,input.estate,input.store,input.materialCode)?.availableQuantity||0))throw new Error("Insufficient available stock. Receive or transfer stock first.");
  if(input.kind==="Transfer"||input.kind==="Remove and replace"){
    if(!input.toEstate||!input.toStore||!placeValid(input.toEstate,input.toStore))throw new Error("Choose a receiving estate and store.");
    if(input.kind==="Transfer"&&(input.toEstate!==input.estate||input.toStore===input.store))throw new Error("A store transfer needs a different store in the same estate.");
    if(input.kind==="Remove and replace"&&input.toEstate===input.estate)throw new Error("Remove and replace needs a different receiving estate.");
  }
  if(input.kind==="Issue out") {
    if(!input.activityCode||!activities.some((a)=>a.code===input.activityCode))throw new Error("Choose the activity charged.");
    if(input.requestKey){const request=materialRequests(s).find((r)=>r.key===input.requestKey);if(!request||!request.accepted||request.estate!==input.estate||request.store!==input.store||request.materialCode!==input.materialCode||request.activityCode!==input.activityCode||request.fieldNo!==input.fieldNo||input.quantity>request.remaining)throw new Error("Accept the work instruction and issue only its outstanding material balance.");}
    if(!input.requestKey){
      const instruction=warehouseWork(s).find((w)=>w.key===input.workKey&&w.accepted&&w.item.activityCode===input.activityCode&&w.item.fieldNo===(input.fieldNo||""));
      const important=programmesForSession(s).some((p)=>p.activityCode===input.activityCode)||input.activityCode.startsWith("PH")||input.activityCode.startsWith("PM")||input.activityCode.startsWith("PF");
      if((input.workKey||important)&&!instruction)throw new Error("Link an accepted M2 work instruction for harvesting or upkeep before issuing materials.");
      if(instruction&&workKind(instruction.item)!=="general"&&!input.fieldNo)throw new Error("Choose the field for this work instruction.");
      if(!input.remark.trim())throw new Error("Enter a reason for this manual issue.");
    }
  }
  const movement:Movement={...input,id:nextId(data,"MOV"),status:input.kind==="Remove and replace"?"In transit":"Posted",at:now()};
  data.movements.unshift(movement);return update(s,data,input.kind+" recorded",movement.id,role);
}
export function receiveTransfer(s:Session,id:string,role:WarehouseRole) {
  requireClerk(role);const data=structuredClone(warehouseFor(s)),movement=data.movements.find((m)=>m.id===id&&m.kind==="Remove and replace");
  if(!movement||movement.status!=="In transit")throw new Error("This transfer has already been received or is unavailable.");
  movement.status="Posted";movement.receivedAt=now();return update(s,data,"Inter-estate stock received",movement.id,role);
}
export function warehouseCounts(s:Session,role:WarehouseRole):Record<WarehouseTab,number> {
  if(!isManagement(role)&&role!=="Store Clerk")return {pr:0,po:0,gr:0,stock:0,issue:0};
  const data=warehouseFor(s),pending=role==="Assistant Manager"?"Pending AM":role==="Manager"?"Pending Manager":"";
  return {pr:role==="Store Clerk"?data.requests.filter((r)=>!["Draft","Returned"].includes(r.status)&&!data.orders.some((o)=>o.prId===r.id)).length:data.requests.filter((r)=>pending?r.status===pending:r.creator===role&&r.status==="Returned").length,
    po:pending?data.orders.filter((o)=>o.status===pending).length:0,
    gr:role==="Store Clerk"?data.deliveries.filter((d)=>d.status==="Pending").length:0,stock:0,
    issue:role==="Store Clerk"?materialRequests(s).filter((r)=>r.remaining>0&&r.accepted).length+data.movements.filter((m)=>m.status==="In transit").length:0};
}
export function warehouseValid(value:unknown):boolean {
  if(value==null)return true;
  try {
    const d=value as WarehouseData;
    if(d.schemaVersion!==1||!Number.isInteger(d.nextId)||d.nextId<1||![d.requests,d.orders,d.deliveries,d.movements].every(Array.isArray))return false;
    const ids=[...d.requests,...d.orders,...d.deliveries,...d.movements].map((r)=>r.id);
    if(ids.some((id)=>typeof id!=="string")||new Set(ids).size!==ids.length)return false;
    for(const r of [...d.requests,...d.orders]){
      if(!placeValid(r.estate,r.store)||!["Draft","Pending AM","Pending Manager","Approved","Returned"].includes(r.status)||!Array.isArray(r.approvals)||!Array.isArray(r.lines)||typeof r.creator!=="string")return false;
      if(r.approvals.some((a,index)=>a.role!==(index===0?"Assistant Manager":"Manager")||typeof a.at!=="string")||r.approvals.length>2||r.status==="Approved"&&r.approvals.length!==2||r.status==="Pending Manager"&&r.approvals.length!==1)return false;
      validatePurchase(r,r.status!=="Draft"&&r.status!=="Returned");
    }
    if(d.orders.some((o)=>!d.requests.some((r)=>r.id===o.prId&&r.status==="Approved")||!suppliers.some((p)=>p.id===o.supplierId)))return false;
    if(new Set(d.orders.map((o)=>o.prId)).size!==d.orders.length)return false;
    for(const delivery of d.deliveries){const po=d.orders.find((o)=>o.id===delivery.poId);if(!po||po.status!=="Approved"||!["Pending","Received","Rejected"].includes(delivery.status)||!Array.isArray(delivery.lines)||!delivery.lines.length||new Set(delivery.lines.map((l)=>l.poLine)).size!==delivery.lines.length||delivery.lines.some((l)=>!po.lines[l.poLine]||!finite(l.declaredQuantity)||!finite(l.deliveredQuantity)||!finite(l.acceptedQuantity)||l.acceptedQuantity>l.deliveredQuantity))return false;}
    for(const m of d.movements)if(!["Receipt","Issue out","Transfer","Remove and replace","Return to store"].includes(m.kind)||!["Posted","In transit"].includes(m.status)||!finite(m.quantity)||m.quantity<=0||!placeValid(m.estate,m.store)||!stockSource.records.some((r)=>r.materialCode===m.materialCode)||(m.kind==="Transfer"||m.kind==="Remove and replace")&&(!m.toEstate||!m.toStore||!placeValid(m.toEstate,m.toStore))||m.status==="In transit"&&m.kind!=="Remove and replace")return false;
    for(const o of d.orders)for(let index=0;index<o.lines.length;index++)if(d.deliveries.filter((r)=>r.poId===o.id&&r.status==="Received").flatMap((r)=>r.lines).filter((r)=>r.poLine===index).reduce((n,r)=>n+r.acceptedQuantity,0)>o.lines[index].quantity+0.005)return false;
    for(const delivery of d.deliveries){
      if(delivery.status!=="Received"&&delivery.lines.some((l)=>l.acceptedQuantity!==0))return false;
      const po=d.orders.find((o)=>o.id===delivery.poId)!;
      const materialCodes=new Set(delivery.lines.map((l)=>po.lines[l.poLine].materialCode));
      for(const code of materialCodes){const accepted=delivery.lines.filter((l)=>po.lines[l.poLine].materialCode===code).reduce((n,l)=>n+l.acceptedQuantity,0),posted=d.movements.filter((m)=>m.kind==="Receipt"&&m.reference===delivery.id&&m.materialCode===code&&m.estate===po.estate&&m.store===po.store).reduce((n,m)=>n+m.quantity,0);if(Math.abs(accepted-posted)>0.005)return false;}
    }
    for(const m of d.movements){
      if(typeof m.at!=="string"||typeof m.receiver!=="string"||!m.receiver.trim())return false;
      if(m.kind==="Receipt"&&!d.deliveries.some((r)=>r.id===m.reference&&r.status==="Received"))return false;
      if(m.kind==="Transfer"&&(m.toEstate!==m.estate||m.toStore===m.store)||m.kind==="Remove and replace"&&m.toEstate===m.estate)return false;
      if(m.kind==="Return to store"){const issue=d.movements.find((r)=>r.id===m.reference&&r.kind==="Issue out"&&r.estate===m.estate&&r.store===m.store&&r.materialCode===m.materialCode);if(!issue||d.movements.filter((r)=>r.kind==="Return to store"&&r.reference===issue.id).reduce((n,r)=>n+r.quantity,0)>issue.quantity+0.005)return false;}
    }
    if(warehouseStock({warehouse:d} as Session).some((r)=>r.availableQuantity<0))return false;
    return true;
  }catch{return false;}
}
