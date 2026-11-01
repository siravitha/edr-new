export type NumberedAsset={id:string;hospitalId:string;assetNo:string;[key:string]:unknown};
export type IntakeUnit={id:string;serialNo:string;status:"PENDING"|"ACCEPTED";assetId?:string;assetNo?:string};
export type Intake={id:string;hospitalId:string;orderRef:string;lineRef:string;title:string;prefix:string;year:number;wardId:string;unitCost:number;units:IntakeUnit[];acceptanceRef?:string;acceptedAt?:string};
export type NumberingState={revision:number;intakes:Intake[];counters:Record<string,number>};
export const emptyNumbering=():NumberingState=>({revision:0,intakes:[],counters:{}});
export function parseAssetNumber(value:string){const m=/^(\d{4})-(\d{3})-(\d{4,5})\/(\d{2})$/.exec(value);if(!m||Number(m[3])===0)return null;return {prefix:`${m[1]}-${m[2]}`,sequence:Number(m[3]),yearSuffix:m[4]};}
export function assetNumberIdentity(value:string){const p=parseAssetNumber(value);return p?`${p.prefix}:${p.sequence}`:value;}
const check=(condition:unknown,message:string):asserts condition=>{if(!condition)throw new Error(message);};
export function nextAssetNumber(assets:NumberedAsset[],hospitalId:string,prefix:string,year:number,counter=0){
 if(!/^\d{4}-\d{3}$/.test(prefix)||!Number.isInteger(year)||year<2500||year>2599)throw new Error("รหัสหรือปีงบประมาณไม่ถูกต้อง");
 let highest=counter;for(const a of assets.filter(a=>a.hospitalId===hospitalId)){const p=parseAssetNumber(a.assetNo);if(p?.prefix===prefix)highest=Math.max(highest,p.sequence);}
 if(!Number.isSafeInteger(highest)||highest<0||highest>=99999)throw new Error("เลขลำดับครบ 99999 ต้องให้ผู้รับผิดชอบกำหนดแนวทางก่อน ไม่วนกลับใช้เลขเดิม");
 return `${prefix}-${String(highest+1).padStart(5,"0")}/${String(year).slice(-2)}`;
}
export type NumberingCommand=
 | {type:"CREATE_INTAKE";hospitalId:string;orderRef:string;lineRef:string;title:string;prefix:string;year:number;wardId:string;unitCost:number;serials:string[]}
 | {type:"ACCEPT_UNITS";id:string;unitIds:string[];reference:string;verified:boolean}
 | {type:"ISSUE_NUMBERS";id:string;unitIds:string[]};
