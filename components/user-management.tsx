"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Search, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSystemActivity } from "@/components/system-activity";
import type { DemoUser } from "@/lib/users.mjs";

type UserRole = "ADMIN" | "WAREHOUSE" | "WARD" | "AUDITOR";

type ApiUser = {
  id: string;
  staffCode: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  wards: string[];
  createdAt?: string;
};

type FormState = {
  staffCode: string;
  fullName: string;
  role: UserRole;
  password: string;
  wards: string[];
};

type Props = {
  /** @deprecated ข้อมูลจาก API แล้ว — prop นี้คงไว้เพื่อเข้ากันได้กับ app/page.tsx */
  users?: DemoUser[];
  departmentOptions?: { id: string; name: string; status?: string }[];
  actorRole: string;
  editable: boolean;
  switchToAdmin: () => void;
  onChange?: (users: DemoUser[], action: string, staffCode: string) => Promise<boolean>;
};

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "ADMIN", label: "ผู้ดูแลระบบ" },
  { value: "WAREHOUSE", label: "เจ้าหน้าที่คลัง" },
  { value: "WARD", label: "ผู้ใช้ประจำวอร์ด" },
  { value: "AUDITOR", label: "ผู้ตรวจสอบ" },
];

const emptyForm: FormState = { staffCode: "", fullName: "", role: "WARD", password: "", wards: [] };

const roleLabel = (role: string) => roleOptions.find(option => option.value === role)?.label ?? role;

class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function apiRequest<T = Record<string, unknown>>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await response.json().catch(() => ({} as T));
  if (!response.ok) {
    const record = body as { message?: unknown; error?: unknown };
    const message = record?.message ?? record?.error;
    throw new ApiError(
      response.status,
      typeof message === "string" && message ? message : `เกิดข้อผิดพลาด (HTTP ${response.status})`,
    );
  }
  return body as T;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบก่อนจัดการข้อมูลผู้ใช้";
    if (error.status === 403) return "บัญชีนี้ไม่มีสิทธิ์จัดการข้อมูลผู้ใช้";
    if (error.status === 409) return "รหัสบุคลากรนี้ถูกใช้งานแล้ว กรุณาใช้รหัสอื่น";
    return error.message;
  }
  return error instanceof Error && error.message ? error.message : "เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

function toDemoUser(user: ApiUser): DemoUser {
  const today = new Date().toISOString().slice(0, 10);
  return {
    staffCode: user.staffCode,
    fullName: user.fullName,
    position: roleLabel(user.role),
    departmentId: user.wards?.[0] ?? "",
    role: user.role.toLowerCase(),
    authority: "NONE",
    orderRef: "",
    startsOn: user.createdAt ? user.createdAt.slice(0, 10) : today,
    endsOn: "",
    id: user.id,
    code: user.id,
    status: user.active ? "DEMO_ACTIVE" : "SUSPENDED",
    identity: "API_LINKED",
  };
}

