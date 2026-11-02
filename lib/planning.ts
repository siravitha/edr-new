import type { BookletFile } from "./planning-pdf";
export type PlanningRole = "requester" | "head" | "planner" | "planning-head" | "cfo" | "director" | "sso" | "procurement";
export type PlanningActor = { role: PlanningRole; department: string };
export type Round = { id: string; code: string; name: string; year: number; fund: string; start: string; end: string; departments: string[]; status: "DRAFT" | "OPEN" | "CLOSED"; reopen?: { start: string; end: string; reason: string } };
export type Item = { title: string; kind: string; quantity: number; unit: string; unitPrice: number; reason: string; urgency: string; evidence: string; leaseYears: number; annual: { year: number; amount: number }[] };
export type Demand = { id: string; code: string; roundId: string; department: string; status: "DRAFT" | "HEAD" | "PLAN" | "RETURNED"; original?: Item; item: Item; revision: number; supplemental: boolean };
export type PlanBooklet = BookletFile & { revision:number; contentKey:string; attachedAt:string };
export type Plan = { booklet?:PlanBooklet; id: string; code: string; roundId: string; demandIds: string[]; status: "DRAFT" | "CFO" | "DIRECTOR" | "SSO" | "APPROVED" | "SENT" | "RETURNED"; revision: number; snapshots: { demandId: string; item: Item }[]; letter?: string; sentDate?: string; reply?: string; replyDate?: string; history: { booklet?:PlanBooklet; revision: number; snapshots: { demandId: string; item: Item }[] }[] };
export type PlanningAudit = { id: string; at: string; actor: PlanningActor; action: string; target: string; reason: string; before: unknown; after: unknown };
export type PlanningState = { revision: number; rounds: Round[]; demands: Demand[]; plans: Plan[]; audit: PlanningAudit[]; counters: Record<string, number> };
export const funds = ["เงินงบประมาณประจำปี", "เงินบำรุง", "เงินบริจาค"];
export const kinds = ["จัดซื้อ", "จัดจ้าง", "จ้างเหมาบริการ", "จ้างซ่อมบำรุง", "การเช่า", "การก่อสร้าง"];
export const roleNames: Record<PlanningRole,string> = { requester: "ผู้ขอ", head: "หัวหน้าแผนก/ฝ่าย", planner: "เจ้าหน้าที่ฝ่ายแผนฯ", "planning-head": "หัวหน้าฝ่ายแผน", cfo: "คณะกรรมการ CFO", director: "ผู้อำนวยการ", sso: "บันทึกผล สสจ.อุดรธานี", procurement: "เจ้าหน้าที่ฝ่ายพัสดุ" };
export const planLabels: Record<Plan["status"],string> = { DRAFT:"ร่างแผน", CFO:"รอ CFO", DIRECTOR:"รอผู้อำนวยการ", SSO:"รอผล สสจ.อุดรธานี", APPROVED:"พร้อมส่งฝ่ายพัสดุ", SENT:"ส่งฝ่ายพัสดุแล้ว", RETURNED:"ส่งกลับปรับแผน" };
export const demandLabels = { DRAFT:"ร่างคำขอ", HEAD:"รอหัวหน้าแผนก", PLAN:"ฝ่ายแผนฯ รับพิจารณา", RETURNED:"ส่งคืนแก้ไข" };
export const emptyPlanning = (): PlanningState => ({revision:0,rounds:[],demands:[],plans:[],audit:[],counters:{}});
const copy = <T,>(value:T):T => structuredClone(value);
function check(ok: unknown, message:string): asserts ok { if(!ok) throw new Error(message); }
function required(value:string, label:string, max=2000) { check(typeof value === "string" && !!value.trim() && value.length<=max && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value), `กรุณาระบุ${label}ให้ถูกต้อง`); }
function date(value:string) { check(/^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0,10)===value,"วันที่ไม่ถูกต้อง"); }
export const amount = (item:Item) => Math.round(item.quantity * Math.round(item.unitPrice*100))/100;
function validateItem(item:Item, year:number) {
  required(item.title,"ชื่อรายการ",200); required(item.reason,"เหตุผลความจำเป็น"); required(item.unit,"หน่วยนับ",40);
  check(kinds.includes(item.kind),"ประเภทงานไม่ถูกต้อง"); check(["ปกติ","เร่งด่วน"].includes(item.urgency),"ความเร่งด่วนไม่ถูกต้อง");
  check(Number.isSafeInteger(item.quantity) && item.quantity>0 && item.quantity<=100000,"จำนวนต้องเป็นจำนวนเต็มบวก");
  check(Number.isFinite(item.unitPrice) && item.unitPrice>0 && item.unitPrice<=1000000000 && Math.abs(item.unitPrice*100-Math.round(item.unitPrice*100))<0.0001,"ราคาต้องเป็นบวกและมีทศนิยมไม่เกิน 2 ตำแหน่ง");
  check(Number.isSafeInteger(Math.round(amount(item)*100)),"วงเงินเกินขอบเขต"); check(item.evidence.length<=1000,"รายการเอกสารยาวเกินกำหนด");
  if(item.kind === "การเช่า") {
    check(Number.isInteger(item.leaseYears) && item.leaseYears>=1 && item.leaseYears<=30,"ระยะเวลาเช่าต้องอยู่ระหว่าง 1–30 ปี");
    check(item.annual.length===item.leaseYears,"ต้องระบุแผนจ่ายครบทุกปี");
    check(item.annual.every((a,i)=>a.year===year+i && Number.isFinite(a.amount) && a.amount>=0 && Math.abs(a.amount*100-Math.round(a.amount*100))<0.0001),"แผนจ่ายรายปีไม่ถูกต้อง");
    check(item.annual.reduce((n,a)=>n+Math.round(a.amount*100),0)===Math.round(amount(item)*100),"ยอดจ่ายรายปีต้องเท่ามูลค่ารวมคำขอ");
  } else check(item.annual.length===0,"แผนจ่ายรายปีใช้กับการเช่าเท่านั้น");
}
export function roundAccepts(round:Round, today:string) { return round.status==="OPEN" && today>=round.start && today<=round.end; }
export function planBookletKey(state:PlanningState, plan:Plan):string {
  return JSON.stringify(["DRAFT","RETURNED"].includes(plan.status) ? plan.demandIds.map(id=>({demandId:id,item:state.demands.find(d=>d.id===id)?.item})) : plan.snapshots);
}
export function hasCurrentBooklet(state:PlanningState, plan:Plan):boolean { return !!plan.booklet && plan.booklet.revision===plan.revision && plan.booklet.contentKey===planBookletKey(state,plan); }
export type PlanningCommand =
  | { type:"ATTACH_BOOKLET"; id:string; file:BookletFile; reason:string }
  | { type:"CREATE_ROUND"; round:Omit<Round,"id"|"code"|"status"> }
  | { type:"OPEN_ROUND"|"CLOSE_ROUND"|"APPROVE_REOPEN"; id:string; reason?:string }
  | { type:"REQUEST_REOPEN"; id:string; start:string; end:string; reason:string }
  | { type:"SAVE_DEMAND"; id?:string; roundId:string; department:string; item:Item; supplemental:boolean }
  | { type:"SUBMIT_DEMAND"|"HEAD_APPROVE"|"RETURN_DEMAND"; id:string; reason?:string }
  | { type:"REVIEW_DEMAND"; id:string; item:Item; reason:string }
  | { type:"REVIEW_PLAN_ITEM"; id:string; demandId:string; item:Item; reason:string }
  | { type:"CREATE_PLAN"; roundId:string; demandIds:string[] }
  | { type:"SUBMIT_PLAN"|"CFO_APPROVE"|"DIRECTOR_APPROVE"|"RETURN_PLAN"|"HANDOFF"; id:string; reason?:string }
  | { type:"SEND_SSO"; id:string; letter:string; date:string }
  | { type:"SSO_RESULT"; id:string; approved:boolean; reply:string; date:string; reason:string };
