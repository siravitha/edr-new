import type {DemoState} from './seed';
import type {BookletFile} from './planning-pdf';
import {emptyNumbering,numberingTransition} from './asset-numbering.ts';

export type Evidence=BookletFile&{reference:string;signed:boolean};
export type FlowActor={id:string;role:string;hospitalId:string;online:boolean};
export type Receipt={id:string;code:string;quantity:number;amount:number;date:string;intakeId?:string;evidence:Evidence;accounting?:{reviewer:string;date:string;debit:string;credit:string;evidence:Evidence}};
export type Claim={id:string;code:string;receiptId:string;invoice:string;amount:number;status:'SUBMITTED'|'RETURNED'|'REVIEWED'|'APPROVED'|'PAID';revision:number;maker:string;reviewer?:string;approver?:string;payer?:string;reason?:string;paymentRef?:string;history:{action:string;at:string;actor:string;evidence:Evidence;reason?:string}[]};
export type FlowCase={id:string;code:string;hospitalId:string;planId:string;planCode:string;planRevision:number;demandId:string;fund:string;year:number;department:string;kind:string;title:string;quantity:number;unit:string;ceiling:number;classification:'ASSET'|'SUPPLY'|'SERVICE'|'CONSTRUCTION'|'LEASE';status:'DRAFT'|'SUBMITTED'|'APPROVED'|'TOR_READY'|'SELECTED'|'CONTRACTED'|'CANCELLED';maker:string;approver?:string;tor?:Evidence;selection?:{method:string;basis:string;evidence:Evidence};contract?:{code:string;reference:string;vendorId:string;vendorName:string;quantity:number;unitCost:number;amount:number;date:string;delivery:string;annual:{year:number;amount:number}[];evidence:Evidence};receipts:Receipt[];claims:Claim[];history:{action:string;actor:string;at:string;evidence?:Evidence;reason?:string}[]};
export type LegalTicket={id:string;code:string;caseId:string;subject:string;question:string;status:'OPEN'|'ANSWERED';maker:string;at:string;evidence:Evidence;answer?:string;reviewer?:string;answeredAt?:string;answerEvidence?:Evidence};
export type FlowState={revision:number;counters:Record<string,number>;cases:FlowCase[];legal:LegalTicket[]};
export const emptyFlow=():FlowState=>({revision:0,counters:{},cases:[],legal:[]});
export const flowLabels:Record<FlowCase['status'],string>={DRAFT:'ร่าง PR',SUBMITTED:'รอเห็นชอบ PR',APPROVED:'PR ผ่านการเห็นชอบ',TOR_READY:'จัดเตรียม TOR/ราคากลางแล้ว',SELECTED:'บันทึกผลจัดหาแล้ว',CONTRACTED:'ลงนามสัญญาและผูกพัน',CANCELLED:'ยกเลิก PR'};
export const claimLabels:Record<Claim['status'],string>={SUBMITTED:'รอตรวจการเงิน',RETURNED:'ส่งคืนแก้ไข',REVIEWED:'รออนุมัติจ่าย',APPROVED:'อนุมัติ รอบันทึกการจ่าย',PAID:'บันทึกหลักฐานจ่ายแล้ว'};
export const methods=['เฉพาะเจาะจง','คัดเลือก','ประกาศเชิญชวนทั่วไป · e-market','ประกาศเชิญชวนทั่วไป · e-bidding','ประกาศเชิญชวนทั่วไป · วิธีอื่นตามที่ใช้ได้'];
type Common={id:string;evidence:Evidence};
export type FlowCommand=
 | {type:'CREATE_PR';planId:string;demandId:string;classification:FlowCase['classification']}
 | ({type:'SUBMIT_PR'|'APPROVE_PR'|'TOR';}&Common)
 | ({type:'CANCEL_PR';reason:string}&Common)
 | ({type:'SELECT';method:string;basis:string}&Common)
 | ({type:'CONTRACT';reference:string;vendorId:string;unitCost:number;date:string;delivery:string;annual:{year:number;amount:number}[]}&Common)
 | ({type:'RECEIVE';quantity:number;date:string;prefix:string;year:number;wardId:string;serials:string[]}&Common)
 | ({type:'CLAIM';receiptId:string;invoice:string}&Common)
 | ({type:'RETURN_CLAIM'|'RESUBMIT_CLAIM'|'REVIEW_CLAIM'|'APPROVE_CLAIM'|'PAY_CLAIM';claimId:string;reason:string;paymentRef:string}&Common)
 | ({type:'ACCOUNTING';receiptId:string;date:string;debit:string;credit:string}&Common)
 | ({type:'LEGAL_REQUEST';question:string}&Common)
 | ({type:'LEGAL_ANSWER';ticketId:string;answer:string}&Common);
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
const text=(s:string,label:string,max=200)=>{check(typeof s==='string'&&!!s.trim()&&s.length<=max&&!/[\x00-\x1f\x7f]/.test(s),`กรุณาระบุ${label}ให้ถูกต้อง`);return s.trim();};
const date=(s:string)=>{check(/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'วันที่ไม่ถูกต้อง');return s;};
const cents=(n:number)=>{check(Number.isFinite(n)&&n>0&&n<=1e9&&Math.abs(n*100-Math.round(n*100))<.0001,'วงเงินต้องเป็นบวกและทศนิยมไม่เกินสองตำแหน่ง');return Math.round(n*100);};
function evidence(e:Evidence){check(e&&e.signed===true,'ต้องยืนยันว่าได้ตรวจเอกสารลงนามหมึกแล้ว');text(e.reference,'เลขเอกสารอ้างอิง');check(typeof e.fileId==='string'&&e.fileId.length>0&&/\.pdf$/i.test(e.name)&&Number.isInteger(e.size)&&e.size>0&&e.size<=10*1024*1024&&/^[a-f0-9]{64}$/.test(e.sha256),'ต้องแนบ PDF ที่ผ่านการตรวจไฟล์');}
export function flowTotals(c:FlowCase){const committed=c.contract?.amount??0,accepted=c.receipts.reduce((n,r)=>n+r.amount,0),claimed=c.claims.reduce((n,r)=>n+r.amount,0),paid=c.claims.filter(r=>r.status==='PAID').reduce((n,r)=>n+r.amount,0);return {ceiling:c.ceiling,committed,accepted,claimed,paid,uncommitted:c.ceiling-committed,unpaid:committed-paid};}
export function transitionFlow(current:DemoState,command:FlowCommand,actor:FlowActor,expectedRevision:number,now=new Date().toISOString()){
 check(actor.hospitalId==='UTH'&&actor.online,'ต้องอยู่ในโรงพยาบาลและออนไลน์ก่อนยืนยันขั้นตอน');
 const existing=current.procurementFlow??emptyFlow();check(existing.revision===expectedRevision,'ข้อมูลเปลี่ยนแล้ว กรุณาเปิดรายการใหม่');
 const data=structuredClone(current),state:FlowState=data.procurementFlow??emptyFlow();data.procurementFlow=state;
 const allow=(...roles:string[])=>check(roles.includes(actor.role),'บทบาทนี้ไม่มีสิทธิ์ดำเนินการ');
 const code=(prefix:string)=>{const n=(state.counters[prefix]??0)+1;check(n<=9999,'ลำดับเอกสารครบ 9999 แล้ว');state.counters[prefix]=n;return `${prefix}-${String(n).padStart(4,'0')}`;};
 let target='';
 if(command.type==='CREATE_PR'){
  allow('procurement');const plan=data.planning?.plans.find(p=>p.id===command.planId&&p.status==='SENT');check(plan,'ต้องเป็นแผนที่อนุมัติและส่งฝ่ายพัสดุแล้ว');
  const round=data.planning?.rounds.find(r=>r.id===plan.roundId),snapshot=plan.snapshots.find(s=>s.demandId===command.demandId),demand=data.planning?.demands.find(d=>d.id===command.demandId);check(round&&snapshot&&demand,'ไม่พบรายการแผนต้นทาง');
  check(!state.cases.some(c=>c.demandId===command.demandId&&c.status!=='CANCELLED'),'รายการแผนนี้มี PR แล้ว กรุณาใช้รายการเดิม');
  check(['ASSET','SUPPLY','SERVICE','CONSTRUCTION','LEASE'].includes(command.classification),'ประเภทการรับรู้ไม่ถูกต้อง');
  const item=snapshot.item;check(Number.isInteger(item.quantity)&&item.quantity>0,'จำนวนต้นทางไม่ถูกต้อง');const ceiling=cents(item.unitPrice)*item.quantity;check(Number.isSafeInteger(ceiling),'วงเงินเกินขอบเขต');target=crypto.randomUUID();
  state.cases.push({id:target,code:code('PR'),hospitalId:actor.hospitalId,planId:plan.id,planCode:plan.code,planRevision:plan.revision,demandId:demand.id,fund:round.fund,year:round.year,department:demand.department,kind:item.kind,title:item.title,quantity:item.quantity,unit:item.unit,ceiling,classification:command.classification,status:'DRAFT',maker:actor.id,receipts:[],claims:[],history:[{action:'CREATE_PR',actor:actor.id,at:now}]});
 }else{
  const c=state.cases.find(c=>c.id===command.id&&c.hospitalId===actor.hospitalId);check(c,'ไม่พบรายการในขอบเขต');target=c.id;evidence(command.evidence);
  if(['SUBMIT_PR','APPROVE_PR','CONTRACT'].includes(command.type)){
   const source=data.planning?.plans.find(p=>p.id===c.planId);check(source?.status==='SENT'&&source.revision===c.planRevision,'แผนต้นทางเปลี่ยนฉบับหรือสถานะ ต้องทวนสอบ PR กับฝ่ายแผนก่อน');
  }
  const requireStatus=(...statuses:FlowCase['status'][])=>check(statuses.includes(c.status),'ขั้นตอนปัจจุบันยังไม่อนุญาตรายการนี้');
  if(command.type==='SUBMIT_PR'){allow('procurement');requireStatus('DRAFT');c.status='SUBMITTED';}
  else if(command.type==='APPROVE_PR'){allow('executive');requireStatus('SUBMITTED');check(actor.id!==c.maker,'ผู้จัดทำห้ามอนุมัติรายการตนเอง');c.status='APPROVED';c.approver=actor.id;}
  else if(command.type==='CANCEL_PR'){allow('procurement');requireStatus('DRAFT','SUBMITTED','APPROVED','TOR_READY','SELECTED');text(command.reason,'เหตุผลยกเลิก',2000);check(!state.legal.some(t=>t.caseId===c.id&&t.status==='OPEN'),'ยังมีเรื่องกฎหมายค้าง ต้องดำเนินการให้เสร็จก่อนยกเลิก');c.status='CANCELLED';}
  else if(command.type==='TOR'){allow('procurement');requireStatus('APPROVED');c.tor=command.evidence;c.status='TOR_READY';}
  else if(command.type==='SELECT'){allow('procurement');requireStatus('TOR_READY');check(methods.includes(command.method),'เลือกวิธีจัดหาที่ถูกต้อง');c.selection={method:command.method,basis:text(command.basis,'เหตุผล/ข้อกฎหมายและเลขโครงการ e-GP',2000),evidence:command.evidence};c.status='SELECTED';}
  else if(command.type==='CONTRACT'){
   allow('procurement');requireStatus('SELECTED');check(!state.legal.some(t=>t.caseId===c.id&&t.status==='OPEN'),'มีเรื่องส่งนิติกรที่ยังไม่ตอบ กรุณาติดตามก่อนบันทึกสัญญา');
   const vendor=data.masterData?.vendors.find(v=>v.id===command.vendorId&&v.status==='ACTIVE');check(vendor,'เลือกผู้ค้าสถานะใช้งานจากทะเบียนผู้ค้า');
   const unitCost=cents(command.unitCost),amount=unitCost*c.quantity;check(Number.isSafeInteger(amount)&&amount<=c.ceiling,'สัญญาเกินวงเงินแผน ต้องเสนอปรับแผนก่อน');
   date(command.date);date(command.delivery);check(command.delivery>=command.date,'วันส่งมอบต้องไม่ก่อนวันสัญญา');const ref=text(command.reference,'เลขสัญญา');check(!state.cases.some(x=>x.contract?.reference===ref),'เลขสัญญาซ้ำ');
   const annual=command.annual;check(annual.length>0&&annual.length<=30&&new Set(annual.map(a=>a.year)).size===annual.length,'ระบุแผนจ่ายรายปีให้ครบและไม่ซ้ำ');
   for(const a of annual)check(Number.isInteger(a.year)&&a.year>=c.year&&a.year<c.year+30&&Number.isSafeInteger(a.amount)&&a.amount>=0,'ปีหรือยอดแผนจ่ายไม่ถูกต้อง');
   check(annual.reduce((n,a)=>n+a.amount,0)===amount,'ยอดรายปีต้องตรงวงเงินสัญญา');
   c.contract={code:code('CON'),reference:ref,vendorId:vendor.id,vendorName:vendor.name,quantity:c.quantity,unitCost,amount,date:command.date,delivery:command.delivery,annual,evidence:command.evidence};c.status='CONTRACTED';
  }else if(command.type==='RECEIVE'){
   allow('procurement');requireStatus('CONTRACTED');const contract=c.contract!;date(command.date);check(command.date>=contract.date,'วันตรวจรับต้องไม่ก่อนสัญญา');check(Number.isInteger(command.quantity)&&command.quantity>0&&command.quantity+c.receipts.reduce((n,r)=>n+r.quantity,0)<=c.quantity,'จำนวนตรวจรับเกินคงเหลือ');
   const receipt:Receipt={id:crypto.randomUUID(),code:code('REC'),quantity:command.quantity,amount:contract.unitCost*command.quantity,date:command.date,evidence:command.evidence};
   if(c.classification==='ASSET'){
    check(command.serials.length===command.quantity,'หมายเลขเครื่องต้องตรงจำนวนตรวจรับ');check(['ICU','ER','MED','SUR','WH'].includes(command.wardId),'หน่วยงานผู้ครอบครองไม่ถูกต้อง');
    const expectedYear=new Date(command.date).getUTCFullYear()+543+(Number(command.date.slice(5,7))>=10?1:0);check(command.year===expectedYear,'ปีได้มาต้องตรงปีงบประมาณของวันตรวจรับ');
    const numberingActor={role:'procurement',hospitalId:actor.hospitalId,online:true};const ns=data.assetNumbering??emptyNumbering();const intake=numberingTransition(ns,data.assets,{type:'CREATE_INTAKE',hospitalId:actor.hospitalId,orderRef:contract.reference,lineRef:receipt.code,title:c.title,prefix:command.prefix,year:command.year,wardId:command.wardId,unitCost:contract.unitCost/100,serials:command.serials},numberingActor,ns.revision,['7110-010'],now);
    const i=intake.numbering.intakes.find(i=>i.id===intake.target)!;const accepted=numberingTransition(intake.numbering,intake.assets,{type:'ACCEPT_UNITS',id:i.id,unitIds:i.units.map(u=>u.id),reference:command.evidence.reference,verified:true},numberingActor,intake.numbering.revision,['7110-010'],now);data.assetNumbering=accepted.numbering;data.assets=accepted.assets as DemoState['assets'];receipt.intakeId=i.id;
   }
   c.receipts.push(receipt);
  }else if(command.type==='CLAIM'){
   allow('procurement');requireStatus('CONTRACTED');const r=c.receipts.find(r=>r.id===command.receiptId);check(r,'ต้องมีรายการตรวจรับผ่านก่อนตั้งเบิก');check(!c.claims.some(x=>x.receiptId===r.id),'งวดตรวจรับนี้ตั้งเบิกแล้ว กรุณาใช้คำขอเดิม');
   const invoice=text(command.invoice,'เลขใบแจ้งหนี้');check(!state.cases.some(x=>x.contract?.vendorId===c.contract?.vendorId&&x.claims.some(p=>p.invoice.toUpperCase()===invoice.toUpperCase())),'ใบแจ้งหนี้ผู้ค้ารายนี้ตั้งเบิกแล้ว');
   c.claims.push({id:crypto.randomUUID(),code:code('PAY'),receiptId:r.id,invoice,amount:r.amount,status:'SUBMITTED',revision:1,maker:actor.id,history:[{action:'CLAIM',at:now,actor:actor.id,evidence:command.evidence}]});
  }else if(['RETURN_CLAIM','RESUBMIT_CLAIM','REVIEW_CLAIM','APPROVE_CLAIM','PAY_CLAIM'].includes(command.type)){
   const cmd=command as Extract<FlowCommand,{claimId:string}>,claim=c.claims.find(p=>p.id===cmd.claimId);check(claim,'ไม่พบคำขอเบิกจ่าย');
   if(cmd.type==='RETURN_CLAIM'){allow('finance','executive');check(['SUBMITTED','REVIEWED'].includes(claim.status),'ส่งคืนได้เฉพาะรายการที่ยังไม่อนุมัติจ่าย');claim.reason=text(cmd.reason,'เหตุผลส่งคืน',2000);claim.status='RETURNED';delete claim.reviewer;delete claim.approver;}
   if(cmd.type==='RESUBMIT_CLAIM'){allow('procurement');check(claim.status==='RETURNED','ต้องเป็นคำขอที่ถูกส่งคืน');claim.status='SUBMITTED';claim.revision++;delete claim.reason;delete claim.reviewer;delete claim.approver;}
   if(cmd.type==='REVIEW_CLAIM'){allow('finance');check(claim.status==='SUBMITTED'&&actor.id!==claim.maker,'ผู้ตรวจต้องแยกจากผู้จัดทำและเป็นรายการรอตรวจ');claim.status='REVIEWED';claim.reviewer=actor.id;}
   if(cmd.type==='APPROVE_CLAIM'){allow('executive');check(claim.status==='REVIEWED'&&actor.id!==claim.maker&&actor.id!==claim.reviewer,'ต้องผ่านตรวจและแยกผู้อนุมัติ');claim.status='APPROVED';claim.approver=actor.id;}
   if(cmd.type==='PAY_CLAIM'){allow('finance');check(claim.status==='APPROVED'&&actor.id!==claim.approver&&actor.id!==claim.maker,'ต้องอนุมัติและแยกผู้จ่ายจากผู้อนุมัติ');const ref=text(cmd.paymentRef,'เลขอ้างอิงการจ่าย');check(!state.cases.some(x=>x.claims.some(p=>p.paymentRef===ref)),'เลขอ้างอิงจ่ายซ้ำ');claim.status='PAID';claim.payer=actor.id;claim.paymentRef=ref;}
   claim.history.push({action:cmd.type,actor:actor.id,at:now,evidence:cmd.evidence,reason:cmd.reason});
  }else if(command.type==='ACCOUNTING'){
   allow('accounting');const r=c.receipts.find(r=>r.id===command.receiptId);check(r&&!r.accounting,'ไม่พบงวดตรวจรับ หรือรับรองแล้ว');date(command.date);check(command.date>=r.date,'วันที่รับรองต้องไม่ก่อนตรวจรับ');text(command.debit,'บัญชีเดบิต');text(command.credit,'บัญชีเครดิต');check(command.debit!==command.credit,'บัญชีเดบิตและเครดิตต้องต่างกัน');r.accounting={reviewer:actor.id,date:command.date,debit:command.debit,credit:command.credit,evidence:command.evidence};
  }else if(command.type==='LEGAL_REQUEST'){
   allow('procurement','finance','accounting','strategy');requireStatus('DRAFT','SUBMITTED','APPROVED','TOR_READY','SELECTED','CONTRACTED');check(!state.legal.some(t=>t.caseId===c.id&&t.status==='OPEN'),'มีเรื่องนิติกรที่ยังไม่ตอบอยู่แล้ว');state.legal.push({id:crypto.randomUUID(),code:code('LEG'),caseId:c.id,subject:c.title,question:text(command.question,'ข้อหารือ',2000),status:'OPEN',maker:actor.id,at:now,evidence:command.evidence});
  }else if(command.type==='LEGAL_ANSWER'){
   allow('legal');const t=state.legal.find(t=>t.id===command.ticketId&&t.caseId===c.id&&t.status==='OPEN');check(t,'ไม่พบเรื่องกฎหมายที่รอตอบ');check(t.maker!==actor.id,'ผู้ขอและผู้ตอบต้องต่างกัน');t.answer=text(command.answer,'ความเห็น',2000);t.status='ANSWERED';t.reviewer=actor.id;t.answeredAt=now;t.answerEvidence=command.evidence;
  }else throw new Error('ไม่รู้จักคำสั่ง');
  c.history.push({action:command.type,actor:actor.id,at:now,evidence:command.evidence,reason:'reason' in command?command.reason:undefined});
 }
 state.revision++;return {data,target};
}
