"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, ShieldCheck, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createDemoUsers, saveDemoUser, toggleDemoUser, userRoleOptions, type DemoUser, type UserDraft } from "@/lib/users.mjs";
import { wards } from "@/lib/seed";

const departments = [...wards, { id:"PLAN",name:"กลุ่มงานยุทธศาสตร์" }, { id:"PROC",name:"งานพัสดุ" }, { id:"FIN",name:"งานการเงิน" }, { id:"ACC",name:"งานบัญชี" }, { id:"IT",name:"งานเทคโนโลยีสารสนเทศ" }];
const roleName = (role: string) => userRoleOptions.find(r => r[0] === role)?.[1] ?? role;
const statusName = (status: string) => status === "SUSPENDED" ? "ระงับ" : status === "DEMO_ACTIVE" ? "ใช้งานจำลอง" : "รอยืนยันตัวตน";
const blank = (): UserDraft => ({ staffCode:"", fullName:"", position:"", departmentId:"ICU", role:"nurse", authority:"NONE", orderRef:"", startsOn: new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Bangkok",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()), endsOn:"" });

type Props = {
  users?: DemoUser[];
  actorRole: string;
  editable: boolean;
  switchToAdmin: () => void;
  onChange: (users: DemoUser[], action: string, staffCode: string) => Promise<boolean>;
};

export function UserManagement({ users, actorRole, editable, switchToAdmin, onChange }: Props) {
  const [seed] = useState(createDemoUsers);
  const records = users ?? seed;
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<UserDraft | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const pending = useRef(false);
  const canManage = actorRole === "admin" && editable && !saving;
  const filtered = records.filter(u => `${u.fullName} ${u.staffCode} ${u.position} ${roleName(u.role)}`.toLowerCase().includes(search.toLowerCase()));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!draft || !canManage || pending.current) return;
    pending.current = true; setSaving(true); setError("");
    try {
      const next = saveDemoUser(records,draft,{ actorRole, allowedDepartments:departments.map(d=>d.id),newId:crypto.randomUUID() });
      if (await onChange(next,draft.id ? "USER_DEMO_UPDATED" : "USER_DEMO_ADDED",draft.staffCode.toUpperCase())) {
        setDraft(null); setMessage("บันทึกผู้ใช้จำลองแล้ว · ยังไม่ได้สร้างบัญชีจริงหรือส่งคำเชิญ");
      } else setError("บันทึกไม่สำเร็จ กรุณาตรวจสิทธิ์และการจัดเก็บข้อมูลในเครื่อง");
    } catch(e) { setError(e instanceof Error ? e.message : "ข้อมูลไม่ถูกต้อง"); }
    finally { pending.current=false; setSaving(false); }
  }
  async function toggle(user: DemoUser) {
    if (!canManage || pending.current) return;
    pending.current=true; setSaving(true); setMessage(""); setError("");
    try {
      const next=toggleDemoUser(records,user.id,actorRole);
      if (await onChange(next,"USER_DEMO_STATUS_CHANGED",user.staffCode)) setMessage("เปลี่ยนสถานะผู้ใช้จำลองแล้ว · ไม่กระทบบัญชีหรือสิทธิ์จริง");
    } catch(e) { setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ"); }
    finally {pending.current=false;setSaving(false);}
  }
  function open(user?: DemoUser) { setError("");setMessage("");setDraft(user ? {...user} : blank()); }

  return <section className="users-workspace">
    <div className="demo-banner"><ShieldCheck size={17}/><span><strong>ทะเบียนผู้ใช้จำลอง</strong> เก็บเฉพาะในเบราว์เซอร์ ไม่สร้างบัญชีจริง ไม่ส่งอีเมล และยังไม่ผูก Provider ID กรุณาใช้ข้อมูลสมมติ</span></div>
    <div className="users-summary"><div><h2>บุคลากรและสิทธิ์การใช้งาน</h2><p className="muted">แยกหน่วยงาน ตำแหน่ง บทบาทในระบบ และอำนาจตามคำสั่ง</p></div><Button disabled={!canManage} onClick={()=>open()}><Plus size={16}/>เพิ่มผู้ใช้งาน</Button></div>
    {actorRole !== "admin" && <div className="users-access"><span>การเพิ่มและแก้ไขจำกัดเฉพาะมุมมองผู้ดูแลระบบจำลอง</span><Button variant="secondary" size="sm" onClick={switchToAdmin}>ทดลองมุมมองผู้ดูแลระบบ</Button></div>}
    <div className="toolbar"><label className="search-wrapper"><Search size={16}/><input aria-label="ค้นหาผู้ใช้งาน" className="search-input" value={search} onChange={e=>setSearch(e.target.value)} placeholder="ค้นหาชื่อ รหัสบุคลากร หรือตำแหน่ง"/></label><span className="badge neutral">{filtered.length} คน · ข้อมูลจำลอง</span></div>
    {message && <p className="users-message" role="status">{message}</p>}{error && !draft && <p className="users-error" role="alert">{error}</p>}
    <div className="panel"><div className="table-wrap"><table className="data-table"><thead><tr><th>บุคลากร</th><th>ตำแหน่ง</th><th>หน่วยงาน</th><th>บทบาทในระบบ</th><th>อำนาจอนุมัติ</th><th>สถานะ</th><th>จัดการ</th></tr></thead><tbody>{filtered.map(user=><tr key={user.id}><td><div className="asset-name"><span className="asset-icon"><UserRound size={16}/></span><span>{user.fullName}<small>{user.staffCode}</small></span></div></td><td>{user.position}</td><td>{departments.find(d=>d.id===user.departmentId)?.name ?? user.departmentId}</td><td><span className="badge info">{roleName(user.role)}</span></td><td>{user.authority === "DOCUMENTED" ? <><span className="badge warning">รอตรวจคำสั่ง</span><small className="users-order">{user.orderRef}</small></> : "ไม่มีอำนาจจากตำแหน่ง"}</td><td><span className={`badge ${user.status === "SUSPENDED" ? "danger" : user.status === "DEMO_ACTIVE" ? "info" : "warning"}`}>{statusName(user.status)}</span></td><td><div className="users-row-actions"><Button variant="secondary" size="sm" disabled={!canManage} aria-label={`แก้ไข ${user.staffCode}`} onClick={()=>open(user)}><Pencil size={13}/>แก้ไข</Button><Button variant="ghost" size="sm" disabled={!canManage} onClick={()=>toggle(user)} aria-label={`${user.status === "SUSPENDED" ? "คืนสถานะ" : "ระงับ"} ${user.staffCode}`}>{user.status === "SUSPENDED" ? "คืนสถานะ" : "ระงับ"}</Button></div></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state">ไม่พบผู้ใช้ตามคำค้น</div>}</div></div>
    <div className="users-policy"><ShieldCheck size={18}/><p><strong>ตำแหน่งไม่ให้สิทธิ์อนุมัติโดยอัตโนมัติ</strong><br/>ข้อมูลคำสั่งในหน้านี้เป็นร่างสาธิต ระบบจริงต้องตรวจผู้มีอำนาจ วงเงิน เรื่องที่แต่งตั้ง และวันที่มีผลจากเซิร์ฟเวอร์ ผู้ดูแลระบบไม่มีอำนาจอนุมัติจัดซื้อเพียงเพราะดูแลบัญชีผู้ใช้</p></div>
    {draft && <UserDialog title={draft.id ? "แก้ไขผู้ใช้งานจำลอง" : "เพิ่มผู้ใช้งานจำลอง"} close={()=>{if(!saving)setDraft(null);}}>
      <form onSubmit={submit}>
        <div className="modal-body"><p className="muted">กรอกข้อมูลสมมติเท่านั้น · เครื่องหมาย * คือข้อมูลที่จำเป็น</p>
          <div className="form-grid"><label className="form-field">รหัสบุคลากร *<input required maxLength={40} value={draft.staffCode} onChange={e=>setDraft({...draft,staffCode:e.target.value})} placeholder="เช่น DEMO-003"/></label><label className="form-field">ชื่อ–นามสกุล *<input required maxLength={120} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})} placeholder="บุคลากรตัวอย่าง"/></label></div>
          <label className="form-field">ตำแหน่ง *<input required maxLength={120} list="user-position-options" value={draft.position} onChange={e=>setDraft({...draft,position:e.target.value})} placeholder="เช่น พยาบาลวิชาชีพ"/><datalist id="user-position-options">{["พยาบาลวิชาชีพ","นักวิชาการพัสดุ","เจ้าพนักงานการเงินและบัญชี","นักวิชาการคอมพิวเตอร์","ผู้อำนวยการโรงพยาบาล"].map(p=><option key={p} value={p}/>)}</datalist></label>
          <div className="form-grid"><label className="form-field">หน่วยงาน *<select value={draft.departmentId} onChange={e=>setDraft({...draft,departmentId:e.target.value})}>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></label><label className="form-field">บทบาทในระบบ *<select value={draft.role} onChange={e=>setDraft({...draft,role:e.target.value})}>{userRoleOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label></div>
          <div className="form-grid"><label className="form-field">วันที่เริ่มสิทธิ์ *<input type="date" required value={draft.startsOn} onChange={e=>setDraft({...draft,startsOn:e.target.value})}/></label><label className="form-field">วันที่สิ้นสุดสิทธิ์<input type="date" min={draft.startsOn} value={draft.endsOn} onChange={e=>setDraft({...draft,endsOn:e.target.value})}/></label></div>
          <label className="form-field">อำนาจตามคำสั่ง<select value={draft.authority} onChange={e=>setDraft({...draft,authority:e.target.value})}><option value="NONE">ไม่มีอำนาจอนุมัติ</option><option value="DOCUMENTED">มีคำสั่ง — รอตรวจสอบ</option></select></label>
          <label className="form-field">เลขคำสั่งแต่งตั้ง/มอบอำนาจ{draft.authority === "DOCUMENTED" || ["approver","committee"].includes(draft.role) ? " *" : ""}<input required={draft.authority === "DOCUMENTED" || ["approver","committee"].includes(draft.role)} maxLength={160} value={draft.orderRef} onChange={e=>setDraft({...draft,orderRef:e.target.value})} placeholder="เลขคำสั่งตัวอย่าง / เรื่องที่แต่งตั้ง"/></label>
          <div className="users-identity"><ShieldCheck size={17}/><span>การยืนยันตัวตน: <strong>ยังไม่เชื่อม Provider ID</strong><br/>ผู้ใช้ใหม่อยู่สถานะรอยืนยัน ไม่กำหนดรหัสผ่านและไม่เปิดสิทธิ์จริงจากแบบฟอร์มนี้</span></div>
          {error && <p className="users-error" role="alert">{error}</p>}
        </div><div className="modal-footer"><Button variant="secondary" type="button" disabled={saving} onClick={()=>setDraft(null)}>ยกเลิก</Button><Button type="submit" disabled={!canManage}>{saving ? "กำลังบันทึก…" : "บันทึกผู้ใช้จำลอง"}</Button></div>
      </form>
    </UserDialog>}
  </section>;
}

function UserDialog({title,children,close}:{title:string;children:React.ReactNode;close:()=>void}) {
  const ref=useRef<HTMLDialogElement>(null);
  const closeRef=useRef(close); closeRef.current=close;
  useEffect(()=>{const previous=document.activeElement as HTMLElement;ref.current?.showModal();return()=>{ref.current?.close();previous?.focus();};},[]);
  return <dialog ref={ref} className="modal users-dialog" aria-label={title} onCancel={event=>{event.preventDefault();closeRef.current();}}><div className="modal-header"><h2>{title}</h2><Button variant="ghost" type="button" size="icon" aria-label="ปิดหน้าต่างผู้ใช้" onClick={close}><X size={18}/></Button></div>{children}</dialog>;
}