export function planningTransition(current:PlanningState, command:PlanningCommand, actor:PlanningActor, expectedRevision:number, now=new Date().toISOString()):PlanningState {
  check(expectedRevision===current.revision,"ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการใหม่");
  const state=copy(current), before=copy(current), today=new Date(now).toLocaleDateString("en-CA",{timeZone:"Asia/Bangkok"});
  const is=(...roles:PlanningRole[])=>check(roles.includes(actor.role),"หน้าที่นี้ไม่มีสิทธิ์ทำรายการ");
  const nextCode=(prefix:string)=>{const n=(state.counters[prefix]??0)+1;check(n<=9999,"เลขลำดับเต็มแล้ว");state.counters[prefix]=n;return `${prefix}-${String(n).padStart(4,"0")}`;};
  let target="";
  if(command.type==="CREATE_ROUND") {
    is("planner","planning-head"); const r=command.round;required(r.name,"ชื่อรอบ",200);check(Number.isInteger(r.year)&&r.year>=2560&&r.year<=2700,"ปีงบประมาณไม่ถูกต้อง");check(funds.includes(r.fund),"แหล่งเงินไม่ถูกต้อง");date(r.start);date(r.end);check(r.start<=r.end,"วันปิดรับต้องไม่ก่อนวันเปิด");check(r.departments.length>0&&new Set(r.departments).size===r.departments.length,"เลือกหน่วยงานอย่างน้อย 1 แห่ง");
    const code=nextCode("RND");state.rounds.push({...r,id:code,code,status:"DRAFT"});target=code;
  } else if(["OPEN_ROUND","CLOSE_ROUND","REQUEST_REOPEN","APPROVE_REOPEN"].includes(command.type)) {
    const c=command as Extract<PlanningCommand,{id:string}>;const r=state.rounds.find(r=>r.id===c.id);check(r,"ไม่พบรอบ");target=r.id;
    if(command.type==="OPEN_ROUND"){is("planner","planning-head");check(r.status==="DRAFT","เปิดได้เฉพาะรอบร่าง");r.status="OPEN";}
    if(command.type==="CLOSE_ROUND"){is("planner","planning-head");check(r.status==="OPEN","รอบยังไม่เปิด");r.status="CLOSED";}
    if(command.type==="REQUEST_REOPEN"){is("planner");check(r.status==="CLOSED"||today>r.end,"รอบยังไม่ปิด");check(!r.reopen,"มีคำขอเปิดเพิ่มเติมรออนุมัติแล้ว");required(command.reason,"เหตุผล");date(command.start);date(command.end);check(command.start<=command.end&&command.end>=today,"ช่วงเวลาเปิดเพิ่มเติมไม่ถูกต้อง");r.reopen={start:command.start,end:command.end,reason:command.reason};}
    if(command.type==="APPROVE_REOPEN"){is("planning-head");check(r.reopen,"ไม่มีคำขอเปิดเพิ่มเติม");check(r.reopen.end>=today,"ช่วงเวลาที่ขอหมดอายุแล้ว");r.start=r.reopen.start;r.end=r.reopen.end;r.status="OPEN";delete r.reopen;}
  } else if(command.type==="SAVE_DEMAND") {
    is("requester");const r=state.rounds.find(r=>r.id===command.roundId);check(r&&roundAccepts(r,today),"รอบนี้ยังไม่เปิดหรือปิดรับแล้ว");check(command.department===actor.department&&r.departments.includes(actor.department),"หน่วยงานไม่อยู่ในขอบเขตรอบ");validateItem(command.item,r.year);
    const d=state.demands.find(d=>d.id===command.id);
    if(command.id) {check(d&&d.department===actor.department&&["DRAFT","RETURNED"].includes(d.status),"แก้ไขคำขอนี้ไม่ได้");check(d.roundId===r.id,"ห้ามย้ายรอบของคำขอ");d.item=copy(command.item);d.supplemental=command.supplemental;d.revision++;target=d.id;}
    else {const code=nextCode("REQ");state.demands.push({id:code,code,roundId:r.id,department:command.department,item:copy(command.item),revision:1,status:"DRAFT",supplemental:command.supplemental});target=code;}
  } else if(["SUBMIT_DEMAND","HEAD_APPROVE","RETURN_DEMAND","REVIEW_DEMAND"].includes(command.type)) {
    const c=command as Extract<PlanningCommand,{id:string}>;const d=state.demands.find(d=>d.id===c.id);check(d,"ไม่พบคำขอ");const r=state.rounds.find(r=>r.id===d.roundId)!;target=d.id;
    const locked=state.plans.some(p=>p.demandIds.includes(d.id)&&p.status!=="RETURNED");check(!locked,"คำขออยู่ในแผนแล้ว ต้องส่งแผนกลับก่อนแก้ไข");
    if(command.type==="SUBMIT_DEMAND"){is("requester");check(d.department===actor.department&&["DRAFT","RETURNED"].includes(d.status),"ส่งคำขอไม่ได้");check(roundAccepts(r,today),"รอบปิดรับแล้ว");validateItem(d.item,r.year);d.original??=copy(d.item);d.status="HEAD";}
    if(command.type==="HEAD_APPROVE"){is("head");check(d.department===actor.department&&d.status==="HEAD","คำขอไม่ได้รอหัวหน้าหน่วยงานนี้");d.status="PLAN";}
    if(command.type==="RETURN_DEMAND"){is("head","planner","planning-head");check(actor.role==="head"?d.department===actor.department&&d.status==="HEAD":d.status==="PLAN","ไม่อยู่ในขั้นพิจารณา");required(command.reason??"","เหตุผลส่งคืน");d.status="RETURNED";}
    if(command.type==="REVIEW_DEMAND"){is("head","planner","planning-head");check(actor.role==="head"?d.department===actor.department&&d.status==="HEAD":d.status==="PLAN","ไม่อยู่ในขั้นพิจารณา");required(command.reason,"เหตุผลแก้ไข");validateItem(command.item,r.year);d.item=copy(command.item);d.revision++;}
  } else if(command.type==="CREATE_PLAN") {
    is("planner","planning-head");const r=state.rounds.find(r=>r.id===command.roundId);check(r,"ไม่พบรอบ");check(command.demandIds.length>0&&new Set(command.demandIds).size===command.demandIds.length,"เลือกคำขออย่างน้อย 1 รายการ");
    const demands=command.demandIds.map(id=>state.demands.find(d=>d.id===id));check(demands.every(d=>d&&d.roundId===r.id&&d.status==="PLAN"&&!state.plans.some(p=>p.demandIds.includes(d.id))),"เลือกเฉพาะคำขอผ่านหัวหน้าในรอบเดียวและยังไม่เข้าแผน");
    const code=nextCode("PLN");state.plans.push({id:code,code,roundId:r.id,demandIds:command.demandIds,status:"DRAFT",revision:1,snapshots:demands.map(d=>({demandId:d!.id,item:copy(d!.item)})),history:[]});target=code;
  } else {
    const c=command as Extract<PlanningCommand,{id:string}>;const p=state.plans.find(p=>p.id===c.id);check(p,"ไม่พบแผน");target=p.id;
    if(command.type==="ATTACH_BOOKLET"){is("planner","planning-head");check(["DRAFT","RETURNED","CFO","DIRECTOR","SSO"].includes(p.status)&&!p.letter,"แนบหรือเปลี่ยนเล่มได้ก่อนบันทึกนำส่ง สสจ.เท่านั้น");const f=command.file;check(/^[a-f0-9-]{36}$/.test(f.fileId)&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isInteger(f.size)&&f.size>=20&&f.size<=10*1024*1024&&/\.pdf$/i.test(f.name)&&f.name.length<=200&&!/[\x00-\x1f\x7f\\/]/.test(f.name),"ข้อมูลไฟล์ PDF ไม่ถูกต้อง");required(command.reason,"รายละเอียดเล่มเอกสาร");p.booklet={...copy(f),revision:p.revision,contentKey:planBookletKey(state,p),attachedAt:now};}
    if(command.type==="REVIEW_PLAN_ITEM"){is("cfo","director");check(actor.role==="cfo"?p.status==="CFO":p.status==="DIRECTOR","แผนไม่ได้อยู่ในขั้นของผู้พิจารณา");required(command.reason,"เหตุผลแก้ไข");const row=p.snapshots.find(s=>s.demandId===command.demandId);check(row,"รายการไม่ได้อยู่ในแผน");validateItem(command.item,state.rounds.find(r=>r.id===p.roundId)!.year);p.history.push({revision:p.revision,snapshots:copy(p.snapshots),booklet:copy(p.booklet)});p.revision++;delete p.booklet;row.item=copy(command.item);const d=state.demands.find(d=>d.id===command.demandId)!;d.item=copy(command.item);d.revision++;if(actor.role==="director")p.status="CFO";}
    if(command.type==="SUBMIT_PLAN"){is("planner","planning-head");check(["DRAFT","RETURNED"].includes(p.status),"แผนไม่ได้รอเสนอ CFO");const ds=p.demandIds.map(id=>state.demands.find(d=>d.id===id)!);check(ds.every(d=>d.status==="PLAN"),"คำขอบางรายการยังไม่ผ่านหัวหน้า");check(hasCurrentBooklet(state,p),"ต้องแนบเล่มเอกสาร PDF ให้ตรงกับฉบับแผนก่อนเสนอ CFO");p.snapshots=ds.map(d=>({demandId:d.id,item:copy(d.item)}));p.status="CFO";delete p.letter;delete p.reply;delete p.sentDate;delete p.replyDate;}
    if(command.type==="CFO_APPROVE"){is("cfo");check(p.status==="CFO","แผนไม่ได้รอ CFO");check(hasCurrentBooklet(state,p),"ต้องแนบเล่ม PDF ของฉบับปัจจุบันก่อนบันทึกผล CFO");required(command.reason??"","เลขที่มติ/หลักฐาน CFO");p.status="DIRECTOR";}
    if(command.type==="DIRECTOR_APPROVE"){is("director");check(p.status==="DIRECTOR","ต้องผ่าน CFO ก่อน");check(hasCurrentBooklet(state,p),"ต้องแนบเล่ม PDF ของฉบับปัจจุบันก่อนบันทึกผลผู้อำนวยการ");required(command.reason??"","หลักฐานอนุมัติผู้อำนวยการ");p.status="SSO";}
    if(command.type==="SEND_SSO"){is("planner","planning-head");check(p.status==="SSO"&&!p.letter,"ส่งต้นสังกัดได้หลังผู้อำนวยการอนุมัติเท่านั้น");check(hasCurrentBooklet(state,p),"ต้องแนบเล่มเอกสาร PDF ให้ตรงกับฉบับแผนก่อนส่ง สสจ.อุดรธานี");required(command.letter,"เลขหนังสือนำส่ง",200);date(command.date);check(command.date<=today,"วันที่ส่งต้องไม่เป็นอนาคต");p.letter=command.letter;p.sentDate=command.date;}
    if(command.type==="SSO_RESULT"){is("sso");check(p.status==="SSO"&&p.letter,"ต้องมีหนังสือนำส่งก่อนบันทึกผล");required(command.reply,"เลขหนังสือตอบกลับ",200);required(command.reason,"รายละเอียดผล/หลักฐาน");date(command.date);check(command.date>=p.sentDate!&&command.date<=today,"วันที่ตอบกลับไม่ถูกต้อง");p.reply=command.reply;p.replyDate=command.date;if(!command.approved){p.history.push({revision:p.revision,snapshots:copy(p.snapshots),booklet:copy(p.booklet)});p.revision++;delete p.booklet;}p.status=command.approved?"APPROVED":"RETURNED";if(!command.approved){delete p.letter;delete p.sentDate;}}
    if(command.type==="RETURN_PLAN"){is("cfo","director");check(actor.role==="cfo"?p.status==="CFO":p.status==="DIRECTOR","แผนไม่ได้อยู่ในขั้นของผู้พิจารณา");required(command.reason??"","เหตุผลส่งคืน");p.history.push({revision:p.revision,snapshots:copy(p.snapshots),booklet:copy(p.booklet)});p.revision++;delete p.booklet;p.status="RETURNED";}
    if(command.type==="HANDOFF"){is("planner","planning-head");check(p.status==="APPROVED"&&p.reply,"ต้องได้รับอนุมัติจาก สสจ.อุดรธานีก่อน");p.status="SENT";}
  }
  state.revision++;state.audit.push({id:`EVT-${state.revision}`,at:now,actor:copy(actor),action:command.type,target,reason:"reason" in command?command.reason??"":"",before:{round:before.rounds.find(r=>r.id===target),demand:before.demands.find(d=>d.id===target),plan:before.plans.find(p=>p.id===target)},after:copy({round:state.rounds.find(r=>r.id===target),demand:state.demands.find(d=>d.id===target),plan:state.plans.find(p=>p.id===target)})});return state;
}
