export type LogContext = { actorId:string; role:string; department?:string; sessionId:string; deviceId:string; page:string };
export type Activity = { action:string; module?:string; target?:string; outcome?:"SUCCESS"|"REJECTED"|"ERROR"|"OBSERVED"; reason?:string; before?:unknown; after?:unknown; actorId?:string; role?:string; department?:string; operationId?:string };
export type SystemLog = { sequence?:number; eventId:string; operationId:string; recordedAt:string; occurredAt:string|null; actorId:string; role:string; department:string|null; sessionId:string; deviceId:string; page:string; module:string; action:string; target:string; outcome:string; reason:string; before:unknown; after:unknown; legacy:boolean; ip:null; providerId:null };
const hidden=/password|secret|token|authorization|cookie|provider.?id|national.?id|registrationNo|email|phone|contact|dataurl|logo|blob|bytes/i;
export function redactLog(value:unknown,key="",depth=0):unknown {
  if(hidden.test(key))return value?"[ปกปิดข้อมูล]":null;
  if(depth>20)return "[โครงสร้างข้อมูลลึกเกินกำหนด]";
  if(value===undefined)return null;
  if(typeof value==="string")return value.startsWith("data:")?"[ไม่เก็บเนื้อหาไฟล์]":value;
  if(Array.isArray(value))return value.map(v=>redactLog(v,"",depth+1));
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([k])=>!["audit","history"].includes(k)).map(([k,v])=>[k,redactLog(v,k,depth+1)]));
  return value;
}
export function createSystemLog(context:LogContext,activity:Activity,now=new Date().toISOString(),legacy=false,occurredAt:string|null=now):SystemLog {
  return {eventId:crypto.randomUUID(),operationId:activity.operationId??crypto.randomUUID(),recordedAt:now,occurredAt,actorId:activity.actorId??context.actorId,role:activity.role??context.role,department:activity.department??context.department??null,sessionId:context.sessionId,deviceId:context.deviceId,page:context.page,module:activity.module??context.page,action:activity.action,target:activity.target??"",outcome:activity.outcome??"SUCCESS",reason:activity.reason??"",before:redactLog(activity.before),after:redactLog(activity.after),legacy,ip:null,providerId:null};
}
type State = Record<string,any>;
const paths = ["procurementFlow.cases","procurementFlow.legal","catalogProposals","importBatches","assetNumbering.intakes","assets","payments","documents","users","queue","conflicts","receipts","planning.rounds","planning.demands","planning.plans","masterData.documents","masterData.departments","masterData.vendors"];
const get=(state:State,path:string):any=>path.split(".").reduce((value,key)=>value?.[key],state);
const id=(row:any,index:number)=>String(row?.id??row?.code??row?.command?.opId??row?.command?.id??row?.assetId??index);
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
function domainEvents(previous:State,next:State):{module:string;entry:any}[]{
  return ["audit","planning.audit","masterData.audit"].flatMap(path=>{const before=get(previous,path)??[],after=get(next,path)??[];return after.slice(after.length>=before.length?before.length:0).map((entry:any)=>({module:path.split(".")[0],entry}));});
}
function fromDomain(module:string,entry:any):Activity {
  const actor=entry.actor;
  return {module:module==="audit"?"operations":module,action:entry.action??entry.outcome??"DOMAIN_EVENT",target:String(entry.target??entry.recordId??entry.assetId??entry.code??""),outcome:/REJECT|CONFLICT|DENIED/.test(entry.outcome??entry.action??"")?"REJECTED":"SUCCESS",reason:entry.reason??"",before:entry.before??{version:entry.beforeVersion??null,status:entry.beforeStatus??null},after:entry.after??entry,actorId:entry.actorId??(actor?`demo-${actor.role}`:undefined),role:actor?.role??entry.role??(typeof entry.actorId==="string"&&entry.actorId.startsWith("demo-")?entry.actorId.slice(5):undefined),department:actor?.department};
}
export function buildSystemLogs(previous:State,next:State,context:LogContext,now=new Date().toISOString()):SystemLog[] {
  const events:Activity[]=[],domain=domainEvents(previous,next);
  for(const path of paths){const before=get(previous,path)??[],after=get(next,path)??[];const oldMap=new Map(before.map((row:any,i:number)=>[id(row,i),row])),newMap=new Map(after.map((row:any,i:number)=>[id(row,i),row]));
    for(const target of new Set([...oldMap.keys(),...newMap.keys()])){const a=oldMap.get(target),b=newMap.get(target);if(same(a,b))continue;const matching=domain.find(d=>String(d.entry.target??d.entry.recordId??d.entry.assetId??"")===target);events.push({...matching?fromDomain(matching.module,matching.entry):{},module:path,action:matching?.entry.action??`${!a?"CREATE":!b?"REMOVE":"UPDATE"}_${path.replaceAll(".","_").toUpperCase()}`,target:String(target),before:a,after:b});}
  }
  for(const key of ["hospitalProfile","lastSynced","lifecycle"]){if(!same(previous[key],next[key]))events.push({action:`UPDATE_${key.toUpperCase()}`,module:key,target:key,before:previous[key],after:next[key]});}
  // เก็บเหตุการณ์โดเมนด้วย แม้ธุรกรรมเปลี่ยนเฉพาะประวัติ เช่น ผลปฏิเสธหรือการลองซ้ำ
  events.push(...domain.map(d=>fromDomain(d.module,d.entry)));
  if(!events.length)events.push({action:"SAVE_STATE",module:context.page,outcome:"OBSERVED",reason:"บันทึกโดยไม่มีการเปลี่ยนข้อมูล"});
  const operationId=crypto.randomUUID();return events.map(e=>createSystemLog(context,{...e,operationId},now));
}
export function legacySystemLogs(state:State,context:LogContext,now=new Date().toISOString()):SystemLog[] {
  return domainEvents({},state).map(({module,entry})=>createSystemLog({...context,actorId:"ไม่ระบุผู้ทำรายการเดิม",role:"ไม่ระบุหน้าที่เดิม"},fromDomain(module,entry),now,true,typeof entry.at==="string"?entry.at:null));
}