export function UserManagement(props: Props) {
  const { departmentOptions = [], actorRole, editable, switchToAdmin, onChange } = props;
  const canManage = editable && actorRole === "admin";
  const activity = useSystemActivity();

  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState("");
  const [modal, setModal] = useState<null | "create" | "edit" | "password">(null);
  const [selected, setSelected] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const load = useCallback(async () => {
    const data = await apiRequest<{ user?: ApiUser; users?: ApiUser[] }>("/api/users");
    const list = Array.isArray(data?.users) ? data.users : data?.user ? [data.user] : [];
    setUsers(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await load();
      } catch (err) {
        setUsers([]);
        setError(toErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) return users;
    return users.filter(user =>
      [user.staffCode, user.fullName, roleLabel(user.role)].join(" ").toLowerCase().includes(query),
    );
  }, [users, filter]);

  async function afterChange(action: string, staffCode: string, message: string) {
    setModal(null);
    setNotice(message);
    const list = await load();
    if (onChange) void onChange(list.map(toDemoUser), action, staffCode);
    void activity({ action, module: "users", target: staffCode, outcome: "SUCCESS" });
  }

  function toggleWard(id: string) {
    setForm(current => ({
      ...current,
      wards: current.wards.includes(id) ? current.wards.filter(ward => ward !== id) : [...current.wards, id],
    }));
  }

  function openCreate() {
    setSelected(null);
    setForm(emptyForm);
    setModal("create");
    setError("");
    setNotice("");
  }

  function openEdit(user: ApiUser) {
    setSelected(user);
    setForm({
      staffCode: user.staffCode,
      fullName: user.fullName,
      role: user.role,
      password: "",
      wards: user.wards ?? [],
    });
    setModal("edit");
    setError("");
    setNotice("");
  }

  function openPassword(user: ApiUser) {
    setSelected(user);
    setForm({ ...emptyForm, staffCode: user.staffCode, fullName: user.fullName });
    setModal("password");
    setError("");
    setNotice("");
  }

  async function createUser() {
    if (!form.staffCode.trim() || !form.fullName.trim()) {
      setError("กรุณากรอกรหัสบุคลากรและชื่อ-นามสกุลให้ครบ");
      return;
    }
    if (form.password.length < 8) {
      setError("รหัสผ่านต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify({
          staffCode: form.staffCode.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
          password: form.password,
          wards: form.wards,
        }),
      });
      await afterChange("USER_CREATED", form.staffCode.trim(), "เพิ่มผู้ใช้ใหม่แล้ว");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function updateUser() {
    if (!selected) return;
    if (!form.fullName.trim()) {
      setError("กรุณากรอกชื่อ-นามสกุล");
      return;
    }
    if (form.password && form.password.length < 8) {
      setError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/users/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          role: form.role,
          wards: form.wards,
        }),
      });
      if (form.password) {
        await apiRequest(`/api/users/${selected.id}/password`, {
          method: "PUT",
          body: JSON.stringify({ password: form.password }),
        });
      }
      await afterChange("USER_UPDATED", selected.staffCode, "บันทึกการแก้ไขผู้ใช้แล้ว");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(user: ApiUser) {
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !user.active }),
      });
      await afterChange(
        user.active ? "USER_SUSPENDED" : "USER_REACTIVATED",
        user.staffCode,
        user.active ? `ระงับผู้ใช้ ${user.fullName} แล้ว` : `เปิดใช้งานผู้ใช้ ${user.fullName} แล้ว`,
      );
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (!selected) return;
    if (form.password.length < 8) {
      setError("รหัสผ่านใหม่ต้องยาวอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await apiRequest(`/api/users/${selected.id}/password`, {
        method: "PUT",
        body: JSON.stringify({ password: form.password }),
      });
      await afterChange("USER_PASSWORD_RESET", selected.staffCode, "เปลี่ยนรหัสผ่านผู้ใช้แล้ว");
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (modal === "create") await createUser();
    else if (modal === "edit") await updateUser();
    else if (modal === "password") await resetPassword();
  }

  if (!canManage) {
    return (
      <section className="users-section">
        <div className="users-summary">
          <div>
            <h2>จัดการผู้ใช้งาน</h2>
            <p>บทบาทปัจจุบันมีสิทธิ์ดูรายการผู้ใช้เท่านั้น การเพิ่ม แก้ไข หรือระงับต้องทำโดยผู้ดูแลระบบ</p>
          </div>
          <Button variant="secondary" onClick={switchToAdmin}>
            <ShieldCheck size={16} /> เปลี่ยนเป็น Admin
          </Button>
        </div>
        <div className="users-access">
          <span>ดูข้อมูลผู้ใช้ได้เท่านั้น</span>
          <Check size={16} />
        </div>
      </section>
    );
  }

  return (
    <section className="users-section">
      <div className="users-summary">
        <div>
          <h2>จัดการผู้ใช้งาน</h2>
          <p>เพิ่ม แก้ไข ระงับผู้ใช้ และเปลี่ยนรหัสผ่านผ่าน API ของระบบ — รหัสผ่านถูกเก็บแบบ hash เท่านั้น</p>
        </div>
        <Button onClick={openCreate} disabled={busy}>
          <UserPlus size={16} /> เพิ่มผู้ใช้
        </Button>
      </div>

      <div className="users-access">
        <span>สิทธิ์ตามบทบาท: ADMIN จัดการผู้ใช้ | WAREHOUSE / WARD / AUDITOR เข้าถึงตามหน้าที่</span>
        <span>{loading ? "กำลังโหลด…" : `${filtered.length} จาก ${users.length} ราย`}</span>
      </div>

      {notice && <p className="users-message">{notice}</p>}
      {error && <p className="users-error">{error}</p>}

      <div className="users-workspace">
        <div className="search-wrapper">
          <Search size={15} />
          <input value={filter} onChange={event => setFilter(event.target.value)} placeholder="ค้นหารหัสบุคลากร ชื่อ หรือบทบาท" />
        </div>
        <div className="users-table">
          <table>
            <thead>
              <tr>
                <th>ผู้ใช้งาน</th>
                <th>บทบาท</th>
                <th>หน่วยงาน/วอร์ด</th>
                <th>สถานะ</th>
                <th className="users-row-actions">การจัดการ</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5}>กำลังโหลดข้อมูลผู้ใช้…</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    {error ? "โหลดข้อมูลไม่สำเร็จ — แก้ไขข้อความแล้วรีเฟรชหน้า" : "ยังไม่มีข้อมูลผู้ใช้ — เริ่มจากเพิ่มผู้ใช้ใหม่"}
                  </td>
                </tr>
              )}
              {filtered.map(user => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName}</strong>
                    <span className="users-order">{user.staffCode}</span>
                  </td>
                  <td>{roleLabel(user.role)}</td>
                  <td>{user.wards?.length ? user.wards.join(", ") : "—"}</td>
                  <td>
                    <span className={`pill ${user.active ? "pill-success" : "pill-danger"}`}>
                      <span className={`dot ${user.active ? "dot-success" : "dot-danger"}`} />
                      {user.active ? "ใช้งาน" : "ระงับ"}
                    </span>
                  </td>
                  <td className="users-row-actions">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(user)} disabled={busy}>แก้ไข</Button>
                    <Button variant="ghost" size="sm" onClick={() => openPassword(user)} disabled={busy}>เปลี่ยนรหัสผ่าน</Button>
                    <Button variant="ghost" size="sm" onClick={() => void toggleActive(user)} disabled={busy}>
                      {user.active ? "ระงับ" : "เปิดใช้งาน"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="users-policy">
        <ShieldCheck size={18} />
        <p>
          ทุกการเปลี่ยนแปลงตรวจสอบตัวตนผ่าน API และบันทึกลำดับเหตุการณ์ — รหัสผ่านถูกเก็บแบบ hash (scrypt)
          ระบบจะไม่แสดงรหัสผ่านเดิม และผู้ใช้ที่ถูกระงับจะเข้าใช้งานระบบไม่ได้ทันที
        </p>
      </div>

      {modal && (
        <dialog className="users-dialog" open onKeyDown={event => { if (event.key === "Escape") setModal(null); }}>
          <form className="modal-body" onSubmit={event => { event.preventDefault(); void save(); }}>
            <div className="users-identity">
              <ShieldCheck size={18} />
              <div>
                <strong>
                  {modal === "create"
                    ? "สร้างบัญชีผู้ใช้ใหม่"
                    : modal === "edit"
                      ? `แก้ไขข้อมูลผู้ใช้${selected ? `: ${selected.fullName}` : ""}`
                      : `เปลี่ยนรหัสผ่าน${selected ? `: ${selected.fullName}` : ""}`}
                </strong>
                <p style={{ margin: "4px 0 0" }}>
                  รหัสผ่านถูกเก็บแบบ hash (scrypt) บนเซิร์ฟเวอร์เท่านั้น — ระบบจะไม่แสดงรหัสผ่านเดิม
                </p>
              </div>
            </div>

            {modal !== "password" && (
              <div className="form-grid">
                <label className="form-field">
                  <span>รหัสบุคลากร * (staffCode)</span>
                  <input
                    value={form.staffCode}
                    onChange={event => setForm(current => ({ ...current, staffCode: event.target.value }))}
                    disabled={modal === "edit"}
                    placeholder="เช่น STAFF-0001"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>ชื่อ-นามสกุล *</span>
                  <input
                    value={form.fullName}
                    onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))}
                    placeholder="ชื่อจริง ตามเอกสาร"
                    required
                  />
                </label>
                <label className="form-field">
                  <span>บทบาท *</span>
                  <select value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as UserRole }))}>
                    {roleOptions.map(option => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                {modal === "edit" && (
                  <label className="form-field">
                    <span>รหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</span>
                    <input
                      type="password"
                      value={form.password}
                      onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                      placeholder="อย่างน้อย 8 ตัวอักษร"
                    />
                  </label>
                )}
              </div>
            )}

            {(modal === "create" || modal === "password") && (
              <div className="form-grid">
                <label className="form-field">
                  <span>รหัสผ่าน * (อย่างน้อย 8 ตัวอักษร)</span>
                  <input
                    type="password"
                    value={form.password}
                    onChange={event => setForm(current => ({ ...current, password: event.target.value }))}
                    placeholder="เช่น Aa123456!"
                    required
                  />
                </label>
              </div>
            )}

            {modal !== "password" && (
              <div className="form-field" style={{ marginTop: 12 }}>
                <span>หน่วยงาน/วอร์ดที่อนุญาต</span>
                <div className="form-grid" style={{ marginTop: 8 }}>
                  {departmentOptions.map(option => (
                    <label key={option.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12 }}>
                      <input type="checkbox" checked={form.wards.includes(option.id)} onChange={() => toggleWard(option.id)} />
                      {option.name}
                    </label>
                  ))}
                  {departmentOptions.length === 0 && <span style={{ fontSize: 12 }}>ยังไม่มีหน่วยงานให้เลือก</span>}
                </div>
              </div>
            )}

            <div className="modal-footer" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
              <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={busy}>ยกเลิก</Button>
              <Button type="submit" disabled={busy}>
                {busy
                  ? "กำลังบันทึก…"
                  : modal === "create"
                    ? "สร้างผู้ใช้"
                    : modal === "edit"
                      ? "บันทึกการแก้ไข"
                      : "เปลี่ยนรหัสผ่าน"}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </section>
  );
}

export default UserManagement;