export function numberingTransition(state:NumberingState,assets:NumberedAsset[],command:NumberingCommand,actor:{role:string;hospitalId:string;online:boolean},revision:number,allowedPrefixes:string[],now=new Date().toISOString()){
 if(actor.role!=="procurement")throw new Error("เฉพาะเจ้าหน้าที่พัสดุที่ออกเลขได้ในต้นแบบ");
 if(state.revision!==revision)throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการใหม่");
 if(!actor.online&&command.type!=="CREATE_INTAKE")throw new Error("ต้องออนไลน์ก่อนยืนยันตรวจรับหรือออกเลข");
 const next=structuredClone(state),nextAssets=structuredClone(assets);
 const text=(v:string,label:string)=>{if(!v.trim()||v.length>200||/[\x00-\x1f]/.test(v))throw new Error(`กรุณาระบุ${label}ให้ถูกต้อง`);return v.trim();};
 let target="";
 if(command.type==="CREATE_INTAKE"){
  if(command.hospitalId!==actor.hospitalId)throw new Error("อยู่นอกขอบเขตโรงพยาบาล");
  if(!allowedPrefixes.includes(command.prefix))throw new Error("รหัสประเภท–ชนิดยังไม่ผ่านการยืนยัน ห้ามสร้างรหัสใหม่แทนการอนุมัติ");
  nextAssetNumber(nextAssets,actor.hospitalId,command.prefix,command.year);
  if(!command.serials.length||command.serials.length>100||new Set(command.serials.map(s=>s.trim())).size!==command.serials.length)throw new Error("ระบุหมายเลขเครื่อง 1–100 เครื่องและไม่ซ้ำกัน");
  if(!Number.isFinite(command.unitCost)||command.unitCost<=0||command.unitCost>1e9||Math.abs(command.unitCost*100-Math.round(command.unitCost*100))>0.0001)throw new Error("ราคาทุนต้องเป็นบวกและทศนิยมไม่เกิน 2 ตำแหน่ง");
  const orderRef=text(command.orderRef,"เลขสัญญา"),lineRef=text(command.lineRef,"รายการ/งวดส่งมอบ");
  if(next.intakes.some(i=>i.hospitalId===actor.hospitalId&&i.orderRef===orderRef&&i.lineRef===lineRef))throw new Error("รายการ/งวดส่งมอบนี้มีแล้ว กรุณาเปิดรายการเดิม");
  for(const serial of command.serials){text(serial,"หมายเลขเครื่อง");if(nextAssets.some(a=>a.hospitalId===actor.hospitalId&&a.serialNo===serial.trim())||next.intakes.some(i=>i.hospitalId===actor.hospitalId&&i.units.some(u=>u.serialNo===serial.trim())))throw new Error("หมายเลขเครื่องมีอยู่แล้ว กรุณาตรวจรายการซ้ำ");}
  target=crypto.randomUUID();next.intakes.push({id:target,hospitalId:actor.hospitalId,orderRef,lineRef,title:text(command.title,"ชื่อรายการ"),prefix:command.prefix,year:command.year,wardId:text(command.wardId,"หน่วยงาน"),unitCost:command.unitCost,units:command.serials.map(serialNo=>({id:crypto.randomUUID(),serialNo:serialNo.trim(),status:"PENDING"}))});
 } else {
  const intake=next.intakes.find(i=>i.id===command.id&&i.hospitalId===actor.hospitalId);if(!intake)throw new Error("ไม่พบรายการรับในโรงพยาบาลนี้");target=intake.id;
  if(!command.unitIds.length||new Set(command.unitIds).size!==command.unitIds.length)throw new Error("เลือกเครื่องที่จะดำเนินการและห้ามซ้ำ");
  const units=command.unitIds.map(id=>intake.units.find(u=>u.id===id));if(units.some(u=>!u))throw new Error("เครื่องไม่อยู่ในรายการตรวจรับ");
  if(command.type==="ACCEPT_UNITS"){
   if(!command.verified)throw new Error("ต้องตรวจหลักฐานลงนามก่อนยืนยันผลตรวจรับ");
   if(units.some(u=>u!.status!=="PENDING"||u!.assetNo))throw new Error("บางเครื่องตรวจรับหรือออกเลขแล้ว");
   const reference=text(command.reference,"เลขรายงานตรวจรับ/หลักฐานลงนาม");
   for(const u of units){u!.status="ACCEPTED";Object.assign(u!,{acceptanceRef:reference,acceptedAt:now});}intake.acceptanceRef=reference;intake.acceptedAt=now;
  } else {
   if(units.some(u=>u!.status!=="ACCEPTED"||u!.assetId||u!.assetNo))throw new Error("ออกเลขได้เฉพาะเครื่องตรวจรับผ่านแล้วและยังไม่เคยออกเลข");
   const key=`${actor.hospitalId}:${intake.prefix}`;
   for(const u of units){const assetNo=nextAssetNumber(nextAssets,actor.hospitalId,intake.prefix,intake.year,next.counters[key]??0),assetId=crypto.randomUUID();next.counters[key]=parseAssetNumber(assetNo)!.sequence;
    nextAssets.push({id:assetId,hospitalId:actor.hospitalId,assetNo,name:intake.title,serialNo:u!.serialNo,category:intake.title,wardId:intake.wardId,status:"QUARANTINED",version:1,cost:intake.unitCost,depreciation:0,accountingPending:true,verified:false,poNo:intake.orderRef,critical:false,intakeId:intake.id,acceptanceRef:(u as any).acceptanceRef,acquiredYear:intake.year});u!.assetId=assetId;u!.assetNo=assetNo;}
  }
 }
 next.revision++;return {numbering:next,assets:nextAssets,target};
}
